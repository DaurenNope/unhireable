import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resumeAnalyzerApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { FileText, User, Briefcase, GraduationCap, Code, Lightbulb, TrendingUp, CheckCircle2, AlertCircle, Upload, RefreshCw, } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    try {
        return JSON.stringify(error);
    }
    catch {
        return 'Unknown error';
    }
}
const formSchema = z.object({
    pdfPath: z.string().trim().min(1, 'PDF path is required'),
    jobTitle: z.string().max(120, 'Job title is too long').optional(),
    jobDescription: z.string().max(5000, 'Job description is too long').optional(),
});
export function ResumeAnalyzer() {
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            pdfPath: '',
            jobTitle: '',
            jobDescription: '',
        },
    });
    const [analysis, setAnalysis] = useState(null);
    const { errors } = form.formState;
    const noTextExtracted = analysis ? analysis.raw_text.trim().length === 0 : false;
    const atsBreakdown = analysis?.insights?.ats_breakdown ?? [];
    const hrSignals = analysis?.insights?.hr_signals ?? [];
    const keywordGaps = analysis?.insights?.keyword_gaps ?? [];
    const jobAlignment = analysis?.insights?.job_alignment;
    const pdfPathValue = form.watch('pdfPath') || '';
    const { data: dependencyStatus, isLoading: dependencyLoading, refetch: refetchDependencies, } = useQuery({
        queryKey: ['resume-env-status'],
        queryFn: () => resumeAnalyzerApi.environmentStatus(),
        staleTime: 5 * 60 * 1000,
    });
    const dependencyChecks = [
        {
            key: 'pdftotext',
            label: 'Poppler (pdftotext)',
            description: 'Text extraction fallback',
            available: dependencyStatus?.pdftotext_available ?? null,
        },
        {
            key: 'pdftoppm',
            label: 'Poppler (pdftoppm)',
            description: 'Page rendering for OCR',
            available: dependencyStatus?.pdftoppm_available ?? null,
        },
        {
            key: 'tesseract',
            label: 'Tesseract OCR',
            description: 'Scanned PDF support',
            available: dependencyStatus?.tesseract_available ?? null,
        },
    ];
    const missingDependencies = dependencyChecks.filter((dep) => dep.available === false);
    const signalBadgeClasses = {
        positive: 'bg-green-50 text-green-700 border border-green-100',
        warning: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
        critical: 'bg-red-50 text-red-700 border border-red-100',
    };
    const formatPercent = (value, decimals = 0) => {
        if (value === undefined || value === null || Number.isNaN(value)) {
            return 'N/A';
        }
        return `${(value * 100).toFixed(decimals)}%`;
    };
    const analyzeMutation = useMutation({
        mutationFn: (payload) => resumeAnalyzerApi.analyze(payload.pdfPath, payload.jobTarget),
        onSuccess: (data) => {
            setAnalysis(data);
            toast({
                title: 'Resume analyzed successfully',
                description: 'Your resume has been analyzed and insights are ready.',
            });
        },
        onError: (error) => {
            toast({
                title: 'Analysis failed',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        },
    });
    const handleAnalyze = form.handleSubmit((values) => {
        const trimmedPath = values.pdfPath.trim();
        const title = values.jobTitle?.trim() ?? '';
        const description = values.jobDescription?.trim() ?? '';
        const hasJobContext = title.length > 0 || description.length > 0;
        const jobTarget = hasJobContext
            ? {
                title: title || undefined,
                description: description || undefined,
            }
            : undefined;
        analyzeMutation.mutate({
            pdfPath: trimmedPath,
            jobTarget,
        });
    });
    const handleSelectFile = async () => {
        try {
            if (typeof window === 'undefined') {
                toast({
                    title: 'File dialog unavailable',
                    description: 'Please enter the file path manually when running outside the Tauri shell.',
                    variant: 'destructive',
                });
                return;
            }
            const tauriDialog = window.__TAURI__?.dialog;
            if (!tauriDialog?.open) {
                toast({
                    title: 'File dialog unavailable',
                    description: 'Tauri dialog API is not accessible. Please enter the file path manually.',
                    variant: 'destructive',
                });
                return;
            }
            const selected = await tauriDialog.open({
                multiple: false,
                filters: [{ name: 'PDF', extensions: ['pdf'] }],
            });
            const picked = typeof selected === 'string'
                ? selected
                : Array.isArray(selected) && selected.length > 0
                    ? selected[0]
                    : null;
            if (picked) {
                form.setValue('pdfPath', picked, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                });
            }
        }
        catch (error) {
            toast({
                title: 'Failed to open file dialog',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        }
    };
    return (_jsxs("div", { className: "container mx-auto py-8 space-y-6", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold", children: "Resume Analyzer" }), _jsx("p", { className: "text-muted-foreground mt-2", children: "Upload and analyze your resume to get insights and recommendations" })] }) }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Upload Resume" }), _jsx(CardDescription, { children: "Enter the path to your PDF resume file to analyze it" })] }), _jsx(CardContent, { className: "space-y-4", children: _jsxs("form", { onSubmit: handleAnalyze, className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex flex-col gap-2 md:flex-row", children: [_jsx("input", { type: "text", placeholder: "/path/to/resume.pdf", className: "flex-1 px-3 py-2 border rounded-md", "aria-invalid": errors.pdfPath ? 'true' : 'false', ...form.register('pdfPath') }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { onClick: handleSelectFile, variant: "outline", type: "button", children: [_jsx(Upload, { className: "h-4 w-4 mr-2" }), "Select File"] }), _jsx(Button, { type: "submit", disabled: analyzeMutation.isPending || !pdfPathValue.trim(), children: analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Resume' })] })] }), errors.pdfPath && (_jsx("p", { className: "text-sm text-destructive", children: errors.pdfPath.message }))] }), pdfPathValue && (_jsxs("p", { className: "text-sm text-muted-foreground", children: ["Current path: ", _jsx("code", { className: "bg-muted px-1 rounded", children: pdfPathValue })] }))] }) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Target Job (optional)" }), _jsx(CardDescription, { children: "Paste the job title and description you want to tailor this resume toward." })] }), _jsxs(CardContent, { className: "space-y-3", children: [_jsx("input", { type: "text", placeholder: "e.g., Senior Platform Engineer at AstroCorp", className: "w-full px-3 py-2 border rounded-md", "aria-invalid": errors.jobTitle ? 'true' : 'false', ...form.register('jobTitle') }), errors.jobTitle && (_jsx("p", { className: "text-sm text-destructive", children: errors.jobTitle.message })), _jsx("textarea", { placeholder: "Paste the job description here to get exact keyword gaps...", rows: 6, className: "w-full px-3 py-2 border rounded-md", "aria-invalid": errors.jobDescription ? 'true' : 'false', ...form.register('jobDescription') }), errors.jobDescription && (_jsx("p", { className: "text-sm text-destructive", children: errors.jobDescription.message }))] })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Tip: For scanned/image-based PDFs you'll need OCR helpers installed. The checker below keeps tabs on Tesseract and Poppler so you know when fallbacks are ready." }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "Local prerequisites" }), _jsx(CardDescription, { children: "We look for Poppler utilities and Tesseract automatically." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("div", { className: "grid gap-3 md:grid-cols-3", children: dependencyChecks.map((dep) => (_jsxs("div", { className: "rounded-xl border bg-muted/30 p-3", "aria-live": "polite", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-medium text-foreground", children: dep.label }), _jsx(Badge, { className: dep.available === null
                                                        ? 'bg-muted text-muted-foreground'
                                                        : dep.available
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-red-50 text-red-700 border border-red-200', children: dep.available === null
                                                        ? 'Checking'
                                                        : dep.available
                                                            ? 'Ready'
                                                            : 'Missing' })] }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: dep.description })] }, dep.key))) }), missingDependencies.length > 0 && (_jsxs(Alert, { variant: "warning", children: [_jsx(AlertTitle, { children: "Install dependencies" }), _jsxs(AlertDescription, { children: ["Run ", _jsx("code", { className: "bg-muted px-1 rounded", children: "brew install poppler tesseract" }), " (or use your package manager) to unlock OCR fallbacks."] })] })), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => refetchDependencies(), disabled: dependencyLoading, className: "gap-2", children: [_jsx(RefreshCw, { className: `h-4 w-4 ${dependencyLoading ? 'animate-spin text-muted-foreground' : 'text-muted-foreground'}` }), dependencyLoading ? 'Re-checking...' : 'Re-check'] }) })] })] }), analysis && (_jsxs(Tabs, { defaultValue: "overview", className: "space-y-4", children: [noTextExtracted && (_jsxs(Alert, { variant: "warning", children: [_jsx(AlertTitle, { children: "No text detected" }), _jsx(AlertDescription, { children: "We couldn't extract text from this PDF. Make sure the file contains selectable text or install the OCR prerequisites (Tesseract + Poppler) and try again." })] })), _jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "overview", children: "Overview" }), _jsx(TabsTrigger, { value: "personal", children: "Personal Info" }), _jsx(TabsTrigger, { value: "experience", children: "Experience" }), _jsx(TabsTrigger, { value: "skills", children: "Skills" }), _jsx(TabsTrigger, { value: "insights", children: "Insights" })] }), _jsxs(TabsContent, { value: "overview", className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "ATS Score" }), _jsx(TrendingUp, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: analysis.insights.ats_score?.toFixed(0) ?? 'N/A' }), _jsx("p", { className: "text-xs text-muted-foreground", children: "out of 100" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Experience" }), _jsx(Briefcase, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: analysis.insights.total_years_experience?.toFixed(1) ?? 'N/A' }), _jsx("p", { className: "text-xs text-muted-foreground", children: "years" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Skills" }), _jsx(Code, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: analysis.skills.length }), _jsx("p", { className: "text-xs text-muted-foreground", children: "identified" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Positions" }), _jsx(FileText, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: analysis.experience.length }), _jsx("p", { className: "text-xs text-muted-foreground", children: "work experiences" })] })] })] }), analysis.summary && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Summary" }) }), _jsx(CardContent, { children: _jsx("p", { className: "text-sm", children: analysis.summary }) })] })), atsBreakdown.length > 0 && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "ATS Systems" }), _jsx(CardDescription, { children: "How major ATS engines are expected to score this resume." })] }), _jsx(CardContent, { className: "space-y-4", children: atsBreakdown.map((ats) => (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-sm font-medium", children: [_jsx("span", { children: ats.system }), _jsxs("span", { children: [ats.score.toFixed(0), " / 100"] })] }), _jsx(Progress, { value: ats.score }), _jsx("p", { className: "text-xs text-muted-foreground", children: ats.verdict })] }, ats.system))) })] }))] }), _jsx(TabsContent, { value: "personal", className: "space-y-4", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(User, { className: "h-5 w-5" }), "Personal Information"] }) }), _jsxs(CardContent, { className: "space-y-2", children: [analysis.personal_info.name && (_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Name: " }), _jsx("span", { children: analysis.personal_info.name })] })), analysis.personal_info.email && (_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Email: " }), _jsx("span", { children: analysis.personal_info.email })] })), analysis.personal_info.phone && (_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Phone: " }), _jsx("span", { children: analysis.personal_info.phone })] })), analysis.personal_info.location && (_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Location: " }), _jsx("span", { children: analysis.personal_info.location })] })), analysis.personal_info.linkedin && (_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "LinkedIn: " }), _jsx("a", { href: analysis.personal_info.linkedin, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline", children: analysis.personal_info.linkedin })] })), analysis.personal_info.github && (_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "GitHub: " }), _jsx("a", { href: analysis.personal_info.github, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline", children: analysis.personal_info.github })] })), analysis.personal_info.portfolio && (_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Portfolio: " }), _jsx("a", { href: analysis.personal_info.portfolio, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline", children: analysis.personal_info.portfolio })] }))] })] }) }), _jsxs(TabsContent, { value: "experience", className: "space-y-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Briefcase, { className: "h-5 w-5" }), "Work Experience"] }) }), _jsx(CardContent, { className: "space-y-6", children: analysis.experience.map((exp, idx) => (_jsxs("div", { className: "border-l-2 pl-4 space-y-2", children: [exp.position && (_jsx("h3", { className: "font-semibold text-lg", children: exp.position })), exp.company && (_jsx("p", { className: "text-muted-foreground", children: exp.company })), exp.duration && (_jsx("p", { className: "text-sm text-muted-foreground", children: exp.duration })), exp.description.length > 0 && (_jsx("ul", { className: "list-disc list-inside space-y-1", children: exp.description.map((desc, i) => (_jsx("li", { className: "text-sm", children: desc }, i))) })), exp.technologies.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1", children: exp.technologies.map((tech, i) => (_jsx(Badge, { variant: "secondary", children: tech }, i))) }))] }, idx))) })] }), analysis.education.length > 0 && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(GraduationCap, { className: "h-5 w-5" }), "Education"] }) }), _jsx(CardContent, { className: "space-y-4", children: analysis.education.map((edu, idx) => (_jsxs("div", { className: "space-y-1", children: [edu.degree && (_jsx("h3", { className: "font-semibold", children: edu.degree })), edu.institution && (_jsx("p", { className: "text-muted-foreground", children: edu.institution })), edu.year && (_jsx("p", { className: "text-sm text-muted-foreground", children: edu.year })), edu.details && (_jsx("p", { className: "text-sm", children: edu.details }))] }, idx))) })] }))] }), _jsxs(TabsContent, { value: "skills", className: "space-y-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Code, { className: "h-5 w-5" }), "Skills"] }) }), _jsx(CardContent, { children: _jsx("div", { className: "flex flex-wrap gap-2", children: analysis.skills.map((skill, idx) => (_jsx(Badge, { variant: "default", children: skill }, idx))) }) })] }), analysis.insights.skill_categories.length > 0 && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Skill Categories" }) }), _jsx(CardContent, { children: _jsx("div", { className: "flex flex-wrap gap-2", children: analysis.insights.skill_categories.map((cat, idx) => (_jsx(Badge, { variant: "outline", children: cat }, idx))) }) })] })), analysis.projects.length > 0 && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Projects" }) }), _jsx(CardContent, { className: "space-y-2", children: analysis.projects.map((project, idx) => (_jsx("p", { className: "text-sm", children: project }, idx))) })] }))] }), _jsxs(TabsContent, { value: "insights", className: "space-y-4", children: [analysis.insights.strengths.length > 0 && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(CheckCircle2, { className: "h-5 w-5 text-green-600" }), "Strengths"] }) }), _jsx(CardContent, { children: _jsx("ul", { className: "space-y-2", children: analysis.insights.strengths.map((strength, idx) => (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx(CheckCircle2, { className: "h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" }), _jsx("span", { children: strength })] }, idx))) }) })] })), analysis.insights.recommendations.length > 0 && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Lightbulb, { className: "h-5 w-5 text-yellow-600" }), "Recommendations"] }) }), _jsx(CardContent, { children: _jsx("ul", { className: "space-y-2", children: analysis.insights.recommendations.map((rec, idx) => (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx(AlertCircle, { className: "h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" }), _jsx("span", { children: rec })] }, idx))) }) })] })), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Primary Skills" }) }), _jsx(CardContent, { children: _jsx("div", { className: "flex flex-wrap gap-2", children: analysis.insights.primary_skills.map((skill, idx) => (_jsx(Badge, { variant: "default", children: skill }, idx))) }) })] }), atsBreakdown.length > 0 && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "ATS Emulator" }), _jsx(CardDescription, { children: "How popular ATS engines would parse this resume." })] }), _jsx(CardContent, { className: "space-y-6", children: atsBreakdown.map((ats, idx) => (_jsxs("div", { className: idx < atsBreakdown.length - 1 ? 'pb-4 border-b' : '', children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: ats.system }), _jsx("p", { className: "text-sm text-muted-foreground", children: ats.verdict })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-2xl font-bold", children: ats.score.toFixed(0) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "out of 100" })] })] }), ats.highlights.length > 0 && (_jsxs("div", { className: "mt-3 space-y-1", children: [_jsx("p", { className: "text-xs font-medium text-green-600", children: "Highlights" }), _jsx("ul", { className: "text-sm space-y-1", children: ats.highlights.map((msg, msgIdx) => (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx(CheckCircle2, { className: "h-4 w-4 text-green-600 mt-0.5" }), _jsx("span", { children: msg })] }, msgIdx))) })] })), ats.risks.length > 0 && (_jsxs("div", { className: "mt-3 space-y-1", children: [_jsx("p", { className: "text-xs font-medium text-red-600", children: "Risks" }), _jsx("ul", { className: "text-sm space-y-1", children: ats.risks.map((msg, msgIdx) => (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx(AlertCircle, { className: "h-4 w-4 text-red-600 mt-0.5" }), _jsx("span", { children: msg })] }, msgIdx))) })] }))] }, ats.system))) })] })), hrSignals.length > 0 && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "HR Reviewer Signals" }), _jsx(CardDescription, { children: "Quick checks recruiters run before forwarding a candidate." })] }), _jsx(CardContent, { className: "space-y-4", children: hrSignals.map((signal, idx) => (_jsxs("div", { className: "space-y-1", children: [_jsx(Badge, { className: signalBadgeClasses[signal.status], children: signal.label }), _jsx("p", { className: "text-sm", children: signal.detail })] }, idx))) })] })), keywordGaps.length > 0 && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Keyword Opportunities" }), _jsx(CardDescription, { children: "High-leverage phrases to mirror from job descriptions." })] }), _jsx(CardContent, { className: "space-y-4", children: keywordGaps.map((gap, idx) => (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "font-medium", children: gap.category }), _jsx("div", { className: "flex flex-wrap gap-2", children: gap.missing.map((keyword) => (_jsx(Badge, { variant: "outline", className: "text-xs", children: keyword }, keyword))) })] }, idx))) })] })), jobAlignment && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Role Alignment" }), _jsx(CardDescription, { children: "Where this resume currently shines and what to add next." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs uppercase text-muted-foreground", children: "Target role" }), _jsx("p", { className: "text-lg font-semibold", children: jobAlignment.dominant_role ?? 'Generalist Software Engineer' })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-muted-foreground mb-2", children: "Role confidence" }), _jsx(Progress, { value: (jobAlignment.role_confidence ?? 0) * 100 }), _jsx("p", { className: "text-sm mt-1", children: formatPercent(jobAlignment.role_confidence, 0) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-muted-foreground mb-2", children: "Keyword coverage" }), _jsx(Progress, { value: (jobAlignment.keyword_match ?? 0) * 100 }), _jsx("p", { className: "text-sm mt-1", children: formatPercent(jobAlignment.keyword_match, 0) })] })] }), jobAlignment.matched_keywords.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-muted-foreground mb-2", children: "Matched keywords" }), _jsx("div", { className: "flex flex-wrap gap-2", children: jobAlignment.matched_keywords.map((kw) => (_jsx(Badge, { variant: "secondary", children: kw }, kw))) })] })), jobAlignment.missing_keywords.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-muted-foreground mb-2", children: "Add next" }), _jsx("div", { className: "flex flex-wrap gap-2", children: jobAlignment.missing_keywords.map((kw) => (_jsx(Badge, { variant: "outline", children: kw }, kw))) })] }))] })] }))] })] }))] }));
}

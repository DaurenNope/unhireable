import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Rocket, FileText, ExternalLink, CheckCircle2, User, Loader2, Sparkles, } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyField } from '@/components/ui/copy-field';
import { DocumentGenerator } from '@/components/document-generator';
import { jobApi } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-shell';
import { cn } from '@/lib/utils';
export function ApplicationLaunchpad({ job, userProfile }) {
    const [isMarkingApplied, setIsMarkingApplied] = useState(false);
    const [hasMarkedApplied, setHasMarkedApplied] = useState(job.status === 'applied');
    const [showDocGenerator, setShowDocGenerator] = useState(false);
    const queryClient = useQueryClient();
    const handleOpenApplication = async () => {
        if (!job.url)
            return;
        // Check if we're running in Tauri environment
        const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        if (isTauri) {
            try {
                await open(job.url);
                return;
            }
            catch (err) {
                console.error('Tauri shell.open failed, falling back to window.open:', err);
            }
        }
        // Fallback for browser mode or if Tauri fails
        window.open(job.url, '_blank', 'noopener,noreferrer');
    };
    const handleMarkApplied = async () => {
        if (!job.id)
            return;
        setIsMarkingApplied(true);
        try {
            await jobApi.update({ ...job, status: 'applied' });
            queryClient.invalidateQueries({ queryKey: ['job', job.id] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setHasMarkedApplied(true);
        }
        catch (err) {
            console.error('Failed to mark as applied:', err);
        }
        finally {
            setIsMarkingApplied(false);
        }
    };
    const personalInfo = userProfile?.personal_info;
    // Handle missing profile data gracefully
    if (!personalInfo) {
        return (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "text-center space-y-2", children: [_jsxs("div", { className: "inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-full", children: [_jsx(Rocket, { className: "h-5 w-5" }), _jsx("span", { className: "font-semibold", children: "Application Launchpad" })] }), _jsx("p", { className: "text-muted-foreground text-sm", children: "Please complete your profile in Settings to use the Application Launchpad." })] }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "text-center space-y-2", children: [_jsxs("div", { className: "inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-full", children: [_jsx(Rocket, { className: "h-5 w-5" }), _jsx("span", { className: "font-semibold", children: "Application Launchpad" })] }), _jsx("p", { className: "text-muted-foreground text-sm", children: "Everything you need to apply \u2014 copy your info, generate documents, and go!" })] }), _jsxs(Card, { className: "border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent", children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(User, { className: "h-5 w-5 text-primary" }), "Quick Copy Profile"] }), _jsx(CardDescription, { children: "Click any field to copy to clipboard" })] }), _jsxs(CardContent, { className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(CopyField, { label: "Name", value: personalInfo.name }), _jsx(CopyField, { label: "Email", value: personalInfo.email }), personalInfo.phone && (_jsx(CopyField, { label: "Phone", value: personalInfo.phone })), personalInfo.location && (_jsx(CopyField, { label: "Location", value: personalInfo.location }))] }), (personalInfo.linkedin || personalInfo.github || personalInfo.portfolio) && (_jsxs("div", { className: "pt-3 border-t space-y-3", children: [_jsx("span", { className: "text-sm font-medium text-muted-foreground", children: "Links" }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [personalInfo.linkedin && (_jsx(CopyField, { label: "LinkedIn", value: personalInfo.linkedin })), personalInfo.github && (_jsx(CopyField, { label: "GitHub", value: personalInfo.github })), personalInfo.portfolio && (_jsx(CopyField, { label: "Portfolio", value: personalInfo.portfolio }))] })] }))] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(FileText, { className: "h-5 w-5 text-primary" }), "Application Documents"] }), _jsx(CardDescription, { children: "Generate a tailored resume and cover letter for this position" })] }), _jsx(CardContent, { children: showDocGenerator ? (_jsx(DocumentGenerator, { job: job, userProfile: userProfile, onDocumentGenerated: (doc) => {
                                console.log('Document generated:', doc);
                            } })) : (_jsxs("div", { className: "flex flex-col items-center gap-4 py-6", children: [_jsx("div", { className: "flex items-center gap-3 text-muted-foreground", children: _jsx("div", { className: "p-3 rounded-full bg-muted", children: _jsx(Sparkles, { className: "h-6 w-6" }) }) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-medium", children: "Ready to generate documents?" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Create a tailored resume and cover letter for ", job.company] })] }), _jsxs(Button, { onClick: () => setShowDocGenerator(true), className: "gap-2", children: [_jsx(FileText, { className: "h-4 w-4" }), "Generate Documents"] })] })) })] }), _jsx(Card, { className: "border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent", children: _jsxs(CardContent, { className: "pt-6", children: [_jsxs("div", { className: "flex flex-col gap-4 items-center justify-center", children: [_jsxs(Button, { size: "lg", className: "gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg w-full sm:w-auto animate-pulse", onClick: async () => {
                                        // Sync profile to Chrome extension storage
                                        try {
                                            localStorage.setItem('unhireable_profile', JSON.stringify(userProfile));
                                            console.log('[Unhireable] Profile synced for extension');
                                        }
                                        catch (err) {
                                            console.error('Failed to sync profile:', err);
                                        }
                                        // Open job URL - extension will auto-fill
                                        handleOpenApplication();
                                    }, disabled: !job.url, children: [_jsx(Sparkles, { className: "h-5 w-5" }), "\u26A1 Auto-Apply (Extension)"] }), _jsxs("div", { className: "flex flex-row gap-3 w-full sm:w-auto", children: [_jsxs(Button, { size: "lg", variant: "outline", className: "gap-2 flex-1 sm:flex-none", onClick: handleOpenApplication, disabled: !job.url, children: [_jsx(ExternalLink, { className: "h-5 w-5" }), "Open Page"] }), _jsxs(Button, { size: "lg", variant: hasMarkedApplied ? 'outline' : 'default', className: cn('gap-2 flex-1 sm:flex-none', hasMarkedApplied && 'border-green-500 text-green-600 bg-green-50 hover:bg-green-100'), onClick: handleMarkApplied, disabled: isMarkingApplied || hasMarkedApplied, children: [isMarkingApplied ? (_jsx(Loader2, { className: "h-5 w-5 animate-spin" })) : (_jsx(CheckCircle2, { className: "h-5 w-5" })), hasMarkedApplied ? 'Applied!' : 'Mark Applied'] })] })] }), hasMarkedApplied && (_jsx("p", { className: "text-center text-sm text-green-600 mt-3", children: "\u2713 Application tracked! Good luck! \uD83C\uDF40" }))] }) }), _jsxs("div", { className: "text-center text-sm text-muted-foreground space-y-1", children: [_jsxs("p", { children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "Tip:" }), " Click \"Auto-Apply\" \u2192 Extension auto-fills form \u2192 Review & Submit!"] }), _jsx("p", { children: "\uD83D\uDCE6 Install the Unhireable Chrome Extension for one-click applications." })] })] }));
}

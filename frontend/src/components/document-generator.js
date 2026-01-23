import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Sparkles, Loader2, AlertCircle, FileText, Eye, Package } from 'lucide-react';
import { generatorApi } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
export function DocumentGenerator({ job, userProfile, onDocumentGenerated }) {
    const [documentType, setDocumentType] = useState('cover_letter');
    const [template, setTemplate] = useState('');
    const [improveWithAI, setImproveWithAI] = useState(false);
    const [generatedDocument, setGeneratedDocument] = useState(null);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [error, setError] = useState(null);
    const { data: resumeTemplates = [] } = useQuery({
        queryKey: ['resume-templates'],
        queryFn: () => generatorApi.getResumeTemplates(),
    });
    const { data: coverLetterTemplates = [] } = useQuery({
        queryKey: ['cover-letter-templates'],
        queryFn: () => generatorApi.getCoverLetterTemplates(),
    });
    const templates = documentType === 'resume' ? resumeTemplates : coverLetterTemplates;
    // Auto-select first template when templates are loaded or document type changes
    useEffect(() => {
        if (templates.length > 0 && templates[0]) {
            setTemplate(templates[0]);
        }
        else {
            setTemplate('');
        }
    }, [templates]);
    const handleGenerate = async () => {
        if (!template && templates.length > 0) {
            setError('Please select a template');
            return;
        }
        setIsGenerating(true);
        setError(null);
        setGeneratedDocument(null);
        try {
            let document;
            const templateName = template || templates[0] || undefined;
            switch (documentType) {
                case 'resume':
                    document = await generatorApi.generateResume(userProfile, job.id, templateName, improveWithAI);
                    break;
                case 'cover_letter':
                    document = await generatorApi.generateCoverLetter(userProfile, job.id, templateName, improveWithAI);
                    break;
                case 'email':
                    document = await generatorApi.generateEmailVersion(userProfile, job.id, templateName, improveWithAI);
                    break;
                default:
                    throw new Error('Invalid document type');
            }
            setGeneratedDocument(document);
            onDocumentGenerated?.(document);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate document';
            setError(message);
            console.error('Document generation error:', err);
        }
        finally {
            setIsGenerating(false);
        }
    };
    const handleExportPDF = async () => {
        if (!generatedDocument)
            return;
        try {
            // Generate a default filename
            const sanitizedTitle = job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${sanitizedTitle}_${documentType}.pdf`;
            const filePath = await generatorApi.exportToPDF(generatedDocument, filename);
            alert(`✅ PDF exported successfully!\n\nSaved to: ${filePath}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('Export error:', err);
            alert(`Failed to export PDF: ${message}\n\nCheck the console for details.`);
        }
    };
    const handleExportDOCX = async () => {
        if (!generatedDocument)
            return;
        try {
            // Generate a default filename
            const sanitizedTitle = job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${sanitizedTitle}_${documentType}.docx`;
            const filePath = await generatorApi.exportToDOCX(generatedDocument, filename);
            alert(`✅ DOCX exported successfully!\n\nSaved to: ${filePath}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('Export error:', err);
            alert(`Failed to export DOCX: ${message}\n\nCheck the console for details.`);
        }
    };
    const handlePreviewTemplate = async () => {
        if (!template) {
            setError('Please select a template');
            return;
        }
        setIsPreviewing(true);
        setError(null);
        setPreviewDocument(null);
        try {
            let preview;
            if (documentType === 'resume') {
                preview = await generatorApi.previewResumeTemplate(template);
            }
            else {
                preview = await generatorApi.previewCoverLetterTemplate(template);
            }
            setPreviewDocument(preview);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to preview template';
            setError(message);
            console.error('Preview error:', err);
        }
        finally {
            setIsPreviewing(false);
        }
    };
    const handleBulkExport = async (format) => {
        if (!generatedDocument) {
            alert('Please generate a document first');
            return;
        }
        try {
            const exportedPaths = await generatorApi.bulkExport([generatedDocument], format);
            alert(`✅ ${format.toUpperCase()} exported successfully!\n\nSaved to: ${exportedPaths[0]}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('Bulk export error:', err);
            alert(`Failed to export: ${message}`);
        }
    };
    const renderPreview = () => {
        if (!generatedDocument)
            return null;
        return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "Preview" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Template: ", generatedDocument.metadata.template_used, " \u2022 Words: ", generatedDocument.metadata.word_count] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { onClick: handleExportPDF, variant: "outline", children: [_jsx(Download, { className: "h-4 w-4 mr-2" }), "Export PDF"] }), _jsxs(Button, { onClick: handleExportDOCX, variant: "outline", children: [_jsx(FileText, { className: "h-4 w-4 mr-2" }), "Export DOCX"] }), _jsx(Button, { onClick: () => handleBulkExport('pdf'), variant: "outline", size: "icon", title: "Bulk export PDF", children: _jsx(Package, { className: "h-4 w-4" }) })] })] }), _jsx("div", { className: "border rounded-lg p-6 bg-white dark:bg-gray-900 max-h-[600px] overflow-auto", children: generatedDocument.format === 'HTML' ? (_jsx("div", { dangerouslySetInnerHTML: { __html: generatedDocument.content } })) : (_jsx("pre", { className: "whitespace-pre-wrap font-sans text-sm", children: generatedDocument.content })) })] }));
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Generate Documents" }), _jsx(CardDescription, { children: "Create tailored resume, cover letter, or email for this job" })] }), _jsx(CardContent, { className: "space-y-4", children: _jsxs(Tabs, { value: documentType, onValueChange: (value) => {
                        setDocumentType(value);
                        setGeneratedDocument(null);
                        // Template will be auto-selected by useEffect when templates load
                    }, children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "resume", children: "Resume" }), _jsx(TabsTrigger, { value: "cover_letter", children: "Cover Letter" }), _jsx(TabsTrigger, { value: "email", children: "Email" })] }), _jsx(TabsContent, { value: documentType, className: "space-y-4", children: _jsxs("div", { className: "space-y-4", children: [templates.length > 0 ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "template", children: "Template" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Select, { value: template || templates[0] || '', onValueChange: (value) => {
                                                            setTemplate(value);
                                                            setPreviewDocument(null); // Clear preview when template changes
                                                        }, children: [_jsx(SelectTrigger, { id: "template", className: "flex-1", children: _jsx(SelectValue, { placeholder: "Select a template" }) }), _jsx(SelectContent, { children: templates.map((tpl) => (_jsx(SelectItem, { value: tpl, children: tpl }, tpl))) })] }), _jsx(Button, { onClick: handlePreviewTemplate, disabled: isPreviewing || !template, variant: "outline", size: "icon", title: "Preview template", children: isPreviewing ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin" })) : (_jsx(Eye, { className: "h-4 w-4" })) })] })] })) : (_jsx("div", { className: "text-sm text-muted-foreground p-4 border rounded-lg", children: "Loading available templates..." })), _jsxs("div", { className: "flex items-center justify-between p-4 border rounded-lg", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { htmlFor: "ai-improve", children: "Improve with AI" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Use AI to enhance and tailor the content" })] }), _jsx(Switch, { id: "ai-improve", checked: improveWithAI, onCheckedChange: setImproveWithAI })] }), error && (_jsxs(Alert, { variant: "destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: error })] })), _jsx(Button, { onClick: handleGenerate, disabled: isGenerating || templates.length === 0, className: "w-full", size: "lg", children: isGenerating ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "h-4 w-4 mr-2 animate-spin" }), "Generating..."] })) : (_jsxs(_Fragment, { children: [_jsx(Sparkles, { className: "h-4 w-4 mr-2" }), "Generate ", documentType === 'resume' ? 'Resume' : documentType === 'cover_letter' ? 'Cover Letter' : 'Email'] })) }), previewDocument && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "Template Preview" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Template: ", previewDocument.metadata.template_used, " \u2022 Words: ", previewDocument.metadata.word_count] })] }), _jsx(Button, { onClick: () => setPreviewDocument(null), variant: "ghost", size: "sm", children: "Close Preview" })] }), _jsx("div", { className: "border rounded-lg p-6 bg-white dark:bg-gray-900 max-h-[400px] overflow-auto", children: previewDocument.format === 'HTML' ? (_jsx("div", { dangerouslySetInnerHTML: { __html: previewDocument.content } })) : (_jsx("pre", { className: "whitespace-pre-wrap font-sans text-sm", children: previewDocument.content })) })] })), generatedDocument && renderPreview()] }) })] }) })] }));
}

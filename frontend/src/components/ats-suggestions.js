import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Info, Lightbulb, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
export function AtsSuggestions({ jobUrl }) {
    const [suggestion, setSuggestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!jobUrl) {
            setLoading(false);
            return;
        }
        const fetchSuggestions = async () => {
            try {
                setLoading(true);
                setError(null);
                const result = await api.ats.getSuggestions(jobUrl);
                setSuggestion(result);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load ATS suggestions';
                setError(message);
            }
            finally {
                setLoading(false);
            }
        };
        fetchSuggestions();
    }, [jobUrl]);
    if (loading) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { className: "text-sm font-medium", children: "ATS Information" }) }), _jsx(CardContent, { children: _jsx("div", { className: "text-sm text-muted-foreground", children: "Loading..." }) })] }));
    }
    if (error || !suggestion) {
        return null;
    }
    const getConfidenceColor = (confidence) => {
        switch (confidence) {
            case 'high':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'low':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
        }
    };
    const getAutomationColor = (support) => {
        switch (support) {
            case 'full':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'partial':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            case 'manual':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
        }
    };
    const getAutomationIcon = (support) => {
        switch (support) {
            case 'full':
                return _jsx(Zap, { className: "h-4 w-4" });
            case 'partial':
                return _jsx(AlertCircle, { className: "h-4 w-4" });
            case 'manual':
                return _jsx(AlertTriangle, { className: "h-4 w-4" });
            default:
                return _jsx(Info, { className: "h-4 w-4" });
        }
    };
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "ATS Information" }), _jsx(CardDescription, { className: "mt-1", children: "Application system details and automation tips" })] }), suggestion.ats_type && (_jsx(Badge, { variant: "outline", className: "font-medium", children: suggestion.ats_type }))] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex gap-2 flex-wrap", children: [_jsxs(Badge, { className: cn('text-xs', getConfidenceColor(suggestion.confidence)), children: [suggestion.confidence === 'high' ? 'High' : suggestion.confidence === 'medium' ? 'Medium' : 'Low', " Confidence"] }), _jsxs(Badge, { className: cn('text-xs flex items-center gap-1', getAutomationColor(suggestion.automation_support)), children: [getAutomationIcon(suggestion.automation_support), suggestion.automation_support === 'full' ? 'Full Automation' : suggestion.automation_support === 'partial' ? 'Partial Automation' : 'Manual Review'] })] }), suggestion.tips.length > 0 && (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Lightbulb, { className: "h-4 w-4 text-yellow-600 dark:text-yellow-400" }), _jsx("h4", { className: "text-sm font-semibold", children: "Helpful Tips" })] }), _jsx("ul", { className: "space-y-1.5 text-sm", children: suggestion.tips.map((tip, index) => (_jsxs("li", { className: "flex items-start gap-2 text-muted-foreground", children: [_jsx(CheckCircle2, { className: "h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" }), _jsx("span", { children: tip })] }, index))) })] })), suggestion.known_quirks.length > 0 && (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(AlertTriangle, { className: "h-4 w-4 text-orange-600 dark:text-orange-400" }), _jsx("h4", { className: "text-sm font-semibold", children: "Things to Watch For" })] }), _jsx("ul", { className: "space-y-1.5 text-sm", children: suggestion.known_quirks.map((quirk, index) => (_jsxs("li", { className: "flex items-start gap-2 text-muted-foreground", children: [_jsx(Info, { className: "h-3.5 w-3.5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" }), _jsx("span", { children: quirk })] }, index))) })] })), !suggestion.ats_type && (_jsxs("div", { className: "rounded-lg bg-muted p-3 text-sm text-muted-foreground", children: [_jsx(Info, { className: "h-4 w-4 inline mr-2" }), "This appears to be a custom application form. Review the form structure carefully before automating."] }))] })] }));
}

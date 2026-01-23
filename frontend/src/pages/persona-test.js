import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, User, Play, CheckCircle2, XCircle } from 'lucide-react';
export function PersonaTest() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(null);
    const [personas, setPersonas] = useState([]);
    const [activationResult, setActivationResult] = useState(null);
    const [dryRunResult, setDryRunResult] = useState(null);
    const loadPersonas = async () => {
        setLoading('catalog');
        try {
            const result = await api.persona.listCatalog();
            setPersonas(result);
            toast({
                title: 'Personas loaded',
                description: `Found ${result.length} persona(s)`,
            });
        }
        catch (error) {
            toast({
                title: 'Error',
                description: (error instanceof Error ? error.message : String(error)) || 'Failed to load personas',
                variant: 'destructive',
            });
        }
        finally {
            setLoading(null);
        }
    };
    const loadPersona = async (slug = 'atlas') => {
        setLoading(`load-${slug}`);
        try {
            const result = await api.persona.loadTestPersona(slug);
            setActivationResult(result);
            const displayName = typeof result === 'object' && result !== null && 'display_name' in result
                ? String(result.display_name ?? '')
                : 'Persona';
            toast({
                title: 'Persona loaded',
                description: `${displayName} profile and preferences installed`,
            });
        }
        catch (error) {
            toast({
                title: 'Error',
                description: (error instanceof Error ? error.message : String(error)) || 'Failed to load persona',
                variant: 'destructive',
            });
        }
        finally {
            setLoading(null);
        }
    };
    const runDryRun = async (slug = 'atlas', autoSubmit = true) => {
        setLoading(`dryrun-${slug}`);
        try {
            const result = await api.persona.dryRun(slug, autoSubmit);
            setDryRunResult(result);
            const success = typeof result === 'object' && result !== null && 'success' in result
                ? Boolean(result.success)
                : false;
            const message = typeof result === 'object' && result !== null && 'message' in result
                ? String(result.message ?? '')
                : 'Dry-run completed';
            toast({
                title: success ? 'Dry-run successful' : 'Dry-run completed',
                description: message,
                variant: success ? 'default' : 'destructive',
            });
        }
        catch (error) {
            toast({
                title: 'Error',
                description: (error instanceof Error ? error.message : String(error)) || 'Failed to run dry-run',
                variant: 'destructive',
            });
        }
        finally {
            setLoading(null);
        }
    };
    return (_jsxs("div", { className: "container mx-auto p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold", children: "Persona Testing" }), _jsx("p", { className: "text-muted-foreground mt-2", children: "Load test personas and run automated application dry-runs" })] }), _jsxs("div", { className: "grid gap-6 md:grid-cols-2", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Available Personas" }), _jsx(CardDescription, { children: "List and load test personas" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx(Button, { onClick: loadPersonas, disabled: loading === 'catalog', className: "w-full", children: loading === 'catalog' ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Loading..."] })) : (_jsxs(_Fragment, { children: [_jsx(User, { className: "mr-2 h-4 w-4" }), "List Personas"] })) }), personas.length > 0 && (_jsx("div", { className: "space-y-2", children: personas.map((persona) => (_jsxs("div", { className: "p-3 border rounded-lg space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold", children: persona.display_name }), _jsx("p", { className: "text-sm text-muted-foreground", children: persona.target_role })] }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => loadPersona(persona.slug), disabled: loading?.startsWith('load-'), children: loading === `load-${persona.slug}` ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin" })) : ('Load') })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: persona.description })] }, persona.slug))) }))] })] }), activationResult && typeof activationResult === 'object' && activationResult !== null && 'display_name' in activationResult && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Persona Activated" }), _jsx(CardDescription, { children: String(activationResult.display_name) })] }), _jsxs(CardContent, { className: "space-y-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Resume:" }), ' ', _jsx("span", { className: "text-muted-foreground", children: String(activationResult.resume_path ?? '') })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Cover Letter:" }), ' ', _jsx("span", { className: "text-muted-foreground", children: String(activationResult.cover_letter_path ?? '') })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Saved Search:" }), ' ', _jsxs("span", { className: "text-muted-foreground", children: [String(activationResult.saved_search_name ?? ''), " (ID: ", String(activationResult.saved_search_id ?? ''), ")"] })] })] })] })), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Dry Run Test" }), _jsx(CardDescription, { children: "Test automated application flow" })] }), _jsx(CardContent, { className: "space-y-4", children: _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: () => runDryRun('atlas', true), disabled: loading?.startsWith('dryrun-'), className: "flex-1", children: loading === 'dryrun-atlas' ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Running..."] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { className: "mr-2 h-4 w-4" }), "Run Dry-Run (Auto-Submit)"] })) }), _jsx(Button, { onClick: () => runDryRun('atlas', false), disabled: loading?.startsWith('dryrun-'), variant: "outline", className: "flex-1", children: loading === 'dryrun-atlas' ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Running..."] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { className: "mr-2 h-4 w-4" }), "Dry-Run (Manual)"] })) })] }) })] }), dryRunResult && typeof dryRunResult === 'object' && dryRunResult !== null && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [dryRunResult.success ? (_jsx(CheckCircle2, { className: "h-5 w-5 text-green-500" })) : (_jsx(XCircle, { className: "h-5 w-5 text-red-500" })), "Dry-Run Result"] }), _jsx(CardDescription, { children: String(dryRunResult.job_title ?? '') })] }), _jsxs(CardContent, { className: "space-y-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Status:" }), ' ', _jsx("span", { className: dryRunResult.success ? 'text-green-600' : 'text-red-600', children: dryRunResult.success ? 'Success' : 'Failed' })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Message:" }), ' ', _jsx("span", { className: "text-muted-foreground", children: String(dryRunResult.message ?? '') })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Test Endpoint:" }), ' ', _jsx("a", { href: String(dryRunResult.test_endpoint ?? ''), target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline", children: String(dryRunResult.test_endpoint ?? '') })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Job ID:" }), ' ', _jsx("span", { className: "text-muted-foreground", children: String(dryRunResult.job_id ?? '') })] })] })] }))] })] }));
}

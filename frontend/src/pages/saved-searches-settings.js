import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Bell, Edit, X, Play, Plus, Save, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { savedSearchApi } from '@/api/client';
export function SavedSearchesSettings() {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState(null);
    const { data: searches, isLoading, refetch } = useQuery({
        queryKey: ['saved-searches'],
        queryFn: () => savedSearchApi.list(false),
    });
    const defaultFilters = {
        remote_only: false,
        min_match_score: null,
        status: 'all',
        skill_filter: null,
        preferred_locations: [],
        preferred_titles: [],
        preferred_companies: [],
        avoid_companies: [],
        required_skills: [],
        preferred_skills: [],
        min_salary: null,
        job_types: [],
        industries: [],
        must_have_benefits: [],
        company_size: null,
    };
    const withDefaultFilters = (filters) => ({
        ...defaultFilters,
        ...(filters || {}),
    });
    const [formData, setFormData] = useState({
        name: '',
        query: '',
        sources: ['remotive', 'remoteok', 'wellfound', 'greenhouse'],
        filters: withDefaultFilters(),
        alert_frequency: 'daily',
        min_match_score: 60,
        enabled: true,
    });
    const availableSources = [
        { id: 'remotive', name: 'Remotive' },
        { id: 'remoteok', name: 'RemoteOK' },
        { id: 'wellfound', name: 'Wellfound' },
        { id: 'greenhouse', name: 'Greenhouse' },
    ];
    const alertFrequencies = [
        { value: 'hourly', label: 'Hourly' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'never', label: 'Never' },
    ];
    const resetForm = () => {
        setFormData({
            name: '',
            query: '',
            sources: ['remotive', 'remoteok', 'wellfound', 'greenhouse'],
            filters: withDefaultFilters(),
            alert_frequency: 'daily',
            min_match_score: 60,
            enabled: true,
        });
        setEditingId(null);
        setIsCreating(false);
    };
    const handleSave = async () => {
        if (!formData.name || !formData.query) {
            setMessage({ type: 'error', text: 'Name and query are required' });
            return;
        }
        try {
            if (editingId) {
                await savedSearchApi.update({ ...formData, id: editingId });
                setMessage({ type: 'success', text: 'Saved search updated successfully' });
            }
            else {
                await savedSearchApi.create(formData);
                setMessage({ type: 'success', text: 'Saved search created successfully' });
            }
            resetForm();
            refetch();
            queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
        }
        catch (error) {
            setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to save search' });
        }
    };
    const handleEdit = (search) => {
        setFormData({
            ...search,
            filters: withDefaultFilters(search.filters),
        });
        setEditingId(search.id || null);
        setIsCreating(true);
    };
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this saved search?'))
            return;
        try {
            await savedSearchApi.delete(id);
            setMessage({ type: 'success', text: 'Saved search deleted successfully' });
            refetch();
            queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
        }
        catch (error) {
            setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to delete search' });
        }
    };
    const handleRun = async (id) => {
        try {
            const jobs = await savedSearchApi.run(id);
            setMessage({ type: 'success', text: `Found ${jobs.length} matching jobs` });
            refetch();
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
        catch (error) {
            setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to run search' });
        }
    };
    const handleCheckAndRunAll = async () => {
        try {
            const count = await savedSearchApi.checkAndRun();
            setMessage({
                type: 'success',
                text: `Checked and ran ${count} saved searches. Found ${count} new jobs total.`
            });
            refetch();
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['saved-searches-status'] });
        }
        catch (error) {
            setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to check and run searches' });
        }
    };
    const toggleSource = (sourceId) => {
        const current = formData.sources || [];
        if (current.includes(sourceId)) {
            if (current.length > 1) {
                setFormData({ ...formData, sources: current.filter((s) => s !== sourceId) });
            }
        }
        else {
            setFormData({ ...formData, sources: [...current, sourceId] });
        }
    };
    if (message) {
        setTimeout(() => setMessage(null), 5000);
    }
    return (_jsx("div", { className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Search, { className: "h-5 w-5" }), "Saved Searches"] }), _jsx(CardDescription, { children: "Create automated searches that run periodically and notify you of new high-match jobs." })] }), _jsxs(CardContent, { className: "space-y-4", children: [message && (_jsxs(Alert, { variant: message.type === 'error' ? 'destructive' : 'default', children: [message.type === 'success' ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(AlertCircle, { className: "h-4 w-4" })), _jsx(AlertDescription, { children: message.text })] })), _jsxs("div", { className: "flex gap-2", children: [!isCreating && (_jsxs(Button, { onClick: () => setIsCreating(true), className: "gap-2", children: [_jsx(Plus, { className: "h-4 w-4" }), "Create Saved Search"] })), !isCreating && searches && searches.length > 0 && (_jsxs(Button, { onClick: handleCheckAndRunAll, variant: "outline", className: "gap-2", title: "Check all saved searches and run those that are due", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), "Check & Run All Due"] }))] }), isCreating && (_jsxs(Card, { className: "border-2 border-primary/20", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { className: "text-lg", children: editingId ? 'Edit Saved Search' : 'Create Saved Search' }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "search-name", children: "Name" }), _jsx(Input, { id: "search-name", placeholder: "e.g., Senior React Developer", value: formData.name || '', onChange: (e) => setFormData({ ...formData, name: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "search-query", children: "Search Query" }), _jsx(Input, { id: "search-query", placeholder: "e.g., senior react developer", value: formData.query || '', onChange: (e) => setFormData({ ...formData, query: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Sources" }), _jsx("div", { className: "flex flex-wrap gap-2", children: availableSources.map((source) => (_jsx(Button, { type: "button", variant: formData.sources?.includes(source.id) ? 'default' : 'outline', size: "sm", onClick: () => toggleSource(source.id), children: source.name }, source.id))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "alert-frequency", children: "Alert Frequency" }), _jsx("select", { id: "alert-frequency", className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value: formData.alert_frequency || 'daily', onChange: (e) => setFormData({ ...formData, alert_frequency: e.target.value }), children: alertFrequencies.map((freq) => (_jsx("option", { value: freq.value, children: freq.label }, freq.value))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "min-match-score", children: "Minimum Match Score" }), _jsx(Input, { id: "min-match-score", type: "number", min: "0", max: "100", value: formData.min_match_score || 60, onChange: (e) => setFormData({ ...formData, min_match_score: parseInt(e.target.value) || 60 }) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Switch, { id: "remote-only", checked: formData.filters?.remote_only || false, onCheckedChange: (checked) => setFormData({
                                                        ...formData,
                                                        filters: { ...formData.filters, remote_only: checked },
                                                    }) }), _jsx(Label, { htmlFor: "remote-only", children: "Remote only" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "skill-filter", children: "Skill Filter (optional)" }), _jsx(Input, { id: "skill-filter", placeholder: "e.g., react, typescript", value: formData.filters?.skill_filter || '', onChange: (e) => setFormData({
                                                        ...formData,
                                                        filters: { ...formData.filters, skill_filter: e.target.value || null },
                                                    }) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Switch, { id: "search-enabled", checked: formData.enabled ?? true, onCheckedChange: (checked) => setFormData({ ...formData, enabled: checked }) }), _jsx(Label, { htmlFor: "search-enabled", children: "Enabled" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { onClick: handleSave, className: "gap-2", children: [_jsx(Save, { className: "h-4 w-4" }), editingId ? 'Update' : 'Create'] }), _jsxs(Button, { variant: "outline", onClick: resetForm, className: "gap-2", children: [_jsx(X, { className: "h-4 w-4" }), "Cancel"] })] })] })] })), _jsx(Separator, {}), _jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Your Saved Searches" }), isLoading ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Loading..." })) : !searches || searches.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "No saved searches yet. Create one to get started!" })) : (_jsx("div", { className: "space-y-3", children: searches.map((search) => (_jsx(Card, { className: `transition-all duration-200 hover:shadow-md ${!search.enabled ? 'opacity-60' : 'border-primary/20 hover:border-primary/40'}`, children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1 space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h4", { className: "font-semibold text-lg", children: search.name }), search.enabled ? (_jsx(Badge, { variant: "default", className: "bg-green-500/90 text-white animate-pulse", children: "Active" })) : (_jsx(Badge, { variant: "secondary", children: "Disabled" })), _jsxs(Badge, { variant: "outline", className: "gap-1", children: [_jsx(Bell, { className: "h-3 w-3" }), search.alert_frequency] })] }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Query: ", _jsx("span", { className: "font-mono", children: search.query })] }), _jsx("div", { className: "flex flex-wrap gap-1", children: search.sources.map((source) => (_jsx(Badge, { variant: "outline", className: "text-xs", children: source }, source))) }), _jsxs("div", { className: "flex flex-wrap gap-2 text-xs text-muted-foreground", children: [_jsxs("span", { children: ["Min score: ", search.min_match_score, "%"] }), search.filters.remote_only && _jsx("span", { children: "\u2022 Remote only" }), search.filters.skill_filter && (_jsxs("span", { children: ["\u2022 Skill: ", search.filters.skill_filter] })), search.last_run_at && (_jsxs("span", { children: ["\u2022 Last run: ", new Date(search.last_run_at).toLocaleString()] }))] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs(Button, { size: "sm", variant: "outline", onClick: () => handleRun(search.id), className: "gap-2 hover:bg-primary/10 transition-colors", children: [_jsx(Play, { className: "h-3.5 w-3.5" }), "Run Now"] }), _jsxs(Button, { size: "sm", variant: "outline", onClick: () => handleEdit(search), className: "gap-2 hover:bg-primary/10 transition-colors", children: [_jsx(Edit, { className: "h-3.5 w-3.5" }), "Edit"] }), _jsxs(Button, { size: "sm", variant: "outline", onClick: () => handleDelete(search.id), className: "gap-2 text-destructive hover:bg-destructive/10 transition-colors", children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), "Delete"] })] })] }) }) }, search.id))) }))] })] })] }) }));
}

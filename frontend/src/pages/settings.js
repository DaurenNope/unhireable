import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Sun, Moon, Monitor, Key, Trash2, Plus, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { credentialApi } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
export function Settings() {
    return (_jsxs("div", { className: "space-y-6 p-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold tracking-tight", children: "Settings" }), _jsx("p", { className: "text-muted-foreground", children: "Manage your account settings and preferences." })] }), _jsxs(Tabs, { defaultValue: "appearance", className: "space-y-4", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "appearance", children: "Appearance" }), _jsx(TabsTrigger, { value: "scraper", children: "Scraper Config" }), _jsx(TabsTrigger, { value: "credentials", children: "Credentials" }), _jsx(TabsTrigger, { value: "job-prefs", children: "Job Preferences" })] }), _jsx(TabsContent, { value: "appearance", className: "space-y-4", children: _jsx(AppearanceSettings, {}) }), _jsx(TabsContent, { value: "scraper", className: "space-y-4", children: _jsx(ScraperSettings, {}) }), _jsx(TabsContent, { value: "credentials", className: "space-y-4", children: _jsx(CredentialsSettings, {}) }), _jsx(TabsContent, { value: "job-prefs", className: "space-y-4", children: _jsx(JobPreferences, {}) })] })] }));
}
function AppearanceSettings() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    if (!mounted) {
        return _jsx("div", { className: "h-32" });
    }
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Theme" }), _jsx(CardDescription, { children: "Customize how JobEz looks on your device." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsxs(Button, { variant: theme === "light" ? "default" : "outline", className: "w-full justify-start", onClick: () => setTheme("light"), children: [_jsx(Sun, { className: "mr-2 h-4 w-4" }), "Light"] }), _jsxs(Button, { variant: theme === "dark" ? "default" : "outline", className: "w-full justify-start", onClick: () => setTheme("dark"), children: [_jsx(Moon, { className: "mr-2 h-4 w-4" }), "Dark"] }), _jsxs(Button, { variant: theme === "system" ? "default" : "outline", className: "w-full justify-start", onClick: () => setTheme("system"), children: [_jsx(Monitor, { className: "mr-2 h-4 w-4" }), "System"] })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "The \"System\" setting will match your operating system's appearance settings." })] })] }));
}
function ScraperSettings() {
    const [firecrawlKey, setFirecrawlKey] = useState("");
    const [, setUseFirecrawl] = useState(false);
    const [useBrowserAutomation, setUseBrowserAutomation] = useState(false);
    const [linkedinEnabled, setLinkedinEnabled] = useState(false);
    const [message, setMessage] = useState(null);
    const queryClient = useQueryClient();
    const { data: firecrawlCred } = useQuery({
        queryKey: ['credential', 'firecrawl'],
        queryFn: () => credentialApi.get('firecrawl'),
    });
    useEffect(() => {
        if (firecrawlCred) {
            setFirecrawlKey(firecrawlCred.tokens || "");
            setUseFirecrawl(!!firecrawlCred.tokens);
        }
    }, [firecrawlCred]);
    const saveFirecrawlKey = async () => {
        try {
            if (firecrawlKey.trim()) {
                await credentialApi.create({
                    platform: 'firecrawl',
                    tokens: firecrawlKey.trim(),
                    is_active: true,
                });
                setMessage({ type: 'success', text: 'Firecrawl API key saved' });
            }
            else {
                await credentialApi.delete('firecrawl');
                setMessage({ type: 'success', text: 'Firecrawl API key removed' });
            }
            queryClient.invalidateQueries({ queryKey: ['credential'] });
            setTimeout(() => setMessage(null), 3000);
        }
        catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to save API key' });
            setTimeout(() => setMessage(null), 3000);
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Firecrawl API" }), _jsx(CardDescription, { children: "Configure Firecrawl API key for advanced scraping capabilities." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "firecrawl-key", children: "API Key" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "firecrawl-key", type: "password", placeholder: "Enter Firecrawl API key", value: firecrawlKey, onChange: (e) => setFirecrawlKey(e.target.value), className: "flex-1" }), _jsxs(Button, { onClick: saveFirecrawlKey, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), "Save"] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Optional: Used for scraping JavaScript-rendered pages. Get your key at firecrawl.dev" })] }), message && (_jsxs(Alert, { variant: message.type === 'error' ? 'destructive' : 'default', children: [message.type === 'success' ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(AlertCircle, { className: "h-4 w-4" })), _jsx(AlertDescription, { children: message.text })] }))] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Browser Automation" }), _jsx(CardDescription, { children: "Configure browser automation settings for scraping." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Use Browser Automation" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Use Playwright/Chrome for JavaScript-heavy sites" })] }), _jsx(Switch, { checked: useBrowserAutomation, onCheckedChange: setUseBrowserAutomation })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Requires Playwright or headless Chrome to be installed on your system." })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "LinkedIn Settings" }), _jsx(CardDescription, { children: "\u26A0\uFE0F LinkedIn scraping is high-risk and disabled by default." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Enable LinkedIn Scraping" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Use conservative delays to reduce ban risk" })] }), _jsx(Switch, { checked: linkedinEnabled, onCheckedChange: setLinkedinEnabled })] }), _jsxs(Alert, { variant: "destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "LinkedIn does not allow automated scraping. Enabling this feature may result in account bans. Use at your own risk with conservative settings." })] })] })] })] }));
}
function CredentialsSettings() {
    const queryClient = useQueryClient();
    const { data: credentials = [], isLoading } = useQuery({
        queryKey: ['credentials'],
        queryFn: () => credentialApi.list(false),
    });
    const handleDelete = async (platform) => {
        if (!confirm(`Delete credentials for ${platform}?`))
            return;
        try {
            await credentialApi.delete(platform);
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
        }
        catch (error) {
            alert(`Failed to delete: ${error.message}`);
        }
    };
    const platforms = [
        { name: 'OpenAI', key: 'openai', description: 'For AI-powered document generation' },
        { name: 'Firecrawl', key: 'firecrawl', description: 'For advanced web scraping' },
        { name: 'LinkedIn', key: 'linkedin', description: 'For LinkedIn scraping (high risk)' },
        { name: 'Wellfound', key: 'wellfound', description: 'For Wellfound scraping' },
    ];
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "API Keys & Credentials" }), _jsx(CardDescription, { children: "Manage API keys and platform credentials securely." })] }), _jsx(CardContent, { className: "space-y-4", children: isLoading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading..." })) : (_jsx("div", { className: "space-y-3", children: platforms.map((platform) => {
                        const cred = credentials.find(c => c.platform === platform.key);
                        return (_jsxs("div", { className: "flex items-center justify-between p-4 border rounded-lg", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h4", { className: "font-medium", children: platform.name }), cred?.is_active && (_jsx(Badge, { variant: "outline", className: "text-xs", children: "Active" }))] }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: platform.description }), cred?.tokens && (_jsxs("p", { className: "text-xs text-muted-foreground mt-1 font-mono", children: [cred.tokens.substring(0, 8), "..."] }))] }), _jsx("div", { className: "flex gap-2", children: cred ? (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => {
                                                    // TODO: Open edit dialog
                                                    alert('Edit functionality coming soon');
                                                }, children: [_jsx(Key, { className: "mr-2 h-4 w-4" }), "Edit"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => handleDelete(platform.key), children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Delete"] })] })) : (_jsxs(Button, { variant: "outline", size: "sm", onClick: () => {
                                            // TODO: Open add dialog
                                            alert('Add credential functionality coming soon');
                                        }, children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add"] })) })] }, platform.key));
                    }) })) })] }));
}
function JobPreferences() {
    const [keywords, setKeywords] = useState(() => localStorage.getItem('prefs.keywords') || '');
    const [location, setLocation] = useState(() => localStorage.getItem('prefs.location') || '');
    const [sources, setSources] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('prefs.sources') || '[]');
        }
        catch {
            return [];
        }
    });
    const [isRunning, setIsRunning] = useState(false);
    const [message, setMessage] = useState(null);
    const toggleSource = (src) => {
        setSources(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]);
    };
    const savePrefs = () => {
        localStorage.setItem('prefs.keywords', keywords);
        localStorage.setItem('prefs.location', location);
        localStorage.setItem('prefs.sources', JSON.stringify(sources));
        setMessage('Preferences saved');
        setTimeout(() => setMessage(null), 1500);
    };
    const runScrape = async () => {
        try {
            setIsRunning(true);
            setMessage(null);
            const { invoke } = await import("@tauri-apps/api/core");
            const q = [keywords, location].filter(Boolean).join(' ');
            await invoke('scrape_jobs_selected', { sources, query: q });
            setMessage('Scrape completed. Check Jobs page.');
        }
        catch (e) {
            setMessage(e?.message || 'Scrape failed');
        }
        finally {
            setIsRunning(false);
        }
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Job Search Preferences" }), _jsx(CardDescription, { children: "Configure your default job search criteria." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "keywords", children: "Keywords" }), _jsx(Input, { id: "keywords", type: "text", placeholder: "e.g. Rust, React, TypeScript", value: keywords, onChange: (e) => setKeywords(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "location", children: "Location" }), _jsx(Input, { id: "location", type: "text", placeholder: "e.g. Remote, Almaty", value: location, onChange: (e) => setLocation(e.target.value) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Sources" }), _jsx("div", { className: "grid gap-2 md:grid-cols-3", children: ['hhkz', 'linkedin', 'wellfound'].map(src => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", id: `source-${src}`, checked: sources.includes(src), onChange: () => toggleSource(src), className: "rounded border-gray-300" }), _jsx(Label, { htmlFor: `source-${src}`, className: "capitalize cursor-pointer", children: src })] }, src))) })] }), _jsx(Separator, {}), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { variant: "outline", onClick: savePrefs, disabled: isRunning, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), "Save Preferences"] }), _jsx(Button, { onClick: runScrape, disabled: isRunning, children: isRunning ? 'Scraping...' : 'Scrape Now' }), message && (_jsx("span", { className: "text-sm text-muted-foreground", children: message }))] })] })] }));
}

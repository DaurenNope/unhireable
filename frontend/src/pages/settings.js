import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Sun, Moon, Monitor, Key, Trash2, Plus, Save, AlertCircle, CheckCircle2, Mail, Send } from "lucide-react";
import { credentialApi, schedulerApi } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserProfileForm } from "@/components/user-profile-form";
import { invoke } from "@tauri-apps/api/core";
import { Clock, Play, Square, RefreshCw } from "lucide-react";
export function Settings() {
    const [searchParams, setSearchParams] = useSearchParams();
    const defaultTab = searchParams.get('tab') || 'appearance';
    return (_jsxs("div", { className: "space-y-6 p-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold tracking-tight", children: "Settings" }), _jsx("p", { className: "text-muted-foreground", children: "Manage your account settings and preferences." })] }), _jsxs(Tabs, { value: defaultTab, onValueChange: (value) => {
                    setSearchParams({ tab: value });
                }, className: "space-y-4", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "appearance", children: "Appearance" }), _jsx(TabsTrigger, { value: "profile", children: "Profile" }), _jsx(TabsTrigger, { value: "scraper", children: "Scraper Config" }), _jsx(TabsTrigger, { value: "credentials", children: "Credentials" }), _jsx(TabsTrigger, { value: "email", children: "Email Notifications" }), _jsx(TabsTrigger, { value: "scheduler", children: "Scheduler" }), _jsx(TabsTrigger, { value: "job-prefs", children: "Job Preferences" })] }), _jsx(TabsContent, { value: "appearance", className: "space-y-4", children: _jsx(AppearanceSettings, {}) }), _jsx(TabsContent, { value: "profile", className: "space-y-4", children: _jsx(ProfileSettings, {}) }), _jsx(TabsContent, { value: "scraper", className: "space-y-4", children: _jsx(ScraperSettings, {}) }), _jsx(TabsContent, { value: "credentials", className: "space-y-4", children: _jsx(CredentialsSettings, {}) }), _jsx(TabsContent, { value: "email", className: "space-y-4", children: _jsx(EmailNotificationSettings, {}) }), _jsx(TabsContent, { value: "scheduler", className: "space-y-4", children: _jsx(SchedulerSettings, {}) }), _jsx(TabsContent, { value: "job-prefs", className: "space-y-4", children: _jsx(JobPreferences, {}) })] })] }));
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
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Theme" }), _jsx(CardDescription, { children: "Customize how Unhireable looks on your device." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsxs(Button, { variant: theme === "light" ? "default" : "outline", className: "w-full justify-start", onClick: () => setTheme("light"), children: [_jsx(Sun, { className: "mr-2 h-4 w-4" }), "Light"] }), _jsxs(Button, { variant: theme === "dark" ? "default" : "outline", className: "w-full justify-start", onClick: () => setTheme("dark"), children: [_jsx(Moon, { className: "mr-2 h-4 w-4" }), "Dark"] }), _jsxs(Button, { variant: theme === "system" ? "default" : "outline", className: "w-full justify-start", onClick: () => setTheme("system"), children: [_jsx(Monitor, { className: "mr-2 h-4 w-4" }), "System"] })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "The \"System\" setting will match your operating system's appearance settings." })] })] }));
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
function EmailNotificationSettings() {
    const [smtpServer, setSmtpServer] = useState("smtp.gmail.com");
    const [smtpPort, setSmtpPort] = useState("587");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [fromEmail, setFromEmail] = useState("");
    const [fromName, setFromName] = useState("Unhireable");
    const [testEmailTo, setTestEmailTo] = useState("");
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [notifyOnNewJobs, setNotifyOnNewJobs] = useState(true);
    const [notifyOnMatches, setNotifyOnMatches] = useState(true);
    const [minMatchScore, setMinMatchScore] = useState("60");
    const [notifyDailySummary, setNotifyDailySummary] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);
    useEffect(() => {
        // Load email settings from localStorage
        const savedConfig = localStorage.getItem('emailConfig');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                setSmtpServer(config.smtp_server || "smtp.gmail.com");
                setSmtpPort(config.smtp_port?.toString() || "587");
                setUsername(config.username || "");
                setPassword(config.password || "");
                setFromEmail(config.from_email || "");
                setFromName(config.from_name || "Unhireable");
                setEmailEnabled(config.email_enabled || false);
                setNotifyOnNewJobs(config.notify_on_new_jobs !== false);
                setNotifyOnMatches(config.notify_on_matches !== false);
                setMinMatchScore(config.min_match_score_for_notification?.toString() || "60");
                setNotifyDailySummary(config.notify_daily_summary !== false);
            }
            catch (e) {
                console.error('Failed to load email config:', e);
            }
        }
    }, []);
    const saveEmailConfig = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            const config = {
                smtp_server: smtpServer,
                smtp_port: parseInt(smtpPort) || 587,
                username: username,
                password: password,
                from_email: fromEmail || username,
                from_name: fromName,
                use_tls: smtpPort === "587",
                use_ssl: smtpPort === "465",
                email_enabled: emailEnabled,
                notify_on_new_jobs: notifyOnNewJobs,
                notify_on_matches: notifyOnMatches,
                min_match_score_for_notification: parseFloat(minMatchScore) || 60,
                notify_daily_summary: notifyDailySummary,
            };
            localStorage.setItem('emailConfig', JSON.stringify(config));
            setMessage({ type: 'success', text: 'Email configuration saved successfully' });
            setTimeout(() => setMessage(null), 3000);
        }
        catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to save email configuration' });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsSaving(false);
        }
    };
    const testEmailConnection = async () => {
        if (!username || !password) {
            setMessage({ type: 'error', text: 'Please enter username and password first' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }
        setIsTesting(true);
        setMessage(null);
        try {
            const config = {
                smtp_server: smtpServer,
                smtp_port: parseInt(smtpPort) || 587,
                username: username,
                password: password,
                from_email: fromEmail || username,
                from_name: fromName,
                use_tls: smtpPort === "587",
                use_ssl: smtpPort === "465",
            };
            await invoke('test_email_connection', { config });
            setMessage({ type: 'success', text: 'Email connection test successful!' });
            setTimeout(() => setMessage(null), 3000);
        }
        catch (error) {
            setMessage({ type: 'error', text: error.message || 'Email connection test failed' });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsTesting(false);
        }
    };
    const sendTestEmail = async () => {
        if (!testEmailTo) {
            setMessage({ type: 'error', text: 'Please enter a test email address' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }
        if (!username || !password) {
            setMessage({ type: 'error', text: 'Please enter username and password first' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }
        setIsTesting(true);
        setMessage(null);
        try {
            const config = {
                smtp_server: smtpServer,
                smtp_port: parseInt(smtpPort) || 587,
                username: username,
                password: password,
                from_email: fromEmail || username,
                from_name: fromName,
                use_tls: smtpPort === "587",
                use_ssl: smtpPort === "465",
            };
            await invoke('send_test_email', { config, to: testEmailTo });
            setMessage({ type: 'success', text: `Test email sent successfully to ${testEmailTo}!` });
            setTimeout(() => setMessage(null), 5000);
        }
        catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to send test email' });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsTesting(false);
        }
    };
    return (_jsx("div", { className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Email Notifications" }), _jsx(CardDescription, { children: "Configure email notifications for job matches and updates. Many jobs only provide email contacts, so email functionality is crucial." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Enable Email Notifications" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send email notifications for job matches and updates" })] }), _jsx(Switch, { checked: emailEnabled, onCheckedChange: setEmailEnabled })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "smtp-server", children: "SMTP Server" }), _jsx(Input, { id: "smtp-server", type: "text", placeholder: "smtp.gmail.com", value: smtpServer, onChange: (e) => setSmtpServer(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Gmail: smtp.gmail.com, Outlook: smtp-mail.outlook.com" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "smtp-port", children: "SMTP Port" }), _jsx(Input, { id: "smtp-port", type: "number", placeholder: "587", value: smtpPort, onChange: (e) => setSmtpPort(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "587 (TLS) or 465 (SSL)" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email-username", children: "Email Address / Username" }), _jsx(Input, { id: "email-username", type: "email", placeholder: "your.email@gmail.com", value: username, onChange: (e) => setUsername(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Your email address (used as username for SMTP)" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email-password", children: "Password / App Password" }), _jsx(Input, { id: "email-password", type: "password", placeholder: "Enter password or app password", value: password, onChange: (e) => setPassword(e.target.value) }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["For Gmail, use an App Password (not your regular password).", _jsx("a", { href: "https://support.google.com/accounts/answer/185833", target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline ml-1", children: "Learn more" })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "from-email", children: "From Email" }), _jsx(Input, { id: "from-email", type: "email", placeholder: "your.email@gmail.com", value: fromEmail, onChange: (e) => setFromEmail(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Defaults to username if empty" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "from-name", children: "From Name" }), _jsx(Input, { id: "from-name", type: "text", placeholder: "Unhireable", value: fromName, onChange: (e) => setFromName(e.target.value) })] })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold", children: "Notification Preferences" }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Notify on New Jobs" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send email when new jobs are found" })] }), _jsx(Switch, { checked: notifyOnNewJobs, onCheckedChange: setNotifyOnNewJobs, disabled: !emailEnabled })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Notify on Job Matches" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send email when high-match jobs are found" })] }), _jsx(Switch, { checked: notifyOnMatches, onCheckedChange: setNotifyOnMatches, disabled: !emailEnabled })] }), notifyOnMatches && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "min-match-score", children: "Minimum Match Score" }), _jsx(Input, { id: "min-match-score", type: "number", min: "0", max: "100", placeholder: "60", value: minMatchScore, onChange: (e) => setMinMatchScore(e.target.value), disabled: !emailEnabled }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Only notify for jobs with match score >= this value (0-100)" })] })), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Daily Summary" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send daily summary of job search activity" })] }), _jsx(Switch, { checked: notifyDailySummary, onCheckedChange: setNotifyDailySummary, disabled: !emailEnabled })] })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold", children: "Test Email Configuration" }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "test-email", children: "Test Email Address" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "test-email", type: "email", placeholder: "test@example.com", value: testEmailTo, onChange: (e) => setTestEmailTo(e.target.value) }), _jsxs(Button, { variant: "outline", onClick: testEmailConnection, disabled: isTesting || !username || !password, children: [_jsx(Mail, { className: "mr-2 h-4 w-4" }), "Test Connection"] }), _jsxs(Button, { onClick: sendTestEmail, disabled: isTesting || !testEmailTo || !username || !password, children: [_jsx(Send, { className: "mr-2 h-4 w-4" }), isTesting ? 'Sending...' : 'Send Test Email'] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Test your email configuration by sending a test email" })] })] }), message && (_jsxs(Alert, { variant: message.type === 'error' ? 'destructive' : 'default', children: [message.type === 'success' ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(AlertCircle, { className: "h-4 w-4" })), _jsx(AlertDescription, { children: message.text })] })), _jsx("div", { className: "flex justify-end gap-2", children: _jsxs(Button, { onClick: saveEmailConfig, disabled: isSaving, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), isSaving ? 'Saving...' : 'Save Configuration'] }) })] })] })] }) }));
}
function ProfileSettings() {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);
    useEffect(() => {
        // Load profile from localStorage
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
            try {
                setProfile(JSON.parse(savedProfile));
            }
            catch (e) {
                console.error('Failed to parse saved profile:', e);
            }
        }
    }, []);
    const handleSave = async (newProfile) => {
        setIsLoading(true);
        setMessage(null);
        try {
            // Save to localStorage (in a real app, this would be saved to backend)
            localStorage.setItem('userProfile', JSON.stringify(newProfile));
            setProfile(newProfile);
            setMessage({ type: 'success', text: 'Profile saved successfully' });
            setTimeout(() => setMessage(null), 3000);
        }
        catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to save profile' });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsLoading(false);
        }
    };
    const loadSampleProfile = () => {
        const sampleProfile = {
            personal_info: {
                name: "Alex Johnson",
                email: "alex.johnson@email.com",
                phone: "+1 (555) 123-4567",
                location: "San Francisco, CA",
                linkedin: "linkedin.com/in/alexjohnson",
                github: "github.com/alexjohnson",
                portfolio: "alexjohnson.dev",
            },
            summary: "Experienced software developer with 5+ years of expertise in full-stack development, specializing in React, TypeScript, and Node.js. Passionate about building scalable web applications and leading technical teams.",
            skills: {
                technical_skills: [
                    "React",
                    "TypeScript",
                    "Node.js",
                    "Python",
                    "PostgreSQL",
                    "MongoDB",
                    "Docker",
                    "AWS",
                    "Git",
                    "REST APIs",
                    "GraphQL",
                    "Next.js"
                ],
                soft_skills: [
                    "Team Leadership",
                    "Problem Solving",
                    "Communication",
                    "Agile Methodology",
                    "Mentoring"
                ],
                experience_years: {
                    "React": 4,
                    "TypeScript": 3,
                    "Node.js": 5,
                    "Python": 3,
                },
                proficiency_levels: {
                    "React": "Expert",
                    "TypeScript": "Advanced",
                    "Node.js": "Advanced",
                    "Python": "Intermediate",
                },
            },
            experience: [
                {
                    company: "TechCorp Inc.",
                    position: "Senior Software Engineer",
                    duration: "Jan 2021 - Present",
                    description: [
                        "Led development of customer-facing web applications using React and TypeScript",
                        "Architected and implemented microservices using Node.js and Python",
                        "Mentored junior developers and conducted code reviews",
                        "Reduced application load time by 40% through optimization"
                    ],
                    technologies: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS"]
                },
                {
                    company: "StartupXYZ",
                    position: "Full Stack Developer",
                    duration: "Jun 2019 - Dec 2020",
                    description: [
                        "Developed and maintained web applications using React and Node.js",
                        "Collaborated with cross-functional teams to deliver features on time",
                        "Implemented CI/CD pipelines using Docker and AWS"
                    ],
                    technologies: ["React", "Node.js", "MongoDB", "Docker"]
                },
                {
                    company: "WebDev Agency",
                    position: "Frontend Developer",
                    duration: "Mar 2018 - May 2019",
                    description: [
                        "Built responsive web applications for various clients",
                        "Collaborated with designers to implement UI/UX designs",
                        "Optimized applications for performance and SEO"
                    ],
                    technologies: ["React", "JavaScript", "CSS", "HTML"]
                }
            ],
            education: [
                {
                    institution: "University of California, Berkeley",
                    degree: "Bachelor of Science in Computer Science",
                    year: "2018",
                    details: "Graduated with honors. Relevant coursework: Data Structures, Algorithms, Database Systems"
                }
            ],
            projects: [
                "Built a real-time collaboration tool using React, Node.js, and WebSockets",
                "Developed an open-source React component library with 1k+ GitHub stars",
                "Created a task management application with offline support using PWA technologies"
            ],
        };
        setProfile(sampleProfile);
        handleSave(sampleProfile);
        setMessage({ type: 'success', text: 'Sample profile loaded! You can edit it and save.' });
        setTimeout(() => setMessage(null), 3000);
    };
    return (_jsxs("div", { className: "space-y-4", children: [message && (_jsxs(Alert, { variant: message.type === 'error' ? 'destructive' : 'default', children: [message.type === 'success' ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(AlertCircle, { className: "h-4 w-4" })), _jsx(AlertDescription, { children: message.text })] })), !profile && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Get Started" }), _jsx(CardDescription, { children: "Create your profile or load a sample profile to test the resume generator." })] }), _jsx(CardContent, { children: _jsx(Button, { onClick: loadSampleProfile, variant: "outline", children: "Load Sample Profile" }) })] })), _jsx(UserProfileForm, { profile: profile, onSave: handleSave, isLoading: isLoading })] }));
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
            const q = [keywords, location].filter(Boolean).join(' ') || 'developer';
            if (sources.length === 0) {
                setMessage('Please select at least one source to scrape');
                setIsRunning(false);
                return;
            }
            console.log('Starting scrape with sources:', sources, 'query:', q);
            const scrapedJobs = await invoke('scrape_jobs_selected', { sources, query: q });
            const jobCount = Array.isArray(scrapedJobs) ? scrapedJobs.length : 0;
            if (jobCount > 0) {
                setMessage(`Successfully scraped ${jobCount} job(s)! Check Jobs page.`);
            }
            else {
                setMessage('No new jobs found. Try different keywords or check if jobs already exist.');
            }
            // Invalidate jobs query to refresh the jobs list
            const { useQueryClient } = await import("@tanstack/react-query");
            const queryClient = useQueryClient();
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
        catch (e) {
            console.error('Scrape error:', e);
            const errorMessage = e?.message || e?.toString() || 'Scrape failed';
            setMessage(`Error: ${errorMessage}`);
            alert(`Failed to scrape: ${errorMessage}`);
        }
        finally {
            setIsRunning(false);
        }
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Job Search Preferences" }), _jsx(CardDescription, { children: "Configure your default job search criteria." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "keywords", children: "Keywords" }), _jsx(Input, { id: "keywords", type: "text", placeholder: "e.g. Rust, React, TypeScript", value: keywords, onChange: (e) => setKeywords(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "location", children: "Location" }), _jsx(Input, { id: "location", type: "text", placeholder: "e.g. Remote, Almaty", value: location, onChange: (e) => setLocation(e.target.value) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Sources" }), _jsx("div", { className: "grid gap-2 md:grid-cols-3", children: ['hhkz', 'linkedin', 'wellfound'].map(src => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", id: `source-${src}`, checked: sources.includes(src), onChange: () => toggleSource(src), className: "rounded border-gray-300" }), _jsx(Label, { htmlFor: `source-${src}`, className: "capitalize cursor-pointer", children: src })] }, src))) })] }), _jsx(Separator, {}), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { variant: "outline", onClick: savePrefs, disabled: isRunning, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), "Save Preferences"] }), _jsx(Button, { onClick: runScrape, disabled: isRunning, children: isRunning ? 'Scraping...' : 'Scrape Now' }), message && (_jsx("span", { className: "text-sm text-muted-foreground", children: message }))] })] })] }));
}
function SchedulerSettings() {
    const [enabled, setEnabled] = useState(false);
    const [schedule, setSchedule] = useState("0 9 * * *");
    const [query, setQuery] = useState("developer");
    const [sources, setSources] = useState([]);
    const [minMatchScore, setMinMatchScore] = useState("60");
    const [sendNotifications, setSendNotifications] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const { data: status, refetch: refetchStatus } = useQuery({
        queryKey: ["scheduler-status"],
        queryFn: () => schedulerApi.getStatus(),
        refetchInterval: 5000,
    });
    useEffect(() => {
        const savedConfig = localStorage.getItem("schedulerConfig");
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                setEnabled(config.enabled);
                setSchedule(config.schedule);
                setQuery(config.query);
                setSources(config.sources);
                setMinMatchScore(config.min_match_score?.toString() || "60");
                setSendNotifications(config.send_notifications);
            }
            catch (e) {
                console.error("Failed to load scheduler config:", e);
            }
        }
    }, []);
    useEffect(() => {
        if (status) {
            setIsRunning(status.running);
            setEnabled(status.enabled);
            setSchedule(status.schedule);
            setQuery(status.query);
            setSources(status.sources);
            setMinMatchScore(status.min_match_score?.toString() || "60");
            setSendNotifications(status.send_notifications);
        }
    }, [status]);
    const saveSchedulerConfig = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const config = {
                enabled,
                schedule,
                query,
                sources,
                min_match_score: parseFloat(minMatchScore) || null,
                send_notifications: sendNotifications,
            };
            localStorage.setItem("schedulerConfig", JSON.stringify(config));
            await schedulerApi.updateConfig(config);
            await refetchStatus();
            setMessage({ type: "success", text: "Scheduler configuration saved successfully" });
            setTimeout(() => setMessage(null), 3000);
        }
        catch (error) {
            setMessage({ type: "error", text: error.message || "Failed to save scheduler configuration" });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleStart = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            await schedulerApi.start();
            await refetchStatus();
            setMessage({ type: "success", text: "Scheduler started successfully" });
            setTimeout(() => setMessage(null), 3000);
        }
        catch (error) {
            setMessage({ type: "error", text: error.message || "Failed to start scheduler" });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleStop = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            await schedulerApi.stop();
            await refetchStatus();
            setMessage({ type: "success", text: "Scheduler stopped successfully" });
            setTimeout(() => setMessage(null), 3000);
        }
        catch (error) {
            setMessage({ type: "error", text: error.message || "Failed to stop scheduler" });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsLoading(false);
        }
    };
    const toggleSource = (src) => {
        setSources(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]);
    };
    return (_jsx("div", { className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Automated Job Scraping" }), _jsx(CardDescription, { children: "Schedule automatic job scraping at regular intervals. Jobs will be scraped and saved automatically." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Enable Scheduler" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Automatically scrape jobs on a schedule" })] }), _jsx(Switch, { checked: enabled, onCheckedChange: setEnabled, disabled: isLoading })] }), status && (_jsxs("div", { className: "flex items-center gap-2 p-3 bg-muted rounded-lg", children: [_jsx(Clock, { className: "h-4 w-4" }), _jsxs("div", { className: "flex-1", children: [_jsxs("p", { className: "text-sm font-medium", children: ["Status: ", isRunning ? "Running" : "Stopped"] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Schedule: ", schedule, " | Query: ", query] })] }), _jsx("div", { className: "flex gap-2", children: !isRunning ? (_jsxs(Button, { variant: "outline", size: "sm", onClick: handleStart, disabled: isLoading || !enabled, children: [_jsx(Play, { className: "mr-2 h-4 w-4" }), "Start"] })) : (_jsxs(Button, { variant: "outline", size: "sm", onClick: handleStop, disabled: isLoading, children: [_jsx(Square, { className: "mr-2 h-4 w-4" }), "Stop"] })) })] })), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "schedule", children: "Schedule (Cron Expression)" }), _jsx(Input, { id: "schedule", type: "text", placeholder: "0 9 * * *", value: schedule, onChange: (e) => setSchedule(e.target.value), disabled: isLoading }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Cron format: \"minute hour day month weekday\". Example: \"0 9 * * *\" = Daily at 9 AM" }), _jsxs("div", { className: "text-xs text-muted-foreground space-y-1", children: [_jsx("p", { children: _jsx("strong", { children: "Common schedules:" }) }), _jsxs("ul", { className: "list-disc list-inside space-y-1 ml-2", children: [_jsx("li", { children: "\"0 9 * * *\" - Daily at 9 AM" }), _jsx("li", { children: "\"0 */6 * * *\" - Every 6 hours" }), _jsx("li", { children: "\"0 */12 * * *\" - Every 12 hours" }), _jsx("li", { children: "\"0 9 * * 1\" - Every Monday at 9 AM" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "scheduler-query", children: "Default Search Query" }), _jsx(Input, { id: "scheduler-query", type: "text", placeholder: "developer", value: query, onChange: (e) => setQuery(e.target.value), disabled: isLoading }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Default search query to use when scraping jobs" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Sources" }), _jsx("p", { className: "text-xs text-muted-foreground mb-2", children: "Select sources to scrape. Leave empty to scrape all sources." }), _jsx("div", { className: "grid gap-2 md:grid-cols-3", children: ["hhkz", "linkedin", "wellfound"].map(src => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", id: `scheduler-source-${src}`, checked: sources.includes(src), onChange: () => toggleSource(src), disabled: isLoading, className: "rounded border-gray-300" }), _jsx(Label, { htmlFor: `scheduler-source-${src}`, className: "capitalize cursor-pointer", children: src })] }, src))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "scheduler-min-match", children: "Minimum Match Score" }), _jsx(Input, { id: "scheduler-min-match", type: "number", min: "0", max: "100", placeholder: "60", value: minMatchScore, onChange: (e) => setMinMatchScore(e.target.value), disabled: isLoading }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Only notify for jobs with match score >= this value (0-100). Leave empty for no minimum." })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Send Notifications" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send email notifications when new jobs are found" })] }), _jsx(Switch, { checked: sendNotifications, onCheckedChange: setSendNotifications, disabled: isLoading })] })] }), message && (_jsxs(Alert, { variant: message.type === "error" ? "destructive" : "default", children: [message.type === "success" ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(AlertCircle, { className: "h-4 w-4" })), _jsx(AlertDescription, { children: message.text })] })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => refetchStatus(), disabled: isLoading, children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}` }), "Refresh Status"] }), _jsxs(Button, { onClick: saveSchedulerConfig, disabled: isLoading, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), isLoading ? "Saving..." : "Save Configuration"] })] })] })] }) }));
}

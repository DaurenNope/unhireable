import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from "react";
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
import { Sun, Moon, Monitor, Key, Trash2, Plus, Save, AlertCircle, CheckCircle2, Mail, Send, Rocket, Shield, Zap, Search, Play } from "lucide-react";
import { credentialApi, schedulerApi, profileApi, savedSearchApi, automationApi } from "@/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserProfileForm } from "@/components/user-profile-form";
import { cn } from "@/lib/utils";
// Saved searches functionality moved to simplified UI
import { invoke } from "@tauri-apps/api/core";
import { Clock, Square, RefreshCw, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
export function Settings() {
    const [searchParams, setSearchParams] = useSearchParams();
    const defaultTab = searchParams.get('tab') || 'profile';
    // Get scheduler status
    const { data: schedulerStatus } = useQuery({
        queryKey: ['scheduler-status'],
        queryFn: () => schedulerApi.getStatus(),
        refetchInterval: 5000,
    });
    // Get email config to check if enabled
    const [emailEnabled, setEmailEnabled] = useState(false);
    // Load email enabled state from localStorage
    useEffect(() => {
        const loadEmailEnabled = () => {
            const savedConfig = localStorage.getItem('emailConfig');
            if (savedConfig) {
                try {
                    const config = JSON.parse(savedConfig);
                    setEmailEnabled(config.email_enabled || false);
                }
                catch (e) {
                    console.error('Failed to load email config:', e);
                }
            }
        };
        loadEmailEnabled();
        // Listen for storage changes (when email config is saved)
        const handleStorageChange = (e) => {
            if (e.key === 'emailConfig') {
                loadEmailEnabled();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        // Also poll for changes (since same-window storage events don't fire)
        const interval = setInterval(loadEmailEnabled, 1000);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);
    return (_jsxs("div", { className: "space-y-6 p-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold tracking-tight", children: "Settings" }), _jsx("p", { className: "text-muted-foreground", children: "Configure your profile, automation, and preferences." })] }), _jsxs(Tabs, { value: defaultTab, onValueChange: (value) => {
                    setSearchParams({ tab: value });
                }, className: "space-y-4", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "profile", children: "Profile" }), _jsx(TabsTrigger, { value: "automation", children: "Automation" }), _jsx(TabsTrigger, { value: "scraper", children: "Job Sources" }), _jsx(TabsTrigger, { value: "appearance", children: "Appearance" })] }), _jsx(TabsContent, { value: "profile", className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Your Profile" }), _jsx(CardDescription, { children: "Your skills, experience, and preferences help us match you with the right jobs." })] }), _jsx(CardContent, { children: _jsx(ProfileSettings, {}) })] }) }), _jsx(TabsContent, { value: "automation", className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Automation" }), _jsx(CardDescription, { children: "Configure automatic job applications, email notifications, and scheduling." })] }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx(AutomationHealthCard, {}), _jsx(ApplicationSettings, {}), _jsx(Separator, {}), _jsx(EmailNotificationSettings, {}), _jsx(Separator, {}), _jsx(SchedulerSettings, {})] })] }) }), _jsx(TabsContent, { value: "scraper", className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Job Sources" }), _jsx(CardDescription, { children: "Choose which job boards to scrape and how often to check for new listings." })] }), _jsx(CardContent, { className: "space-y-6", children: _jsx(ScraperSettings, {}) })] }) }), _jsx(TabsContent, { value: "appearance", className: "space-y-4", children: _jsx(AppearanceSettings, {}) })] })] }));
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
            setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to save API key' });
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
            alert(`Failed to delete: ${(error instanceof Error ? error.message : String(error)) || 'Unknown error'}`);
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
    const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(true);
    const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
    const [quietHoursStart, setQuietHoursStart] = useState("22:00");
    const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
    const [maxNotificationsPerHour, setMaxNotificationsPerHour] = useState("10");
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
                setDesktopNotificationsEnabled(config.desktop_notifications_enabled !== false);
                setQuietHoursEnabled(config.quiet_hours_enabled || false);
                setQuietHoursStart(config.quiet_hours_start || "22:00");
                setQuietHoursEnd(config.quiet_hours_end || "08:00");
                setMaxNotificationsPerHour(config.max_notifications_per_hour?.toString() || "10");
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
                desktop_notifications_enabled: desktopNotificationsEnabled,
                quiet_hours_enabled: quietHoursEnabled,
                quiet_hours_start: quietHoursStart,
                quiet_hours_end: quietHoursEnd,
                max_notifications_per_hour: parseInt(maxNotificationsPerHour) || 10,
            };
            localStorage.setItem('emailConfig', JSON.stringify(config));
            setMessage({ type: 'success', text: 'Email configuration saved successfully' });
            setTimeout(() => setMessage(null), 3000);
        }
        catch (error) {
            setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to save email configuration' });
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
            setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Email connection test failed' });
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
            const testMode = localStorage.getItem('testMode') === 'true';
            const testEmailEndpoint = localStorage.getItem('testEmailEndpoint') || '';
            await invoke('send_test_email', {
                config,
                to: testEmailTo,
                test_mode: testMode,
                test_email_endpoint: testEmailEndpoint || undefined,
            });
            setMessage({ type: 'success', text: `Test email sent successfully${testMode ? ' (TEST MODE)' : ''} to ${testMode && testEmailEndpoint ? testEmailEndpoint : testEmailTo}!` });
            setTimeout(() => setMessage(null), 5000);
        }
        catch (error) {
            setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to send test email' });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsTesting(false);
        }
    };
    return (_jsx("div", { className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Email Notifications" }), _jsx(CardDescription, { children: "Configure email notifications for job matches and updates. Many jobs only provide email contacts, so email functionality is crucial." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Enable Email Notifications" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send email notifications for job matches and updates" })] }), _jsx(Switch, { checked: emailEnabled, onCheckedChange: setEmailEnabled })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "smtp-server", children: "SMTP Server" }), _jsx(Input, { id: "smtp-server", type: "text", placeholder: "smtp.gmail.com", value: smtpServer, onChange: (e) => setSmtpServer(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Gmail: smtp.gmail.com, Outlook: smtp-mail.outlook.com" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "smtp-port", children: "SMTP Port" }), _jsx(Input, { id: "smtp-port", type: "number", placeholder: "587", value: smtpPort, onChange: (e) => setSmtpPort(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "587 (TLS) or 465 (SSL)" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email-username", children: "Email Address / Username" }), _jsx(Input, { id: "email-username", type: "email", placeholder: "your.email@gmail.com", value: username, onChange: (e) => setUsername(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Your email address (used as username for SMTP)" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email-password", children: "Password / App Password" }), _jsx(Input, { id: "email-password", type: "password", placeholder: "Enter password or app password", value: password, onChange: (e) => setPassword(e.target.value) }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["For Gmail, use an App Password (not your regular password).", _jsx("a", { href: "https://support.google.com/accounts/answer/185833", target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline ml-1", children: "Learn more" })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "from-email", children: "From Email" }), _jsx(Input, { id: "from-email", type: "email", placeholder: "your.email@gmail.com", value: fromEmail, onChange: (e) => setFromEmail(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Defaults to username if empty" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "from-name", children: "From Name" }), _jsx(Input, { id: "from-name", type: "text", placeholder: "Unhireable", value: fromName, onChange: (e) => setFromName(e.target.value) })] })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold", children: "Notification Preferences" }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Notify on New Jobs" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send email when new jobs are found" })] }), _jsx(Switch, { checked: notifyOnNewJobs, onCheckedChange: setNotifyOnNewJobs, disabled: !emailEnabled })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Notify on Job Matches" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send email when high-match jobs are found" })] }), _jsx(Switch, { checked: notifyOnMatches, onCheckedChange: setNotifyOnMatches, disabled: !emailEnabled })] }), notifyOnMatches && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "min-match-score", children: "Minimum Match Score" }), _jsx(Input, { id: "min-match-score", type: "number", min: "0", max: "100", placeholder: "60", value: minMatchScore, onChange: (e) => setMinMatchScore(e.target.value), disabled: !emailEnabled }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Only notify for jobs with match score >= this value (0-100)" })] })), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Daily Summary" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send daily summary of job search activity" })] }), _jsx(Switch, { checked: notifyDailySummary, onCheckedChange: setNotifyDailySummary, disabled: !emailEnabled })] })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold", children: "Desktop Notifications" }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Enable Desktop Notifications" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Show desktop notifications when new jobs are found" })] }), _jsx(Switch, { checked: desktopNotificationsEnabled, onCheckedChange: setDesktopNotificationsEnabled })] }), desktopNotificationsEnabled && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "max-notifications", children: "Max Notifications Per Hour" }), _jsx(Input, { id: "max-notifications", type: "number", min: "1", max: "60", value: maxNotificationsPerHour, onChange: (e) => setMaxNotificationsPerHour(e.target.value) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Limit the number of notifications to prevent spam (1-60)" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Quiet Hours" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Disable notifications during specified hours" })] }), _jsx(Switch, { checked: quietHoursEnabled, onCheckedChange: setQuietHoursEnabled })] }), quietHoursEnabled && (_jsxs("div", { className: "grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "quiet-start", children: "Start Time" }), _jsx(Input, { id: "quiet-start", type: "time", value: quietHoursStart, onChange: (e) => setQuietHoursStart(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "quiet-end", children: "End Time" }), _jsx(Input, { id: "quiet-end", type: "time", value: quietHoursEnd, onChange: (e) => setQuietHoursEnd(e.target.value) })] }), _jsx("p", { className: "col-span-2 text-xs text-muted-foreground", children: "Notifications will be suppressed during these hours" })] }))] }))] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold", children: "Test Email Configuration" }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "test-email", children: "Test Email Address" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "test-email", type: "email", placeholder: "test@example.com", value: testEmailTo, onChange: (e) => setTestEmailTo(e.target.value) }), _jsxs(Button, { variant: "outline", onClick: testEmailConnection, disabled: isTesting || !username || !password, children: [_jsx(Mail, { className: "mr-2 h-4 w-4" }), "Test Connection"] }), _jsxs(Button, { onClick: sendTestEmail, disabled: isTesting || !testEmailTo || !username || !password, children: [_jsx(Send, { className: "mr-2 h-4 w-4" }), isTesting ? 'Sending...' : 'Send Test Email'] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Test your email configuration by sending a test email" })] })] }), message && (_jsxs(Alert, { variant: message.type === 'error' ? 'destructive' : 'default', children: [message.type === 'success' ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(AlertCircle, { className: "h-4 w-4" })), _jsx(AlertDescription, { children: message.text })] })), _jsx("div", { className: "flex justify-end gap-2", children: _jsxs(Button, { onClick: saveEmailConfig, disabled: isSaving, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), isSaving ? 'Saving...' : 'Save Configuration'] }) })] })] })] }) }));
}
function ProfileSettings() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);
    useEffect(() => {
        // Load profile from database
        const loadProfile = async () => {
            try {
                setIsLoading(true);
                const savedProfile = await profileApi.get();
                if (savedProfile) {
                    setProfile(savedProfile);
                    // Also save to localStorage as backup
                    localStorage.setItem('userProfile', JSON.stringify(savedProfile));
                }
                else {
                    // Try loading from localStorage as fallback
                    const localProfile = localStorage.getItem('userProfile');
                    if (localProfile) {
                        try {
                            const parsed = JSON.parse(localProfile);
                            setProfile(parsed);
                            // Migrate to database
                            await profileApi.save(parsed);
                        }
                        catch (e) {
                            console.error('Failed to parse local profile:', e);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Failed to load profile:', error);
                // Try loading from localStorage as fallback
                const localProfile = localStorage.getItem('userProfile');
                if (localProfile) {
                    try {
                        const parsed = JSON.parse(localProfile);
                        setProfile(parsed);
                    }
                    catch (e) {
                        console.error('Failed to parse local profile:', e);
                    }
                }
            }
            finally {
                setIsLoading(false);
            }
        };
        loadProfile();
    }, []);
    const handleSave = async (newProfile) => {
        setIsLoading(true);
        setMessage(null);
        try {
            // Save to database
            await profileApi.save(newProfile);
            // Also save to localStorage as backup
            localStorage.setItem('userProfile', JSON.stringify(newProfile));
            setProfile(newProfile);
            // Invalidate profile query to trigger refetch and bootstrap
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            setMessage({ type: 'success', text: 'Profile saved successfully! Redirecting to dashboard...' });
            // Redirect to dashboard after a short delay
            // The dashboard will detect the profile and trigger auto-scraping
            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);
        }
        catch (error) {
            console.error('Failed to save profile:', error);
            setMessage({ type: 'error', text: `Failed to save profile: ${(error instanceof Error ? error.message : String(error)) || 'Unknown error'}` });
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
function ApplicationSettings() {
    const [mode, setMode] = useState(() => {
        const saved = localStorage.getItem('applicationMode');
        return saved || 'manual';
    });
    const [autoSubmit, setAutoSubmit] = useState(() => {
        const saved = localStorage.getItem('applicationAutoSubmit');
        return saved === 'true';
    });
    const [autoGenerateDocuments, setAutoGenerateDocuments] = useState(() => {
        const saved = localStorage.getItem('applicationAutoGenerateDocuments');
        return saved !== 'false'; // Default to true
    });
    const [minMatchScore, setMinMatchScore] = useState(() => {
        const saved = localStorage.getItem('applicationMinMatchScore');
        return saved ? parseInt(saved) : 70;
    });
    const [batchApply, setBatchApply] = useState(() => {
        const saved = localStorage.getItem('applicationBatchApply');
        return saved === 'true';
    });
    const [batchSize, setBatchSize] = useState(() => {
        const saved = localStorage.getItem('applicationBatchSize');
        return saved ? parseInt(saved) : 10;
    });
    const [delayBetweenApplications, setDelayBetweenApplications] = useState(() => {
        const saved = localStorage.getItem('applicationDelay');
        return saved ? parseInt(saved) : 5;
    });
    const [message, setMessage] = useState(null);
    const saveSettings = () => {
        localStorage.setItem('applicationMode', mode);
        localStorage.setItem('applicationAutoSubmit', autoSubmit.toString());
        localStorage.setItem('applicationAutoGenerateDocuments', autoGenerateDocuments.toString());
        localStorage.setItem('applicationMinMatchScore', minMatchScore.toString());
        localStorage.setItem('applicationBatchApply', batchApply.toString());
        localStorage.setItem('applicationBatchSize', batchSize.toString());
        localStorage.setItem('applicationDelay', delayBetweenApplications.toString());
        setMessage({ type: 'success', text: 'Application settings saved successfully' });
        setTimeout(() => setMessage(null), 3000);
    };
    // Update autoSubmit based on mode
    useEffect(() => {
        if (mode === 'yolo') {
            setAutoSubmit(true);
        }
        else if (mode === 'manual') {
            setAutoSubmit(false);
        }
        // semi-auto can have either
    }, [mode]);
    return (_jsx("div", { className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Application Mode" }), _jsx(CardDescription, { children: "Choose how you want to apply to jobs. Manual mode is safest, YOLO mode applies to all jobs automatically." })] }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs(RadioGroup, { value: mode, onValueChange: (value) => setMode(value), children: [_jsxs("div", { className: "flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors", children: [_jsx(RadioGroupItem, { value: "manual", id: "mode-manual", className: "mt-1" }), _jsxs("div", { className: "flex-1", children: [_jsxs(Label, { htmlFor: "mode-manual", className: "flex items-center gap-2 cursor-pointer", children: [_jsx(Shield, { className: "h-4 w-4 text-blue-500" }), _jsx("span", { className: "font-semibold", children: "Manual Mode" })] }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "Fill forms automatically, but you review and submit manually. Safest option." }), _jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: ["\u2713 Form filled automatically", _jsx("br", {}), "\u2713 Browser opens for review", _jsx("br", {}), "\u2713 You submit manually", _jsx("br", {}), "\u2713 Best for important applications"] })] })] }), _jsxs("div", { className: "flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors", children: [_jsx(RadioGroupItem, { value: "semi-auto", id: "mode-semi-auto", className: "mt-1" }), _jsxs("div", { className: "flex-1", children: [_jsxs(Label, { htmlFor: "mode-semi-auto", className: "flex items-center gap-2 cursor-pointer", children: [_jsx(Zap, { className: "h-4 w-4 text-yellow-500" }), _jsx("span", { className: "font-semibold", children: "Semi-Auto Mode" })] }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "Fill forms and show preview, then auto-submit after confirmation." }), _jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: ["\u2713 Form filled automatically", _jsx("br", {}), "\u2713 Preview shown before submission", _jsx("br", {}), "\u2713 Auto-submit after confirmation", _jsx("br", {}), "\u2713 Balance of speed and safety"] })] })] }), _jsxs("div", { className: "flex items-start space-x-3 p-4 border-2 border-red-500/50 rounded-lg hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors", children: [_jsx(RadioGroupItem, { value: "yolo", id: "mode-yolo", className: "mt-1" }), _jsxs("div", { className: "flex-1", children: [_jsxs(Label, { htmlFor: "mode-yolo", className: "flex items-center gap-2 cursor-pointer", children: [_jsx(Rocket, { className: "h-4 w-4 text-red-500" }), _jsx("span", { className: "font-semibold", children: "YOLO Mode \uD83D\uDE80" }), _jsx(Badge, { variant: "destructive", className: "ml-2", children: "AUTO-APPLY" })] }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "Fully automated. Applies to all jobs matching your criteria without any confirmation." }), _jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: ["\u2713 Forms filled automatically", _jsx("br", {}), "\u2713 Applications submitted automatically", _jsx("br", {}), "\u2713 Batch apply to multiple jobs", _jsx("br", {}), "\u26A0\uFE0F No manual review - use with caution"] }), _jsxs(Alert, { variant: "destructive", className: "mt-3", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsxs(AlertDescription, { children: [_jsx("strong", { children: "Warning:" }), " YOLO mode will automatically apply to jobs without your review. Make sure your profile and documents are ready. Use at your own risk."] })] })] })] })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold", children: "Test Mode" }), _jsxs(Alert, { children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsxs(AlertDescription, { children: [_jsx("strong", { children: "Test Mode:" }), " Use test endpoints to verify functionality without applying to real jobs. Applications will be sent to test endpoints where you can verify they were received."] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Enable Test Mode" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Use test endpoints for applications and emails (for testing only)" })] }), _jsx(Switch, { checked: (() => {
                                                const testMode = localStorage.getItem('testMode');
                                                return testMode === 'true';
                                            })(), onCheckedChange: (checked) => {
                                                localStorage.setItem('testMode', checked.toString());
                                                setMessage({ type: 'success', text: `Test mode ${checked ? 'enabled' : 'disabled'}` });
                                                setTimeout(() => setMessage(null), 2000);
                                            } })] }), (() => {
                                    const testMode = localStorage.getItem('testMode') === 'true';
                                    return testMode ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "test-application-endpoint", children: "Test Application Endpoint" }), _jsx(Input, { id: "test-application-endpoint", type: "url", placeholder: "https://httpbin.org/post", value: localStorage.getItem('testApplicationEndpoint') || 'https://httpbin.org/post', onChange: (e) => {
                                                            localStorage.setItem('testApplicationEndpoint', e.target.value);
                                                            setMessage({ type: 'success', text: 'Test endpoint saved' });
                                                            setTimeout(() => setMessage(null), 2000);
                                                        } }), _jsx("p", { className: "text-xs text-muted-foreground", children: "URL where test applications will be submitted. Default: httpbin.org/post (shows the submitted data)" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "test-email-endpoint", children: "Test Email Address" }), _jsx(Input, { id: "test-email-endpoint", type: "email", placeholder: "test@example.com", value: localStorage.getItem('testEmailEndpoint') || '', onChange: (e) => {
                                                            localStorage.setItem('testEmailEndpoint', e.target.value);
                                                            setMessage({ type: 'success', text: 'Test email saved' });
                                                            setTimeout(() => setMessage(null), 2000);
                                                        } }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Email address to receive test emails. Leave empty to use your configured email." })] }), _jsxs("div", { className: "p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg", children: [_jsx("p", { className: "text-sm font-medium text-blue-900 dark:text-blue-100 mb-2", children: "\uD83D\uDCA1 Test Endpoints Explained:" }), _jsxs("ul", { className: "text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside", children: [_jsxs("li", { children: [_jsx("strong", { children: "Application Endpoint:" }), " Applications will be sent here. httpbin.org/post shows all submitted data."] }), _jsxs("li", { children: [_jsx("strong", { children: "Test Email:" }), " All emails will be sent to this address instead of job contacts."] }), _jsxs("li", { children: [_jsx("strong", { children: "Safe Testing:" }), " No real applications will be sent when test mode is enabled."] })] })] })] })) : null;
                                })(), _jsx(Separator, {}), _jsx("h3", { className: "font-semibold", children: "Application Settings" }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Auto-Generate Documents" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Automatically generate resume and cover letter before applying" })] }), _jsx(Switch, { checked: autoGenerateDocuments, onCheckedChange: setAutoGenerateDocuments })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "min-match-score", children: "Minimum Match Score for Auto-Apply" }), _jsx(Input, { id: "min-match-score", type: "number", min: "0", max: "100", value: minMatchScore, onChange: (e) => setMinMatchScore(parseInt(e.target.value) || 70), disabled: mode !== 'yolo' }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Only auto-apply to jobs with match score >= this value (YOLO mode only)" })] }), mode === 'yolo' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Batch Apply" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Apply to multiple jobs in batch (YOLO mode)" })] }), _jsx(Switch, { checked: batchApply, onCheckedChange: setBatchApply })] }), batchApply && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "batch-size", children: "Batch Size" }), _jsx(Input, { id: "batch-size", type: "number", min: "1", max: "50", value: batchSize, onChange: (e) => setBatchSize(parseInt(e.target.value) || 10) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Number of jobs to apply to in each batch" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "delay-between", children: "Delay Between Applications (seconds)" }), _jsx(Input, { id: "delay-between", type: "number", min: "1", max: "60", value: delayBetweenApplications, onChange: (e) => setDelayBetweenApplications(parseInt(e.target.value) || 5) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Delay between applications to avoid rate limiting" })] })] }))] })), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Auto-Submit Applications" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Automatically submit applications without manual review" })] }), _jsx(Switch, { checked: autoSubmit, onCheckedChange: setAutoSubmit, disabled: mode === 'manual' })] })] }), message && (_jsxs(Alert, { variant: message.type === 'error' ? 'destructive' : 'default', children: [message.type === 'success' ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(AlertCircle, { className: "h-4 w-4" })), _jsx(AlertDescription, { children: message.text })] })), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { onClick: saveSettings, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), "Save Settings"] }) })] })] }) }));
}
function AutomationHealthCard() {
    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['automation-health'],
        queryFn: () => automationApi.healthCheck(),
        staleTime: 60 * 1000,
    });
    const health = data;
    const profileReady = !health || (health.profile_configured && (health.missing_fields?.length ?? 0) === 0);
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Automation Health Check" }), _jsx(CardDescription, { children: "Run this before enabling auto-apply to ensure everything is ready." })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => refetch(), disabled: isFetching, children: [_jsx(RefreshCw, { className: cn("mr-2 h-4 w-4", isFetching && "animate-spin") }), "Refresh"] })] }), _jsx(CardContent, { className: "space-y-4", children: isLoading && !health ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Running checks..." })) : (_jsxs(_Fragment, { children: [_jsx(HealthRow, { label: "Profile completeness", ok: profileReady, description: profileReady
                                ? "Name, email, and phone look good."
                                : `Missing: ${(health?.missing_fields ?? []).join(", ")}` }), _jsx(HealthRow, { label: "Resume on file", ok: (health?.resume_documents ?? 0) > 0, description: (health?.resume_documents ?? 0) > 0
                                ? `${health?.resume_documents} resume uploaded.`
                                : "Upload at least one resume document." }), _jsx(HealthRow, { label: "Saved credentials", ok: (health?.credential_platforms?.length ?? 0) > 0, description: (health?.credential_platforms?.length ?? 0) > 0
                                ? `Active for: ${(health?.credential_platforms ?? []).join(", ")}`
                                : "Add credentials under the Credentials tab." }), _jsx(HealthRow, { label: "Browser automation", ok: Boolean(health?.chromium_available || health?.playwright_available), description: health
                                ? `Chromium: ${health.chromium_available ? 'ready ✅' : 'missing ❌'}, Playwright: ${health.playwright_available ? 'ready ✅' : 'missing ❌'}`
                                : "Browser runtimes will be detected automatically." })] })) })] }));
}
function HealthRow({ label, ok, description, }) {
    return (_jsxs("div", { className: "flex items-start justify-between border rounded-lg p-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: label }), _jsx("p", { className: "text-sm text-muted-foreground", children: description })] }), _jsx(Badge, { variant: ok ? "default" : "destructive", children: ok ? "Ready" : "Needs attention" })] }));
}
const defaultPreferenceForm = {
    query: "remote software engineer",
    sources: ["remotive", "remoteok", "wellfound", "greenhouse"],
    remoteOnly: true,
    minMatchScore: 65,
    alertFrequency: "daily",
    locations: [],
    titles: [],
    preferredCompanies: [],
    avoidCompanies: [],
    requiredSkills: [],
    preferredSkills: [],
    jobTypes: [],
    industries: [],
    benefits: [],
    companySize: null,
    minSalary: "",
};
function JobPreferences() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(defaultPreferenceForm);
    const [runLoading, setRunLoading] = useState(false);
    const { data: savedSearches, isLoading } = useQuery({
        queryKey: ["saved-searches"],
        queryFn: () => savedSearchApi.list(false),
    });
    const smartSearch = useMemo(() => savedSearches?.find((search) => search.name === "Smart Filter"), [savedSearches]);
    useEffect(() => {
        if (smartSearch) {
            const filters = {
                remote_only: smartSearch.filters?.remote_only ?? defaultPreferenceForm.remoteOnly,
                preferred_locations: smartSearch.filters?.preferred_locations ?? [],
                preferred_titles: smartSearch.filters?.preferred_titles ?? [],
                preferred_companies: smartSearch.filters?.preferred_companies ?? [],
                avoid_companies: smartSearch.filters?.avoid_companies ?? [],
                required_skills: smartSearch.filters?.required_skills ?? [],
                preferred_skills: smartSearch.filters?.preferred_skills ?? [],
                job_types: smartSearch.filters?.job_types ?? [],
                industries: smartSearch.filters?.industries ?? [],
                must_have_benefits: smartSearch.filters?.must_have_benefits ?? [],
                company_size: smartSearch.filters?.company_size ?? null,
                min_salary: smartSearch.filters?.min_salary ?? null,
            };
            setForm({
                query: smartSearch.query || defaultPreferenceForm.query,
                sources: smartSearch.sources?.length > 0
                    ? smartSearch.sources
                    : defaultPreferenceForm.sources,
                remoteOnly: filters.remote_only,
                minMatchScore: smartSearch.min_match_score || defaultPreferenceForm.minMatchScore,
                alertFrequency: smartSearch.alert_frequency || defaultPreferenceForm.alertFrequency,
                locations: filters.preferred_locations,
                titles: filters.preferred_titles,
                preferredCompanies: filters.preferred_companies,
                avoidCompanies: filters.avoid_companies,
                requiredSkills: filters.required_skills,
                preferredSkills: filters.preferred_skills,
                jobTypes: filters.job_types,
                industries: filters.industries,
                benefits: filters.must_have_benefits,
                companySize: filters.company_size,
                minSalary: filters.min_salary ? String(filters.min_salary) : "",
            });
        }
    }, [smartSearch]);
    const sourceOptions = [
        { id: "remotive", label: "Remotive" },
        { id: "remoteok", label: "RemoteOK" },
        { id: "wellfound", label: "Wellfound" },
        { id: "greenhouse", label: "Greenhouse" },
        { id: "ziprecruiter", label: "ZipRecruiter" },
        { id: "dice", label: "Dice" },
    ];
    const jobTypeOptions = ["full-time", "part-time", "contract", "freelance", "internship"];
    const companySizeOptions = ["startup", "small", "medium", "large", "enterprise"];
    const updateArrayField = (field, value) => {
        setForm((prev) => {
            const current = prev[field];
            const exists = current.includes(value);
            return {
                ...prev,
                [field]: exists ? current.filter((item) => item !== value) : [...current, value],
            };
        });
    };
    const handleTagChange = (field, values) => {
        setForm((prev) => ({
            ...prev,
            [field]: values,
        }));
    };
    const savePreferences = useMutation({
        mutationFn: async () => {
            const filters = {
                remote_only: form.remoteOnly,
                min_match_score: form.minMatchScore,
                status: smartSearch?.filters?.status || "all",
                skill_filter: smartSearch?.filters?.skill_filter || null,
                preferred_locations: form.locations,
                preferred_titles: form.titles,
                preferred_companies: form.preferredCompanies,
                avoid_companies: form.avoidCompanies,
                required_skills: form.requiredSkills,
                preferred_skills: form.preferredSkills,
                min_salary: form.minSalary ? parseInt(form.minSalary, 10) || null : null,
                job_types: form.jobTypes,
                industries: form.industries,
                must_have_benefits: form.benefits,
                company_size: form.companySize,
            };
            if (smartSearch?.id) {
                return savedSearchApi.update({
                    ...smartSearch,
                    query: form.query,
                    sources: form.sources,
                    filters,
                    alert_frequency: form.alertFrequency,
                    min_match_score: form.minMatchScore,
                    enabled: true,
                });
            }
            return savedSearchApi.create({
                name: "Smart Filter",
                query: form.query,
                sources: form.sources,
                filters,
                alert_frequency: form.alertFrequency,
                min_match_score: form.minMatchScore,
                enabled: true,
            });
        },
        onSuccess: () => {
            toast({ title: "Preferences saved", description: "Smart filter updated successfully." });
            queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
        },
        onError: (error) => {
            toast({
                title: "Failed to save preferences",
                description: (error instanceof Error ? error.message : String(error)) || "Try again in a moment.",
                variant: "destructive",
            });
        },
    });
    const handleRunSmartFilter = async () => {
        if (!smartSearch?.id) {
            toast({
                title: "No saved filter found",
                description: "Save your preferences first before running the filter.",
            });
            return;
        }
        try {
            setRunLoading(true);
            const jobs = await savedSearchApi.run(smartSearch.id);
            toast({
                title: "Smart filter executed",
                description: `Found ${jobs.length} matching job${jobs.length === 1 ? "" : "s"}.`,
            });
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }
        catch (error) {
            toast({
                title: "Failed to run filter",
                description: (error instanceof Error ? error.message : String(error)) || "Please try again later.",
                variant: "destructive",
            });
        }
        finally {
            setRunLoading(false);
        }
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Smart Job Preferences" }), _jsx(CardDescription, { children: "Answer a few prompts and we\u2019ll automatically filter jobs and saved searches to match your ideal role." })] }), _jsx(CardContent, { className: "space-y-6", children: isLoading ? (_jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), "Loading existing preferences..."] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "smart-query", children: "Role / Keyword Focus" }), _jsx(Input, { id: "smart-query", value: form.query, onChange: (e) => setForm((prev) => ({ ...prev, query: e.target.value })), placeholder: "e.g. Staff React Engineer" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "smart-salary", children: "Minimum Salary (USD)" }), _jsx(Input, { id: "smart-salary", type: "number", min: "0", value: form.minSalary, onChange: (e) => setForm((prev) => ({ ...prev, minSalary: e.target.value })), placeholder: "120000" })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Sources" }), _jsx("div", { className: "flex flex-wrap gap-2", children: sourceOptions.map((source) => (_jsx(Button, { type: "button", variant: form.sources.includes(source.id) ? "default" : "outline", size: "sm", onClick: () => updateArrayField("sources", source.id), children: source.label }, source.id))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Alert Frequency" }), _jsxs("select", { className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value: form.alertFrequency, onChange: (e) => setForm((prev) => ({ ...prev, alertFrequency: e.target.value })), children: [_jsx("option", { value: "hourly", children: "Hourly" }), _jsx("option", { value: "daily", children: "Daily" }), _jsx("option", { value: "weekly", children: "Weekly" }), _jsx("option", { value: "never", children: "Never" })] })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Match Requirements" }), _jsxs("div", { className: "space-y-3 rounded-lg border p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: "Remote only" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Filter out onsite roles automatically." })] }), _jsx(Switch, { checked: form.remoteOnly, onCheckedChange: (checked) => setForm((prev) => ({ ...prev, remoteOnly: checked })) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx(Label, { htmlFor: "smart-min-match", className: "text-sm", children: "Minimum match score" }), _jsx(Input, { id: "smart-min-match", type: "number", min: "0", max: "100", value: form.minMatchScore, onChange: (e) => setForm((prev) => ({
                                                                ...prev,
                                                                minMatchScore: parseInt(e.target.value) || prev.minMatchScore,
                                                            })) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Jobs below this score will be hidden from the smart feed." })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "smart-company-size", children: "Preferred company size" }), _jsxs("select", { id: "smart-company-size", className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value: form.companySize || "", onChange: (e) => setForm((prev) => ({ ...prev, companySize: e.target.value || null })), children: [_jsx("option", { value: "", children: "No preference" }), companySizeOptions.map((size) => (_jsx("option", { value: size, children: size.charAt(0).toUpperCase() + size.slice(1) }, size)))] })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("div", { className: "space-y-4", children: [_jsx(TagInput, { label: "Preferred locations", values: form.locations, placeholder: "Add city or region", onChange: (values) => handleTagChange("locations", values) }), _jsx(TagInput, { label: "Target job titles", values: form.titles, placeholder: "Add role (e.g. 'Senior React Engineer')", onChange: (values) => handleTagChange("titles", values) }), _jsx(TagInput, { label: "Required skills", values: form.requiredSkills, placeholder: "Add required skill", onChange: (values) => handleTagChange("requiredSkills", values) }), _jsx(TagInput, { label: "Nice-to-have skills", values: form.preferredSkills, placeholder: "Add nice-to-have skill", onChange: (values) => handleTagChange("preferredSkills", values) })] }), _jsxs("div", { className: "space-y-4", children: [_jsx(TagInput, { label: "Preferred companies", values: form.preferredCompanies, placeholder: "Add company name", onChange: (values) => handleTagChange("preferredCompanies", values) }), _jsx(TagInput, { label: "Avoid companies", values: form.avoidCompanies, placeholder: "Add company to avoid", onChange: (values) => handleTagChange("avoidCompanies", values) }), _jsx(TagInput, { label: "Industries", values: form.industries, placeholder: "Add industry (e.g. fintech, AI safety)", onChange: (values) => handleTagChange("industries", values) }), _jsx(TagInput, { label: "Must-have benefits", values: form.benefits, placeholder: "Add benefit (e.g. visa sponsorship)", onChange: (values) => handleTagChange("benefits", values) })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx(Label, { children: "Ideal working style" }), _jsx("div", { className: "flex flex-wrap gap-2", children: jobTypeOptions.map((type) => (_jsx(Button, { type: "button", variant: form.jobTypes.includes(type) ? "default" : "outline", size: "sm", onClick: () => updateArrayField("jobTypes", type), children: type }, type))) })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { onClick: () => savePreferences.mutate(), disabled: savePreferences.isPending, className: "gap-2", children: [savePreferences.isPending && _jsx(Loader2, { className: "h-4 w-4 animate-spin" }), _jsx(Save, { className: "h-4 w-4" }), smartSearch ? "Update Preferences" : "Save Preferences"] }), _jsxs(Button, { variant: "secondary", onClick: handleRunSmartFilter, disabled: runLoading, className: "gap-2", children: [runLoading ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin" })) : (_jsx(Play, { className: "h-4 w-4" })), "Run Smart Filter"] }), smartSearch && smartSearch.last_run_at && (_jsxs(Badge, { variant: "outline", className: "text-xs", children: ["Last run ", new Date(smartSearch.last_run_at).toLocaleString()] }))] })] })) })] }));
}
function TagInput({ label, values, placeholder, onChange, }) {
    const [inputValue, setInputValue] = useState("");
    const addValue = () => {
        const trimmed = inputValue.trim();
        if (!trimmed)
            return;
        if (!values.includes(trimmed)) {
            onChange([...values, trimmed]);
        }
        setInputValue("");
    };
    const handleKeyDown = (event) => {
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addValue();
        }
    };
    return (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: label }), _jsx("div", { className: "flex flex-wrap gap-2", children: values.map((value) => (_jsxs(Badge, { variant: "outline", className: "flex items-center gap-1", children: [value, _jsx("button", { type: "button", onClick: () => onChange(values.filter((item) => item !== value)), className: "ml-1 text-xs text-muted-foreground hover:text-foreground", children: "\u00D7" })] }, value))) }), _jsx(Input, { value: inputValue, onChange: (e) => setInputValue(e.target.value), onKeyDown: handleKeyDown, placeholder: placeholder })] }));
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
    const { data: savedSearchesStatus } = useQuery({
        queryKey: ["saved-searches-status"],
        queryFn: () => savedSearchApi.getStatus(),
        refetchInterval: 10000,
    });
    useEffect(() => {
        const savedConfig = localStorage.getItem("schedulerConfig");
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                setEnabled(config.enabled);
                setSchedule(config.schedule);
                setQuery(config.query);
                setSources(config.sources || []);
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
            setSources(status.sources || []);
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
                sources: sources || [],
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
            setMessage({ type: "error", text: (error instanceof Error ? error.message : String(error)) || "Failed to save scheduler configuration" });
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
            setMessage({ type: "error", text: (error instanceof Error ? error.message : String(error)) || "Failed to start scheduler" });
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
            setMessage({ type: "error", text: (error instanceof Error ? error.message : String(error)) || "Failed to stop scheduler" });
            setTimeout(() => setMessage(null), 3000);
        }
        finally {
            setIsLoading(false);
        }
    };
    const toggleSource = (src) => {
        setSources(prev => {
            const current = prev || [];
            return current.includes(src) ? current.filter(s => s !== src) : [...current, src];
        });
    };
    return (_jsx("div", { className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Automated Job Scraping" }), _jsx(CardDescription, { children: "Schedule automatic job scraping at regular intervals. Jobs will be scraped and saved automatically." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Enable Scheduler" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Automatically scrape jobs on a schedule" })] }), _jsx(Switch, { checked: enabled, onCheckedChange: setEnabled, disabled: isLoading })] }), status && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2 p-3 bg-muted rounded-lg", children: [_jsx(Clock, { className: "h-4 w-4" }), _jsxs("div", { className: "flex-1", children: [_jsxs("p", { className: "text-sm font-medium", children: ["Status: ", isRunning ? "Running" : "Stopped"] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Schedule: ", schedule, " | Query: ", query] })] }), _jsx("div", { className: "flex gap-2", children: !isRunning ? (_jsxs(Button, { variant: "outline", size: "sm", onClick: handleStart, disabled: isLoading || !enabled, children: [_jsx(Play, { className: "mr-2 h-4 w-4" }), "Start"] })) : (_jsxs(Button, { variant: "outline", size: "sm", onClick: handleStop, disabled: isLoading, children: [_jsx(Square, { className: "mr-2 h-4 w-4" }), "Stop"] })) })] }), savedSearchesStatus && (_jsxs("div", { className: "flex items-center gap-2 p-3 bg-muted/50 rounded-lg border", children: [_jsx(Search, { className: "h-4 w-4" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium", children: "Saved Searches" }), _jsxs("div", { className: "flex gap-4 text-xs text-muted-foreground mt-1", children: [_jsxs("span", { children: ["Total: ", savedSearchesStatus.total] }), _jsxs("span", { children: ["Enabled: ", savedSearchesStatus.enabled] }), savedSearchesStatus.due_for_run > 0 && (_jsxs("span", { className: "text-amber-600 font-medium", children: [savedSearchesStatus.due_for_run, " due for run"] }))] })] })] }))] })), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "schedule", children: "Schedule (Cron Expression)" }), _jsx(Input, { id: "schedule", type: "text", placeholder: "0 9 * * *", value: schedule, onChange: (e) => setSchedule(e.target.value), disabled: isLoading }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Cron format: \"minute hour day month weekday\". Example: \"0 9 * * *\" = Daily at 9 AM" }), _jsxs("div", { className: "text-xs text-muted-foreground space-y-1", children: [_jsx("p", { children: _jsx("strong", { children: "Common schedules:" }) }), _jsxs("ul", { className: "list-disc list-inside space-y-1 ml-2", children: [_jsx("li", { children: "\"0 9 * * *\" - Daily at 9 AM" }), _jsx("li", { children: "\"0 */6 * * *\" - Every 6 hours" }), _jsx("li", { children: "\"0 */12 * * *\" - Every 12 hours" }), _jsx("li", { children: "\"0 9 * * 1\" - Every Monday at 9 AM" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "scheduler-query", children: "Default Search Query" }), _jsx(Input, { id: "scheduler-query", type: "text", placeholder: "developer", value: query, onChange: (e) => setQuery(e.target.value), disabled: isLoading }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Default search query to use when scraping jobs" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Sources" }), _jsx("p", { className: "text-xs text-muted-foreground mb-2", children: "Select sources to scrape. Leave empty to scrape all sources." }), _jsx("div", { className: "grid gap-2 md:grid-cols-3", children: ["hhkz", "linkedin", "wellfound"].map(src => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", id: `scheduler-source-${src}`, checked: (sources || []).includes(src), onChange: () => toggleSource(src), disabled: isLoading, className: "rounded border-gray-300" }), _jsx(Label, { htmlFor: `scheduler-source-${src}`, className: "capitalize cursor-pointer", children: src })] }, src))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "scheduler-min-match", children: "Minimum Match Score" }), _jsx(Input, { id: "scheduler-min-match", type: "number", min: "0", max: "100", placeholder: "60", value: minMatchScore, onChange: (e) => setMinMatchScore(e.target.value), disabled: isLoading }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Only notify for jobs with match score >= this value (0-100). Leave empty for no minimum." })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { children: "Send Notifications" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Send email notifications when new jobs are found" })] }), _jsx(Switch, { checked: sendNotifications, onCheckedChange: setSendNotifications, disabled: isLoading })] })] }), message && (_jsxs(Alert, { variant: message.type === "error" ? "destructive" : "default", children: [message.type === "success" ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(AlertCircle, { className: "h-4 w-4" })), _jsx(AlertDescription, { children: message.text })] })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => refetchStatus(), disabled: isLoading, children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}` }), "Refresh Status"] }), _jsxs(Button, { onClick: saveSchedulerConfig, disabled: isLoading, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), isLoading ? "Saving..." : "Save Configuration"] })] })] })] }) }));
}

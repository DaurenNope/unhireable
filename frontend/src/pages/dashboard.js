import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { jobApi, profileApi, insightsApi, authApi, automationApi, applicationApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatSourceLabel } from '@/lib/sources';
import { Sparkles, Rocket, Lightbulb, TrendingUp, RefreshCw, Wand2, Trophy, Target, ArrowUpRight, Shield, ShieldCheck, } from 'lucide-react';
import { OnboardingChecklist, } from '@/components/dashboard/OnboardingChecklist';
const DEFAULT_SOURCES = ['remotive', 'remoteok', 'greenhouse', 'wellfound', 'indeed'];
const formatPercent = (value) => `${Math.round(value)}%`;
const getMatchMood = (score) => {
    if (score === null || score === undefined) {
        return { label: 'No score yet', className: 'bg-muted text-muted-foreground' };
    }
    if (score >= 80) {
        return {
            label: 'Stellar fit',
            className: 'bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0',
        };
    }
    if (score >= 60) {
        return {
            label: 'Great vibe',
            className: 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0',
        };
    }
    return {
        label: 'Worth a peek',
        className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0',
    };
};
const friendlyName = (profile) => {
    const raw = profile?.personal_info.name?.trim();
    if (!raw)
        return 'friend';
    const first = raw.split(' ')[0];
    return first || 'friend';
};
const formatRelativeTime = (date) => {
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1)
        return 'just now';
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7)
        return `${days}d ago`;
    return date.toLocaleDateString();
};
export function Dashboard() {
    const queryClient = useQueryClient();
    const [scrapeQuery, setScrapeQuery] = useState('developer');
    const [isScraping, setIsScraping] = useState(false);
    const [bootstrapped, setBootstrapped] = useState(false);
    const [isAutoApplying, setIsAutoApplying] = useState(false);
    const [isDryRun, setIsDryRun] = useState(true);
    const [autoApplyResult, setAutoApplyResult] = useState(null);
    const { data: jobsData, isLoading: jobsLoading } = useQuery({
        queryKey: ['jobs'],
        queryFn: () => jobApi.list(undefined, undefined, 1, 50), // Limit to 50 jobs for dashboard
        staleTime: 30000, // Cache for 30 seconds
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    });
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: () => profileApi.get(),
    });
    const { data: marketInsights, isLoading: insightsLoading } = useQuery({
        queryKey: ['market-insights', 30],
        queryFn: () => insightsApi.getMarketInsights(30),
    });
    const { data: recommendedJobs, isLoading: recommendationsLoading } = useQuery({
        queryKey: ['recommended-jobs'],
        queryFn: () => jobApi.getRecommended(10),
        enabled: !!profile, // Only fetch if profile exists
    });
    const { data: authStatus } = useQuery({
        queryKey: ['auth-status'],
        queryFn: () => authApi.getStatus(),
        staleTime: 60000,
    });
    const { data: automationHealth } = useQuery({
        queryKey: ['automation-health'],
        queryFn: () => automationApi.healthCheck(),
        staleTime: 60000,
    });
    const jobs = jobsData ?? [];
    const isLoading = jobsLoading || insightsLoading;
    useEffect(() => {
        if (bootstrapped)
            return;
        if (profile === undefined || jobsData === undefined)
            return;
        if (!profile) {
            setBootstrapped(true);
            return;
        }
        if (jobsData.length > 0) {
            setBootstrapped(true);
            return;
        }
        (async () => {
            try {
                setIsScraping(true);
                await jobApi.scrapeSelected(DEFAULT_SOURCES, scrapeQuery || 'developer');
                queryClient.invalidateQueries({ queryKey: ['jobs'] });
                queryClient.invalidateQueries({ queryKey: ['market-insights'] });
            }
            catch (error) {
                console.error('Auto-scrape failed:', error);
            }
            finally {
                setIsScraping(false);
                setBootstrapped(true);
            }
        })();
    }, [profile, jobsData, bootstrapped, queryClient, scrapeQuery]);
    const topMatches = useMemo(() => {
        return [...jobs]
            .filter((job) => (job.match_score ?? -1) >= 0)
            .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
            .slice(0, 3);
    }, [jobs]);
    const freshFinds = useMemo(() => {
        return [...jobs]
            .filter((job) => job.created_at)
            .sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        })
            .slice(0, 4);
    }, [jobs]);
    const skillSuggestions = useMemo(() => {
        return marketInsights?.skills_to_learn?.slice(0, 5) ?? [];
    }, [marketInsights]);
    const lastScrapedDate = useMemo(() => {
        if (!jobs.length)
            return null;
        const timestamps = jobs
            .map((job) => (job.created_at ? new Date(job.created_at).getTime() : null))
            .filter((value) => value !== null);
        if (!timestamps.length)
            return null;
        return new Date(Math.max(...timestamps));
    }, [jobs]);
    const handleScrape = async () => {
        if (isScraping)
            return;
        setIsScraping(true);
        try {
            const query = scrapeQuery.trim() || 'developer';
            await jobApi.scrapeSelected(DEFAULT_SOURCES, query);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['market-insights'] });
        }
        catch (error) {
            console.error('Failed to scrape jobs:', error);
        }
        finally {
            setIsScraping(false);
        }
    };
    const handleAutoApply = async () => {
        if (isAutoApplying)
            return;
        setIsAutoApplying(true);
        setAutoApplyResult(null);
        try {
            const result = await applicationApi.autoApply('remote senior backend engineer', 5, isDryRun);
            setAutoApplyResult(result);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            queryClient.invalidateQueries({ queryKey: ['market-insights'] });
        }
        catch (error) {
            console.error('Auto-apply failed:', error);
        }
        finally {
            setIsAutoApplying(false);
        }
    };
    const jobsCount = jobs.length;
    const statusStateMeta = {
        ready: {
            label: 'Ready',
            className: 'text-emerald-600',
            pillClass: 'bg-emerald-50 text-emerald-700',
        },
        warning: {
            label: 'Needs attention',
            className: 'text-amber-600',
            pillClass: 'bg-amber-50 text-amber-700',
        },
        action: {
            label: 'Action required',
            className: 'text-red-600',
            pillClass: 'bg-red-50 text-red-700',
        },
    };
    const authConfigured = Boolean(authStatus?.configured);
    const authAuthenticated = Boolean(authStatus?.authenticated);
    const profileReady = Boolean(profile);
    const docCount = automationHealth?.resume_documents ?? 0;
    const missingFields = automationHealth?.missing_fields ?? [];
    const credentialsReady = (automationHealth?.credential_platforms?.length ?? 0) > 0;
    const browsersReady = Boolean(automationHealth?.playwright_available || automationHealth?.chromium_available);
    const jobFeedStale = lastScrapedDate
        ? Date.now() - lastScrapedDate.getTime() > 1000 * 60 * 60 * 48
        : false;
    const jobFeedState = jobsCount === 0 ? 'action' : jobFeedStale ? 'warning' : 'ready';
    const jobFeedDetail = jobsCount === 0
        ? 'No jobs scraped yet.'
        : `Last import ${lastScrapedDate ? formatRelativeTime(lastScrapedDate) : 'recently'}.`;
    const jobFeedActionLabel = isScraping
        ? 'Scraping…'
        : jobsCount === 0
            ? 'Run scrape'
            : 'Refresh feed';
    const automationState = automationHealth
        ? automationHealth.profile_configured && docCount > 0 && credentialsReady && browsersReady
            ? 'ready'
            : 'warning'
        : 'warning';
    const automationDetail = !automationHealth
        ? 'Checking automation health…'
        : automationHealth.profile_configured
            ? docCount === 0
                ? 'Upload a resume so forms can auto-fill.'
                : credentialsReady
                    ? browsersReady
                        ? 'Resumes, credentials, and browser automation look good.'
                        : 'Install Playwright/Chromium to unlock auto-apply.'
                    : 'Add at least one credential platform.'
            : missingFields.length
                ? `Need: ${missingFields.slice(0, 2).join(', ')}`
                : 'Complete your profile fields.';
    const statusTiles = [
        {
            label: 'Authentication',
            icon: ShieldCheck,
            state: authStatus
                ? authAuthenticated
                    ? 'ready'
                    : authConfigured
                        ? 'warning'
                        : 'action'
                : 'warning',
            detail: !authStatus
                ? 'Checking sign-in…'
                : authAuthenticated
                    ? `Signed in${authStatus.email ? ` as ${authStatus.email}` : ''}.`
                    : authConfigured
                        ? 'Session expired — log back in.'
                        : 'Protect your workspace with a password.',
            action: authAuthenticated
                ? undefined
                : {
                    type: 'link',
                    label: authConfigured ? 'Log in' : 'Set up login',
                    to: '/auth',
                },
        },
        {
            label: 'Persona & profile',
            icon: Shield,
            state: profileReady ? 'ready' : 'action',
            detail: profileReady
                ? `${profile?.personal_info?.name ?? 'Profile'} loaded.`
                : 'Load a persona or finish your profile to personalize matches.',
            action: {
                type: 'link',
                label: profileReady ? 'Edit profile' : 'Load persona',
                to: profileReady ? '/settings?tab=profile' : '/persona-test',
            },
        },
        {
            label: 'Automation kit',
            icon: Sparkles,
            state: automationState,
            detail: automationDetail,
            action: automationHealth && docCount === 0
                ? { type: 'link', label: 'Add resume', to: '/settings?tab=profile' }
                : !credentialsReady
                    ? { type: 'link', label: 'Add credentials', to: '/settings' }
                    : undefined,
        },
        {
            label: 'Job feed',
            icon: RefreshCw,
            state: jobFeedState,
            detail: jobFeedDetail,
            action: {
                type: 'button',
                label: jobFeedActionLabel,
                onClick: handleScrape,
                disabled: isScraping,
            },
        },
        {
            label: 'Auto-apply',
            icon: Rocket,
            state: isAutoApplying ? 'action' : autoApplyResult ? 'ready' : 'warning',
            detail: isAutoApplying
                ? 'Applying to jobs...'
                : autoApplyResult
                    ? `Applied to ${autoApplyResult.applications_submitted} jobs (${autoApplyResult.applications_failed} failed).`
                    : 'Automatically apply to matching remote jobs.',
            action: {
                type: 'button',
                label: isAutoApplying ? 'Applying...' : isDryRun ? 'Start Dry Run' : 'Start Auto-apply',
                onClick: handleAutoApply,
                disabled: isAutoApplying || isScraping,
            },
            footer: (_jsxs("div", { className: "flex items-center space-x-2 pt-2", children: [_jsx(Switch, { id: "dry-run", checked: isDryRun, onCheckedChange: setIsDryRun }), _jsx(Label, { htmlFor: "dry-run", className: "text-xs text-muted-foreground", children: "Dry Run Mode" })] })),
        },
    ];
    const checklistSteps = [
        {
            id: 'auth',
            title: 'Secure the workspace',
            description: authAuthenticated
                ? 'Password protection is active.'
                : 'Set a password so local data stays private.',
            done: authAuthenticated,
            action: authAuthenticated
                ? undefined
                : { type: 'link', label: authConfigured ? 'Log in' : 'Set up', to: '/auth' },
        },
        {
            id: 'persona',
            title: 'Load a persona',
            description: profileReady
                ? `${profile?.personal_info?.name?.split(' ')[0] || 'Profile'} is powering recommendations.`
                : 'Load Atlas (or your profile) to prefill saved searches.',
            done: profileReady,
            action: {
                type: 'link',
                label: profileReady ? 'Switch persona' : 'Load persona',
                to: '/persona-test',
            },
        },
        {
            id: 'scrape',
            title: 'Pull fresh jobs',
            description: jobsCount > 0
                ? `Last scrape ${lastScrapedDate ? formatRelativeTime(lastScrapedDate) : 'recently'}.`
                : 'Grab a sample feed to explore the UI.',
            done: jobsCount > 0,
            action: {
                type: 'button',
                label: jobFeedActionLabel,
                onClick: handleScrape,
                disabled: isScraping,
            },
        },
        {
            id: 'review',
            title: 'Review matches & ATS tips',
            description: recommendationsLoading || (recommendedJobs && recommendedJobs.length > 0)
                ? 'Personalized recommendations ready.'
                : 'Once you add skills + jobs, we’ll rank matches here.',
            done: Boolean(recommendedJobs && recommendedJobs.length > 0),
            action: { type: 'link', label: 'Open jobs', to: '/jobs' },
        },
    ];
    const orientationShortcuts = [
        {
            title: 'Persona dry-run',
            description: 'Load Atlas (or your own) persona and simulate a full auto-apply.',
            icon: Rocket,
            to: '/persona-test',
            label: 'Open persona lab',
        },
        {
            title: 'Profile & docs',
            description: 'Polish your summary, upload resumes, and set smart filters.',
            icon: Shield,
            to: '/settings?tab=profile',
            label: 'Edit profile',
        },
        {
            title: 'Auth & security',
            description: 'Lock the workspace and review credentials before testing.',
            icon: ShieldCheck,
            to: '/auth',
            label: 'Review auth',
        },
    ];
    const heroName = friendlyName(profile);
    const totalMatches = jobs.filter((job) => (job.match_score ?? -1) >= 0).length;
    const remotePercentage = marketInsights?.remote_percentage ?? 0;
    const topSkill = marketInsights?.trending_skills?.[0];
    const seekerLevel = Math.max(1, Math.min(20, Math.floor(totalMatches / 8) + 1));
    const matchesThisLevel = totalMatches % 8;
    const xpPercent = Math.min(100, Math.round((matchesThisLevel / 8) * 100));
    const nextMilestoneTarget = seekerLevel * 8;
    const journeyStats = [
        {
            label: 'Level',
            value: `Level ${seekerLevel}`,
            subtext: `${xpPercent}% toward Level ${seekerLevel + 1}`,
            icon: Trophy,
        },
        {
            label: 'Remote pulse',
            value: formatPercent(remotePercentage),
            subtext: remotePercentage > 60 ? 'Remote-friendly spree' : 'Balanced market',
            icon: Target,
        },
        {
            label: 'Skill signal',
            value: topSkill?.name ?? 'Awaiting scrape',
            subtext: topSkill ? `${topSkill.job_count} roles mention this` : 'Run a scrape to refresh',
            icon: ArrowUpRight,
        },
    ];
    if (isLoading) {
        return (_jsxs("div", { className: "space-y-8 p-6 animate-in fade-in duration-500", children: [_jsx(Card, { className: "border-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "space-y-4", children: [_jsx(Skeleton, { className: "h-6 w-24 rounded-full" }), _jsx(Skeleton, { className: "h-8 w-64" }), _jsx(Skeleton, { className: "h-4 w-96" }), _jsxs("div", { className: "flex gap-3", children: [_jsx(Skeleton, { className: "h-10 w-48" }), _jsx(Skeleton, { className: "h-10 w-32" }), _jsx(Skeleton, { className: "h-10 w-32" })] })] }) }) }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-3", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-48" }), _jsx(Skeleton, { className: "h-4 w-64 mt-2" })] }), _jsx(CardContent, { className: "space-y-4", children: [1, 2, 3].map((i) => (_jsxs("div", { className: "space-y-3 rounded-xl border p-4", children: [_jsx(Skeleton, { className: "h-5 w-3/4" }), _jsx(Skeleton, { className: "h-4 w-1/2" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Skeleton, { className: "h-6 w-20 rounded-full" }), _jsx(Skeleton, { className: "h-6 w-24 rounded-full" })] })] }, i))) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-40" }), _jsx(Skeleton, { className: "h-4 w-56 mt-2" })] }), _jsx(CardContent, { className: "space-y-3", children: [1, 2, 3, 4, 5].map((i) => (_jsx(Skeleton, { className: "h-12 w-full rounded-xl" }, i))) })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-48" }), _jsx(Skeleton, { className: "h-4 w-64 mt-2" })] }), _jsx(CardContent, { children: _jsx("div", { className: "grid gap-3 md:grid-cols-2", children: [1, 2, 3, 4].map((i) => (_jsx(Skeleton, { className: "h-24 w-full rounded-xl" }, i))) }) })] })] }));
    }
    return (_jsxs("div", { className: "space-y-8 p-6 animate-in fade-in duration-500 bg-muted/30 min-h-screen", children: [_jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsxs(CardHeader, { className: "pb-4", children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "Quick Status" }), _jsx(CardDescription, { className: "text-sm", children: "See what needs your attention." })] }), _jsx(CardContent, { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-4", children: statusTiles.map((tile) => (_jsxs("div", { className: "rounded-xl border bg-background/80 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(tile.icon, { className: "h-4 w-4 text-muted-foreground" }), _jsx("span", { className: "text-sm font-semibold text-foreground", children: tile.label })] }), _jsx("span", { className: `text-xs font-semibold rounded-full px-2 py-0.5 ${statusStateMeta[tile.state].pillClass}`, children: statusStateMeta[tile.state].label })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: tile.detail }), tile.action && (tile.action.type === 'link' ? (_jsx(Button, { variant: "link", size: "sm", className: "px-0", asChild: true, children: _jsx(Link, { to: tile.action.to, children: tile.action.label }) })) : (_jsx(Button, { variant: "link", size: "sm", className: "px-0", onClick: tile.action.onClick, disabled: tile.action.disabled, children: tile.action.label }))), tile.footer] }, tile.label))) })] }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-[2fr_minmax(0,1fr)]", children: [_jsx(Card, { className: "border bg-gradient-to-br from-primary/5 via-background to-background shadow-md", children: _jsxs(CardContent, { className: "flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between p-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-4xl md:text-5xl font-bold tracking-tight text-foreground", children: "Level up your job hunt" }), _jsx("p", { className: "mt-3 max-w-xl text-base text-muted-foreground leading-relaxed", children: totalMatches > 0
                                                        ? `You’ve logged ${totalMatches} matches. Remote roles are sitting at ${formatPercent(remotePercentage)} — keep the radar humming.`
                                                        : 'Start by scraping jobs and adding your skills to unlock personalized quests.' })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx(Input, { value: scrapeQuery, onChange: (event) => setScrapeQuery(event.target.value), placeholder: "Try 'senior react', 'ml engineer'...", className: "w-full max-w-xs" }), _jsx(Button, { onClick: handleScrape, disabled: isScraping, className: "gap-2", children: isScraping ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "h-4 w-4 animate-spin" }), _jsx("span", { children: "Scraping..." })] })) : (_jsxs(_Fragment, { children: [_jsx(Sparkles, { className: "h-4 w-4" }), _jsx("span", { children: "Scrape jobs" })] })) }), _jsx(Button, { variant: "outline", asChild: true, className: "gap-2", children: _jsxs(Link, { to: "/jobs", children: [_jsx(Rocket, { className: "h-4 w-4" }), " Browse all jobs"] }) })] })] }), _jsxs("div", { className: "grid gap-3 w-full max-w-md", children: [journeyStats.map((stat) => (_jsxs("div", { className: "flex items-center gap-3 rounded-xl border bg-background/80 px-4 py-3", children: [_jsx("div", { className: "rounded-lg bg-muted p-2", children: _jsx(stat.icon, { className: "h-4 w-4 text-muted-foreground" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: stat.label }), _jsx("p", { className: "text-lg font-semibold text-foreground", children: stat.value }), _jsx("p", { className: "text-sm text-muted-foreground", children: stat.subtext })] })] }, stat.label))), _jsxs("div", { className: "rounded-2xl border bg-background/90 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("p", { className: "text-sm font-semibold text-foreground flex items-center gap-2", children: [_jsx(Shield, { className: "h-4 w-4 text-primary" }), "Progress toward next badge"] }), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["Level ", seekerLevel + 1, " unlocks at ", nextMilestoneTarget, " matches"] })] }), _jsx("div", { className: "h-2 w-full rounded-full bg-muted overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-primary via-indigo-500 to-purple-500 transition-all", style: { width: `${xpPercent}%` } }) })] })] })] }) }), _jsx(OnboardingChecklist, { steps: checklistSteps })] }), _jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsx(CardHeader, { className: "pb-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg font-semibold", children: "Quest board" }), _jsx(CardDescription, { className: "text-sm", children: "Micro-actions that boost your reverse-hiring signal." })] })] }) }), _jsxs(CardContent, { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "rounded-xl border bg-muted/30 p-4 space-y-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: "Refresh a saved search" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Keep alerts hot\u2014hourly cadence keeps the feed feeling live." }), _jsx(Button, { size: "sm", variant: "outline", className: "gap-2", asChild: true, children: _jsxs(Link, { to: "/settings?tab=saved-searches", children: [_jsx(RefreshCw, { className: "h-3.5 w-3.5" }), "Manage searches"] }) })] }), _jsxs("div", { className: "rounded-xl border bg-muted/30 p-4 space-y-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: "Tune your pitch" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Spotlight intros pull from your summary & highlight skills." }), _jsx(Button, { size: "sm", variant: "outline", className: "gap-2", asChild: true, children: _jsxs(Link, { to: "/settings?tab=profile", children: [_jsx(Shield, { className: "h-3.5 w-3.5" }), "Profile settings"] }) })] }), _jsxs("div", { className: "rounded-xl border bg-muted/30 p-4 space-y-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: "Track a milestone" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Logging interviews and offers feeds smarter insights." }), _jsx(Button, { size: "sm", variant: "outline", className: "gap-2", asChild: true, children: _jsxs(Link, { to: "/applications", children: [_jsx(Rocket, { className: "h-3.5 w-3.5" }), "Applications"] }) })] })] })] }), _jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsx(CardHeader, { className: "pb-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg font-semibold", children: "Need an orientation?" }), _jsx(CardDescription, { className: "text-sm", children: "Jump straight to the spots that unblock the end-to-end test persona." })] })] }) }), _jsx(CardContent, { className: "grid gap-4 md:grid-cols-3", children: orientationShortcuts.map((item) => (_jsxs("div", { className: "rounded-xl border bg-background/70 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(item.icon, { className: "h-4 w-4 text-primary" }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: item.title })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: item.description }), _jsx(Button, { variant: "outline", size: "sm", className: "w-full gap-2", asChild: true, children: _jsx(Link, { to: item.to, children: item.label }) })] }, item.title))) })] }), recommendedJobs && recommendedJobs.length > 0 && (_jsxs(Card, { className: "border bg-gradient-to-br from-primary/5 via-background to-background shadow-md", children: [_jsx(CardHeader, { className: "pb-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { className: "h-5 w-5 text-primary" }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-xl font-bold", children: "Jobs You Might Like" }), _jsx(CardDescription, { className: "text-sm", children: "Personalized recommendations based on your profile and behavior" })] })] }) }), _jsxs(CardContent, { children: [_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: recommendedJobs.slice(0, 4).map((rec, index) => {
                                    const job = rec.job;
                                    const mood = getMatchMood(rec.recommendation_score);
                                    return (_jsxs("div", { className: "group rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-lg hover:border-primary/40", style: { animationDelay: `${index * 100}ms` }, children: [_jsxs("div", { className: "flex items-start justify-between gap-3 mb-2", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-base font-semibold text-foreground", children: job.title }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: job.company })] }), _jsxs(Badge, { className: cn('text-xs font-semibold', mood.className), children: [Math.round(rec.recommendation_score), "%"] })] }), rec.reasons.length > 0 && (_jsx("div", { className: "mb-3", children: _jsx("p", { className: "text-xs text-muted-foreground", children: rec.reasons[0] }) })), _jsxs("div", { className: "flex items-center gap-2 mt-3", children: [_jsx(Button, { size: "sm", variant: "outline", asChild: true, className: "flex-1", onClick: () => job.id && jobApi.trackInteraction(job.id, 'view'), children: _jsx(Link, { to: `/jobs/${job.id ?? ''}`, children: "View Details" }) }), _jsx(Button, { size: "sm", variant: "ghost", asChild: true, children: _jsx("a", { href: job.url, target: "_blank", rel: "noopener noreferrer", children: "Open" }) })] })] }, job.id ?? job.url));
                                }) }), recommendedJobs.length > 4 && (_jsx("div", { className: "mt-4 flex justify-end", children: _jsx(Button, { variant: "ghost", asChild: true, className: "text-sm", children: _jsxs(Link, { to: "/jobs?filter=recommended", children: ["See all recommendations", _jsx(Rocket, { className: "h-3.5 w-3.5 ml-2" })] }) }) }))] })] })), _jsxs("div", { className: "grid gap-6 lg:grid-cols-3", children: [_jsxs(Card, { className: "lg:col-span-2 border bg-card shadow-sm", children: [_jsx(CardHeader, { className: "pb-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg font-semibold", children: "Top Matches" }), _jsx(CardDescription, { className: "text-sm", children: "Jobs that best match your skills and experience" })] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [topMatches.length === 0 ? (_jsxs("div", { className: "rounded-xl border border-dashed border-muted-foreground/40 p-6 text-sm text-muted-foreground", children: ["Add your skills in ", _jsx(Link, { to: "/settings?tab=profile", className: "underline", children: "profile settings" }), " to unlock personalised matches."] })) : (_jsx("div", { className: "space-y-3", children: topMatches.map((job, index) => {
                                            const mood = getMatchMood(job.match_score);
                                            return (_jsxs("div", { className: "flex flex-col gap-3 rounded-lg border bg-card p-4 transition-all duration-200 hover:shadow-md", style: { animationDelay: `${index * 100}ms` }, children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-base font-semibold text-foreground", children: job.title }), _jsxs("div", { className: "mt-1 flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx("span", { children: job.company }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: formatSourceLabel(job.source) })] })] }), _jsxs(Badge, { className: cn('text-xs font-semibold transition-all duration-200', mood.className), children: [mood.label, job.match_score !== null && job.match_score !== undefined
                                                                        ? ` · ${Math.round(job.match_score)}%`
                                                                        : ''] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [job.location && _jsx(Badge, { variant: "outline", children: job.location }), job.salary && (_jsx(Badge, { variant: "outline", className: "border-amber-200 bg-amber-50/80 text-amber-800", children: job.salary }))] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { size: "sm", asChild: true, className: "gap-2", children: _jsxs(Link, { to: `/jobs/${job.id ?? ''}`, children: [_jsx(Wand2, { className: "h-3.5 w-3.5" }), " View Details"] }) }), _jsx(Button, { size: "sm", variant: "outline", asChild: true, children: _jsx("a", { href: job.url, target: "_blank", rel: "noopener noreferrer", children: "Open posting" }) })] })] }, job.id ?? job.url));
                                        }) })), _jsx("div", { className: "flex items-center justify-end", children: _jsx(Button, { variant: "ghost", asChild: true, className: "text-sm", children: _jsxs(Link, { to: "/jobs", className: "gap-2", children: ["See all matches", _jsx(Rocket, { className: "h-3.5 w-3.5" })] }) }) })] })] }), _jsxs(Card, { className: "border", children: [_jsx(CardHeader, { className: "pb-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Lightbulb, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg font-semibold", children: "Recommended Skills" }), _jsx(CardDescription, { className: "text-sm", children: "Skills that appear frequently in high-match positions" })] })] }) }), _jsxs(CardContent, { className: "space-y-3", children: [skillSuggestions.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "We\u2019ll surface learning tips after your next scrape." })) : (_jsx("ul", { className: "space-y-2", children: skillSuggestions.map((skill, index) => (_jsxs("li", { className: "flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/50", style: { animationDelay: `${index * 50}ms` }, children: [_jsx("span", { className: "font-medium text-foreground", children: skill.name }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [skill.job_count, " jobs \u00B7 ", skill.percentage.toFixed(1), "%"] })] }, skill.name))) })), _jsx(Button, { variant: "outline", size: "sm", asChild: true, children: _jsx(Link, { to: "/jobs", className: "gap-2 text-xs", children: "Peek roles using these skills" }) })] })] })] }), _jsxs(Card, { className: "border", children: [_jsx(CardHeader, { className: "pb-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(TrendingUp, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-xl font-bold text-gradient-primary", children: "Freshly scraped crowd-pleasers" }), _jsx(CardDescription, { className: "text-sm mt-1", children: "The newest roles hitting your feed. Keep them in view before they vanish. \u26A1" })] })] }) }), _jsx(CardContent, { className: "grid gap-3 md:grid-cols-2", children: freshFinds.length === 0 ? (_jsx("div", { className: "col-span-full rounded-xl border border-dashed border-muted-foreground/40 p-6 text-sm text-muted-foreground", children: "Nothing new yet. Hit the scrape button and we\u2019ll restock this shelf." })) : (freshFinds.map((job, index) => (_jsxs("div", { className: "group rounded-xl border-2 border-border/50 bg-card/90 backdrop-blur-sm p-5 shadow-soft transition-all duration-300 hover:shadow-soft-lg hover:border-primary/40 hover:scale-[1.02] hover-lift animate-in fade-in slide-in-from-bottom-4", style: { animationDelay: `${index * 75}ms` }, children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "font-semibold text-foreground", children: job.title }), _jsx(Badge, { variant: "outline", children: formatSourceLabel(job.source) })] }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: job.company }), _jsxs("div", { className: "mt-3 flex items-center gap-2 text-xs", children: [_jsx(Button, { variant: "ghost", size: "sm", asChild: true, className: "px-0 text-xs", children: _jsx(Link, { to: `/jobs/${job.id ?? ''}`, children: "View details" }) }), _jsx("span", { className: "text-muted-foreground", children: "\u2022" }), _jsx("a", { href: job.url, target: "_blank", rel: "noopener noreferrer", className: "text-xs text-primary underline", children: "Open posting" })] })] }, job.id ?? job.url)))) })] })] }));
}

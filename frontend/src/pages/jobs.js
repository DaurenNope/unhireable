import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, Sparkles, Briefcase, MapPin, Building2, SlidersHorizontal, ThumbsUp, ThumbsDown, Flame, Clock, Mail, Copy, Target, Shield, Sparkles as SparklesIcon, } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { jobApi, profileApi, savedSearchApi, schedulerApi, insightsApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatSourceLabel } from '@/lib/sources';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
const statusVariant = {
    'scouted': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
    'prospect': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
    'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    'applied': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
    'rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200',
};
const STATUS_FILTERS = ['all', 'scouted', 'prospect', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived'];
const getSanitizer = () => {
    if (typeof window === 'undefined' || !window.document) {
        return {
            sanitize: (value) => value,
        };
    }
    return DOMPurify;
};
const sanitizer = getSanitizer();
// Helper function to get match quality from score
function getMatchQuality(score) {
    if (score === null || score === undefined)
        return null;
    if (score >= 80)
        return 'Excellent';
    if (score >= 60)
        return 'Good';
    if (score >= 40)
        return 'Fair';
    return 'Poor';
}
// Helper function to get match quality badge variant
function getMatchQualityVariant(quality) {
    if (!quality)
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    switch (quality) {
        case 'Excellent':
            return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0';
        case 'Good':
            return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0';
        case 'Fair':
            return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0';
        case 'Poor':
            return 'bg-gradient-to-r from-red-500 to-rose-500 text-white border-0';
    }
}
const stripHtml = (html) => {
    if (!html)
        return '';
    const clean = sanitizer.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    return clean.replace(/\s+/g, ' ').trim();
};
const summarize = (value, limit = 240) => {
    if (!value)
        return '';
    return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
};
const getErrorMessage = (error) => {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'string')
        return error;
    try {
        return JSON.stringify(error);
    }
    catch {
        return 'Unknown error';
    }
};
export function Jobs() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState({
        field: 'created_at',
        direction: 'desc',
    });
    const [isScraping, setIsScraping] = useState(false);
    const [scrapeError, setScrapeError] = useState(null);
    const [isCalculatingScores, setIsCalculatingScores] = useState(false);
    const [isEnriching, setIsEnriching] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [skillFilter, setSkillFilter] = useState('');
    const [remoteOnly, setRemoteOnly] = useState(false);
    const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);
    const [dismissedSpotlights, setDismissedSpotlights] = useState(new Set());
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [showHighMatchesOnly, setShowHighMatchesOnly] = useState(false);
    const [hideBarebonesJobs, setHideBarebonesJobs] = useState(false);
    const [isRunningSavedSearches, setIsRunningSavedSearches] = useState(false);
    const [isTogglingScheduler, setIsTogglingScheduler] = useState(false);
    // Use React Query for jobs data with caching
    // Use separate query key for jobs page to avoid conflicts with dashboard
    const { data: jobsData, isLoading, refetch: refetchJobs } = useQuery({
        queryKey: ['jobs', 'all'],
        queryFn: () => jobApi.list(),
        staleTime: 30000, // Cache for 30 seconds
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    });
    const jobs = useMemo(() => jobsData ?? [], [jobsData]);
    const getJobKey = (job, fallbackIndex) => {
        if (job.id !== undefined && job.id !== null) {
            return `id-${job.id}`;
        }
        if (job.url) {
            return `url-${job.url}`;
        }
        return `idx-${fallbackIndex}`;
    };
    const { data: marketInsights } = useQuery({
        queryKey: ['market-insights', 'jobs-page'],
        queryFn: () => insightsApi.getMarketInsights(30),
    });
    const { data: savedSearchStatus } = useQuery({
        queryKey: ['saved-searches-status'],
        queryFn: () => savedSearchApi.getStatus(),
        refetchInterval: 15000,
    });
    const { data: schedulerStatus } = useQuery({
        queryKey: ['scheduler-status'],
        queryFn: () => schedulerApi.getStatus(),
        refetchInterval: 15000,
    });
    useEffect(() => {
        loadUserProfile(); // This is now async
    }, []);
    useEffect(() => {
        setActiveSpotlightIndex(0);
        setDismissedSpotlights(new Set());
    }, [jobs]);
    const loadUserProfile = async () => {
        try {
            // Try loading from database first
            const profile = await profileApi.get();
            if (profile) {
                setUserProfile(profile);
                // Also save to localStorage as backup
                localStorage.setItem('userProfile', JSON.stringify(profile));
            }
            else {
                // Fallback to localStorage
                const profileJson = localStorage.getItem('userProfile');
                if (profileJson) {
                    const parsed = JSON.parse(profileJson);
                    setUserProfile(parsed);
                }
            }
        }
        catch (error) {
            console.error('Failed to load user profile:', error);
            // Fallback to localStorage
            try {
                const profileJson = localStorage.getItem('userProfile');
                if (profileJson) {
                    const profile = JSON.parse(profileJson);
                    setUserProfile(profile);
                }
            }
            catch (fallbackError) {
                console.error('Failed to load profile from localStorage:', fallbackError);
            }
        }
    };
    const handleAdvanceSpotlight = () => {
        if (spotlightCount === 0)
            return;
        setActiveSpotlightIndex((prev) => prev + 1);
    };
    const handleSkipSpotlight = () => {
        if (!spotlightJob)
            return;
        const key = getJobKey(spotlightJob, effectiveSpotlightIndex);
        setDismissedSpotlights((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
        if (spotlightCount <= 1) {
            setActiveSpotlightIndex(0);
        }
        else if (effectiveSpotlightIndex >= spotlightCount - 1) {
            setActiveSpotlightIndex(0);
        }
    };
    const handleCalculateMatchScores = async () => {
        if (!userProfile) {
            toast({
                title: "Profile required",
                description: "Please create a user profile first in Settings to calculate match scores.",
                variant: "destructive",
            });
            return;
        }
        setIsCalculatingScores(true);
        try {
            const updatedCount = await jobApi.updateMatchScores(userProfile);
            toast({
                title: "Match scores updated!",
                description: `Successfully calculated match scores for ${updatedCount} job${updatedCount === 1 ? '' : 's'}`,
            });
            // Invalidate and refetch jobs to get updated match scores
            await queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
        catch (error) {
            console.error('Failed to calculate match scores:', error);
            toast({
                title: "Failed to calculate match scores",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        }
        finally {
            setIsCalculatingScores(false);
        }
    };
    const handleScrape = async () => {
        setIsScraping(true);
        setScrapeError(null);
        try {
            // Use 'demo' as default query to show sample jobs
            // Users can change this to try real scraping
            const query = searchTerm || 'demo';
            console.log('Scraping jobs with query:', query);
            const scrapedJobs = await jobApi.scrape(query);
            console.log('Scraped jobs:', scrapedJobs);
            if (scrapedJobs && scrapedJobs.length > 0) {
                // Invalidate and refetch jobs to get newly scraped jobs
                await queryClient.invalidateQueries({ queryKey: ['jobs'] });
                setScrapeError(null);
                toast({
                    title: "Success!",
                    description: `Successfully scraped ${scrapedJobs.length} job${scrapedJobs.length === 1 ? '' : 's'}`,
                });
            }
            else {
                const errorMsg = 'No jobs found. Try "demo" to see sample jobs, or a different search term for real scraping.';
                setScrapeError(errorMsg);
                toast({
                    title: "No jobs found",
                    description: errorMsg,
                    variant: "destructive",
                });
            }
        }
        catch (error) {
            console.error('Failed to scrape jobs:', error);
            const errorMessage = getErrorMessage(error);
            const errorMsg = `Scraping failed: ${errorMessage}. Try "demo" to see sample jobs!`;
            setScrapeError(errorMsg);
            toast({
                title: "Scraping failed",
                description: errorMessage,
                variant: "destructive",
            });
        }
        finally {
            setIsScraping(false);
        }
    };
    const handleRunDueSearches = useCallback(async () => {
        if (isRunningSavedSearches)
            return;
        setIsRunningSavedSearches(true);
        try {
            await savedSearchApi.checkAndRun();
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['saved-searches-status'] });
        }
        catch (error) {
            console.error('Failed to run saved searches:', error);
        }
        finally {
            setIsRunningSavedSearches(false);
        }
    }, [isRunningSavedSearches, queryClient]);
    const handleToggleScheduler = useCallback(async () => {
        if (!schedulerStatus || isTogglingScheduler)
            return;
        setIsTogglingScheduler(true);
        try {
            if (schedulerStatus.running) {
                await schedulerApi.stop();
            }
            else {
                await schedulerApi.start();
            }
            queryClient.invalidateQueries({ queryKey: ['scheduler-status'] });
        }
        catch (error) {
            console.error('Failed to toggle scheduler:', error);
        }
        finally {
            setIsTogglingScheduler(false);
        }
    }, [schedulerStatus, isTogglingScheduler, queryClient]);
    const handleEnrichBatch = async () => {
        setIsEnriching(true);
        try {
            const enrichedJobs = await jobApi.enrichBatch(10);
            // Invalidate and refetch jobs to get enriched data
            await queryClient.invalidateQueries({ queryKey: ['jobs'] });
            if (enrichedJobs.length > 0) {
                alert(`✅ Successfully enriched ${enrichedJobs.length} job(s)!`);
            }
            else {
                alert('ℹ️ No jobs need enrichment (all jobs already have descriptions).');
            }
        }
        catch (error) {
            console.error('Failed to enrich jobs:', error);
            alert(`Failed to enrich jobs: ${getErrorMessage(error)}`);
        }
        finally {
            setIsEnriching(false);
        }
    };
    const filteredJobs = useMemo(() => {
        const filtered = jobs.filter((job) => {
            const matchesSearch = !searchTerm ||
                job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
            const matchesSkill = !skillFilter ||
                job.title?.toLowerCase().includes(skillFilter.toLowerCase()) ||
                job.description?.toLowerCase().includes(skillFilter.toLowerCase()) ||
                job.requirements?.toLowerCase().includes(skillFilter.toLowerCase());
            const matchesRemote = !remoteOnly ||
                job.location?.toLowerCase().includes('remote') ||
                job.description?.toLowerCase().includes('remote');
            const hasDetails = Boolean(job.description && job.description.trim().length > 80) ||
                Boolean(job.requirements && job.requirements.trim().length > 40);
            const matchesDetail = !hideBarebonesJobs || hasDetails;
            const meetsMatchThreshold = !showHighMatchesOnly || (job.match_score ?? -1) >= 60;
            return matchesSearch && matchesStatus && matchesSkill && matchesRemote && matchesDetail && meetsMatchThreshold;
        });
        return filtered;
    }, [jobs, statusFilter, searchTerm, skillFilter, remoteOnly, hideBarebonesJobs, showHighMatchesOnly]);
    const prioritizedMatches = useMemo(() => {
        const matches = filteredJobs.filter((job) => (job.match_score ?? -1) >= 60);
        matches.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
        return matches;
    }, [filteredJobs]);
    const spotlightMatches = useMemo(() => {
        return prioritizedMatches.filter((job, index) => {
            const key = getJobKey(job, index);
            return !dismissedSpotlights.has(key);
        });
    }, [prioritizedMatches, dismissedSpotlights]);
    const spotlightCount = spotlightMatches.length;
    const effectiveSpotlightIndex = spotlightCount > 0 ? activeSpotlightIndex % spotlightCount : 0;
    const spotlightJob = spotlightCount > 0 ? spotlightMatches[effectiveSpotlightIndex] : null;
    const spotlightSummary = spotlightJob
        ? summarize(stripHtml(spotlightJob.description || spotlightJob.requirements || ''), 260)
        : '';
    const spotlightMatchQuality = spotlightJob ? getMatchQuality(spotlightJob.match_score) : null;
    const reversePitch = useMemo(() => {
        if (!spotlightJob || !userProfile)
            return null;
        const firstName = userProfile.personal_info?.name?.split(' ')[0] || 'I';
        const topTech = userProfile.skills?.technical_skills?.slice(0, 3) ?? [];
        const headlineSkills = topTech.length ? topTech.join(', ') : 'shipping remote-first products';
        const firstExperience = userProfile.experience?.[0];
        const experienceSnippet = firstExperience
            ? `I recently led ${firstExperience.position} at ${firstExperience.company}`
            : `I’ve shipped end-to-end features across growth and platform teams`;
        const company = spotlightJob.company || 'your team';
        const role = spotlightJob.title || 'this role';
        return `${firstName} here — I specialize in ${headlineSkills}. ${experienceSnippet}, partnering closely with product & engineering. I’d love to help ${company} level up ${role} with a mix of fast experimentation and reliable delivery.`;
    }, [spotlightJob, userProfile]);
    const outreachMailLink = useMemo(() => {
        if (!spotlightJob)
            return null;
        const subject = `Quick intro for ${spotlightJob.title ?? 'your open role'}`;
        const body = reversePitch
            ? `${reversePitch}\n\nMore about me: ${userProfile?.personal_info?.linkedin || userProfile?.personal_info?.portfolio || ''}`
            : `Hi ${spotlightJob.company ?? 'team'},\n\nI’d love to discuss how I can help with ${spotlightJob.title ?? 'this role'}.\n\n`;
        return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }, [reversePitch, spotlightJob, userProfile]);
    const handleCopyPitch = async () => {
        if (!reversePitch || typeof navigator === 'undefined' || !navigator.clipboard)
            return;
        try {
            await navigator.clipboard.writeText(reversePitch);
        }
        catch (error) {
            console.error('Failed to copy pitch', error);
        }
    };
    const handleApplySkillFilter = (skillName) => {
        setSkillFilter(skillName);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const questItems = useMemo(() => {
        return [
            {
                id: 'profile',
                title: userProfile ? 'Profile synced' : 'Complete your pitch',
                description: userProfile
                    ? 'Your summary powers reverse pitches.'
                    : 'Spotlight pitches need your summary & top skills.',
                completed: Boolean(userProfile),
                actionLabel: userProfile ? 'View profile' : 'Complete profile',
                href: '/settings?tab=profile',
                icon: Shield,
            },
            {
                id: 'saved-search',
                title: savedSearchStatus && savedSearchStatus.due_for_run > 0
                    ? 'Run due alerts'
                    : 'Alerts standing by',
                description: savedSearchStatus && savedSearchStatus.due_for_run > 0
                    ? `${savedSearchStatus.due_for_run} search${savedSearchStatus.due_for_run > 1 ? 'es' : ''} ready to sweep.`
                    : 'Saved searches are syncing hourly.',
                completed: savedSearchStatus ? savedSearchStatus.due_for_run === 0 : false,
                actionLabel: savedSearchStatus && savedSearchStatus.due_for_run > 0 ? 'Run now' : 'Manage searches',
                action: savedSearchStatus && savedSearchStatus.due_for_run > 0
                    ? () => handleRunDueSearches()
                    : undefined,
                href: savedSearchStatus && savedSearchStatus.due_for_run > 0
                    ? undefined
                    : '/settings?tab=saved-searches',
                icon: Target,
            },
            {
                id: 'scheduler',
                title: schedulerStatus?.running ? 'Scheduler online' : 'Start background loop',
                description: schedulerStatus?.running
                    ? 'Saved searches sweep every few hours.'
                    : 'Auto-scraping paused — turn it on for live intel.',
                completed: Boolean(schedulerStatus?.running),
                actionLabel: schedulerStatus?.running ? 'Pause' : 'Start scheduler',
                action: () => handleToggleScheduler(),
                icon: Flame,
            },
        ];
    }, [userProfile, savedSearchStatus, schedulerStatus, handleRunDueSearches, handleToggleScheduler]);
    const skillGapSuggestions = useMemo(() => {
        return marketInsights?.skills_to_learn?.slice(0, 6) ?? [];
    }, [marketInsights]);
    const trendingRoles = useMemo(() => {
        return marketInsights?.trending_roles?.slice(0, 4) ?? [];
    }, [marketInsights]);
    const freshDrops = useMemo(() => {
        return [...jobs]
            .filter((job) => job.created_at)
            .sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeB - timeA;
        })
            .slice(0, 5);
    }, [jobs]);
    const remotePercentage = marketInsights?.remote_percentage ?? null;
    const onsitePercentage = marketInsights?.onsite_percentage ?? null;
    const topTrendingSkill = marketInsights?.trending_skills?.[0];
    const topHiringCompany = marketInsights?.top_companies?.[0];
    const hotRole = marketInsights?.trending_roles?.[0];
    const matchesAvailable = prioritizedMatches.length;
    const totalJobs = jobs.length;
    const filteredCount = filteredJobs.length;
    const sortedJobs = [...filteredJobs].sort((a, b) => {
        if (sortBy.field === 'match_score') {
            const aScore = a.match_score ?? -1;
            const bScore = b.match_score ?? -1;
            if (sortBy.direction === 'asc') {
                return aScore - bScore;
            }
            else {
                return bScore - aScore;
            }
        }
        const aValue = a[sortBy.field] || '';
        const bValue = b[sortBy.field] || '';
        if (aValue === bValue)
            return 0;
        if (sortBy.direction === 'asc') {
            return aValue > bValue ? 1 : -1;
        }
        else {
            return aValue < bValue ? 1 : -1;
        }
    });
    const handleSort = (field) => {
        setSortBy(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };
    if (isLoading) {
        return (_jsxs("div", { className: "space-y-6 p-6 animate-in fade-in duration-500", children: [_jsx(Card, { className: "border-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "space-y-4", children: [_jsx(Skeleton, { className: "h-6 w-32 rounded-full" }), _jsx(Skeleton, { className: "h-8 w-3/4" }), _jsx(Skeleton, { className: "h-4 w-full" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Skeleton, { className: "h-10 w-24 rounded-full" }), _jsx(Skeleton, { className: "h-10 w-24 rounded-full" })] })] }) }) }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Skeleton, { className: "h-10 w-64" }), _jsx(Skeleton, { className: "h-10 w-32" }), _jsx(Skeleton, { className: "h-10 w-24 rounded-full" }), _jsx(Skeleton, { className: "h-10 w-24 rounded-full" })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: [1, 2, 3, 4, 5, 6].map((i) => (_jsxs(Card, { className: "border", children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-5 w-3/4" }), _jsx(Skeleton, { className: "h-4 w-1/2 mt-2" })] }), _jsxs(CardContent, { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-full" }), _jsx(Skeleton, { className: "h-4 w-5/6" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Skeleton, { className: "h-6 w-20 rounded-full" }), _jsx(Skeleton, { className: "h-6 w-24 rounded-full" })] })] }), _jsx(CardFooter, { children: _jsx(Skeleton, { className: "h-9 w-full" }) })] }, i))) })] }));
    }
    return (_jsx(TooltipProvider, { children: _jsxs("div", { className: "space-y-8 p-6 bg-muted/20 min-h-screen animate-in fade-in duration-500", children: [_jsx(Card, { className: "border bg-card shadow-sm", children: _jsxs(CardContent, { className: "flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between p-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-4xl md:text-5xl font-bold tracking-tight text-foreground", children: "Let's find your next obsession" }), _jsx("p", { className: "mt-3 max-w-xl text-base text-muted-foreground leading-relaxed", children: matchesAvailable > 0
                                                    ? `You've got ${matchesAvailable} high-fit matches primed. ${remotePercentage !== null ? `${Math.round(remotePercentage)}% of the feed is remote` : 'Remote opportunities are flowing'}, and ${hotRole ? `${hotRole.name} roles` : 'fresh opportunities'} are trending right now.`
                                                    : 'Scrape a fresh batch and add your skills—your personalised feed will wake right up.' })] }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(Button, { onClick: handleScrape, disabled: isScraping, className: "gap-2", children: [isScraping ? (_jsx(RefreshCw, { className: "h-4 w-4 animate-spin" })) : (_jsx(Sparkles, { className: "h-4 w-4" })), isScraping ? 'Scraping…' : 'Scrape new roles'] }) }), _jsx(TooltipContent, { children: _jsx("p", { children: "Search and scrape jobs from multiple sources" }) })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Button, { variant: "outline", onClick: handleCalculateMatchScores, disabled: isCalculatingScores || !userProfile, className: "gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100", children: isCalculatingScores ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "h-4 w-4 animate-spin" }), _jsx("span", { children: "Scoring\u2026" })] })) : (_jsxs(_Fragment, { children: [_jsx(Flame, { className: "h-4 w-4" }), _jsx("span", { children: "Refresh matches" })] })) }) }), _jsx(TooltipContent, { children: _jsx("p", { children: !userProfile ? 'Create a user profile first to calculate match scores' : 'Recalculate how well jobs match your profile' }) })] }), _jsx(Button, { variant: "outline", onClick: handleEnrichBatch, disabled: isEnriching, className: "gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100", title: "Fetch full descriptions for jobs missing details", children: isEnriching ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "h-4 w-4 animate-spin" }), _jsx("span", { children: "Enriching\u2026" })] })) : (_jsxs(_Fragment, { children: [_jsx(Sparkles, { className: "h-4 w-4" }), _jsx("span", { children: "Enrich Missing Jobs" })] })) }), _jsxs(Button, { variant: "outline", onClick: () => refetchJobs(), className: "gap-2 transition-all duration-200 hover:scale-105", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), "Reload cache"] }), _jsx(Button, { variant: "outline", asChild: true, className: "gap-2", children: _jsxs(Link, { to: "/jobs/new", children: [_jsx(Plus, { className: "h-4 w-4" }), "Add job manually"] }) })] })] }), _jsxs("div", { className: "grid w-full max-w-sm gap-3 rounded-2xl border bg-background/85 p-4 text-sm shadow-inner", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Matches queued" }), _jsx("span", { className: "text-lg font-semibold text-foreground", children: matchesAvailable })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Jobs visible" }), _jsxs("span", { className: "text-lg font-semibold text-foreground", children: [filteredCount, " / ", totalJobs] })] }), remotePercentage !== null && onsitePercentage !== null && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Remote vibe" }), _jsxs("span", { className: "text-lg font-semibold text-foreground", children: [Math.round(remotePercentage), "% remote \u00B7 ", Math.round(onsitePercentage), "% onsite"] })] })), topTrendingSkill && (_jsxs("div", { className: "rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground", children: [_jsxs("span", { className: "block text-sm font-semibold text-foreground", children: ["Skill in demand: ", topTrendingSkill.name] }), _jsxs("span", { children: ["Showing up in ", topTrendingSkill.job_count, " listings this cycle."] })] })), topHiringCompany && (_jsxs("div", { className: "rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground", children: [_jsx("span", { className: "block text-sm font-semibold text-foreground", children: topHiringCompany.name }), _jsxs("span", { children: [topHiringCompany.job_count, " open roles live now."] })] }))] })] }) }), _jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsx(CardHeader, { className: "pb-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(SparklesIcon, { className: "h-4 w-4 text-primary" }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "Quest feed" }), _jsx(CardDescription, { className: "text-sm", children: "Small actions that unlock reverse-hiring perks." })] })] }) }), _jsx(CardContent, { className: "grid gap-4 md:grid-cols-3", children: questItems.map((quest) => (_jsxs("div", { className: cn('rounded-xl border p-4 space-y-2 transition-all', quest.completed ? 'bg-emerald-50/80 border-emerald-100' : 'bg-muted/30'), children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: cn('rounded-lg p-2', quest.completed ? 'bg-emerald-200 text-emerald-700' : 'bg-muted text-muted-foreground'), children: _jsx(quest.icon, { className: "h-4 w-4" }) }), _jsx("span", { className: "text-sm font-semibold text-foreground", children: quest.title })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: quest.description }), quest.action ? (_jsx(Button, { size: "sm", variant: quest.completed ? 'outline' : 'default', className: "gap-2", onClick: quest.action, disabled: quest.id === 'scheduler' && isTogglingScheduler, children: quest.actionLabel })) : quest.href ? (_jsx(Button, { size: "sm", variant: quest.completed ? 'outline' : 'default', className: "gap-2", asChild: true, children: _jsx(Link, { to: quest.href, children: quest.actionLabel }) })) : null] }, quest.id))) })] }), !userProfile && (_jsx(Card, { className: "border border-dashed bg-muted/30", children: _jsxs(CardContent, { className: "flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "rounded-full bg-primary/10 p-2", children: _jsx(SparklesIcon, { className: "h-4 w-4 text-primary" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: "Add your profile to unlock reverse pitches" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "We\u2019ll craft personal intros for spotlight jobs once your summary & skills are saved." })] })] }), _jsx(Button, { size: "sm", asChild: true, children: _jsx(Link, { to: "/settings?tab=profile", children: "Complete profile" }) })] }) })), scrapeError && (_jsx("div", { className: "rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive", children: scrapeError })), _jsxs("div", { className: "grid gap-6 xl:grid-cols-[2fr_1fr]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "Saved searches & alerts" }), _jsx(CardDescription, { children: "Keep automations ready before the scheduler sweeps." })] }), _jsx(Badge, { variant: "outline", className: "text-xs", children: savedSearchStatus ? `${savedSearchStatus.enabled}/${savedSearchStatus.total} active` : '—' })] }) }), _jsxs(CardContent, { className: "space-y-4 text-sm", children: [savedSearchStatus ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2", children: [_jsx("span", { className: "text-muted-foreground", children: "Total searches" }), _jsx("span", { className: "font-medium text-foreground", children: savedSearchStatus.total })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2", children: [_jsx("span", { className: "text-muted-foreground", children: "Enabled" }), _jsx("span", { className: "font-medium text-foreground", children: savedSearchStatus.enabled })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2", children: [_jsx("span", { className: "text-muted-foreground", children: "Due for run" }), _jsx("span", { className: cn('font-medium', savedSearchStatus.due_for_run > 0 && 'text-amber-600'), children: savedSearchStatus.due_for_run })] })] })) : (_jsx("p", { className: "text-muted-foreground", children: "No saved searches yet. Create one from Settings." })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", onClick: handleRunDueSearches, disabled: isRunningSavedSearches || !savedSearchStatus?.due_for_run, className: "flex-1", children: isRunningSavedSearches ? 'Checking…' : 'Run due searches' }), _jsx(Button, { size: "sm", variant: "outline", asChild: true, children: _jsx(Link, { to: "/settings?tab=saved-searches", children: "Manage" }) })] })] })] }), _jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "Scheduler & notifications" }), _jsx(CardDescription, { children: "Background scraping and desktop alerts status." })] }), _jsx(Badge, { variant: schedulerStatus?.running ? 'default' : 'secondary', className: "text-xs", children: schedulerStatus?.running ? 'Running' : 'Idle' })] }) }), _jsxs(CardContent, { className: "space-y-3 text-sm", children: [schedulerStatus ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between text-muted-foreground", children: [_jsx("span", { children: "Enabled" }), _jsx("span", { className: "font-medium text-foreground", children: schedulerStatus.enabled ? 'Yes' : 'No' })] }), _jsxs("div", { className: "text-muted-foreground", children: [_jsx("p", { className: "text-xs uppercase tracking-wide mb-1", children: "Schedule" }), _jsx("p", { className: "rounded-lg border bg-muted/30 px-3 py-2 text-foreground", children: schedulerStatus.schedule || 'Not configured' })] }), _jsxs("div", { className: "flex items-center justify-between text-muted-foreground", children: [_jsx("span", { children: "Notifications" }), _jsx("span", { className: "font-medium text-foreground", children: schedulerStatus.send_notifications ? 'On' : 'Off' })] })] })) : (_jsx("p", { className: "text-muted-foreground", children: "Scheduler not configured yet." })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", onClick: handleToggleScheduler, disabled: !schedulerStatus || isTogglingScheduler, className: "flex-1", children: schedulerStatus?.running ? 'Pause scheduler' : 'Start scheduler' }), _jsx(Button, { size: "sm", variant: "outline", asChild: true, children: _jsx(Link, { to: "/settings?tab=scheduler", children: "Configure" }) })] })] })] }), _jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "rounded-md bg-muted p-2", children: _jsx(Flame, { className: "h-4 w-4 text-muted-foreground" }) }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-xl font-semibold", children: "Spotlight match" }), _jsx(CardDescription, { className: "text-sm mt-1", children: "High-intent roles that mirror your skill DNA." })] })] }), spotlightCount > 0 && (_jsxs(Badge, { className: "text-xs font-medium", children: [effectiveSpotlightIndex + 1, " / ", spotlightCount] }))] }) }), spotlightJob ? (_jsxs(_Fragment, { children: [_jsxs(CardContent, { className: "space-y-5", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-2xl md:text-3xl font-semibold text-foreground", children: spotlightJob.title }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 text-sm text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Building2, { className: "h-4 w-4" }), spotlightJob.company] }), spotlightJob.location && (_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(MapPin, { className: "h-4 w-4" }), spotlightJob.location] }))] })] }), _jsx(Badge, { variant: "outline", className: "text-xs", children: formatSourceLabel(spotlightJob.source) })] }), spotlightSummary && (_jsx("p", { className: "text-sm leading-relaxed text-muted-foreground", children: spotlightSummary })), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [spotlightJob.salary && (_jsx(Badge, { variant: "outline", className: "bg-amber-50/80 text-amber-800", children: spotlightJob.salary })), spotlightMatchQuality && (_jsxs(Badge, { className: cn('font-semibold', getMatchQualityVariant(spotlightMatchQuality)), children: [spotlightMatchQuality, " ", spotlightJob.match_score?.toFixed(0), "%"] })), _jsxs(Badge, { variant: "outline", className: "text-xs", children: ["Added ", spotlightJob.created_at ? new Date(spotlightJob.created_at).toLocaleDateString() : 'recently'] })] }), reversePitch && (_jsxs("div", { className: "rounded-xl border bg-muted/30 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-sm font-semibold text-foreground flex items-center gap-2", children: [_jsx(SparklesIcon, { className: "h-4 w-4 text-primary" }), "Reverse pitch draft"] }), _jsxs(Button, { size: "sm", variant: "ghost", className: "gap-2", onClick: handleCopyPitch, children: [_jsx(Copy, { className: "h-4 w-4" }), "Copy"] })] }), _jsx("p", { className: "text-sm text-muted-foreground whitespace-pre-line", children: reversePitch })] }))] }), _jsxs(CardFooter, { className: "flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "ghost", onClick: handleSkipSpotlight, className: "gap-2", children: [_jsx(ThumbsDown, { className: "h-4 w-4" }), "Skip"] }), _jsxs(Button, { variant: "secondary", onClick: handleAdvanceSpotlight, className: "gap-2", children: [_jsx(ThumbsUp, { className: "h-4 w-4" }), "Next sparkle"] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { size: "sm", className: "gap-2", asChild: true, children: _jsx(Link, { to: `/jobs/${spotlightJob.id ?? ''}`, children: "Peek inside" }) }), spotlightJob.url && (_jsx(Button, { size: "sm", variant: "outline", className: "border-2 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:scale-105", asChild: true, children: _jsx("a", { href: spotlightJob.url, target: "_blank", rel: "noopener noreferrer", children: "Open posting" }) })), reversePitch && (_jsxs(Button, { size: "sm", variant: "outline", className: "gap-2", onClick: handleCopyPitch, children: [_jsx(Copy, { className: "h-4 w-4" }), "Copy pitch"] })), outreachMailLink && (_jsx(Button, { size: "sm", variant: "secondary", className: "gap-2", asChild: true, children: _jsxs("a", { href: outreachMailLink, children: [_jsx(Mail, { className: "h-4 w-4" }), "Reach out"] }) }))] })] })] })) : (_jsxs(CardContent, { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "We\u2019ll drop spotlight matches here once you\u2019ve scraped jobs and refreshed match scores." }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { size: "sm", onClick: handleScrape, disabled: isScraping, children: isScraping ? 'Scraping…' : 'Scrape now' }), _jsx(Button, { size: "sm", variant: "outline", onClick: handleCalculateMatchScores, disabled: isCalculatingScores || !userProfile, children: "Refresh matches" })] })] }))] }), _jsxs(Card, { className: "border shadow-sm", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg font-semibold", children: "Tune your feed" }), _jsx(CardDescription, { children: "Stack filters to shape the vibe." })] }), _jsxs(Button, { variant: "ghost", size: "sm", className: "gap-2", onClick: () => setShowAdvancedFilters((prev) => !prev), children: [_jsx(SlidersHorizontal, { className: "h-3.5 w-3.5" }), showAdvancedFilters ? 'Hide tips' : 'Pro tips'] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 lg:grid-cols-[2fr_1fr]", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { type: "text", placeholder: "Search roles, companies, keywords\u2026", className: "h-12 rounded-xl border-muted/40 bg-background/70 pl-10", value: searchTerm, onChange: (event) => setSearchTerm(event.target.value) })] }), _jsxs("div", { className: "relative", children: [_jsx(Sparkles, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { type: "text", placeholder: "Skill focus (e.g. next.js, go, fintech)", className: "h-12 rounded-xl border-muted/40 bg-background/70 pl-10", value: skillFilter, onChange: (event) => setSkillFilter(event.target.value) })] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl border border-muted/40 bg-background/70 px-4 py-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Remote mode" }), _jsx("p", { className: "text-sm text-foreground", children: remoteOnly ? 'Only remote opportunities' : 'Any location, remote included' })] }), _jsx(Switch, { id: "remote-only", checked: remoteOnly, onCheckedChange: (value) => setRemoteOnly(Boolean(value)) })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-muted/40 bg-background/70 px-4 py-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "High-fit view" }), _jsx("p", { className: "text-sm text-foreground", children: showHighMatchesOnly ? 'Showing ≥60% matches' : 'Include all match scores' })] }), _jsx(Switch, { id: "match-only", checked: showHighMatchesOnly, onCheckedChange: (value) => setShowHighMatchesOnly(Boolean(value)) })] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl border border-muted/40 bg-background/70 px-4 py-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Hide empty posts" }), _jsx("p", { className: "text-sm text-foreground", children: hideBarebonesJobs ? 'Stripping blank descriptions' : 'Show every posting' })] }), _jsx(Switch, { id: "hide-empty", checked: hideBarebonesJobs, onCheckedChange: (value) => setHideBarebonesJobs(Boolean(value)) })] })] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: STATUS_FILTERS.map((option) => (_jsx(Button, { size: "sm", variant: statusFilter === option ? 'default' : 'outline', className: cn('rounded-full capitalize', statusFilter === option ? 'shadow-md' : 'bg-background/70'), onClick: () => setStatusFilter(option), children: option === 'all' ? 'All' : option }, option))) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: sortBy.field === 'match_score' ? 'default' : 'outline', size: "sm", className: "gap-2", onClick: () => handleSort('match_score'), children: [_jsx(Sparkles, { className: "h-3.5 w-3.5" }), "Rank by match"] }), _jsxs(Button, { variant: sortBy.field === 'created_at' ? 'default' : 'outline', size: "sm", className: "gap-2", onClick: () => handleSort('created_at'), children: [_jsx(Clock, { className: "h-3.5 w-3.5" }), "Newest first"] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                                setSearchTerm('');
                                                                setSkillFilter('');
                                                                setRemoteOnly(false);
                                                                setStatusFilter('all');
                                                            }, children: "Reset filters" })] }), showAdvancedFilters && (_jsxs("div", { className: "rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground", children: [_jsx("p", { className: "font-semibold text-foreground", children: "Pro tip" }), _jsx("p", { children: "Add multiple keywords with commas (e.g. \u201Cgrowth, lifecycle, email\u201D) to surface niche matches." })] }))] })] }), _jsxs(Card, { className: "border shadow-sm", children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsx(CardTitle, { className: "text-lg font-semibold", children: "Discovery feed" }), _jsx(CardDescription, { children: sortedJobs.length > 0
                                                        ? `${sortedJobs.length} roles after filters.`
                                                        : 'No roles match your filters just yet.' })] }), _jsx(CardContent, { children: sortedJobs.length > 0 ? (_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: sortedJobs.map((job, index) => {
                                                    const matchQuality = getMatchQuality(job.match_score);
                                                    const summary = summarize(stripHtml(job.description || job.requirements || ''), 220);
                                                    return (_jsx(Card, { className: "group rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg", style: { animationDelay: `${index % 6 * 50}ms` }, children: _jsxs(CardContent, { className: "space-y-4 p-5", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h3", { className: "text-lg font-semibold text-foreground", children: _jsx(Link, { to: `/jobs/${job.id}`, className: "hover:text-primary", children: job.title }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Building2, { className: "h-3.5 w-3.5" }), job.company] }), job.location && (_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(MapPin, { className: "h-3.5 w-3.5" }), job.location] }))] })] }), _jsx(Badge, { variant: "outline", className: "text-xs", children: formatSourceLabel(job.source) })] }), summary && (_jsx("p", { className: "text-sm leading-relaxed text-muted-foreground line-clamp-4", children: summary })), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Badge, { className: statusVariant[job.status], children: job.status }), job.match_score !== null && job.match_score !== undefined && (_jsxs(Badge, { className: cn('font-semibold', getMatchQualityVariant(matchQuality)), children: [matchQuality, " ", job.match_score.toFixed(0), "%"] })), job.salary && (_jsx(Badge, { variant: "outline", className: "bg-amber-50/80 text-amber-800", children: job.salary }))] }), _jsxs("div", { className: "flex items-center justify-between text-xs text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "h-3.5 w-3.5" }), job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown date'] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { size: "sm", variant: "ghost", asChild: true, children: _jsx(Link, { to: `/jobs/${job.id}`, children: "Peek inside" }) }), job.url && (_jsx(Button, { size: "sm", variant: "ghost", asChild: true, children: _jsx("a", { href: job.url, target: "_blank", rel: "noopener noreferrer", children: "Open" }) }))] })] })] }) }, job.id || `job-${index}`));
                                                }) })) : (_jsx(EmptyState, { icon: Briefcase, title: jobs.length === 0 ? "No jobs yet" : "No jobs match your filters", description: jobs.length === 0
                                                    ? "Start by scraping jobs from various sources. We'll help you find the perfect match!"
                                                    : "Try adjusting your search terms, filters, or clear them to see all available jobs.", action: jobs.length === 0
                                                    ? {
                                                        label: "Scrape jobs now",
                                                        onClick: handleScrape,
                                                        icon: Sparkles,
                                                    }
                                                    : {
                                                        label: "Clear filters",
                                                        onClick: () => {
                                                            setSearchTerm('');
                                                            setSkillFilter('');
                                                            setRemoteOnly(false);
                                                            setStatusFilter('all');
                                                            setShowHighMatchesOnly(false);
                                                            setHideBarebonesJobs(false);
                                                        },
                                                    }, secondaryAction: jobs.length === 0
                                                    ? {
                                                        label: "View settings",
                                                        onClick: () => navigate('/settings?tab=scraper'),
                                                    }
                                                    : undefined })) })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { className: "h-4 w-4 text-primary" }), _jsx(CardTitle, { className: "text-base font-semibold", children: "Skill boosts to chase" })] }), _jsx(CardDescription, { children: "Learn these next to unlock even richer matches." })] }), _jsx(CardContent, { className: "space-y-3", children: skillGapSuggestions.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Once you refresh match scores we'll highlight the most impactful skill boosts." })) : (_jsx("ul", { className: "space-y-3", children: skillGapSuggestions.map((skill) => (_jsxs("li", { className: "flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 gap-4", children: [_jsxs("div", { children: [_jsx("span", { className: "text-sm font-medium text-foreground", children: skill.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [skill.job_count, " listings \u00B7 ", skill.percentage.toFixed(1), "%"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { size: "sm", variant: "ghost", className: "h-7 px-2 text-xs", onClick: () => handleApplySkillFilter(skill.name), children: "Focus" }), _jsx(Button, { size: "sm", variant: "outline", className: "h-7 px-2 text-xs", asChild: true, children: _jsx(Link, { to: "/pulse", children: "See trend" }) })] })] }, skill.name))) })) })] }), _jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Briefcase, { className: "h-4 w-4 text-primary" }), _jsx(CardTitle, { className: "text-base font-semibold", children: "Trending role themes" })] }), _jsx(CardDescription, { children: "What hiring managers keep shouting about this week." })] }), _jsx(CardContent, { className: "space-y-3", children: trendingRoles.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Run a scrape to see which roles are heating up right now." })) : (_jsx("ul", { className: "space-y-3", children: trendingRoles.map((role) => (_jsxs("li", { className: "flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2", children: [_jsx("span", { className: "text-sm font-medium text-foreground", children: role.name }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [role.job_count, " roles \u00B7 ", role.percentage.toFixed(1), "%"] })] }, role.name))) })) })] }), _jsxs(Card, { className: "border bg-card shadow-sm", children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Clock, { className: "h-4 w-4 text-primary" }), _jsx(CardTitle, { className: "text-base font-semibold", children: "Fresh from the feed" })] }), _jsx(CardDescription, { children: "Brand-new listings you might want to bookmark." })] }), _jsx(CardContent, { className: "space-y-3", children: freshDrops.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "No new drops yet\u2014scrape again in a bit." })) : (_jsx("ul", { className: "space-y-3", children: freshDrops.map((job, index) => (_jsxs("li", { className: "rounded-xl border bg-background/70 p-3 transition-all duration-200 hover:bg-background/90 hover:border-primary/30 hover:shadow-sm animate-in fade-in slide-in-from-right-4", style: { animationDelay: `${index * 50}ms` }, children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: job.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: job.company })] }), _jsx(Badge, { variant: "outline", className: "text-xs", children: formatSourceLabel(job.source) })] }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-xs text-muted-foreground", children: [_jsx("span", { children: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'New' }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { size: "sm", variant: "ghost", asChild: true, children: _jsx(Link, { to: `/jobs/${job.id}`, children: "Peek inside" }) }), job.url && (_jsx(Button, { size: "sm", variant: "ghost", asChild: true, children: _jsx("a", { href: job.url, target: "_blank", rel: "noopener noreferrer", children: "Open" }) }))] })] })] }, job.id || job.url || `fresh-${index}`))) })) })] })] })] })] }) }));
}

import { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  Sparkles,
  Briefcase,
  MapPin,
  Building2,
  SlidersHorizontal,
  ThumbsUp,
  ThumbsDown,
  Compass,
  Flame,
  Clock,
  Mail,
  Copy,
  Target,
  Shield,
  Sparkles as SparklesIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Job, JobStatus, MatchQuality, UserProfile } from '@/types/models';
import { jobApi, profileApi, savedSearchApi, schedulerApi, insightsApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatSourceLabel } from '@/lib/sources';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const statusVariant: Record<JobStatus, string> = {
  'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  'applied': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  'rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200',
};

const STATUS_FILTERS: (JobStatus | 'all')[] = ['all', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived'];

const getSanitizer = () => {
  if (typeof window === 'undefined' || !window.document) {
    return {
      sanitize: (value: string) => value,
    } as Pick<typeof DOMPurify, 'sanitize'>;
  }
  return DOMPurify;
};

const sanitizer = getSanitizer();

// Helper function to get match quality from score
function getMatchQuality(score: number | null | undefined): MatchQuality | null {
  if (score === null || score === undefined) return null;
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

// Helper function to get match quality badge variant
function getMatchQualityVariant(quality: MatchQuality | null): string {
  if (!quality) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
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

const stripHtml = (html?: string | null) => {
  if (!html) return '';
  const clean = sanitizer.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return clean.replace(/\s+/g, ' ').trim();
};

const summarize = (value: string, limit = 240) => {
  if (!value) return '';
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

export function Jobs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<{ field: keyof Job; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [isCalculatingScores, setIsCalculatingScores] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [skillFilter, setSkillFilter] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);
  const [dismissedSpotlights, setDismissedSpotlights] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showHighMatchesOnly, setShowHighMatchesOnly] = useState(false);
  const [hideBarebonesJobs, setHideBarebonesJobs] = useState(true);
  const [isRunningSavedSearches, setIsRunningSavedSearches] = useState(false);
  const [isTogglingScheduler, setIsTogglingScheduler] = useState(false);

  // Use React Query for jobs data with caching
  // Use separate query key for jobs page to avoid conflicts with dashboard
  const { data: jobsData, isLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: () => jobApi.list(),
    staleTime: 30_000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const jobs = jobsData ?? [];

  const getJobKey = (job: Job, fallbackIndex: number) => {
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
      } else {
        // Fallback to localStorage
        const profileJson = localStorage.getItem('userProfile');
        if (profileJson) {
          const parsed = JSON.parse(profileJson) as UserProfile;
          setUserProfile(parsed);
        }
      }
    } catch (error: unknown) {
      console.error('Failed to load user profile:', error);
      // Fallback to localStorage
      try {
        const profileJson = localStorage.getItem('userProfile');
        if (profileJson) {
          const profile = JSON.parse(profileJson) as UserProfile;
          setUserProfile(profile);
        }
      } catch (fallbackError: unknown) {
        console.error('Failed to load profile from localStorage:', fallbackError);
      }
    }
  };

  const handleAdvanceSpotlight = () => {
    if (spotlightCount === 0) return;
    setActiveSpotlightIndex((prev) => prev + 1);
  };

  const handleSkipSpotlight = () => {
    if (!spotlightJob) return;
    const key = getJobKey(spotlightJob, effectiveSpotlightIndex);
    setDismissedSpotlights((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    if (spotlightCount <= 1) {
      setActiveSpotlightIndex(0);
    } else if (effectiveSpotlightIndex >= spotlightCount - 1) {
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
    } catch (error: unknown) {
      console.error('Failed to calculate match scores:', error);
      toast({
        title: "Failed to calculate match scores",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
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
      } else {
        const errorMsg = 'No jobs found. Try "demo" to see sample jobs, or a different search term for real scraping.';
        setScrapeError(errorMsg);
        toast({
          title: "No jobs found",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Failed to scrape jobs:', error);
      const errorMessage = getErrorMessage(error);
      const errorMsg = `Scraping failed: ${errorMessage}. Try "demo" to see sample jobs!`;
      setScrapeError(errorMsg);
      toast({
        title: "Scraping failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleRunDueSearches = async () => {
    if (isRunningSavedSearches) return;
    setIsRunningSavedSearches(true);
    try {
      await savedSearchApi.checkAndRun();
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['saved-searches-status'] });
    } catch (error: unknown) {
      console.error('Failed to run saved searches:', error);
    } finally {
      setIsRunningSavedSearches(false);
    }
  };

  const handleToggleScheduler = async () => {
    if (!schedulerStatus || isTogglingScheduler) return;
    setIsTogglingScheduler(true);
    try {
      if (schedulerStatus.running) {
        await schedulerApi.stop();
      } else {
        await schedulerApi.start();
      }
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] });
    } catch (error: unknown) {
      console.error('Failed to toggle scheduler:', error);
    } finally {
      setIsTogglingScheduler(false);
    }
  };

  const handleEnrichBatch = async () => {
    setIsEnriching(true);
    try {
      const enrichedJobs = await jobApi.enrichBatch(10);
      // Invalidate and refetch jobs to get enriched data
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      if (enrichedJobs.length > 0) {
        alert(`✅ Successfully enriched ${enrichedJobs.length} job(s)!`);
      } else {
        alert('ℹ️ No jobs need enrichment (all jobs already have descriptions).');
      }
    } catch (error: unknown) {
      console.error('Failed to enrich jobs:', error);
      alert(`Failed to enrich jobs: ${getErrorMessage(error)}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const filteredJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      const matchesSearch =
        !searchTerm ||
        job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const matchesSkill =
        !skillFilter ||
        job.title?.toLowerCase().includes(skillFilter.toLowerCase()) ||
        job.description?.toLowerCase().includes(skillFilter.toLowerCase()) ||
        job.requirements?.toLowerCase().includes(skillFilter.toLowerCase());
      const matchesRemote =
        !remoteOnly ||
        job.location?.toLowerCase().includes('remote') ||
        job.description?.toLowerCase().includes('remote');
      const hasDetails =
        Boolean(job.description && job.description.trim().length > 80) ||
        Boolean(job.requirements && job.requirements.trim().length > 40);
      const matchesDetail = !hideBarebonesJobs || hasDetails;
      const meetsMatchThreshold =
        !showHighMatchesOnly || (job.match_score ?? -1) >= 60;

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
    if (!spotlightJob || !userProfile) return null;
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
    if (!spotlightJob) return null;
    const subject = `Quick intro for ${spotlightJob.title ?? 'your open role'}`;
    const body = reversePitch
      ? `${reversePitch}\n\nMore about me: ${userProfile?.personal_info?.linkedin || userProfile?.personal_info?.portfolio || ''}`
      : `Hi ${spotlightJob.company ?? 'team'},\n\nI’d love to discuss how I can help with ${spotlightJob.title ?? 'this role'}.\n\n`;
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [reversePitch, spotlightJob, userProfile]);

  const handleCopyPitch = async () => {
    if (!reversePitch || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(reversePitch);
    } catch (error: unknown) {
      console.error('Failed to copy pitch', error);
    }
  };

  const handleApplySkillFilter = (skillName: string) => {
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
        title:
          savedSearchStatus && savedSearchStatus.due_for_run > 0
            ? 'Run due alerts'
            : 'Alerts standing by',
        description:
          savedSearchStatus && savedSearchStatus.due_for_run > 0
            ? `${savedSearchStatus.due_for_run} search${savedSearchStatus.due_for_run > 1 ? 'es' : ''} ready to sweep.`
            : 'Saved searches are syncing hourly.',
        completed: savedSearchStatus ? savedSearchStatus.due_for_run === 0 : false,
        actionLabel:
          savedSearchStatus && savedSearchStatus.due_for_run > 0 ? 'Run now' : 'Manage searches',
        action: savedSearchStatus && savedSearchStatus.due_for_run > 0
          ? () => handleRunDueSearches()
          : undefined,
        href:
          savedSearchStatus && savedSearchStatus.due_for_run > 0
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
  }, [userProfile, savedSearchStatus, schedulerStatus]);

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
      } else {
        return bScore - aScore;
      }
    }

    const aValue = a[sortBy.field] || '';
    const bValue = b[sortBy.field] || '';

    if (aValue === bValue) return 0;

    if (sortBy.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (field: keyof Job) => {
    setSortBy(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 animate-in fade-in duration-500">
        {/* Spotlight Skeleton */}
        <Card className="border-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10">
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24 rounded-full" />
                <Skeleton className="h-10 w-24 rounded-full" />
          </div>
          </div>
          </CardContent>
        </Card>
        
        {/* Filters Skeleton */}
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
        
        {/* Jobs Grid Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border">
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-8 p-6 bg-muted/20 min-h-screen animate-in fade-in duration-500">
      <Card className="border bg-card shadow-sm">
        <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between p-6">
          <div className="space-y-4">
        <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                Let&apos;s find your next obsession
          </h1>
              <p className="mt-3 max-w-xl text-base text-muted-foreground leading-relaxed">
                {matchesAvailable > 0
                  ? `You've got ${matchesAvailable} high-fit matches primed. ${remotePercentage !== null ? `${Math.round(remotePercentage)}% of the feed is remote` : 'Remote opportunities are flowing'}, and ${hotRole ? `${hotRole.name} roles` : 'fresh opportunities'} are trending right now.`
                  : 'Scrape a fresh batch and add your skills—your personalised feed will wake right up.'}
          </p>
        </div>
            <div className="flex flex-wrap gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleScrape} 
                    disabled={isScraping} 
                    className="gap-2"
                  >
                    {isScraping ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isScraping ? 'Scraping…' : 'Scrape new roles'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search and scrape jobs from multiple sources</p>
                </TooltipContent>
              </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={handleCalculateMatchScores} 
                disabled={isCalculatingScores || !userProfile}
                className="gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isCalculatingScores ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Scoring…</span>
                  </>
                ) : (
                  <>
                    <Flame className="h-4 w-4" />
                    <span>Refresh matches</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{!userProfile ? 'Create a user profile first to calculate match scores' : 'Recalculate how well jobs match your profile'}</p>
            </TooltipContent>
          </Tooltip>
          <Button 
            variant="outline" 
            onClick={handleEnrichBatch} 
            disabled={isEnriching}
            className="gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title="Fetch full descriptions for jobs missing details"
          >
            {isEnriching ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Enriching…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Enrich Missing Jobs</span>
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
                onClick={() => refetchJobs()} 
                className="gap-2 transition-all duration-200 hover:scale-105"
          >
                <RefreshCw className="h-4 w-4" />
                Reload cache
          </Button>
              <Button variant="outline" asChild className="gap-2">
            <Link to="/jobs/new">
                  <Plus className="h-4 w-4" />
                  Add job manually
            </Link>
          </Button>
        </div>
      </div>
          <div className="grid w-full max-w-sm gap-3 rounded-2xl border bg-background/85 p-4 text-sm shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Matches queued</span>
              <span className="text-lg font-semibold text-foreground">{matchesAvailable}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Jobs visible</span>
              <span className="text-lg font-semibold text-foreground">
                {filteredCount} / {totalJobs}
              </span>
                </div>
            {remotePercentage !== null && onsitePercentage !== null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Remote vibe</span>
                <span className="text-lg font-semibold text-foreground">
                  {Math.round(remotePercentage)}% remote · {Math.round(onsitePercentage)}% onsite
                </span>
                </div>
            )}
            {topTrendingSkill && (
              <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <span className="block text-sm font-semibold text-foreground">
                  Skill in demand: {topTrendingSkill.name}
                </span>
                <span>Showing up in {topTrendingSkill.job_count} listings this cycle.</span>
                </div>
            )}
            {topHiringCompany && (
              <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <span className="block text-sm font-semibold text-foreground">
                  {topHiringCompany.name}
                </span>
                <span>{topHiringCompany.job_count} open roles live now.</span>
              </div>
            )}
            </div>
          </CardContent>
        </Card>

      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-4 w-4 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold">Quest feed</CardTitle>
              <CardDescription className="text-sm">
                Small actions that unlock reverse-hiring perks.
              </CardDescription>
        </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {questItems.map((quest) => (
            <div
              key={quest.id}
              className={cn(
                'rounded-xl border p-4 space-y-2 transition-all',
                quest.completed ? 'bg-emerald-50/80 border-emerald-100' : 'bg-muted/30',
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'rounded-lg p-2',
                    quest.completed ? 'bg-emerald-200 text-emerald-700' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <quest.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold text-foreground">{quest.title}</span>
              </div>
              <p className="text-sm text-muted-foreground">{quest.description}</p>
              {quest.action ? (
                <Button
                  size="sm"
                  variant={quest.completed ? 'outline' : 'default'}
                  className="gap-2"
                  onClick={quest.action}
                  disabled={quest.id === 'scheduler' && isTogglingScheduler}
                >
                  {quest.actionLabel}
                </Button>
              ) : quest.href ? (
                <Button
                  size="sm"
                  variant={quest.completed ? 'outline' : 'default'}
                  className="gap-2"
                  asChild
                >
                  <Link to={quest.href}>{quest.actionLabel}</Link>
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {!userProfile && (
        <Card className="border border-dashed bg-muted/30">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <SparklesIcon className="h-4 w-4 text-primary" />
            </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Add your profile to unlock reverse pitches</p>
                <p className="text-sm text-muted-foreground">
                  We’ll craft personal intros for spotlight jobs once your summary & skills are saved.
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link to="/settings?tab=profile">Complete profile</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {scrapeError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {scrapeError}
            </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">Saved searches & alerts</CardTitle>
                  <CardDescription>
                    Keep automations ready before the scheduler sweeps.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {savedSearchStatus ? `${savedSearchStatus.enabled}/${savedSearchStatus.total} active` : '—'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {savedSearchStatus ? (
                <>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="text-muted-foreground">Total searches</span>
                    <span className="font-medium text-foreground">{savedSearchStatus.total}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="text-muted-foreground">Enabled</span>
                    <span className="font-medium text-foreground">{savedSearchStatus.enabled}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="text-muted-foreground">Due for run</span>
                    <span className={cn('font-medium', savedSearchStatus.due_for_run > 0 && 'text-amber-600')}>
                      {savedSearchStatus.due_for_run}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No saved searches yet. Create one from Settings.</p>
              )}
              <div className="flex gap-2">
              <Button
                size="sm"
                  onClick={handleRunDueSearches}
                  disabled={isRunningSavedSearches || !savedSearchStatus?.due_for_run}
                className="flex-1"
              >
                  {isRunningSavedSearches ? 'Checking…' : 'Run due searches'}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/settings?tab=saved-searches">Manage</Link>
              </Button>
          </div>
        </CardContent>
      </Card>

          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">Scheduler & notifications</CardTitle>
                  <CardDescription>
                    Background scraping and desktop alerts status.
                  </CardDescription>
            </div>
                <Badge variant={schedulerStatus?.running ? 'default' : 'secondary'} className="text-xs">
                  {schedulerStatus?.running ? 'Running' : 'Idle'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {schedulerStatus ? (
                <>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Enabled</span>
                    <span className="font-medium text-foreground">
                      {schedulerStatus.enabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <p className="text-xs uppercase tracking-wide mb-1">Schedule</p>
                    <p className="rounded-lg border bg-muted/30 px-3 py-2 text-foreground">
                      {schedulerStatus.schedule || 'Not configured'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Notifications</span>
                    <span className="font-medium text-foreground">
                      {schedulerStatus.send_notifications ? 'On' : 'Off'}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Scheduler not configured yet.</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleToggleScheduler}
                  disabled={!schedulerStatus || isTogglingScheduler}
                  className="flex-1"
                >
                  {schedulerStatus?.running ? 'Pause scheduler' : 'Start scheduler'}
              </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/settings?tab=scheduler">Configure</Link>
              </Button>
            </div>
            </CardContent>
          </Card>

          <Card className="border bg-card shadow-sm">
                <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-muted p-2">
                    <Flame className="h-4 w-4 text-muted-foreground" />
                </div>
                  <div>
                    <CardTitle className="text-xl font-semibold">Spotlight match</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      High-intent roles that mirror your skill DNA.
                      </CardDescription>
                </div>
                </div>
                {spotlightCount > 0 && (
                  <Badge className="text-xs font-medium">
                    {effectiveSpotlightIndex + 1} / {spotlightCount}
                  </Badge>
                    )}
              </div>
                </CardHeader>
            {spotlightJob ? (
              <>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <h2 className="text-2xl md:text-3xl font-semibold text-foreground">{spotlightJob.title}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-4 w-4" />
                          {spotlightJob.company}
                        </span>
                        {spotlightJob.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {spotlightJob.location}
                          </span>
                        )}
            </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatSourceLabel(spotlightJob.source)}
                    </Badge>
                    </div>
                  {spotlightSummary && (
                    <p className="text-sm leading-relaxed text-muted-foreground">{spotlightSummary}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {spotlightJob.salary && (
                      <Badge variant="outline" className="bg-amber-50/80 text-amber-800">
                        {spotlightJob.salary}
                    </Badge>
                    )}
                    {spotlightMatchQuality && (
                      <Badge className={cn('font-semibold', getMatchQualityVariant(spotlightMatchQuality))}>
                        {spotlightMatchQuality} {spotlightJob.match_score?.toFixed(0)}%
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Added {spotlightJob.created_at ? new Date(spotlightJob.created_at).toLocaleDateString() : 'recently'}
                    </Badge>
                  </div>
                {reversePitch && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4 text-primary" />
                        Reverse pitch draft
                      </span>
                      <Button size="sm" variant="ghost" className="gap-2" onClick={handleCopyPitch}>
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{reversePitch}</p>
                  </div>
                )}
          </CardContent>
                <CardFooter className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={handleSkipSpotlight} className="gap-2">
                      <ThumbsDown className="h-4 w-4" />
                      Skip
                    </Button>
                    <Button variant="secondary" onClick={handleAdvanceSpotlight} className="gap-2">
                      <ThumbsUp className="h-4 w-4" />
                      Next sparkle
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-2" asChild>
                      <Link to={`/jobs/${spotlightJob.id ?? ''}`}>Peek inside</Link>
                    </Button>
                    {spotlightJob.url && (
                      <Button size="sm" variant="outline" className="border-2 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:scale-105" asChild>
                        <a href={spotlightJob.url} target="_blank" rel="noopener noreferrer">
                          Open posting
                        </a>
                      </Button>
                    )}
                  {reversePitch && (
                    <Button size="sm" variant="outline" className="gap-2" onClick={handleCopyPitch}>
                      <Copy className="h-4 w-4" />
                      Copy pitch
                    </Button>
                  )}
                  {outreachMailLink && (
                    <Button size="sm" variant="secondary" className="gap-2" asChild>
                      <a href={outreachMailLink}>
                        <Mail className="h-4 w-4" />
                        Reach out
                      </a>
                    </Button>
                  )}
                  </div>
                </CardFooter>
              </>
            ) : (
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  We’ll drop spotlight matches here once you’ve scraped jobs and refreshed match scores.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleScrape} disabled={isScraping}>
                    {isScraping ? 'Scraping…' : 'Scrape now'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCalculateMatchScores}
                    disabled={isCalculatingScores || !userProfile}
                  >
                    Refresh matches
                  </Button>
                </div>
              </CardContent>
            )}
        </Card>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold">Tune your feed</CardTitle>
                  <CardDescription>Stack filters to shape the vibe.</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {showAdvancedFilters ? 'Hide tips' : 'Pro tips'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search roles, companies, keywords…"
                      className="h-12 rounded-xl border-muted/40 bg-background/70 pl-10"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Skill focus (e.g. next.js, go, fintech)"
                      className="h-12 rounded-xl border-muted/40 bg-background/70 pl-10"
                      value={skillFilter}
                      onChange={(event) => setSkillFilter(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-muted/40 bg-background/70 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Remote mode
                    </p>
                    <p className="text-sm text-foreground">
                      {remoteOnly ? 'Only remote opportunities' : 'Any location, remote included'}
                    </p>
                  </div>
                  <Switch id="remote-only" checked={remoteOnly} onCheckedChange={(value) => setRemoteOnly(Boolean(value))} />
                </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-muted/40 bg-background/70 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      High-fit view
                    </p>
                    <p className="text-sm text-foreground">
                      {showHighMatchesOnly ? 'Showing ≥60% matches' : 'Include all match scores'}
                    </p>
                  </div>
                  <Switch
                    id="match-only"
                    checked={showHighMatchesOnly}
                    onCheckedChange={(value) => setShowHighMatchesOnly(Boolean(value))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-muted/40 bg-background/70 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Hide empty posts
                    </p>
                    <p className="text-sm text-foreground">
                      {hideBarebonesJobs ? 'Stripping blank descriptions' : 'Show every posting'}
                    </p>
                  </div>
                  <Switch
                    id="hide-empty"
                    checked={hideBarebonesJobs}
                    onCheckedChange={(value) => setHideBarebonesJobs(Boolean(value))}
                  />
                </div>
              </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={statusFilter === option ? 'default' : 'outline'}
                    className={cn('rounded-full capitalize', statusFilter === option ? 'shadow-md' : 'bg-background/70')}
                    onClick={() => setStatusFilter(option)}
                  >
                    {option === 'all' ? 'All' : option}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={sortBy.field === 'match_score' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                  onClick={() => handleSort('match_score')}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Rank by match
                </Button>
                <Button
                  variant={sortBy.field === 'created_at' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                  onClick={() => handleSort('created_at')}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Newest first
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSkillFilter('');
                    setRemoteOnly(false);
                    setStatusFilter('all');
                  }}
                >
                  Reset filters
                </Button>
              </div>

              {showAdvancedFilters && (
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">Pro tip</p>
                  <p>Add multiple keywords with commas (e.g. “growth, lifecycle, email”) to surface niche matches.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Discovery feed</CardTitle>
              <CardDescription>
                {sortedJobs.length > 0
                  ? `${sortedJobs.length} roles after filters.`
                  : 'No roles match your filters just yet.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
      {sortedJobs.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
          {sortedJobs.map((job, index) => {
            const matchQuality = getMatchQuality(job.match_score);
                    const summary = summarize(stripHtml(job.description || job.requirements || ''), 220);
            return (
              <Card 
                key={job.id || `job-${index}`} 
                        className="group rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                        style={{ animationDelay: `${index % 6 * 50}ms` }}
                      >
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <h3 className="text-lg font-semibold text-foreground">
                                <Link to={`/jobs/${job.id}`} className="hover:text-primary">
                          {job.title}
                        </Link>
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {job.company}
                                </span>
                                {job.location && (
                                  <span className="flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {job.location}
                                  </span>
                    )}
                  </div>
                    </div>
                            <Badge variant="outline" className="text-xs">
                              {formatSourceLabel(job.source)}
                            </Badge>
                    </div>

                          {summary && (
                            <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4">{summary}</p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Badge className={statusVariant[job.status]}>{job.status}</Badge>
                    {job.match_score !== null && job.match_score !== undefined && (
                              <Badge className={cn('font-semibold', getMatchQualityVariant(matchQuality))}>
                        {matchQuality} {job.match_score.toFixed(0)}%
                      </Badge>
                    )}
                            {job.salary && (
                              <Badge variant="outline" className="bg-amber-50/80 text-amber-800">
                                {job.salary}
                    </Badge>
                            )}
                  </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown date'}
                    </span>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" asChild>
                                <Link to={`/jobs/${job.id}`}>Peek inside</Link>
                    </Button>
                              {job.url && (
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={job.url} target="_blank" rel="noopener noreferrer">
                                    Open
                                  </a>
                    </Button>
                              )}
                            </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
              ) : (
                <EmptyState
                  icon={Briefcase}
                  title={jobs.length === 0 ? "No jobs yet" : "No jobs match your filters"}
                  description={
                    jobs.length === 0
                      ? "Start by scraping jobs from various sources. We'll help you find the perfect match!"
                      : "Try adjusting your search terms, filters, or clear them to see all available jobs."
                  }
                  action={
                    jobs.length === 0
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
                        }
                  }
                  secondaryAction={
                    jobs.length === 0
                      ? {
                          label: "View settings",
                          onClick: () => navigate('/settings?tab=scraper'),
                        }
                      : undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Skill boosts to chase</CardTitle>
              </div>
              <CardDescription>
                Learn these next to unlock even richer matches.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {skillGapSuggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Once you refresh match scores we&apos;ll highlight the most impactful skill boosts.
                </p>
              ) : (
                <ul className="space-y-3">
                  {skillGapSuggestions.map((skill) => (
                <li
                  key={skill.name}
                  className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 gap-4"
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">{skill.name}</span>
                    <p className="text-xs text-muted-foreground">
                      {skill.job_count} listings · {skill.percentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleApplySkillFilter(skill.name)}
                    >
                      Focus
            </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
                      <Link to="/pulse">See trend</Link>
                    </Button>
                  </div>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>

          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Trending role themes</CardTitle>
              </div>
              <CardDescription>
                What hiring managers keep shouting about this week.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {trendingRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Run a scrape to see which roles are heating up right now.
                </p>
              ) : (
                <ul className="space-y-3">
                  {trendingRoles.map((role) => (
                    <li key={role.name} className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2">
                      <span className="text-sm font-medium text-foreground">{role.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {role.job_count} roles · {role.percentage.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Fresh from the feed</CardTitle>
              </div>
              <CardDescription>
                Brand-new listings you might want to bookmark.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {freshDrops.length === 0 ? (
                <p className="text-sm text-muted-foreground">No new drops yet—scrape again in a bit.</p>
              ) : (
                <ul className="space-y-3">
                  {freshDrops.map((job, index) => (
                    <li 
                      key={job.id || job.url || `fresh-${index}`} 
                      className="rounded-xl border bg-background/70 p-3 transition-all duration-200 hover:bg-background/90 hover:border-primary/30 hover:shadow-sm animate-in fade-in slide-in-from-right-4"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{job.title}</p>
                          <p className="text-xs text-muted-foreground">{job.company}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {formatSourceLabel(job.source)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{job.created_at ? new Date(job.created_at).toLocaleDateString() : 'New'}</span>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/jobs/${job.id}`}>Peek inside</Link>
                          </Button>
                          {job.url && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={job.url} target="_blank" rel="noopener noreferrer">
                                Open
                              </a>
            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

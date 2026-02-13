import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { jobApi, profileApi, insightsApi, authApi, automationApi, applicationApi } from '@/api/client';
import type { UserProfile } from '@/types/models';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatSourceLabel } from '@/lib/sources';
import {
  Sparkles,
  Rocket,
  Lightbulb,
  TrendingUp,
  RefreshCw,
  Wand2,
  Trophy,
  Target,
  ArrowUpRight,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  OnboardingChecklist,
  type ChecklistStep,
} from '@/components/dashboard/OnboardingChecklist';

const DEFAULT_SOURCES = ['remotive', 'remoteok', 'greenhouse', 'wellfound', 'indeed'];

const formatPercent = (value: number) => `${Math.round(value)}%`;

const getMatchMood = (score: number | null | undefined) => {
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

const friendlyName = (profile?: UserProfile | null) => {
  const raw = profile?.personal_info?.name?.trim();
  if (!raw) return 'friend';
  const first = raw.split(' ')[0];
  return first || 'friend';
};

const formatRelativeTime = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

type StatusState = 'ready' | 'warning' | 'action';

type StatusAction =
  | { type: 'link'; label: string; to: string }
  | { type: 'button'; label: string; onClick: () => void; disabled?: boolean };

interface StatusTile {
  label: string;
  icon: LucideIcon;
  state: StatusState;
  detail: string;
  action?: StatusAction;
  footer?: React.ReactNode;
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [scrapeQuery, setScrapeQuery] = useState('developer');
  const [isScraping, setIsScraping] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [autoApplyResult, setAutoApplyResult] = useState<{
    jobs_scraped: number;
    jobs_filtered: number;
    applications_submitted: number;
    applications_failed: number;
  } | null>(null);

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobApi.list(undefined, undefined, 1, 50), // Limit to 50 jobs for dashboard
    staleTime: 30_000, // Cache for 30 seconds
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
    staleTime: 60_000,
  });

  const { data: automationHealth } = useQuery({
    queryKey: ['automation-health'],
    queryFn: () => automationApi.healthCheck(),
    staleTime: 60_000,
  });

  const jobs = jobsData ?? [];
  const isLoading = jobsLoading || insightsLoading;

  useEffect(() => {
    if (bootstrapped) return;
    if (profile === undefined || jobsData === undefined) return;

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
      } catch (error) {
        console.error('Auto-scrape failed:', error);
      } finally {
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
    if (!jobs.length) return null;
    const timestamps = jobs
      .map((job) => (job.created_at ? new Date(job.created_at).getTime() : null))
      .filter((value): value is number => value !== null);
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps));
  }, [jobs]);

  const handleScrape = async () => {
    if (isScraping) return;
    setIsScraping(true);
    try {
      const query = scrapeQuery.trim() || 'developer';
      await jobApi.scrapeSelected(DEFAULT_SOURCES, query);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['market-insights'] });
    } catch (error) {
      console.error('Failed to scrape jobs:', error);
    } finally {
      setIsScraping(false);
    }
  };

  const handleAutoApply = async () => {
    if (isAutoApplying) return;
    setIsAutoApplying(true);
    setAutoApplyResult(null);
    try {
      const result = await applicationApi.autoApply('remote senior backend engineer', 5, isDryRun);
      setAutoApplyResult(result);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['market-insights'] });
    } catch (error) {
      console.error('Auto-apply failed:', error);
    } finally {
      setIsAutoApplying(false);
    }
  };

  const jobsCount = jobs.length;
  const statusStateMeta: Record<
    StatusState,
    { label: string; className: string; pillClass: string }
  > = {
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
  const browsersReady = Boolean(
    automationHealth?.playwright_available || automationHealth?.chromium_available,
  );
  const jobFeedStale = lastScrapedDate
    ? Date.now() - lastScrapedDate.getTime() > 1000 * 60 * 60 * 48
    : false;
  const jobFeedState: StatusState = jobsCount === 0 ? 'action' : jobFeedStale ? 'warning' : 'ready';
  const jobFeedDetail =
    jobsCount === 0
      ? 'No jobs scraped yet.'
      : `Last import ${lastScrapedDate ? formatRelativeTime(lastScrapedDate) : 'recently'}.`;
  const jobFeedActionLabel = isScraping
    ? 'Scraping…'
    : jobsCount === 0
      ? 'Run scrape'
      : 'Refresh feed';

  const automationState: StatusState = automationHealth
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

  const statusTiles: StatusTile[] = [
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
      action:
        automationHealth && docCount === 0
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
      footer: (
        <div className="flex items-center space-x-2 pt-2">
          <Switch id="dry-run" checked={isDryRun} onCheckedChange={setIsDryRun} />
          <Label htmlFor="dry-run" className="text-xs text-muted-foreground">Dry Run Mode</Label>
        </div>
      ),
    },
  ];

  const checklistSteps: ChecklistStep[] = [
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
      description:
        jobsCount > 0
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
      description:
        recommendationsLoading || (recommendedJobs && recommendedJobs.length > 0)
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
    return (
      <div className="space-y-8 p-6 animate-in fade-in duration-500">
        {/* Hero Section Skeleton */}
        <Card className="border-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10">
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <div className="flex gap-3">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Skeleton */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 rounded-xl border p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Fresh Finds Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 animate-in fade-in duration-500 bg-muted/30 min-h-screen">
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Quick Status</CardTitle>
          <CardDescription className="text-sm">
            See what needs your attention.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statusTiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border bg-background/80 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <tile.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{tile.label}</span>
                </div>
                <span
                  className={`text-xs font-semibold rounded-full px-2 py-0.5 ${statusStateMeta[tile.state].pillClass}`}
                >
                  {statusStateMeta[tile.state].label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{tile.detail}</p>
              {tile.action && (
                tile.action.type === 'link' ? (
                  <Button variant="link" size="sm" className="px-0" asChild>
                    <Link to={tile.action.to}>{tile.action.label}</Link>
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={tile.action.onClick}
                    disabled={tile.action.disabled}
                  >
                    {tile.action.label}
                  </Button>
                )
              )}
              {tile.footer}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[2fr_minmax(0,1fr)]">
        <Card className="border bg-gradient-to-br from-primary/5 via-background to-background shadow-md">
          <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between p-6">
            <div className="space-y-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                  Level up your job hunt
                </h1>
                <p className="mt-3 max-w-xl text-base text-muted-foreground leading-relaxed">
                  {totalMatches > 0
                    ? `You’ve logged ${totalMatches} matches. Remote roles are sitting at ${formatPercent(
                      remotePercentage,
                    )} — keep the radar humming.`
                    : 'Start by scraping jobs and adding your skills to unlock personalized quests.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={scrapeQuery}
                  onChange={(event) => setScrapeQuery(event.target.value)}
                  placeholder="Try 'senior react', 'ml engineer'..."
                  className="w-full max-w-xs"
                />
                <Button onClick={handleScrape} disabled={isScraping} className="gap-2">
                  {isScraping ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Scraping...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Scrape jobs</span>
                    </>
                  )}
                </Button>
                <Button variant="outline" asChild className="gap-2">
                  <Link to="/jobs">
                    <Rocket className="h-4 w-4" /> Browse all jobs
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 w-full max-w-md">
              {journeyStats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 rounded-xl border bg-background/80 px-4 py-3"
                >
                  <div className="rounded-lg bg-muted p-2">
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.subtext}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border bg-background/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Progress toward next badge
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Level {seekerLevel + 1} unlocks at {nextMilestoneTarget} matches
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-indigo-500 to-purple-500 transition-all"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <OnboardingChecklist steps={checklistSteps} />
      </div>


      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg font-semibold">Quest board</CardTitle>
              <CardDescription className="text-sm">
                Micro-actions that boost your reverse-hiring signal.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Refresh a saved search</p>
            <p className="text-sm text-muted-foreground">
              Keep alerts hot—hourly cadence keeps the feed feeling live.
            </p>
            <Button size="sm" variant="outline" className="gap-2" asChild>
              <Link to="/settings?tab=saved-searches">
                <RefreshCw className="h-3.5 w-3.5" />
                Manage searches
              </Link>
            </Button>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Tune your pitch</p>
            <p className="text-sm text-muted-foreground">
              Spotlight intros pull from your summary & highlight skills.
            </p>
            <Button size="sm" variant="outline" className="gap-2" asChild>
              <Link to="/settings?tab=profile">
                <Shield className="h-3.5 w-3.5" />
                Profile settings
              </Link>
            </Button>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Track a milestone</p>
            <p className="text-sm text-muted-foreground">
              Logging interviews and offers feeds smarter insights.
            </p>
            <Button size="sm" variant="outline" className="gap-2" asChild>
              <Link to="/applications">
                <Rocket className="h-3.5 w-3.5" />
                Applications
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg font-semibold">Need an orientation?</CardTitle>
              <CardDescription className="text-sm">
                Jump straight to the spots that unblock the end-to-end test persona.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {orientationShortcuts.map((item) => (
            <div key={item.title} className="rounded-xl border bg-background/70 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                <Link to={item.to}>{item.label}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recommendations Section */}
      {recommendedJobs && recommendedJobs.length > 0 && (
        <Card className="border bg-gradient-to-br from-primary/5 via-background to-background shadow-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl font-bold">Jobs You Might Like</CardTitle>
                <CardDescription className="text-sm">
                  Personalized recommendations based on your profile and behavior
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {recommendedJobs.slice(0, 4).map((rec, index) => {
                const job = rec.job;
                const mood = getMatchMood(rec.recommendation_score);
                return (
                  <div
                    key={job.id ?? job.url}
                    className="group rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-lg hover:border-primary/40"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-foreground">{job.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{job.company}</p>
                      </div>
                      <Badge className={cn('text-xs font-semibold', mood.className)}>
                        {Math.round(rec.recommendation_score)}%
                      </Badge>
                    </div>
                    {rec.reasons.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground">
                          {rec.reasons[0]}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="flex-1"
                        onClick={() => job.id && jobApi.trackInteraction(job.id, 'view')}
                      >
                        <Link to={`/jobs/${job.id ?? ''}`}>
                          View Details
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          Open
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {recommendedJobs.length > 4 && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" asChild className="text-sm">
                  <Link to="/jobs?filter=recommended">
                    See all recommendations
                    <Rocket className="h-3.5 w-3.5 ml-2" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg font-semibold">Top Matches</CardTitle>
                <CardDescription className="text-sm">
                  Jobs that best match your skills and experience
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {topMatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-muted-foreground/40 p-6 text-sm text-muted-foreground">
                Add your skills in <Link to="/settings?tab=profile" className="underline">profile settings</Link> to unlock personalised matches.
              </div>
            ) : (
              <div className="space-y-3">
                {topMatches.map((job, index) => {
                  const mood = getMatchMood(job.match_score);
                  return (
                    <div
                      key={job.id ?? job.url}
                      className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-all duration-200 hover:shadow-md"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{job.title}</h3>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{job.company}</span>
                            <span>•</span>
                            <span>{formatSourceLabel(job.source)}</span>
                          </div>
                        </div>
                        <Badge className={cn('text-xs font-semibold transition-all duration-200', mood.className)}>
                          {mood.label}
                          {job.match_score !== null && job.match_score !== undefined
                            ? ` · ${Math.round(job.match_score)}%`
                            : ''}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {job.location && <Badge variant="outline">{job.location}</Badge>}
                        {job.salary && (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50/80 text-amber-800">
                            {job.salary}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          asChild
                          className="gap-2"
                        >
                          <Link to={`/jobs/${job.id ?? ''}`}>
                            <Wand2 className="h-3.5 w-3.5" /> View Details
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href={job.url} target="_blank" rel="noopener noreferrer">
                            Open posting
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-end">
              <Button variant="ghost" asChild className="text-sm">
                <Link to="/jobs" className="gap-2">
                  See all matches
                  <Rocket className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg font-semibold">Recommended Skills</CardTitle>
                <CardDescription className="text-sm">
                  Skills that appear frequently in high-match positions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {skillSuggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                We’ll surface learning tips after your next scrape.
              </p>
            ) : (
              <ul className="space-y-2">
                {skillSuggestions.map((skill, index) => (
                  <li
                    key={skill.name}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="font-medium text-foreground">{skill.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {skill.job_count} jobs · {skill.percentage.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/jobs" className="gap-2 text-xs">
                Peek roles using these skills
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-xl font-bold text-gradient-primary">Freshly scraped crowd-pleasers</CardTitle>
              <CardDescription className="text-sm mt-1">
                The newest roles hitting your feed. Keep them in view before they vanish. ⚡
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {freshFinds.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-muted-foreground/40 p-6 text-sm text-muted-foreground">
              Nothing new yet. Hit the scrape button and we’ll restock this shelf.
            </div>
          ) : (
            freshFinds.map((job, index) => (
              <div
                key={job.id ?? job.url}
                className="group rounded-xl border-2 border-border/50 bg-card/90 backdrop-blur-sm p-5 shadow-soft transition-all duration-300 hover:shadow-soft-lg hover:border-primary/40 hover:scale-[1.02] hover-lift animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">{job.title}</span>
                  <Badge variant="outline">{formatSourceLabel(job.source)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{job.company}</p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <Button variant="ghost" size="sm" asChild className="px-0 text-xs">
                    <Link to={`/jobs/${job.id ?? ''}`}>View details</Link>
                  </Button>
                  <span className="text-muted-foreground">•</span>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    Open posting
                  </a>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

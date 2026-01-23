import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { insightsApi } from '@/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, Radio, BarChart3, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';

const InsightCardSkeleton = () => (
  <Card className="border bg-card shadow-sm">
    <CardHeader className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-3 w-3/4" />
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </CardContent>
  </Card>
);

export function Pulse() {
  const { data: marketInsights, isLoading } = useQuery({
    queryKey: ['market-insights', 'pulse'],
    queryFn: () => insightsApi.getMarketInsights(30),
    refetchInterval: 5 * 60 * 1000,
  });

  const skillTrends = useMemo(() => marketInsights?.skill_trends ?? [], [marketInsights]);
  const roleTrends = useMemo(() => marketInsights?.role_trends ?? [], [marketInsights]);
  const sourcesBreakdown = useMemo(() => marketInsights?.sources_breakdown ?? [], [marketInsights]);
  const topCompanies = useMemo(() => marketInsights?.top_companies ?? [], [marketInsights]);

  const topRisingSkill = skillTrends
    .filter((trend) => trend.delta_percentage > 0)
    .sort((a, b) => b.delta_percentage - a.delta_percentage)[0];
  const topFallingSkill = skillTrends
    .filter((trend) => trend.delta_percentage < 0)
    .sort((a, b) => a.delta_percentage - b.delta_percentage)[0];
  const breakoutRole = roleTrends
    .filter((trend) => trend.delta_percentage > 0)
    .sort((a, b) => b.delta_percentage - a.delta_percentage)[0];

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 bg-muted/20 min-h-screen">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-2 h-10 w-64" />
            <Skeleton className="mt-1 h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <InsightCardSkeleton />
          <InsightCardSkeleton />
          <InsightCardSkeleton />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCardSkeleton />
          <InsightCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-muted/20 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge className="bg-primary text-primary-foreground">Live Signals</Badge>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">
            Pulse & Trends
          </h1>
          <p className="mt-1 text-muted-foreground">
            Updated every few hours from the latest scraped roles.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/jobs">Check matching roles</a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Breakout skill
            </CardTitle>
            <CardDescription>
              Biggest week-over-week jump in mentions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topRisingSkill ? (
              <>
                <p className="text-2xl font-semibold text-foreground">{topRisingSkill.name}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="bg-emerald-100 text-emerald-700">
                    <ArrowUp className="mr-1 h-3 w-3" />
                    {topRisingSkill.delta_percentage.toFixed(1)}%
                  </Badge>
                  <span className="text-muted-foreground">
                    {topRisingSkill.current_count} mentions this window
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Need more data to calculate.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Cooling skill
            </CardTitle>
            <CardDescription>
              Biggest drop in share of roles since last snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topFallingSkill ? (
              <>
                <p className="text-2xl font-semibold text-foreground">{topFallingSkill.name}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-amber-600 border-amber-200">
                    <ArrowDown className="mr-1 h-3 w-3" />
                    {topFallingSkill.delta_percentage.toFixed(1)}%
                  </Badge>
                  <span className="text-muted-foreground">
                    {topFallingSkill.current_count} mentions now
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Need more data to calculate.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Radio className="h-4 w-4 text-cyan-500" />
              Breakout role
            </CardTitle>
            <CardDescription>
              Highest acceleration in listings compared to the prior period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {breakoutRole ? (
              <>
                <p className="text-2xl font-semibold text-foreground">{breakoutRole.name}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="bg-primary/10 text-primary">
                    <ArrowUp className="mr-1 h-3 w-3" />
                    {breakoutRole.delta_percentage.toFixed(1)}%
                  </Badge>
                  <span className="text-muted-foreground">
                    {breakoutRole.current_count} openings now live
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Need more data to calculate.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg font-semibold">Source breakdown</CardTitle>
            <CardDescription>
              Share of the latest roles by source (last 7 days).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sourcesBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm">Scrape is running—check back soon.</p>
            ) : (
              <div className="space-y-2">
                {sourcesBreakdown.slice(0, 6).map((source) => (
                  <div
                    key={source.name}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">{source.name}</span>
                    <span className="text-muted-foreground">
                      {source.job_count} roles ({source.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg font-semibold">Companies hiring hardest</CardTitle>
            <CardDescription>
              Who just moved into the fast lane.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCompanies.length === 0 ? (
              <p className="text-muted-foreground text-sm">Waiting for the latest ingest.</p>
            ) : (
              <div className="space-y-2">
                {topCompanies.slice(0, 5).map((company, index) => (
                  <div
                    key={company.name}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{index + 1}</Badge>
                      <span className="font-medium text-foreground">{company.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {company.job_count} active roles
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-lg font-semibold">Unusual signals</CardTitle>
          </div>
          <CardDescription>Hypotheses worth investigating.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {topRisingSkill && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Skill spike
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">{topRisingSkill.name}</p>
              <p className="mt-2 text-muted-foreground">
                Up {topRisingSkill.delta_percentage.toFixed(1)}% vs previous period.
              </p>
            </div>
          )}
          {topFallingSkill && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Cooling signal
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">{topFallingSkill.name}</p>
              <p className="mt-2 text-muted-foreground">
                Down {Math.abs(topFallingSkill.delta_percentage).toFixed(1)}%.
              </p>
            </div>
          )}
          {breakoutRole && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Role breakout
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">{breakoutRole.name}</p>
              <p className="mt-2 text-muted-foreground">
                {breakoutRole.current_count} openings—highest acceleration this cycle.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


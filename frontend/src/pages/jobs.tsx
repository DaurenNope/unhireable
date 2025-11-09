import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, RefreshCw, Sparkles, Briefcase, MapPin, Building2, ExternalLink, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Job, JobStatus, MatchQuality, UserProfile } from '@/types/models';
import { jobApi } from '@/api/client';
import { cn } from '@/lib/utils';

const statusVariant: Record<JobStatus, string> = {
  'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  'applied': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  'rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200',
};

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

export function Jobs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<{ field: keyof Job; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [isCalculatingScores, setIsCalculatingScores] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadJobs();
    loadUserProfile();
  }, []);

  const loadUserProfile = () => {
    try {
      const profileJson = localStorage.getItem('userProfile');
      if (profileJson) {
        const profile = JSON.parse(profileJson) as UserProfile;
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const handleCalculateMatchScores = async () => {
    if (!userProfile) {
      alert('Please create a user profile first in Settings to calculate match scores.');
      return;
    }

    setIsCalculatingScores(true);
    try {
      const updatedCount = await jobApi.updateMatchScores(userProfile);
      alert(`Successfully calculated match scores for ${updatedCount} job(s)!`);
      await loadJobs();
    } catch (error: any) {
      console.error('Failed to calculate match scores:', error);
      alert(`Failed to calculate match scores: ${error.message}`);
    } finally {
      setIsCalculatingScores(false);
    }
  };

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      const jobsData = await jobApi.list();
      
      if (jobsData && Array.isArray(jobsData)) {
        setJobs(jobsData as Job[]);
      } else {
        setJobs([]);
      }
    } catch (error: any) {
      console.error('Failed to load jobs:', error);
      setJobs([]);
    } finally {
      setIsLoading(false);
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
        await loadJobs();
        setScrapeError(null);
        // Show success message
        console.log(`✅ Successfully loaded ${scrapedJobs.length} jobs`);
      } else {
        setScrapeError('No jobs found. Try "demo" to see sample jobs, or a different search term for real scraping.');
      }
    } catch (error: any) {
      console.error('Failed to scrape jobs:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      setScrapeError(`Scraping failed: ${errorMessage}. Try "demo" to see sample jobs!`);
    } finally {
      setIsScraping(false);
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

      return matchesSearch && matchesStatus;
    });
    
    return filtered;
  }, [jobs, statusFilter, searchTerm]);

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
      <div className="space-y-6 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-b from-background to-muted/20 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Jobs
          </h1>
          <p className="text-muted-foreground mt-1">
            {jobs.length > 0 
              ? `${jobs.length} total job${jobs.length === 1 ? '' : 's'}${filteredJobs.length !== jobs.length ? `, ${filteredJobs.length} shown` : ''}`
              : 'No jobs in database. Start by scraping jobs!'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadJobs} disabled={isLoading} className="shadow-sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCalculateMatchScores} 
            disabled={isCalculatingScores || !userProfile}
            title={!userProfile ? 'Create a user profile in Settings first' : 'Calculate match scores for all jobs'}
            className="shadow-sm"
          >
            <Sparkles className={`mr-2 h-4 w-4 ${isCalculatingScores ? 'animate-spin' : ''}`} />
            {isCalculatingScores ? 'Calculating...' : 'Match Scores'}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleScrape} 
            disabled={isScraping}
            className="shadow-sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isScraping ? 'animate-spin' : ''}`} />
            {isScraping ? 'Scraping...' : 'Scrape Jobs'}
          </Button>
          <Button asChild className="shadow-lg">
            <Link to="/jobs/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Link>
          </Button>
        </div>
      </div>

      {scrapeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{scrapeError}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="border-border/40 shadow-md">
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search jobs..."
                className="pl-9 bg-background/50 backdrop-blur-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
              >
                <option value="all">All Statuses</option>
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSort('match_score')}
                className="flex-1"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Sort by Match
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State with Guidance */}
      {!isLoading && jobs.length === 0 && (
        <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-card to-card/80 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6">
            <div className="rounded-full bg-primary/10 p-6 mb-4">
              <Briefcase className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No Jobs Yet</h3>
            <p className="text-muted-foreground text-center mb-2 max-w-md">
              Get started by scraping jobs from multiple sources or adding them manually.
            </p>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              <strong>💡 Try "demo" to see sample jobs!</strong> Real scraping may not work due to website changes. Create your profile in Settings first to enable AI-powered job matching!
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-4">
              <Button onClick={handleScrape} disabled={isScraping} className="shadow-lg">
                <RefreshCw className={`mr-2 h-4 w-4 ${isScraping ? 'animate-spin' : ''}`} />
                {isScraping ? 'Scraping Jobs...' : 'Scrape Jobs'}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/jobs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Job Manually
                </Link>
              </Button>
            </div>
            <div className="mt-4 pt-4 border-t w-full max-w-md">
              <p className="text-xs text-muted-foreground text-center mb-3">Quick Setup Guide:</p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold">1</span>
                  <span>Click <strong>"Scrape Jobs"</strong> (uses "demo" by default) to see sample jobs</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold">2</span>
                  <span>Go to <Link to="/settings?tab=profile" className="text-primary hover:underline">Settings → Profile</Link> and add your skills</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold">3</span>
                  <span>Calculate match scores to see which jobs fit your profile</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs Grid */}
      {sortedJobs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedJobs.map((job, index) => {
            const matchQuality = getMatchQuality(job.match_score);
            return (
              <Card 
                key={job.id || `job-${index}`} 
                className="group hover:shadow-lg transition-all duration-200 border-border/40 hover:border-primary/50 bg-gradient-to-br from-card to-card/80"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-bold line-clamp-2 mb-1">
                        <Link 
                          to={`/jobs/${job.id}`} 
                          className="hover:text-primary transition-colors"
                        >
                          {job.title}
                        </Link>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-1">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">{job.company}</span>
                      </CardDescription>
                    </div>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {job.location && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="line-clamp-1">{job.location}</span>
                    </div>
                  )}
                  
                  {job.salary && (
                    <div className="text-sm font-medium text-foreground">
                      💰 {job.salary}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusVariant[job.status]}>
                      {job.status}
                    </Badge>
                    {job.match_score !== null && job.match_score !== undefined && (
                      <Badge className={cn("font-semibold", getMatchQualityVariant(matchQuality))}>
                        {matchQuality} {job.match_score.toFixed(0)}%
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {job.source}
                    </Badge>
                  </div>

                  {job.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {job.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown date'}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/jobs/${job.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : !isLoading && jobs.length > 0 ? (
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-bold mb-2">No Jobs Match Your Filters</h3>
            <p className="text-muted-foreground text-center mb-4">
              Try adjusting your search term or status filter.
            </p>
            <Button variant="outline" onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

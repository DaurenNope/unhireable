import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, ArrowUpDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Job, JobStatus } from '@/types/models';
import { jobApi } from '@/api/client';

const statusVariant: Record<JobStatus, string> = {
  'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'applied': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', // Note: backend uses 'offer', not 'offer_received'
  'rejected': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

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

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading jobs from API...');
      const jobsData = await jobApi.list();
      console.log('✅ Jobs API returned:', jobsData);
      console.log('📊 Number of jobs:', jobsData?.length || 0);
      if (jobsData && Array.isArray(jobsData)) {
        setJobs(jobsData as Job[]);
        console.log('✅ Successfully loaded', jobsData.length, 'jobs into state');
        if (jobsData.length === 0) {
          console.warn('⚠️ No jobs returned from API. Database might be empty or there was an issue.');
        }
      } else {
        console.error('❌ Jobs API returned unexpected data:', jobsData);
        setJobs([]);
      }
    } catch (error: any) {
      console.error('❌ Failed to load jobs:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        fullError: error
      });
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrape = async () => {
    setIsScraping(true);
    setScrapeError(null);
    try {
      const query = searchTerm || 'developer';
      console.log('Starting scrape with query:', query);
      const scrapedJobs = await jobApi.scrape(query);
      console.log('Scraped jobs:', scrapedJobs);
      if (scrapedJobs && scrapedJobs.length > 0) {
        // Success - reload jobs
        await loadJobs();
        // Show success message briefly
        setScrapeError(null);
      } else {
        setScrapeError('No new jobs found. Try a different search term or check if jobs already exist.');
      }
    } catch (error: any) {
      console.error('Failed to scrape jobs:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      setScrapeError(`Failed to scrape: ${errorMessage}`);
      // Also show alert for critical errors
      if (errorMessage.includes('failed') || errorMessage.includes('error')) {
        alert(`Scraping failed: ${errorMessage}\n\nCheck the console for more details.`);
      }
    } finally {
      setIsScraping(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <h2 className="text-3xl font-bold tracking-tight">Jobs</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleScrape} disabled={isScraping}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isScraping ? 'animate-spin' : ''}`} />
            {isScraping ? 'Scraping...' : 'Scrape Jobs'}
          </Button>
          {scrapeError && (
            <span className="text-sm text-destructive flex items-center px-2">{scrapeError}</span>
          )}
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const sampleJob: Omit<Job, 'id' | 'created_at' | 'updated_at'> = {
                  title: "Senior Frontend Developer",
                  company: "TechStart Inc.",
                  url: "https://example.com/job/senior-frontend-developer",
                  description: "We are looking for an experienced Frontend Developer to join our team. You will be responsible for developing and maintaining our web applications using React and TypeScript. The ideal candidate should have strong experience with modern frontend frameworks and a passion for creating user-friendly interfaces.\n\nResponsibilities:\n- Develop and maintain web applications using React and TypeScript\n- Collaborate with designers and backend developers\n- Write clean, maintainable code\n- Participate in code reviews\n- Mentor junior developers",
                  requirements: "Requirements:\n- 5+ years of experience in frontend development\n- Strong proficiency in React and TypeScript\n- Experience with modern CSS frameworks\n- Knowledge of REST APIs and GraphQL\n- Experience with testing frameworks (Jest, React Testing Library)\n- Strong problem-solving skills\n- Excellent communication skills",
                  location: "San Francisco, CA (Remote)",
                  salary: "$120,000 - $150,000",
                  source: "Manual",
                  status: "saved" as JobStatus,
                };
                await jobApi.create(sampleJob);
                await loadJobs();
                alert('Sample job created! Click on it to test resume generation.');
              } catch (error: any) {
                console.error('Failed to create sample job:', error);
                alert(`Failed to create sample job: ${error.message}`);
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Sample Job
          </Button>
          <Button asChild>
            <Link to="/jobs/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search jobs..."
              className="pl-9"
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
        </div>
      </div>

      {/* Jobs Table */}
      <div className="rounded-lg border shadow-sm">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center">
                    Job Title
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Company
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Location
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Source
                </th>
                <th
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </th>
                <th
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center">
                    Date Added
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                      <span className="ml-2">Loading jobs...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedJobs.length > 0 ? (
                sortedJobs.map((job) => (
                  <tr key={job.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">
                      <Link to={`/jobs/${job.id}`} className="font-medium hover:underline">
                        {job.title}
                      </Link>
                    </td>
                    <td className="p-4 align-middle">{job.company}</td>
                    <td className="p-4 align-middle">{job.location || 'Not specified'}</td>
                    <td className="p-4 align-middle">
                      <Badge variant="outline">{job.source}</Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge className={statusVariant[job.status]}>
                        {job.status}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No jobs found. Try adjusting your search or scrape new jobs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

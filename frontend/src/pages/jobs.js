import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, ArrowUpDown, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { jobApi } from '@/api/client';
const statusVariant = {
    'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'applied': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', // Note: backend uses 'offer', not 'offer_received'
    'rejected': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};
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
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'Good':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'Fair':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'Poor':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
}
export function Jobs() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState({
        field: 'created_at',
        direction: 'desc',
    });
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isScraping, setIsScraping] = useState(false);
    const [scrapeError, setScrapeError] = useState(null);
    const [showDebug, setShowDebug] = useState(false);
    const [isCalculatingScores, setIsCalculatingScores] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    useEffect(() => {
        loadJobs();
        loadUserProfile();
    }, []);
    const loadUserProfile = () => {
        try {
            const profileJson = localStorage.getItem('userProfile');
            if (profileJson) {
                const profile = JSON.parse(profileJson);
                setUserProfile(profile);
            }
        }
        catch (error) {
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
            await loadJobs(); // Reload jobs to show updated scores
        }
        catch (error) {
            console.error('Failed to calculate match scores:', error);
            alert(`Failed to calculate match scores: ${error.message}`);
        }
        finally {
            setIsCalculatingScores(false);
        }
    };
    const loadJobs = async () => {
        try {
            setIsLoading(true);
            console.log('🔄 Loading jobs from API...');
            const jobsData = await jobApi.list();
            console.log('✅ Jobs API returned:', jobsData);
            console.log('📊 Number of jobs:', jobsData?.length || 0);
            console.log('📋 Jobs data sample:', jobsData?.slice(0, 2));
            if (jobsData && Array.isArray(jobsData)) {
                console.log('✅ Jobs is an array, setting jobs state...');
                setJobs(jobsData);
                console.log('✅ Successfully loaded', jobsData.length, 'jobs into state');
                // Log sample job data for debugging
                if (jobsData.length > 0 && jobsData[0]) {
                    console.log('📝 Sample job:', {
                        id: jobsData[0]?.id,
                        title: jobsData[0]?.title,
                        company: jobsData[0]?.company,
                        status: jobsData[0]?.status,
                        source: jobsData[0]?.source,
                        match_score: jobsData[0]?.match_score,
                    });
                }
                if (jobsData.length === 0) {
                    console.warn('⚠️ No jobs returned from API. Database might be empty or there was an issue.');
                }
            }
            else {
                console.error('❌ Jobs API returned unexpected data:', jobsData);
                console.error('❌ Type of jobsData:', typeof jobsData);
                setJobs([]);
            }
        }
        catch (error) {
            console.error('❌ Failed to load jobs:', error);
            console.error('Error details:', {
                message: error?.message,
                stack: error?.stack,
                fullError: error
            });
            setJobs([]);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleScrape = async () => {
        setIsScraping(true);
        setScrapeError(null);
        try {
            const query = searchTerm || 'developer';
            console.log('🔄 Starting scrape with query:', query);
            const scrapedJobs = await jobApi.scrape(query);
            console.log('✅ Scraped jobs received:', scrapedJobs);
            console.log('📊 Number of jobs:', scrapedJobs?.length || 0);
            if (scrapedJobs && scrapedJobs.length > 0) {
                // Success - reload jobs
                console.log('🔄 Reloading jobs list...');
                await loadJobs();
                // Show success message
                setScrapeError(null);
                alert(`Successfully scraped ${scrapedJobs.length} job(s)!`);
            }
            else {
                const errorMsg = 'No jobs found. This could mean:\n- No jobs match your query\n- Website structure changed\n- All scrapers failed\n\nTry a different search term or check the console for details.';
                setScrapeError(errorMsg);
                alert(errorMsg);
            }
        }
        catch (error) {
            console.error('❌ Failed to scrape jobs:', error);
            console.error('Error details:', {
                message: error?.message,
                stack: error?.stack,
                fullError: error
            });
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            const detailedError = `Scraping failed: ${errorMessage}\n\nPossible reasons:\n- Network connectivity issues\n- Website structure changed (selectors outdated)\n- Rate limiting or blocking\n- All scrapers failed\n\nCheck the browser console and backend logs for more details.`;
            setScrapeError(detailedError);
            alert(detailedError);
        }
        finally {
            setIsScraping(false);
        }
    };
    const filteredJobs = useMemo(() => {
        const filtered = jobs.filter((job) => {
            const matchesSearch = !searchTerm || // If no search term, match all
                job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
        console.log('🔍 Filtering jobs:', {
            totalJobs: jobs.length,
            filteredCount: filtered.length,
            statusFilter,
            searchTerm,
            statusBreakdown: jobs.reduce((acc, job) => {
                acc[job.status] = (acc[job.status] || 0) + 1;
                return acc;
            }, {}),
        });
        return filtered;
    }, [jobs, statusFilter, searchTerm]);
    const sortedJobs = [...filteredJobs].sort((a, b) => {
        // Handle match_score separately since it can be null/undefined
        if (sortBy.field === 'match_score') {
            const aScore = a.match_score ?? -1; // Treat null/undefined as -1 (lowest)
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold tracking-tight", children: "Jobs" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: jobs.length > 0
                                    ? `${jobs.length} total job(s)${filteredJobs.length !== jobs.length ? `, ${filteredJobs.length} shown` : ''}`
                                    : 'No jobs in database' })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", onClick: loadJobs, disabled: isLoading, children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}` }), "Refresh"] }), _jsxs(Button, { variant: "outline", onClick: handleCalculateMatchScores, disabled: isCalculatingScores || !userProfile, title: !userProfile ? 'Create a user profile in Settings first' : 'Calculate match scores for all jobs', children: [_jsx(Sparkles, { className: `mr-2 h-4 w-4 ${isCalculatingScores ? 'animate-spin' : ''}` }), isCalculatingScores ? 'Calculating...' : 'Calculate Match Scores'] }), jobs.length > 0 && (_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setShowDebug(!showDebug), children: [showDebug ? 'Hide' : 'Show', " Debug"] })), _jsxs(Button, { variant: "outline", onClick: handleScrape, disabled: isScraping, children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isScraping ? 'animate-spin' : ''}` }), isScraping ? 'Scraping...' : 'Scrape Jobs'] }), scrapeError && (_jsx("span", { className: "text-sm text-destructive flex items-center px-2", children: scrapeError })), _jsxs(Button, { variant: "outline", onClick: async () => {
                                    try {
                                        const sampleJob = {
                                            title: "Senior Frontend Developer",
                                            company: "TechStart Inc.",
                                            url: "https://example.com/job/senior-frontend-developer",
                                            description: "We are looking for an experienced Frontend Developer to join our team. You will be responsible for developing and maintaining our web applications using React and TypeScript. The ideal candidate should have strong experience with modern frontend frameworks and a passion for creating user-friendly interfaces.\n\nResponsibilities:\n- Develop and maintain web applications using React and TypeScript\n- Collaborate with designers and backend developers\n- Write clean, maintainable code\n- Participate in code reviews\n- Mentor junior developers",
                                            requirements: "Requirements:\n- 5+ years of experience in frontend development\n- Strong proficiency in React and TypeScript\n- Experience with modern CSS frameworks\n- Knowledge of REST APIs and GraphQL\n- Experience with testing frameworks (Jest, React Testing Library)\n- Strong problem-solving skills\n- Excellent communication skills",
                                            location: "San Francisco, CA (Remote)",
                                            salary: "$120,000 - $150,000",
                                            source: "Manual",
                                            status: "saved",
                                        };
                                        await jobApi.create(sampleJob);
                                        await loadJobs();
                                        alert('Sample job created! Click on it to test resume generation.');
                                    }
                                    catch (error) {
                                        console.error('Failed to create sample job:', error);
                                        alert(`Failed to create sample job: ${error.message}`);
                                    }
                                }, children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add Sample Job"] }), _jsx(Button, { asChild: true, children: _jsxs(Link, { to: "/jobs/new", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add Job"] }) })] })] }), _jsx("div", { className: "rounded-lg border bg-card p-4 shadow-sm", children: _jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { type: "text", placeholder: "Search jobs...", className: "pl-9", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })] }), _jsxs("div", { className: "relative", children: [_jsx(Filter, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsxs("select", { className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Statuses" }), _jsx("option", { value: "saved", children: "Saved" }), _jsx("option", { value: "applied", children: "Applied" }), _jsx("option", { value: "interviewing", children: "Interviewing" }), _jsx("option", { value: "offer", children: "Offer" }), _jsx("option", { value: "rejected", children: "Rejected" }), _jsx("option", { value: "archived", children: "Archived" })] })] })] }) }), showDebug && jobs.length > 0 && (_jsxs("div", { className: "rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 p-4 shadow-sm", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("h3", { className: "font-semibold text-sm", children: "Debug Information" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowDebug(false), children: "Hide" })] }), _jsxs("div", { className: "text-xs space-y-2 overflow-auto max-h-64", children: [_jsxs("div", { children: [_jsx("strong", { children: "Total Jobs:" }), " ", jobs.length] }), _jsxs("div", { children: [_jsx("strong", { children: "Filtered Jobs:" }), " ", filteredJobs.length] }), _jsxs("div", { children: [_jsx("strong", { children: "Status Filter:" }), " ", statusFilter] }), _jsxs("div", { children: [_jsx("strong", { children: "Search Term:" }), " ", searchTerm || '(none)'] }), _jsxs("div", { children: [_jsx("strong", { children: "Status Breakdown:" }), _jsx("pre", { className: "mt-1 p-2 bg-white dark:bg-gray-800 rounded text-xs overflow-auto", children: JSON.stringify(jobs.reduce((acc, job) => {
                                            acc[job.status] = (acc[job.status] || 0) + 1;
                                            return acc;
                                        }, {}), null, 2) })] }), _jsxs("div", { children: [_jsx("strong", { children: "First 3 Jobs (raw data):" }), _jsx("pre", { className: "mt-1 p-2 bg-white dark:bg-gray-800 rounded text-xs overflow-auto max-h-40", children: JSON.stringify(jobs.slice(0, 3), null, 2) })] })] })] })), _jsx("div", { className: "rounded-lg border shadow-sm", children: _jsx("div", { className: "relative w-full overflow-auto", children: _jsxs("table", { className: "w-full caption-bottom text-sm", children: [_jsx("thead", { className: "[&_tr]:border-b", children: _jsxs("tr", { className: "border-b transition-colors hover:bg-muted/50", children: [_jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer", onClick: () => handleSort('title'), children: _jsxs("div", { className: "flex items-center", children: ["Job Title", _jsx(ArrowUpDown, { className: "ml-2 h-4 w-4" })] }) }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground", children: "Company" }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground", children: "Location" }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground", children: "Source" }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer", onClick: () => handleSort('match_score'), children: _jsxs("div", { className: "flex items-center", children: ["Match Score", _jsx(ArrowUpDown, { className: "ml-2 h-4 w-4" })] }) }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer", onClick: () => handleSort('status'), children: _jsxs("div", { className: "flex items-center", children: ["Status", _jsx(ArrowUpDown, { className: "ml-2 h-4 w-4" })] }) }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer", onClick: () => handleSort('created_at'), children: _jsxs("div", { className: "flex items-center", children: ["Date Added", _jsx(ArrowUpDown, { className: "ml-2 h-4 w-4" })] }) })] }) }), _jsx("tbody", { className: "[&_tr:last-child]:border-0", children: isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "p-8 text-center", children: _jsxs("div", { className: "flex items-center justify-center", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" }), _jsx("span", { className: "ml-2", children: "Loading jobs..." })] }) }) })) : sortedJobs.length > 0 ? (sortedJobs.map((job, index) => {
                                    const matchQuality = getMatchQuality(job.match_score);
                                    return (_jsxs("tr", { className: "border-b transition-colors hover:bg-muted/50", children: [_jsx("td", { className: "p-4 align-middle", children: _jsx(Link, { to: `/jobs/${job.id}`, className: "font-medium hover:underline", children: job.title }) }), _jsx("td", { className: "p-4 align-middle", children: job.company }), _jsx("td", { className: "p-4 align-middle", children: job.location || 'Not specified' }), _jsx("td", { className: "p-4 align-middle", children: _jsx(Badge, { variant: "outline", children: job.source }) }), _jsx("td", { className: "p-4 align-middle", children: job.match_score !== null && job.match_score !== undefined ? (_jsxs(Badge, { className: getMatchQualityVariant(matchQuality), children: [matchQuality, " (", job.match_score.toFixed(0), "%)"] })) : (_jsx("span", { className: "text-muted-foreground text-xs", children: "Not calculated" })) }), _jsx("td", { className: "p-4 align-middle", children: _jsx(Badge, { className: statusVariant[job.status], children: job.status }) }), _jsx("td", { className: "p-4 align-middle", children: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown' })] }, job.id || `job-${index}`));
                                })) : (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "p-8 text-center text-muted-foreground", children: _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("p", { children: "No jobs found." }), _jsx("p", { className: "text-sm", children: jobs.length > 0
                                                        ? `Showing ${jobs.length} total job(s) in database, but none match your filters.`
                                                        : 'Database appears to be empty. Try scraping some jobs!' }), jobs.length > 0 && (_jsxs("div", { className: "text-xs mt-2", children: [_jsxs("p", { children: ["Status filter: ", statusFilter] }), _jsxs("p", { children: ["Search term: ", searchTerm || '(none)'] }), _jsxs("p", { children: ["Available statuses in database: ", Array.from(new Set(jobs.map(j => j.status))).join(', ')] })] }))] }) }) })) })] }) }) })] }));
}

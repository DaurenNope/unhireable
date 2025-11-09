import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, RefreshCw, Sparkles, Briefcase, MapPin, Building2, ExternalLink, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { jobApi, profileApi } from '@/api/client';
import { cn } from '@/lib/utils';
const statusVariant = {
    'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    'applied': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
    'rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200',
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
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState({
        field: 'created_at',
        direction: 'desc',
    });
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isScraping, setIsScraping] = useState(false);
    const [scrapeError, setScrapeError] = useState(null);
    const [isCalculatingScores, setIsCalculatingScores] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    useEffect(() => {
        loadJobs();
        loadUserProfile(); // This is now async
    }, []);
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
            catch (e) {
                console.error('Failed to load profile from localStorage:', e);
            }
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
            const jobsData = await jobApi.list();
            if (jobsData && Array.isArray(jobsData)) {
                setJobs(jobsData);
            }
            else {
                setJobs([]);
            }
        }
        catch (error) {
            console.error('Failed to load jobs:', error);
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
            }
            else {
                setScrapeError('No jobs found. Try "demo" to see sample jobs, or a different search term for real scraping.');
            }
        }
        catch (error) {
            console.error('Failed to scrape jobs:', error);
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            setScrapeError(`Scraping failed: ${errorMessage}. Try "demo" to see sample jobs!`);
        }
        finally {
            setIsScraping(false);
        }
    };
    const filteredJobs = useMemo(() => {
        const filtered = jobs.filter((job) => {
            const matchesSearch = !searchTerm ||
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
        return (_jsxs("div", { className: "space-y-6 p-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4", children: [_jsxs("div", { children: [_jsx(Skeleton, { className: "h-9 w-48 mb-2" }), _jsx(Skeleton, { className: "h-5 w-64" })] }), _jsx(Skeleton, { className: "h-10 w-32" })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: [1, 2, 3, 4, 5, 6].map((i) => (_jsx(Skeleton, { className: "h-48 rounded-xl" }, i))) })] }));
    }
    return (_jsxs("div", { className: "space-y-6 p-6 bg-gradient-to-b from-background to-muted/20 min-h-screen", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent", children: "Jobs" }), _jsx("p", { className: "text-muted-foreground mt-1", children: jobs.length > 0
                                    ? `${jobs.length} total job${jobs.length === 1 ? '' : 's'}${filteredJobs.length !== jobs.length ? `, ${filteredJobs.length} shown` : ''}`
                                    : 'No jobs in database. Start by scraping jobs!' })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", onClick: loadJobs, disabled: isLoading, className: "shadow-sm", children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}` }), "Refresh"] }), _jsxs(Button, { variant: "outline", onClick: handleCalculateMatchScores, disabled: isCalculatingScores || !userProfile, title: !userProfile ? 'Create a user profile in Settings first' : 'Calculate match scores for all jobs', className: "shadow-sm", children: [_jsx(Sparkles, { className: `mr-2 h-4 w-4 ${isCalculatingScores ? 'animate-spin' : ''}` }), isCalculatingScores ? 'Calculating...' : 'Match Scores'] }), _jsxs(Button, { variant: "outline", onClick: handleScrape, disabled: isScraping, className: "shadow-sm", children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isScraping ? 'animate-spin' : ''}` }), isScraping ? 'Scraping...' : 'Scrape Jobs'] }), _jsx(Button, { asChild: true, className: "shadow-lg", children: _jsxs(Link, { to: "/jobs/new", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add Job"] }) })] })] }), scrapeError && (_jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4", children: _jsx("p", { className: "text-sm text-red-800 dark:text-red-200", children: scrapeError }) })), _jsx(Card, { className: "border-border/40 shadow-md", children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { type: "text", placeholder: "Search jobs...", className: "pl-9 bg-background/50 backdrop-blur-sm", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })] }), _jsxs("div", { className: "relative", children: [_jsx(Filter, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsxs("select", { className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Statuses" }), _jsx("option", { value: "saved", children: "Saved" }), _jsx("option", { value: "applied", children: "Applied" }), _jsx("option", { value: "interviewing", children: "Interviewing" }), _jsx("option", { value: "offer", children: "Offer" }), _jsx("option", { value: "rejected", children: "Rejected" }), _jsx("option", { value: "archived", children: "Archived" })] })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Button, { variant: "outline", size: "sm", onClick: () => handleSort('match_score'), className: "flex-1", children: [_jsx(TrendingUp, { className: "mr-2 h-4 w-4" }), "Sort by Match"] }) })] }) }) }), !isLoading && jobs.length === 0 && (_jsx(Card, { className: "border-2 border-dashed border-primary/20 bg-gradient-to-br from-card to-card/80 shadow-lg", children: _jsxs(CardContent, { className: "flex flex-col items-center justify-center py-16 px-6", children: [_jsx("div", { className: "rounded-full bg-primary/10 p-6 mb-4", children: _jsx(Briefcase, { className: "h-12 w-12 text-primary" }) }), _jsx("h3", { className: "text-2xl font-bold mb-2", children: "No Jobs Yet" }), _jsx("p", { className: "text-muted-foreground text-center mb-2 max-w-md", children: "Get started by scraping jobs from multiple sources or adding them manually." }), _jsxs("p", { className: "text-sm text-muted-foreground text-center mb-6 max-w-md", children: [_jsx("strong", { children: "\uD83D\uDCA1 Try \"demo\" to see sample jobs!" }), " Real scraping may not work due to website changes. Create your profile in Settings first to enable AI-powered job matching!"] }), _jsxs("div", { className: "flex flex-wrap gap-3 justify-center mb-4", children: [_jsxs(Button, { onClick: handleScrape, disabled: isScraping, className: "shadow-lg", children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isScraping ? 'animate-spin' : ''}` }), isScraping ? 'Scraping Jobs...' : 'Scrape Jobs'] }), _jsx(Button, { variant: "outline", asChild: true, children: _jsxs(Link, { to: "/jobs/new", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add Job Manually"] }) })] }), _jsxs("div", { className: "mt-4 pt-4 border-t w-full max-w-md", children: [_jsx("p", { className: "text-xs text-muted-foreground text-center mb-3", children: "Quick Setup Guide:" }), _jsxs("div", { className: "grid grid-cols-1 gap-2 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [_jsx("span", { className: "flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold", children: "1" }), _jsxs("span", { children: ["Click ", _jsx("strong", { children: "\"Scrape Jobs\"" }), " (uses \"demo\" by default) to see sample jobs"] })] }), _jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [_jsx("span", { className: "flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold", children: "2" }), _jsxs("span", { children: ["Go to ", _jsx(Link, { to: "/settings?tab=profile", className: "text-primary hover:underline", children: "Settings \u2192 Profile" }), " and add your skills"] })] }), _jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [_jsx("span", { className: "flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold", children: "3" }), _jsx("span", { children: "Calculate match scores to see which jobs fit your profile" })] })] })] })] }) })), sortedJobs.length > 0 ? (_jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: sortedJobs.map((job, index) => {
                    const matchQuality = getMatchQuality(job.match_score);
                    return (_jsxs(Card, { className: "group hover:shadow-lg transition-all duration-200 border-border/40 hover:border-primary/50 bg-gradient-to-br from-card to-card/80", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx(CardTitle, { className: "text-lg font-bold line-clamp-2 mb-1", children: _jsx(Link, { to: `/jobs/${job.id}`, className: "hover:text-primary transition-colors", children: job.title }) }), _jsxs(CardDescription, { className: "flex items-center gap-1.5 mt-1", children: [_jsx(Building2, { className: "h-3.5 w-3.5 flex-shrink-0" }), _jsx("span", { className: "line-clamp-1", children: job.company })] })] }), job.url && (_jsx("a", { href: job.url, target: "_blank", rel: "noopener noreferrer", className: "flex-shrink-0 text-muted-foreground hover:text-primary transition-colors", onClick: (e) => e.stopPropagation(), children: _jsx(ExternalLink, { className: "h-4 w-4" }) }))] }) }), _jsxs(CardContent, { className: "space-y-3", children: [job.location && (_jsxs("div", { className: "flex items-center gap-1.5 text-sm text-muted-foreground", children: [_jsx(MapPin, { className: "h-3.5 w-3.5 flex-shrink-0" }), _jsx("span", { className: "line-clamp-1", children: job.location })] })), job.salary && (_jsxs("div", { className: "text-sm font-medium text-foreground", children: ["\uD83D\uDCB0 ", job.salary] })), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { className: statusVariant[job.status], children: job.status }), job.match_score !== null && job.match_score !== undefined && (_jsxs(Badge, { className: cn("font-semibold", getMatchQualityVariant(matchQuality)), children: [matchQuality, " ", job.match_score.toFixed(0), "%"] })), _jsx(Badge, { variant: "outline", className: "text-xs", children: job.source })] }), job.description && (_jsx("p", { className: "text-sm text-muted-foreground line-clamp-3", children: job.description })), _jsxs("div", { className: "flex items-center justify-between pt-2 border-t", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown date' }), _jsx(Button, { variant: "ghost", size: "sm", asChild: true, children: _jsx(Link, { to: `/jobs/${job.id}`, children: "View Details" }) })] })] })] }, job.id || `job-${index}`));
                }) })) : !isLoading && jobs.length > 0 ? (_jsx(Card, { className: "border-border/40", children: _jsxs(CardContent, { className: "flex flex-col items-center justify-center py-16 px-6", children: [_jsx(Search, { className: "h-12 w-12 text-muted-foreground/50 mb-4" }), _jsx("h3", { className: "text-xl font-bold mb-2", children: "No Jobs Match Your Filters" }), _jsx("p", { className: "text-muted-foreground text-center mb-4", children: "Try adjusting your search term or status filter." }), _jsx(Button, { variant: "outline", onClick: () => {
                                setSearchTerm('');
                                setStatusFilter('all');
                            }, children: "Clear Filters" })] }) })) : null] }));
}

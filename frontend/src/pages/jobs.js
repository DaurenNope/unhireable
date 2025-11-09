import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, ArrowUpDown, RefreshCw } from 'lucide-react';
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
    useEffect(() => {
        loadJobs();
    }, []);
    const loadJobs = async () => {
        try {
            const jobsData = await jobApi.list();
            setJobs(jobsData);
        }
        catch (error) {
            console.error('Failed to load jobs:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleScrape = async () => {
        setIsScraping(true);
        try {
            await jobApi.scrape(searchTerm || 'developer');
            await loadJobs(); // Reload jobs after scraping
        }
        catch (error) {
            console.error('Failed to scrape jobs:', error);
        }
        finally {
            setIsScraping(false);
        }
    };
    const filteredJobs = jobs.filter((job) => {
        const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    const sortedJobs = [...filteredJobs].sort((a, b) => {
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0", children: [_jsx("h2", { className: "text-3xl font-bold tracking-tight", children: "Jobs" }), _jsxs("div", { className: "flex space-x-2", children: [_jsxs(Button, { variant: "outline", onClick: handleScrape, disabled: isScraping, children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isScraping ? 'animate-spin' : ''}` }), isScraping ? 'Scraping...' : 'Scrape Jobs'] }), _jsx(Button, { asChild: true, children: _jsxs(Link, { to: "/jobs/new", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add Job"] }) })] })] }), _jsx("div", { className: "rounded-lg border bg-card p-4 shadow-sm", children: _jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { type: "text", placeholder: "Search jobs...", className: "pl-9", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })] }), _jsxs("div", { className: "relative", children: [_jsx(Filter, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsxs("select", { className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Statuses" }), _jsx("option", { value: "saved", children: "Saved" }), _jsx("option", { value: "applied", children: "Applied" }), _jsx("option", { value: "interviewing", children: "Interviewing" }), _jsx("option", { value: "offer", children: "Offer" }), _jsx("option", { value: "rejected", children: "Rejected" }), _jsx("option", { value: "archived", children: "Archived" })] })] })] }) }), _jsx("div", { className: "rounded-lg border shadow-sm", children: _jsx("div", { className: "relative w-full overflow-auto", children: _jsxs("table", { className: "w-full caption-bottom text-sm", children: [_jsx("thead", { className: "[&_tr]:border-b", children: _jsxs("tr", { className: "border-b transition-colors hover:bg-muted/50", children: [_jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer", onClick: () => handleSort('title'), children: _jsxs("div", { className: "flex items-center", children: ["Job Title", _jsx(ArrowUpDown, { className: "ml-2 h-4 w-4" })] }) }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground", children: "Company" }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground", children: "Location" }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground", children: "Source" }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer", onClick: () => handleSort('status'), children: _jsxs("div", { className: "flex items-center", children: ["Status", _jsx(ArrowUpDown, { className: "ml-2 h-4 w-4" })] }) }), _jsx("th", { className: "h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer", onClick: () => handleSort('created_at'), children: _jsxs("div", { className: "flex items-center", children: ["Date Added", _jsx(ArrowUpDown, { className: "ml-2 h-4 w-4" })] }) })] }) }), _jsx("tbody", { className: "[&_tr:last-child]:border-0", children: isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "p-8 text-center", children: _jsxs("div", { className: "flex items-center justify-center", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" }), _jsx("span", { className: "ml-2", children: "Loading jobs..." })] }) }) })) : sortedJobs.length > 0 ? (sortedJobs.map((job) => (_jsxs("tr", { className: "border-b transition-colors hover:bg-muted/50", children: [_jsx("td", { className: "p-4 align-middle", children: _jsx(Link, { to: `/jobs/${job.id}`, className: "font-medium hover:underline", children: job.title }) }), _jsx("td", { className: "p-4 align-middle", children: job.company }), _jsx("td", { className: "p-4 align-middle", children: job.location || 'Not specified' }), _jsx("td", { className: "p-4 align-middle", children: _jsx(Badge, { variant: "outline", children: job.source }) }), _jsx("td", { className: "p-4 align-middle", children: _jsx(Badge, { className: statusVariant[job.status], children: job.status }) }), _jsx("td", { className: "p-4 align-middle", children: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown' })] }, job.id)))) : (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "p-8 text-center text-muted-foreground", children: "No jobs found. Try adjusting your search or scrape new jobs." }) })) })] }) }) })] }));
}

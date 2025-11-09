import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { jobApi, applicationApi, interviewApi } from '@/api/client';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Legend, Cell } from 'recharts';
// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ActivityFeed } from '@/components/activity-feed';
// Icons
import { Calendar, Briefcase, CheckCircle, MoreHorizontal, Edit, Trash2, Plus, Search, Filter, X, FileText, TrendingUp, MessageSquare, CalendarDays, FileSearch, ChevronDown } from 'lucide-react';
export function Dashboard() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const { data: applicationsData, isLoading: applicationsLoading, refetch: refetchApplications } = useQuery({
        queryKey: ['applications'],
        queryFn: async () => {
            try {
                return await applicationApi.list();
            }
            catch (err) {
                console.error('Failed to fetch applications:', err);
                throw err;
            }
        },
    });
    const { data: jobsData, isLoading: jobsLoading } = useQuery({
        queryKey: ['jobs'],
        queryFn: () => jobApi.list(),
    });
    const { data: interviewsData, isLoading: interviewsLoading } = useQuery({
        queryKey: ['interviews'],
        queryFn: () => interviewApi.list(),
    });
    const applications = applicationsData || [];
    const jobs = jobsData || [];
    const allInterviews = interviewsData || [];
    const isLoading = applicationsLoading || jobsLoading || interviewsLoading;
    // Debug logging
    useEffect(() => {
        if (!isLoading) {
            console.log('Dashboard Data:', {
                applications: applications.length,
                jobs: jobs.length,
                interviews: allInterviews.length,
                applicationsData: applications,
                jobsData: jobs,
            });
        }
    }, [applications, jobs, allInterviews, isLoading]);
    // Enrich applications with job data for display
    const applicationsWithJobs = applications.map(app => {
        const job = jobs.find(j => j.id === app.job_id);
        return {
            ...app,
            job: job,
            job_title: job?.title,
            company: job?.company,
        };
    });
    // Get upcoming interviews (not completed, scheduled in future)
    const upcomingInterviews = useMemo(() => {
        const now = new Date();
        return allInterviews
            .filter(interview => {
            if (interview.completed)
                return false;
            if (!interview.scheduled_at)
                return false;
            const scheduledDate = new Date(interview.scheduled_at);
            return scheduledDate >= now;
        })
            .sort((a, b) => {
            const dateA = new Date(a.scheduled_at || 0);
            const dateB = new Date(b.scheduled_at || 0);
            return dateA.getTime() - dateB.getTime();
        })
            .slice(0, 5)
            .map(interview => {
            const application = applications.find(app => app.id === interview.application_id);
            const job = application ? jobs.find(j => j.id === application.job_id) : null;
            return {
                ...interview,
                jobTitle: job?.title || application?.job_title || 'Unknown',
                company: job?.company || application?.company || 'Unknown',
            };
        });
    }, [allInterviews, applications, jobs]);
    // Get recent applications (last 5, sorted by updated_at)
    const recentApplications = useMemo(() => {
        return [...applicationsWithJobs]
            .sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at || 0);
            const dateB = new Date(b.updated_at || b.created_at || 0);
            return dateB.getTime() - dateA.getTime();
        })
            .slice(0, 5);
    }, [applicationsWithJobs]);
    // Get application status counts (using correct backend status values)
    const statusCounts = {
        applied: applications.filter(app => app.status === 'submitted').length,
        interview: applications.filter(app => app.status === 'interview_scheduled').length,
        offer: applications.filter(app => app.status === 'offer_received').length,
        rejected: applications.filter(app => app.status === 'rejected').length
    };
    // Calculate stats from applications
    const displayStats = {
        totalApplications: applications.length,
        interviewsThisWeek: upcomingInterviews.length,
        offersReceived: applications.filter(app => app.status === 'offer_received').length,
        applicationRate: applications.length > 0
            ? Math.round((applications.filter(app => app.status === 'submitted').length / applications.length) * 100)
            : 0,
    };
    // Prepare chart data for BarChart (Application Status over time)
    const chartData = [
        { name: 'Preparing', total: applications.filter(app => app.status === 'preparing').length },
        { name: 'Submitted', total: applications.filter(app => app.status === 'submitted').length },
        { name: 'Interview', total: applications.filter(app => app.status === 'interview_scheduled').length },
        { name: 'Offer', total: applications.filter(app => app.status === 'offer_received').length },
        { name: 'Rejected', total: applications.filter(app => app.status === 'rejected').length },
        { name: 'Withdrawn', total: applications.filter(app => app.status === 'withdrawn').length },
    ].filter(item => item.total > 0); // Only show statuses with applications
    // Prepare pie chart data for Status Distribution
    const pieChartData = [
        { name: 'Preparing', value: applications.filter(app => app.status === 'preparing').length, fill: '#94a3b8' },
        { name: 'Submitted', value: applications.filter(app => app.status === 'submitted').length, fill: '#3b82f6' },
        { name: 'Interview Scheduled', value: applications.filter(app => app.status === 'interview_scheduled').length, fill: '#eab308' },
        { name: 'Offer Received', value: applications.filter(app => app.status === 'offer_received').length, fill: '#22c55e' },
        { name: 'Rejected', value: applications.filter(app => app.status === 'rejected').length, fill: '#ef4444' },
        { name: 'Withdrawn', value: applications.filter(app => app.status === 'withdrawn').length, fill: '#6b7280' },
    ].filter(item => item.value > 0); // Only show statuses with applications
    // Loading skeleton
    if (isLoading) {
        return (_jsxs("div", { className: "space-y-6 p-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "Dashboard" }), _jsx("p", { className: "text-muted-foreground", children: "Welcome back! Here's what's happening with your job search." })] }), _jsx(Skeleton, { className: "h-10 w-[150px]" })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4", children: [1, 2, 3, 4].map((i) => (_jsx(Skeleton, { className: "h-32 rounded-xl" }, i))) }), _jsxs("div", { className: "grid gap-6 md:grid-cols-2 lg:grid-cols-3", children: [_jsxs("div", { className: "lg:col-span-2 space-y-6", children: [_jsx(Skeleton, { className: "h-10 w-[200px]" }), _jsx(Skeleton, { className: "h-80 rounded-xl" })] }), _jsxs("div", { className: "space-y-6", children: [_jsx(Skeleton, { className: "h-10 w-[200px]" }), _jsx(Skeleton, { className: "h-80 rounded-xl" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsx(Skeleton, { className: "h-10 w-[200px]" }), _jsx(Skeleton, { className: "h-64 rounded-xl" })] })] }));
    }
    return (_jsxs("div", { className: "space-y-6 p-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "Dashboard" }), _jsx("p", { className: "text-muted-foreground", children: "Welcome back! Here's what's happening with your job search." })] }), _jsxs("div", { className: "flex items-center gap-3 w-full md:w-auto", children: [_jsxs("div", { className: "relative flex-1 md:min-w-[300px]", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" }), _jsx(Input, { placeholder: "Search applications...", className: "pl-10 w-full", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value) })] }), _jsx(Button, { className: "gap-2", asChild: true, children: _jsxs(Link, { to: "/applications/new", children: [_jsx(Plus, { className: "h-4 w-4" }), _jsx("span", { className: "hidden sm:inline", children: "Add Application" })] }) })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4", children: [_jsxs(Card, { className: "border-border/40 hover:border-primary/50 transition-colors", children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Total Applications" }), _jsx("div", { className: "h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center", children: _jsx(FileText, { className: "h-4 w-4 text-primary" }) })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: displayStats.totalApplications }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [statusCounts.applied, " active, ", statusCounts.interview, " in interview"] })] })] }), _jsxs(Card, { className: "border-border/40 hover:border-primary/50 transition-colors", children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Interviews" }), _jsx("div", { className: "h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center", children: _jsx(Calendar, { className: "h-4 w-4 text-amber-500" }) })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: displayStats.interviewsThisWeek }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [displayStats.interviewsThisWeek, " scheduled this week"] })] })] }), _jsxs(Card, { className: "border-border/40 hover:border-primary/50 transition-colors", children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Offers" }), _jsx("div", { className: "h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center", children: _jsx(CheckCircle, { className: "h-4 w-4 text-emerald-500" }) })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: displayStats.offersReceived }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [displayStats.offersReceived, " offers received"] })] })] }), _jsxs(Card, { className: "border-border/40 hover:border-primary/50 transition-colors", children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Application Rate" }), _jsx("div", { className: "h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center", children: _jsx(TrendingUp, { className: "h-4 w-4 text-blue-500" }) })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [displayStats.applicationRate, "%"] }), _jsx("div", { className: "mt-2", children: _jsx(Progress, { value: displayStats.applicationRate, className: "h-2" }) })] })] })] }), _jsxs(Card, { className: "overflow-hidden", children: [_jsx(CardHeader, { className: "border-b bg-muted/10", children: _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-xl", children: "Recent Applications" }), _jsx(CardDescription, { children: "Your most recent job applications" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "h-9 gap-1", children: [_jsx(Filter, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "Filter" })] }), _jsxs(Button, { size: "sm", className: "h-9 gap-1", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "Add Application" })] })] })] }) }), _jsx(CardContent, { className: "p-0", children: _jsx("div", { className: "relative overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { className: "bg-muted/20", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-[300px]", children: "Position" }), _jsx(TableHead, { children: "Company" }), _jsx(TableHead, { children: "Status" }), _jsx(TableHead, { children: "Applied" }), _jsx(TableHead, { children: "Next Step" }), _jsx(TableHead, { className: "w-[50px]" })] }) }), _jsx(TableBody, { children: recentApplications.length > 0 ? (recentApplications.map((application) => {
                                            const appInterviews = allInterviews.filter(i => i.application_id === application.id && !i.completed);
                                            const nextInterview = appInterviews.length > 0 ? appInterviews.sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime())[0] : null;
                                            return (_jsxs(TableRow, { className: "group hover:bg-muted/20", children: [_jsx(TableCell, { className: "font-medium", children: _jsxs(Link, { to: `/applications/${application.id}`, className: "flex items-center gap-2 hover:underline hover:text-primary", children: [_jsx(Briefcase, { className: "h-4 w-4 text-muted-foreground" }), _jsx("span", { className: "line-clamp-1", children: application.job_title || application.job?.title || 'N/A' })] }) }), _jsx(TableCell, { children: _jsx("div", { className: "font-medium", children: application.company || application.job?.company || 'N/A' }) }), _jsx(TableCell, { children: _jsxs("span", { className: cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', getStatusVariant(application.status)), children: [application.status === 'submitted' && _jsx(FileText, { className: "h-3 w-3 mr-1" }), application.status === 'interview_scheduled' && _jsx(MessageSquare, { className: "h-3 w-3 mr-1" }), application.status === 'offer_received' && _jsx(CheckCircle, { className: "h-3 w-3 mr-1" }), application.status === 'rejected' && _jsx(X, { className: "h-3 w-3 mr-1" }), application.status] }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-1.5 text-sm", children: [_jsx(CalendarDays, { className: "h-3.5 w-3.5 text-muted-foreground" }), application.applied_at
                                                                    ? new Date(application.applied_at).toLocaleDateString()
                                                                    : 'Not applied'] }) }), _jsx(TableCell, { children: nextInterview ? (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-sm font-medium", children: nextInterview.type }), _jsx("span", { className: "text-xs text-muted-foreground", children: new Date(nextInterview.scheduled_at || '').toLocaleDateString() })] })) : (_jsx("span", { className: "text-muted-foreground text-sm", children: "No next step" })) }), _jsx(TableCell, { children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 p-0 opacity-0 group-hover:opacity-100", children: [_jsx(MoreHorizontal, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Open menu" })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-[160px]", children: [_jsxs(DropdownMenuItem, { onClick: () => navigate(`/applications/${application.id}`), children: [_jsx(Edit, { className: "mr-2 h-4 w-4" }), "Edit"] }), _jsxs(DropdownMenuItem, { onClick: () => navigate(`/applications/${application.id}#interviews`), children: [_jsx(CalendarDays, { className: "mr-2 h-4 w-4" }), "Schedule"] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { className: "text-red-600", onClick: async () => {
                                                                                if (window.confirm('Are you sure you want to delete this application?')) {
                                                                                    try {
                                                                                        await applicationApi.delete(application.id);
                                                                                        refetchApplications();
                                                                                    }
                                                                                    catch (err) {
                                                                                        console.error('Failed to delete application:', err);
                                                                                    }
                                                                                }
                                                                            }, children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Delete"] })] })] }) })] }, application.id));
                                        })) : (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, className: "h-24 text-center", children: _jsxs("div", { className: "flex flex-col items-center justify-center gap-2 py-6", children: [_jsx(FileSearch, { className: "h-10 w-10 text-muted-foreground" }), _jsx("p", { className: "text-muted-foreground", children: "No applications found" }), _jsx(Button, { variant: "outline", size: "sm", className: "mt-2", asChild: true, children: _jsxs(Link, { to: "/applications/new", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add Application"] }) })] }) }) })) })] }) }) }), _jsx(CardFooter, { className: "border-t px-6 py-3", children: _jsxs("div", { className: "text-xs text-muted-foreground", children: ["Showing ", _jsxs("strong", { children: ["1-", Math.min(recentApplications.length, 5)] }), " of ", _jsx("strong", { children: applications.length }), " applications", applications.length > 5 && (_jsx(Button, { variant: "link", className: "ml-2 h-auto p-0 text-xs", asChild: true, children: _jsx(Link, { to: "/applications", children: "View all" }) }))] }) })] }), _jsxs("div", { className: "grid gap-6 md:grid-cols-2 lg:grid-cols-3", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg", children: "Application Status" }), _jsx(CardDescription, { children: "Overview of your job applications" })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Button, { variant: "outline", size: "sm", className: "h-8 gap-1", children: [_jsx("span", { children: "This Month" }), _jsx(ChevronDown, { className: "h-4 w-4" })] }) })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "h-[300px]", children: chartData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: chartData, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "colorTotal", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "hsl(var(--primary))", stopOpacity: 0.8 }), _jsx("stop", { offset: "95%", stopColor: "hsl(var(--primary))", stopOpacity: 0.1 })] }) }), _jsx(XAxis, { dataKey: "name", stroke: "hsl(var(--muted-foreground))", fontSize: 12, tickLine: false, axisLine: false }), _jsx(YAxis, { stroke: "hsl(var(--muted-foreground))", fontSize: 12, tickLine: false, axisLine: false, tickFormatter: (value) => `${value}` }), _jsx(Tooltip, { contentStyle: {
                                                        backgroundColor: 'hsl(var(--background))',
                                                        borderColor: 'hsl(var(--border))',
                                                        borderRadius: 'var(--radius)',
                                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                                                    }, itemStyle: {
                                                        color: 'hsl(var(--foreground))'
                                                    }, labelStyle: {
                                                        color: 'hsl(var(--muted-foreground))',
                                                        fontWeight: 500
                                                    } }), _jsx(Bar, { dataKey: "total", fill: "url(#colorTotal)", radius: [4, 4, 0, 0], animationDuration: 1500 })] }) })) : (_jsx("div", { className: "flex h-full items-center justify-center text-muted-foreground", children: _jsxs("div", { className: "text-center", children: [_jsx(FileText, { className: "h-12 w-12 mx-auto mb-2 opacity-50" }), _jsx("p", { children: "No applications yet" }), _jsx("p", { className: "text-sm", children: "Create applications to see statistics" })] }) })) }) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsx(CardTitle, { className: "text-lg", children: "Status Distribution" }), _jsx(CardDescription, { children: "Breakdown of your applications" })] }), _jsx(CardContent, { children: _jsx("div", { className: "h-[300px]", children: pieChartData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: pieChartData, cx: "50%", cy: "50%", innerRadius: 60, outerRadius: 90, paddingAngle: 2, dataKey: "value", label: (entry) => {
                                                        const percent = typeof entry.percent === 'number' ? entry.percent : 0;
                                                        const name = typeof entry.name === 'string' ? entry.name : '';
                                                        return percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : '';
                                                    }, labelLine: false, animationDuration: 1000, children: pieChartData.map((entry, index) => (_jsx(Cell, { fill: entry.fill }, `cell-${index}`))) }), _jsx(Tooltip, { contentStyle: {
                                                        backgroundColor: 'hsl(var(--background))',
                                                        borderColor: 'hsl(var(--border))',
                                                        borderRadius: 'var(--radius)',
                                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                                                    }, formatter: (value) => [`${value} applications`, 'Count'] }), _jsx(Legend, { layout: "horizontal", verticalAlign: "bottom", align: "center", wrapperStyle: {
                                                        paddingTop: '20px',
                                                        fontSize: '12px'
                                                    } })] }) })) : (_jsx("div", { className: "flex h-full items-center justify-center text-muted-foreground", children: _jsxs("div", { className: "text-center", children: [_jsx(FileText, { className: "h-12 w-12 mx-auto mb-2 opacity-50" }), _jsx("p", { children: "No data to display" }), _jsx("p", { className: "text-sm", children: "Create applications to see distribution" })] }) })) }) })] })] }), _jsx("div", { className: "mt-6", children: _jsx(ActivityFeed, { limit: 10 }) })] }));
}
function getStatusVariant(status) {
    switch (status) {
        case 'submitted':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'interview_scheduled':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'offer_received':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'rejected':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'preparing':
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
        case 'withdrawn':
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
}

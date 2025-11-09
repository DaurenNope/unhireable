import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase, MoreVertical, RefreshCw, AlertCircle, Edit, Trash2, FileText, Calendar, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ApplicationStatuses } from '@/types/models';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { applicationApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
// Format date helper function
const formatDate = (dateString, formatStr = 'PP') => {
    if (!dateString)
        return 'N/A';
    try {
        return format(new Date(dateString), formatStr);
    }
    catch (e) {
        return 'Invalid date';
    }
};
// Status badge component with improved styling
const StatusBadge = ({ status }) => {
    const statusConfig = {
        [ApplicationStatuses.PREPARING]: {
            label: 'Preparing',
            className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
        },
        [ApplicationStatuses.SUBMITTED]: {
            label: 'Submitted',
            className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
        },
        [ApplicationStatuses.INTERVIEW_SCHEDULED]: {
            label: 'Interview Scheduled',
            className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
        },
        [ApplicationStatuses.REJECTED]: {
            label: 'Rejected',
            className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
        },
        [ApplicationStatuses.OFFER_RECEIVED]: {
            label: 'Offer Received',
            className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
        },
        [ApplicationStatuses.WITHDRAWN]: {
            label: 'Withdrawn',
            className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200',
        },
    };
    const config = statusConfig[status] || statusConfig[ApplicationStatuses.PREPARING];
    return (_jsx(Badge, { className: cn('whitespace-nowrap font-medium', config.className), children: config.label }));
};
// Application row component
const ApplicationRow = ({ application, onEdit, onDelete }) => {
    return (_jsxs(TableRow, { className: "group hover:bg-muted/30 transition-colors", children: [_jsx(TableCell, { className: "font-medium", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0", children: _jsx(Briefcase, { className: "h-5 w-5 text-primary" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx(Link, { to: `/applications/${application.id}`, className: "font-semibold hover:text-primary transition-colors line-clamp-1", children: application.job_title || 'Untitled Application' }), _jsxs("div", { className: "flex items-center gap-2 mt-1 text-sm text-muted-foreground", children: [_jsx(Building2, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "line-clamp-1", children: application.company || 'No company' })] })] })] }) }), _jsx(TableCell, { children: _jsx(StatusBadge, { status: application.status }) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsxs("div", { className: "flex items-center gap-1.5 text-sm", children: [_jsx(Calendar, { className: "h-3.5 w-3.5 text-muted-foreground" }), application.applied_at ? formatDate(application.applied_at, 'MMM d, yyyy') : 'N/A'] }) }), _jsx(TableCell, { className: "hidden lg:table-cell", children: _jsx("div", { className: "text-sm text-muted-foreground", children: application.updated_at ? formatDate(application.updated_at, 'MMM d, yyyy') : 'N/A' }) }), _jsx(TableCell, { className: "text-right", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx(MoreVertical, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Open menu" })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-[160px]", children: [_jsxs(DropdownMenuItem, { onClick: () => application.id && onEdit(application.id), children: [_jsx(Edit, { className: "mr-2 h-4 w-4" }), "Edit"] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { className: "text-red-600", onClick: () => application.id && onDelete(application.id), children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Delete"] })] })] }) })] }));
};
// Skeleton loader for application rows
const ApplicationRowSkeleton = () => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Skeleton, { className: "h-10 w-10 rounded-full" }), _jsxs("div", { className: "space-y-2 flex-1", children: [_jsx(Skeleton, { className: "h-4 w-48" }), _jsx(Skeleton, { className: "h-3 w-32" })] })] }) }), _jsx(TableCell, { children: _jsx(Skeleton, { className: "h-6 w-24" }) }), _jsx(TableCell, { children: _jsx(Skeleton, { className: "h-4 w-24" }) }), _jsx(TableCell, { children: _jsx(Skeleton, { className: "h-4 w-24" }) }), _jsx(TableCell, { className: "text-right", children: _jsx(Skeleton, { className: "ml-auto h-8 w-8" }) })] }));
export default function Applications() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy] = useState('applied_at');
    const [sortOrder] = useState('desc');
    // Fetch applications using React Query
    const { data: applicationsData = [], isLoading: appsLoading, error: appsError, refetch } = useQuery({
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
        retry: 1,
    });
    const applications = applicationsData;
    const isLoading = appsLoading;
    const error = appsError
        ? `Failed to load applications: ${appsError instanceof Error ? appsError.message : 'Unknown error'}`
        : null;
    // Filter and sort applications
    const filteredAndSortedApplications = useMemo(() => {
        let result = [...applications];
        // Apply search term filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(app => (app.job_title?.toLowerCase().includes(term)) ||
                (app.company?.toLowerCase().includes(term)) ||
                (app.notes?.toLowerCase().includes(term)));
        }
        // Apply status filter
        if (statusFilter !== 'all') {
            result = result.filter(app => app.status === statusFilter);
        }
        // Apply sorting
        result.sort((a, b) => {
            const aValue = a[sortBy];
            const bValue = b[sortBy];
            if (aValue === bValue)
                return 0;
            if (aValue == null)
                return 1;
            if (bValue == null)
                return -1;
            return sortOrder === 'asc'
                ? aValue > bValue ? 1 : -1
                : aValue < bValue ? 1 : -1;
        });
        return result;
    }, [applications, searchTerm, statusFilter, sortBy, sortOrder]);
    const displayedApplications = filteredAndSortedApplications;
    const handleRetry = () => {
        setSearchTerm('');
        setStatusFilter('all');
        refetch();
    };
    const handleEdit = (applicationId) => {
        navigate(`/applications/${applicationId}`);
    };
    const handleDelete = async (applicationId) => {
        if (!window.confirm('Are you sure you want to delete this application?'))
            return;
        try {
            await applicationApi.delete(applicationId);
            queryClient.invalidateQueries({ queryKey: ['applications'] });
        }
        catch (err) {
            console.error('Failed to delete application:', err);
            alert('Failed to delete application. Please try again.');
        }
    };
    if (error) {
        return (_jsx("div", { className: "flex h-[60vh] flex-col items-center justify-center px-4 text-center", children: _jsx(Card, { className: "border-destructive/50 bg-destructive/5 max-w-md", children: _jsxs(CardContent, { className: "pt-6", children: [_jsx(AlertCircle, { className: "mb-4 h-12 w-12 text-destructive mx-auto" }), _jsx("h2", { className: "mb-2 text-2xl font-bold", children: "Something went wrong" }), _jsx("p", { className: "mb-6 text-muted-foreground", children: error }), _jsxs(Button, { onClick: handleRetry, className: "w-full", children: [_jsx(RefreshCw, { className: "mr-2 h-4 w-4" }), "Try again"] })] }) }) }));
    }
    return (_jsxs("div", { className: "space-y-6 p-6 bg-gradient-to-b from-background to-muted/20 min-h-screen", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent", children: "Applications" }), _jsx("p", { className: "text-muted-foreground mt-1", children: "Track and manage your job applications" })] }), _jsx(Button, { asChild: true, className: "shadow-lg", children: _jsxs(Link, { to: "/applications/new", className: "flex items-center", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "New Application"] }) })] }), _jsx(Card, { className: "border-border/40 shadow-md", children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { placeholder: "Search applications...", className: "pl-9 bg-background/50 backdrop-blur-sm", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), disabled: isLoading })] }), _jsxs("div", { className: "relative", children: [_jsx(FileText, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsxs("select", { className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Statuses" }), _jsx("option", { value: ApplicationStatuses.PREPARING, children: "Preparing" }), _jsx("option", { value: ApplicationStatuses.SUBMITTED, children: "Submitted" }), _jsx("option", { value: ApplicationStatuses.INTERVIEW_SCHEDULED, children: "Interview Scheduled" }), _jsx("option", { value: ApplicationStatuses.OFFER_RECEIVED, children: "Offer Received" }), _jsx("option", { value: ApplicationStatuses.REJECTED, children: "Rejected" }), _jsx("option", { value: ApplicationStatuses.WITHDRAWN, children: "Withdrawn" })] })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Button, { variant: "outline", size: "icon", onClick: handleRetry, disabled: isLoading, title: "Refresh applications", className: "h-10 w-10", children: [_jsx(RefreshCw, { className: `h-4 w-4 ${isLoading ? 'animate-spin' : ''}` }), _jsx("span", { className: "sr-only", children: "Refresh" })] }) })] }) }) }), _jsxs(Card, { className: "overflow-hidden border-border/40 shadow-lg", children: [_jsxs(CardHeader, { className: "border-b bg-gradient-to-r from-muted/30 to-muted/10", children: [_jsx(CardTitle, { className: "text-xl font-bold", children: "Your Applications" }), _jsxs(CardDescription, { children: [displayedApplications.length, " application", displayedApplications.length === 1 ? '' : 's', applications.length !== displayedApplications.length && ` of ${applications.length} total`] })] }), _jsx(CardContent, { className: "p-0", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { className: "bg-muted/20", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "font-semibold", children: "Position" }), _jsx(TableHead, { className: "font-semibold", children: "Status" }), _jsx(TableHead, { className: "hidden md:table-cell font-semibold", children: "Applied Date" }), _jsx(TableHead, { className: "hidden lg:table-cell font-semibold", children: "Last Updated" }), _jsx(TableHead, { className: "w-[50px]" })] }) }), _jsx(TableBody, { children: isLoading ? (Array(3).fill(0).map((_, i) => _jsx(ApplicationRowSkeleton, {}, i))) : displayedApplications.length > 0 ? (displayedApplications.map((application) => (_jsx(ApplicationRow, { application: application, onEdit: handleEdit, onDelete: handleDelete }, application.id)))) : (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 5, className: "h-32 text-center", children: _jsxs("div", { className: "flex flex-col items-center justify-center gap-3 py-8", children: [_jsx(FileText, { className: "h-12 w-12 text-muted-foreground/50" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-foreground", children: "No applications found" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: searchTerm || statusFilter !== 'all'
                                                                        ? 'Try adjusting your search or filters'
                                                                        : 'Get started by creating your first application' })] }), !searchTerm && statusFilter === 'all' && (_jsx(Button, { asChild: true, variant: "outline", className: "mt-2", children: _jsxs(Link, { to: "/applications/new", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Create Application"] }) }))] }) }) })) })] }) }) })] })] }));
}

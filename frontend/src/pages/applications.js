import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase, MoreVertical, ChevronDown, ChevronRight, RefreshCw, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ApplicationStatuses } from '@/types/models';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
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
// Status badge component
const StatusBadge = ({ status }) => {
    const statusConfig = {
        [ApplicationStatuses.PREPARING]: {
            label: 'Preparing',
            className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
        },
        [ApplicationStatuses.SUBMITTED]: {
            label: 'Submitted',
            className: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
        },
        [ApplicationStatuses.INTERVIEW_SCHEDULED]: {
            label: 'Interview Scheduled',
            className: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
        },
        [ApplicationStatuses.REJECTED]: {
            label: 'Rejected',
            className: 'bg-red-100 text-red-800 hover:bg-red-200',
        },
        [ApplicationStatuses.OFFER_RECEIVED]: {
            label: 'Offer Received',
            className: 'bg-green-100 text-green-800 hover:bg-green-200',
        },
        [ApplicationStatuses.WITHDRAWN]: {
            label: 'Withdrawn',
            className: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
        },
    };
    const config = statusConfig[status] || statusConfig[ApplicationStatuses.PREPARING];
    return (_jsx(Badge, { className: cn('whitespace-nowrap', config.className), children: config.label }));
};
// Application row component
const ApplicationRow = ({ application, onEdit, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => setIsExpanded(!isExpanded), className: "h-6 w-6 p-0", children: isExpanded ? (_jsx(ChevronDown, { className: "h-4 w-4" })) : (_jsx(ChevronRight, { className: "h-4 w-4" })) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: application.job_title || 'Untitled Application' }), _jsx("div", { className: "text-sm text-muted-foreground", children: application.company || 'No company' })] })] }) }), _jsx(TableCell, { children: _jsx(StatusBadge, { status: application.status }) }), _jsx(TableCell, { className: "hidden md:table-cell", children: application.applied_at ? formatDate(application.applied_at) : 'N/A' }), _jsx(TableCell, { className: "hidden md:table-cell", children: application.updated_at ? formatDate(application.updated_at) : 'N/A' }), _jsx(TableCell, { className: "text-right", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 p-0", children: [_jsx(MoreVertical, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Open menu" })] }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onClick: () => application.id && onEdit(application.id), children: [_jsx(Edit, { className: "mr-2 h-4 w-4" }), "Edit"] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { className: "text-red-600", onClick: () => application.id && onDelete(application.id), children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Delete"] })] })] }) })] }));
};
// Skeleton loader for application rows
const ApplicationRowSkeleton = () => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Skeleton, { className: "h-4 w-4" }), _jsx(Skeleton, { className: "h-4 w-32" })] }) }), _jsx(TableCell, { children: _jsx(Skeleton, { className: "h-6 w-24" }) }), _jsx(TableCell, { children: _jsx(Skeleton, { className: "h-4 w-24" }) }), _jsx(TableCell, { children: _jsx(Skeleton, { className: "h-4 w-24" }) }), _jsx(TableCell, { className: "text-right", children: _jsx(Skeleton, { className: "ml-auto h-8 w-8" }) })] }));
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
    // Sort function
    const sortApplications = (a, b) => {
        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';
        if (aValue < bValue)
            return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue)
            return sortOrder === 'asc' ? 1 : -1;
        return 0;
    };
    const displayedApplications = [...filteredAndSortedApplications].sort(sortApplications);
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
        return (_jsxs("div", { className: "container mx-auto flex h-[60vh] flex-col items-center justify-center px-4 text-center", children: [_jsx(AlertCircle, { className: "mb-4 h-12 w-12 text-red-500" }), _jsx("h2", { className: "mb-2 text-2xl font-bold", children: "Something went wrong" }), _jsx("p", { className: "mb-6 text-muted-foreground", children: error }), _jsxs(Button, { onClick: handleRetry, children: [_jsx(RefreshCw, { className: "mr-2 h-4 w-4" }), "Try again"] })] }));
    }
    return (_jsxs("div", { className: "container mx-auto px-4 py-8", children: [_jsx("header", { className: "mb-8", children: _jsxs("div", { className: "flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "Job Applications" }), _jsx("p", { className: "text-muted-foreground", children: "Track and manage your job applications" })] }), _jsx("div", { className: "flex space-x-2", children: _jsx(Button, { asChild: true, children: _jsxs(Link, { to: "/applications/new", className: "flex items-center", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add Application"] }) }) })] }) }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsxs("div", { className: "flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0", children: [_jsxs("div", { className: "relative w-full md:max-w-sm", children: [_jsx(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { placeholder: "Search applications...", className: "pl-9", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), disabled: isLoading })] }), _jsx("div", { className: "flex items-center space-x-2", children: _jsxs(Button, { variant: "outline", size: "icon", onClick: handleRetry, disabled: isLoading, title: "Refresh applications", className: "h-9 w-9", children: [_jsx(RefreshCw, { className: `h-4 w-4 ${isLoading ? 'animate-spin' : ''}` }), _jsx("span", { className: "sr-only", children: "Refresh" })] }) })] }), _jsx("div", { className: "rounded-md border", children: _jsx(Table, { children: _jsx(TableBody, { children: isLoading ? (
                                // Show skeleton loaders while loading
                                Array(3).fill(0).map((_, i) => _jsx(ApplicationRowSkeleton, {}, i))) : displayedApplications.length > 0 ? (
                                // Show applications
                                displayedApplications.map((application) => (_jsx(ApplicationRow, { application: application, onEdit: handleEdit, onDelete: handleDelete }, application.id)))) : (
                                // Show empty state
                                _jsx(TableRow, { children: _jsx(TableCell, { colSpan: 5, className: "h-24 text-center", children: _jsxs("div", { className: "flex flex-col items-center justify-center space-y-2", children: [_jsx(Briefcase, { className: "h-8 w-8 text-muted-foreground" }), _jsx("p", { className: "text-sm text-muted-foreground", children: searchTerm || statusFilter !== 'all'
                                                        ? 'No applications match your filters.'
                                                        : 'No applications found. Get started by adding one.' }), _jsx(Button, { asChild: true, variant: "outline", className: "mt-2", children: _jsxs(Link, { to: "/applications/new", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), "Add Application"] }) })] }) }) })) }) }) })] })] }));
}

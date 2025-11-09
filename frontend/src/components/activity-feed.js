import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Briefcase, FileText, UserPlus, Calendar, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
const getActivityIcon = (entityType, action) => {
    if (action === 'deleted') {
        return _jsx(Trash2, { className: "h-4 w-4 text-destructive" });
    }
    if (action === 'status_changed') {
        return _jsx(CheckCircle, { className: "h-4 w-4 text-primary" });
    }
    switch (entityType) {
        case 'job':
            return _jsx(Briefcase, { className: "h-4 w-4 text-blue-500" });
        case 'application':
            return _jsx(FileText, { className: "h-4 w-4 text-green-500" });
        case 'contact':
            return _jsx(UserPlus, { className: "h-4 w-4 text-purple-500" });
        case 'interview':
            return _jsx(Calendar, { className: "h-4 w-4 text-orange-500" });
        case 'document':
            return _jsx(FileText, { className: "h-4 w-4 text-indigo-500" });
        default:
            return _jsx(Clock, { className: "h-4 w-4 text-muted-foreground" });
    }
};
const getActivityColor = (entityType, action) => {
    if (action === 'deleted') {
        return 'border-l-destructive';
    }
    if (action === 'status_changed') {
        return 'border-l-primary';
    }
    switch (entityType) {
        case 'job':
            return 'border-l-blue-500';
        case 'application':
            return 'border-l-green-500';
        case 'contact':
            return 'border-l-purple-500';
        case 'interview':
            return 'border-l-orange-500';
        case 'document':
            return 'border-l-indigo-500';
        default:
            return 'border-l-muted-foreground';
    }
};
export function ActivityFeed({ limit = 10, entityType, className }) {
    const { data: activities, isLoading, error } = useQuery({
        queryKey: ['activities', entityType, limit],
        queryFn: () => activityApi.list(entityType, limit),
    });
    if (isLoading) {
        return (_jsxs(Card, { className: className, children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Recent Activity" }), _jsx(CardDescription, { children: "Your latest job search activities" })] }), _jsx(CardContent, { className: "space-y-4", children: [...Array(5)].map((_, i) => (_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Skeleton, { className: "h-8 w-8 rounded-full" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-3/4" }), _jsx(Skeleton, { className: "h-3 w-1/2" })] })] }, i))) })] }));
    }
    if (error) {
        return (_jsxs(Card, { className: className, children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Recent Activity" }), _jsx(CardDescription, { children: "Your latest job search activities" })] }), _jsx(CardContent, { children: _jsxs(Alert, { variant: "destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "Failed to load activities. Please try again later." })] }) })] }));
    }
    if (!activities || activities.length === 0) {
        return (_jsxs(Card, { className: className, children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Recent Activity" }), _jsx(CardDescription, { children: "Your latest job search activities" })] }), _jsx(CardContent, { children: _jsxs("div", { className: "text-center py-8 text-muted-foreground", children: [_jsx(Clock, { className: "h-12 w-12 mx-auto mb-2 opacity-50" }), _jsx("p", { children: "No activity yet" }), _jsx("p", { className: "text-sm", children: "Start creating jobs and applications to see activity here" })] }) })] }));
    }
    return (_jsxs(Card, { className: className, children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Recent Activity" }), _jsx(CardDescription, { children: "Your latest job search activities" })] }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-4", children: activities.map((activity) => (_jsxs("div", { className: `flex items-start gap-3 p-3 rounded-lg border-l-4 ${getActivityColor(activity.entity_type, activity.action)} bg-muted/50 hover:bg-muted/70 transition-colors`, children: [_jsx("div", { className: "mt-0.5", children: getActivityIcon(activity.entity_type, activity.action) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium leading-none", children: activity.description || `${activity.action} ${activity.entity_type}` }), activity.created_at && (_jsx("p", { className: "text-xs text-muted-foreground mt-1", children: formatDistanceToNow(new Date(activity.created_at), { addSuffix: true }) }))] })] }, activity.id))) }) })] }));
}

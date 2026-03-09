import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, Mail, Phone, MapPin, Check, Edit, Trash2, Plus } from 'lucide-react';
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { applicationApi, interviewApi, contactApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
const statusDisplay = {
    'preparing': { label: 'Saved', variant: 'secondary' },
    'submitted': { label: 'Applied', variant: 'outline' },
    'interview_scheduled': { label: 'Interview Scheduled', variant: 'default' },
    'offer_received': { label: 'Offer Received', variant: 'default' },
    'rejected': { label: 'Rejected', variant: 'destructive' },
    'withdrawn': { label: 'Withdrawn', variant: 'destructive' }
};
export function ApplicationDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const applicationId = id ? parseInt(id) : null;
    // State management
    const [isEditing, setIsEditing] = useState(false);
    const [editedNotes, setEditedNotes] = useState('');
    // Fetch application data
    const { data: application, isLoading, error: queryError } = useQuery({
        queryKey: ['application', applicationId],
        queryFn: () => applicationApi.get(applicationId),
        enabled: !!applicationId,
    });
    const { data: interviews = [] } = useQuery({
        queryKey: ['interviews', applicationId],
        queryFn: () => interviewApi.list(applicationId || undefined),
        enabled: !!applicationId,
    });
    const { data: contacts = [] } = useQuery({
        queryKey: ['contacts', application?.job_id],
        queryFn: () => contactApi.list(application?.job_id),
        enabled: !!application?.job_id,
    });
    useEffect(() => {
        if (application) {
            setEditedNotes(application.notes || '');
        }
    }, [application]);
    const error = queryError ? 'Failed to load application details' : (!application && !isLoading ? 'Application not found' : null);
    // Format date for display
    const formatDisplayDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    // Handle saving notes
    const handleSaveNotes = async () => {
        if (!application)
            return;
        try {
            await applicationApi.update({
                ...application,
                notes: editedNotes
            });
            queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            setIsEditing(false);
        }
        catch (err) {
            console.error('Failed to save notes:', err);
            alert('Failed to save notes. Please try again.');
        }
    };
    // Handle status change
    const handleStatusChange = async (newStatus) => {
        if (!application)
            return;
        try {
            await applicationApi.update({
                ...application,
                status: newStatus
            });
            queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
            queryClient.invalidateQueries({ queryKey: ['applications'] });
        }
        catch (err) {
            console.error('Failed to update status:', err);
            alert('Failed to update status. Please try again.');
        }
    };
    // Handle delete
    const handleDelete = async () => {
        if (!applicationId || !window.confirm('Are you sure you want to delete this application?'))
            return;
        try {
            await applicationApi.delete(applicationId);
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            navigate('/applications');
        }
        catch (err) {
            console.error('Failed to delete application:', err);
            alert('Failed to delete application. Please try again.');
        }
    };
    // Get status display info
    const currentStatus = application ? statusDisplay[application.status] ||
        { label: application.status, variant: 'outline' } : null;
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" }) }));
    }
    if (error || !application) {
        return (_jsxs("div", { className: "text-center py-12", children: [_jsx("h2", { className: "text-xl font-semibold text-destructive", children: error || 'Application not found' }), _jsxs(Button, { variant: "outline", className: "mt-4", onClick: () => navigate(-1), children: [_jsx(ArrowLeft, { className: "mr-2 h-4 w-4" }), "Back to Applications"] })] }));
    }
    return (_jsxs("div", { className: "p-6 max-w-6xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs(Button, { onClick: () => navigate(-1), variant: "outline", size: "sm", children: [_jsx(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Back"] }), _jsx("div", { className: "flex items-center space-x-2", children: _jsx(Badge, { variant: currentStatus?.variant, children: currentStatus?.label }) })] }), _jsxs("div", { className: "bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden", children: [_jsx("div", { className: "p-6 border-b border-gray-200 dark:border-gray-700", children: _jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: application.job_title }), _jsx("p", { className: "text-lg text-gray-600 dark:text-gray-300", children: application.company }), _jsxs("p", { className: "text-sm text-gray-500 dark:text-gray-400 mt-1", children: ["Applied on ", application.applied_at ? formatDisplayDate(application.applied_at) : 'Not applied yet'] })] }), _jsxs("div", { className: "mt-4 md:mt-0 flex space-x-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => navigate(`/applications/${applicationId}/edit`), children: [_jsx(Edit, { className: "mr-2 h-4 w-4" }), " Edit"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: handleDelete, children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), " Delete"] })] })] }) }), _jsxs(Tabs, { defaultValue: "overview", className: "w-full", children: [_jsxs(TabsList, { className: "w-full justify-start rounded-none border-b bg-transparent p-0", children: [_jsx(TabsTrigger, { value: "overview", className: "relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none hover:bg-gray-100 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none", children: "Overview" }), _jsxs(TabsTrigger, { value: "interviews", className: "relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none hover:bg-gray-100 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none", children: ["Interviews (", interviews.length || 0, ")"] }), _jsxs(TabsTrigger, { value: "contacts", className: "relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none hover:bg-gray-100 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none", children: ["Contacts (", contacts.length || 0, ")"] }), _jsx(TabsTrigger, { value: "documents", className: "relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none hover:bg-gray-100 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none", children: "Documents" })] }), _jsx(TabsContent, { value: "overview", className: "p-6", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "md:col-span-2 space-y-6", children: [_jsxs("div", { className: "bg-gray-50 dark:bg-gray-800 p-4 rounded-lg", children: [_jsx("h3", { className: "font-medium mb-2", children: "Application Status" }), _jsx("div", { className: "flex flex-wrap gap-2", children: ['preparing', 'submitted', 'interview_scheduled', 'offer_received', 'rejected', 'withdrawn'].map((status) => (_jsx(Button, { variant: status === application?.status ? 'default' : 'outline', size: "sm", onClick: () => handleStatusChange(status), children: statusDisplay[status]?.label || status }, status))) })] }), _jsxs("div", { className: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "font-medium", children: "Notes" }), !isEditing ? (_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                                        setEditedNotes(application.notes || '');
                                                                        setIsEditing(true);
                                                                    }, children: [_jsx(Edit, { className: "h-4 w-4 mr-2" }), " Edit"] })) : (_jsxs("div", { className: "space-x-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setIsEditing(false), children: "Cancel" }), _jsx(Button, { size: "sm", onClick: handleSaveNotes, children: "Save" })] }))] }), isEditing ? (_jsx(Textarea, { value: editedNotes, onChange: (e) => setEditedNotes(e.target.value), className: "min-h-[150px]", placeholder: "Add your notes here..." })) : (_jsx("div", { className: "prose dark:prose-invert max-w-none", children: application.notes || 'No notes added yet.' }))] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4", children: [_jsx("h3", { className: "font-medium mb-4", children: "Upcoming Interviews" }), interviews.filter(i => !i.completed).length > 0 ? (_jsx("div", { className: "space-y-4", children: interviews
                                                                .filter(i => !i.completed)
                                                                .map((interview) => (_jsxs("div", { className: "border-l-4 border-blue-500 pl-4 py-2", children: [_jsxs("div", { className: "font-medium", children: [interview.type, " Interview"] }), _jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: formatDisplayDate(interview.scheduled_at || '') }), _jsxs("div", { className: "text-sm mt-1", children: [_jsx(MapPin, { className: "inline h-4 w-4 mr-1" }), interview.location || 'Not specified'] })] }, interview.id))) })) : (_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "No upcoming interviews scheduled." })), _jsxs(Button, { variant: "outline", size: "sm", className: "mt-4 w-full", onClick: () => navigate(`/applications/${applicationId}/interviews/new`), children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), " Add Interview"] })] }), _jsxs("div", { className: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4", children: [_jsx("h3", { className: "font-medium mb-4", children: "Key Contacts" }), _jsx("div", { className: "space-y-4", children: contacts.length > 0 ? contacts.map((contact) => (_jsxs("div", { className: "flex items-start", children: [_jsx("div", { className: "flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300", children: contact.name.charAt(0) }), _jsxs("div", { className: "ml-3", children: [_jsx("div", { className: "font-medium", children: contact.name }), _jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: contact.position }), _jsxs("div", { className: "mt-3 space-y-1", children: [_jsxs("div", { className: "flex items-center text-sm", children: [_jsx(Mail, { className: "h-4 w-4 mr-2 text-gray-400" }), _jsx("a", { href: `mailto:${contact.email}`, className: "text-blue-600 dark:text-blue-400 hover:underline", children: contact.email })] }), contact.phone && (_jsxs("div", { className: "flex items-center text-sm", children: [_jsx(Phone, { className: "h-4 w-4 mr-2 text-gray-400" }), _jsx("a", { href: `tel:${contact.phone}`, className: "text-blue-600 dark:text-blue-400 hover:underline", children: contact.phone })] }))] }), contact.notes && (_jsx("div", { className: "mt-3 pt-3 border-t", children: _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: contact.notes }) }))] })] }, contact.id))) : (_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "No contacts added yet." })) }), _jsxs(Button, { variant: "outline", size: "sm", className: "mt-4 w-full", onClick: () => navigate(`/applications/${applicationId}/contacts/new`), children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), " Add Contact"] })] })] })] }) }), _jsxs(TabsContent, { value: "interviews", className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Interviews" }), _jsxs(Button, { children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), " Schedule Interview"] })] }), _jsx("div", { className: "space-y-4", children: interviews.length > 0 ? (interviews.map((interview) => (_jsxs("div", { className: "border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsxs("h3", { className: "font-medium", children: [interview.type, " Interview"] }), _jsxs("div", { className: "text-sm text-gray-500 dark:text-gray-400 mt-1", children: [_jsx(Calendar, { className: "inline h-4 w-4 mr-1" }), formatDisplayDate(interview.scheduled_at)] }), _jsxs("div", { className: "text-sm mt-1", children: [_jsx(MapPin, { className: "inline h-4 w-4 mr-1" }), interview.location] }), interview.notes && (_jsxs("div", { className: "mt-2 text-sm", children: [_jsx("p", { className: "font-medium", children: "Notes:" }), _jsx("p", { className: "text-gray-600 dark:text-gray-300", children: interview.notes })] }))] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Button, { variant: "outline", size: "sm", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx(Button, { variant: "outline", size: "sm", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }), interview.completed && (_jsxs("div", { className: "mt-2 flex items-center text-sm text-green-600 dark:text-green-400", children: [_jsx(Check, { className: "h-4 w-4 mr-1" }), " Completed"] }))] }, interview.id)))) : (_jsxs("div", { className: "text-center py-8", children: [_jsx(FileText, { className: "h-12 w-12 mx-auto text-gray-400" }), _jsx("h3", { className: "mt-2 text-sm font-medium text-gray-900 dark:text-white", children: "No interviews scheduled" }), _jsx("p", { className: "mt-1 text-sm text-gray-500 dark:text-gray-400", children: "Get started by scheduling your first interview." }), _jsx("div", { className: "mt-6", children: _jsxs(Button, { children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), " Schedule Interview"] }) })] })) })] }), _jsxs(TabsContent, { value: "contacts", className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Contacts" }), _jsxs(Button, { children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), " Add Contact"] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: contacts.length > 0 ? (contacts.map((contact) => (_jsx("div", { className: "border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors", children: _jsxs("div", { className: "flex items-start", children: [_jsx("div", { className: "flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-lg font-medium", children: contact.name.charAt(0) }), _jsxs("div", { className: "ml-4", children: [_jsx("h3", { className: "font-medium", children: contact.name }), contact.position && (_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: contact.position })), _jsxs("div", { className: "mt-2 space-y-1", children: [_jsxs("div", { className: "flex items-center text-sm", children: [_jsx(Mail, { className: "h-4 w-4 mr-2 text-gray-400" }), _jsx("a", { href: `mailto:${contact.email}`, className: "text-blue-600 dark:text-blue-400 hover:underline", children: contact.email })] }), contact.phone && (_jsxs("div", { className: "flex items-center text-sm", children: [_jsx(Phone, { className: "h-4 w-4 mr-2 text-gray-400" }), _jsx("a", { href: `tel:${contact.phone}`, className: "text-blue-600 dark:text-blue-400 hover:underline", children: contact.phone })] }))] }), contact.notes && (_jsxs("div", { className: "mt-3 pt-3 border-t border-gray-200 dark:border-gray-700", children: [_jsx("p", { className: "text-xs text-gray-500 dark:text-gray-400", children: "Notes:" }), _jsx("p", { className: "text-sm text-gray-700 dark:text-gray-300", children: contact.notes })] }))] }), _jsx("div", { className: "ml-auto", children: _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: _jsx(Edit, { className: "h-4 w-4" }) }) })] }) }, contact.id)))) : (_jsxs("div", { className: "col-span-full text-center py-8", children: [_jsx(FileText, { className: "h-12 w-12 mx-auto text-gray-400" }), _jsx("h3", { className: "mt-2 text-sm font-medium text-gray-900 dark:text-white", children: "No contacts added" }), _jsx("p", { className: "mt-1 text-sm text-gray-500 dark:text-gray-400", children: "Add contacts you've interacted with during the application process." }), _jsx("div", { className: "mt-6", children: _jsxs(Button, { children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), " Add Contact"] }) })] })) })] }), _jsxs(TabsContent, { value: "documents", className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Documents" }), _jsxs(Button, { children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), " Upload Document"] })] }), _jsx("div", { className: "space-y-4", children: application.resume || application.cover_letter ? (_jsxs("div", { className: "space-y-4", children: [application.resume && (_jsxs("div", { className: "flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(FileText, { className: "h-8 w-8 text-blue-500" }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "font-medium", children: "Resume" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: application.resume })] })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Button, { variant: "outline", size: "sm", children: "View" }), _jsx(Button, { variant: "outline", size: "sm", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] })), application.cover_letter && (_jsxs("div", { className: "flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(FileText, { className: "h-8 w-8 text-green-500" }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "font-medium", children: "Cover Letter" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: application.cover_letter })] })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Button, { variant: "outline", size: "sm", children: "View" }), _jsx(Button, { variant: "outline", size: "sm", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }))] })) : (_jsxs("div", { className: "text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg", children: [_jsx(FileText, { className: "h-12 w-12 mx-auto text-gray-400" }), _jsx("h3", { className: "mt-2 text-sm font-medium text-gray-900 dark:text-white", children: "No documents" }), _jsx("p", { className: "mt-1 text-sm text-gray-500 dark:text-gray-400", children: "Upload your resume, cover letter, and other relevant documents." }), _jsx("div", { className: "mt-6", children: _jsxs(Button, { children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), " Upload Document"] }) })] })) })] })] })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, ExternalLink, MapPin, DollarSign, Briefcase, Save, Trash2, Edit, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { jobApi, profileApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DocumentGenerator } from '@/components/document-generator';
export function JobDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editedJob, setEditedJob] = useState({});
    const [userProfile, setUserProfile] = useState(null);
    const jobId = id ? parseInt(id) : null;
    useEffect(() => {
        // Load user profile from database
        const loadProfile = async () => {
            try {
                const profile = await profileApi.get();
                if (profile) {
                    setUserProfile(profile);
                    localStorage.setItem('userProfile', JSON.stringify(profile));
                }
                else {
                    // Fallback to localStorage
                    const savedProfile = localStorage.getItem('userProfile');
                    if (savedProfile) {
                        try {
                            setUserProfile(JSON.parse(savedProfile));
                        }
                        catch (e) {
                            console.error('Failed to parse user profile:', e);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Failed to load user profile:', error);
                // Fallback to localStorage
                const savedProfile = localStorage.getItem('userProfile');
                if (savedProfile) {
                    try {
                        setUserProfile(JSON.parse(savedProfile));
                    }
                    catch (e) {
                        console.error('Failed to parse user profile:', e);
                    }
                }
            }
        };
        loadProfile();
    }, []);
    const { data: job, isLoading, error: queryError } = useQuery({
        queryKey: ['job', jobId],
        queryFn: () => jobApi.get(jobId),
        enabled: !!jobId,
    });
    useEffect(() => {
        if (job) {
            setEditedJob(job);
        }
    }, [job]);
    const error = queryError ? 'Failed to load job details' : (!job && !isLoading ? 'Job not found' : null);
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedJob(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const handleStatusChange = (status) => {
        setEditedJob(prev => ({
            ...prev,
            status
        }));
    };
    const handleSave = async () => {
        if (!job)
            return;
        try {
            await jobApi.update({ ...job, ...editedJob });
            queryClient.invalidateQueries({ queryKey: ['job', jobId] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setIsEditing(false);
        }
        catch (err) {
            console.error('Failed to save changes:', err);
            alert('Failed to save changes. Please try again.');
        }
    };
    const handleDelete = async () => {
        if (!jobId || !window.confirm('Are you sure you want to delete this job?'))
            return;
        try {
            await jobApi.delete(jobId);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            navigate('/jobs');
        }
        catch (err) {
            console.error('Failed to delete job:', err);
            alert('Failed to delete job. Please try again.');
        }
    };
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" }) }));
    }
    if (error || !job) {
        return (_jsxs("div", { className: "text-center py-12", children: [_jsx("h2", { className: "text-xl font-semibold text-destructive", children: error || 'Job not found' }), _jsxs(Button, { variant: "outline", className: "mt-4", onClick: () => navigate(-1), children: [_jsx(ArrowLeft, { className: "mr-2 h-4 w-4" }), "Back to Jobs"] })] }));
    }
    const statusVariant = {
        'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        'applied': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        'rejected': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(Button, { variant: "outline", onClick: () => navigate(-1), children: [_jsx(ArrowLeft, { className: "mr-2 h-4 w-4" }), "Back to Jobs"] }), _jsx("div", { className: "flex space-x-2", children: isEditing ? (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", onClick: () => setIsEditing(false), children: [_jsx(X, { className: "mr-2 h-4 w-4" }), "Cancel"] }), _jsxs(Button, { onClick: handleSave, children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), "Save Changes"] })] })) : (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", onClick: handleDelete, children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Delete"] }), _jsxs(Button, { onClick: () => setIsEditing(true), children: [_jsx(Edit, { className: "mr-2 h-4 w-4" }), "Edit"] })] })) })] }), _jsxs(Tabs, { defaultValue: "details", className: "space-y-4", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "details", children: "Job Details" }), userProfile && (_jsxs(TabsTrigger, { value: "documents", children: [_jsx(FileText, { className: "h-4 w-4 mr-2" }), "Generate Documents"] }))] }), _jsx(TabsContent, { value: "details", className: "space-y-6", children: _jsxs("div", { className: "bg-card rounded-lg border shadow-sm", children: [_jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex flex-col space-y-4", children: [_jsxs("div", { className: "flex flex-col space-y-2", children: [isEditing ? (_jsx("input", { type: "text", name: "title", value: editedJob.title || '', onChange: handleInputChange, className: "text-3xl font-bold bg-transparent border-b focus:outline-none focus:border-primary" })) : (_jsx("h1", { className: "text-3xl font-bold", children: job.title })), _jsxs("div", { className: "flex items-center space-x-4 text-muted-foreground", children: [isEditing ? (_jsx("input", { type: "text", name: "company", value: editedJob.company || '', onChange: handleInputChange, className: "text-xl bg-transparent border-b focus:outline-none focus:border-primary" })) : (_jsx("span", { className: "text-xl", children: job.company })), job.url && (_jsxs("a", { href: job.url, target: "_blank", rel: "noopener noreferrer", className: "text-primary hover:underline flex items-center", children: [_jsx(ExternalLink, { className: "h-4 w-4 mr-1" }), "View Posting"] }))] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: isEditing ? (['saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived'].map((status) => (_jsx("button", { type: "button", onClick: () => handleStatusChange(status), className: cn('px-3 py-1 rounded-full text-sm font-medium transition-colors', editedJob.status === status
                                                        ? statusVariant[status]
                                                        : 'bg-muted hover:bg-muted/80 cursor-pointer'), children: status }, status)))) : job.status && (_jsx(Badge, { className: statusVariant[job.status], children: job.status })) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(MapPin, { className: "h-5 w-5 text-muted-foreground" }), isEditing ? (_jsx("input", { type: "text", name: "location", value: editedJob.location || '', onChange: handleInputChange, className: "bg-transparent border-b focus:outline-none focus:border-primary w-full", placeholder: "Location" })) : (_jsx("span", { children: job.location || 'Not specified' }))] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(DollarSign, { className: "h-5 w-5 text-muted-foreground" }), isEditing ? (_jsx("input", { type: "text", name: "salary", value: editedJob.salary || '', onChange: handleInputChange, className: "bg-transparent border-b focus:outline-none focus:border-primary w-full", placeholder: "Salary range" })) : (_jsx("span", { children: job.salary || 'Not specified' }))] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Briefcase, { className: "h-5 w-5 text-muted-foreground" }), _jsxs("span", { children: ["Source: ", job.source] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Calendar, { className: "h-5 w-5 text-muted-foreground" }), _jsxs("span", { children: ["Added on ", job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown'] })] })] })] }) }), _jsxs("div", { className: "border-t p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Job Description" }), isEditing ? (_jsx(Textarea, { name: "description", value: editedJob.description || '', onChange: handleInputChange, className: "min-h-[150px]" })) : (_jsx("p", { className: "whitespace-pre-line text-muted-foreground", children: job.description || 'No description provided.' }))] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Requirements" }), isEditing ? (_jsx(Textarea, { name: "requirements", value: editedJob.requirements || '', onChange: handleInputChange, className: "min-h-[100px]", placeholder: "Enter job requirements..." })) : (_jsx("p", { className: "whitespace-pre-line text-muted-foreground", children: job.requirements || 'No requirements listed.' }))] })] })] }) }), userProfile && (_jsx(TabsContent, { value: "documents", children: _jsx(DocumentGenerator, { job: job, userProfile: userProfile, onDocumentGenerated: (doc) => {
                                console.log('Document generated:', doc);
                                // Could save to database or show notification
                            } }) }))] }), !userProfile && (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "text-center space-y-4", children: [_jsx(FileText, { className: "h-12 w-12 mx-auto text-muted-foreground" }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "Create Your Profile" }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: "Set up your profile to generate tailored resumes and cover letters for jobs." })] }), _jsx(Button, { onClick: () => navigate('/settings?tab=profile'), children: "Go to Profile Settings" })] }) }) }))] }));
}
// Helper function to merge class names
function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}

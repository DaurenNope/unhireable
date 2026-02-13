import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MapPin, DollarSign, Briefcase, Save, Trash2, Edit, X, FileText, Sparkles, Rocket, Clock, Building2, Tag, Calendar, RefreshCw, } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { jobApi, profileApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DocumentGenerator } from '@/components/document-generator';
import { ApplicationLaunchpad } from '@/components/application-launchpad';
import { AtsSuggestions } from '@/components/ats-suggestions';
import { formatSourceLabel } from '@/lib/sources';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import { open } from '@tauri-apps/plugin-shell';
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
function parseMetadataFromDescription(description) {
    const metadata = {
        cleanedDescription: description,
    };
    // Try to extract text content if it's HTML
    let textContent = description;
    if (typeof window !== 'undefined' && description.includes('<')) {
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = description;
            textContent = tempDiv.textContent || tempDiv.innerText || description;
        }
        catch {
            textContent = description;
        }
    }
    // Pattern to match metadata line: "Category: ... Type: ... Tags: ... Published: ..."
    // More flexible pattern that handles various spacing
    const metadataPattern = /Category:\s*([^\n]+?)\s+Type:\s*([^\n]+?)\s+Tags:\s*([^\n]+?)\s+Published:\s*([^\n]+?)(?:\n|$)/i;
    const match = textContent.match(metadataPattern);
    if (match) {
        metadata.category = match[1]?.trim();
        metadata.type = match[2]?.trim();
        const tagsStr = match[3]?.trim();
        if (tagsStr) {
            metadata.tags = tagsStr.split(',').map(tag => tag.trim()).filter(Boolean);
        }
        metadata.published = match[4]?.trim();
        // Remove the metadata line from description
        // First try to remove it from HTML (if it contains HTML tags)
        let cleaned = description;
        if (description.includes('<')) {
            // Remove HTML tags around the metadata pattern
            const escapedCategory = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedType = match[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedTags = match[3].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedPublished = match[4].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Pattern that matches metadata with optional HTML tags
            const htmlPattern = new RegExp(`(?:<[^>]*>\\s*)?Category:\\s*${escapedCategory}\\s+Type:\\s*${escapedType}\\s+Tags:\\s*${escapedTags}\\s+Published:\\s*${escapedPublished}(?:\\s*<[^>]*>)?(?:\\n|$)`, 'gi');
            cleaned = cleaned.replace(htmlPattern, '');
        }
        // Also try plain text pattern as fallback
        cleaned = cleaned.replace(metadataPattern, '').trim();
        metadata.cleanedDescription = cleaned;
    }
    return metadata;
}
export function JobDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editedJob, setEditedJob] = useState({});
    const [userProfile, setUserProfile] = useState(null);
    const [isEnriching, setIsEnriching] = useState(false);
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
                        catch (parseError) {
                            console.error('Failed to parse user profile:', parseError);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Failed to load user profile:', error);
                const savedProfile = localStorage.getItem('userProfile');
                if (savedProfile) {
                    try {
                        setUserProfile(JSON.parse(savedProfile));
                    }
                    catch (parseError) {
                        console.error('Failed to parse user profile:', parseError);
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
    // Auto-enrich jobs that are missing descriptions
    useEffect(() => {
        const shouldAutoEnrich = job && !isEnriching && (!job.description || job.description.trim() === '') && job.url;
        if (shouldAutoEnrich && jobId) {
            console.log('[Unhireable] Auto-enriching job...', jobId);
            setIsEnriching(true);
            jobApi.enrich(jobId)
                .then((enrichedJob) => {
                queryClient.invalidateQueries({ queryKey: ['job', jobId] });
                console.log('✅ Auto-enriched job:', enrichedJob?.title);
            })
                .catch((err) => {
                console.error('Auto-enrichment failed:', err);
            })
                .finally(() => {
                setIsEnriching(false);
            });
        }
    }, [job?.id, job?.description, job?.url, jobId, queryClient]);
    // Get sanitizer instance (must be before early returns to maintain hook order)
    const sanitizer = useMemo(() => {
        if (typeof window === 'undefined' || !window.document) {
            return {
                sanitize: (value) => value,
            };
        }
        return DOMPurify;
    }, []);
    const matchQuality = useMemo(() => getMatchQuality(job?.match_score), [job?.match_score]);
    // Parse metadata from description
    const parsedMetadata = useMemo(() => {
        if (!job?.description)
            return null;
        return parseMetadataFromDescription(job.description);
    }, [job?.description]);
    const sanitizedDescription = useMemo(() => {
        if (!job?.description)
            return '';
        const descriptionToSanitize = parsedMetadata?.cleanedDescription || job.description;
        return sanitizer.sanitize(descriptionToSanitize, {
            ALLOWED_TAGS: ['p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'div', 'span', 'h3', 'h4', 'h5', 'h6'],
            ALLOWED_ATTR: ['class', 'href', 'rel', 'target'],
        });
    }, [job?.description, sanitizer, parsedMetadata]);
    const sanitizedRequirements = useMemo(() => {
        if (!job?.requirements)
            return '';
        return sanitizer.sanitize(job.requirements, {
            ALLOWED_TAGS: ['p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'div', 'span', 'h3', 'h4', 'h5', 'h6'],
            ALLOWED_ATTR: ['class', 'href', 'rel', 'target'],
        });
    }, [job?.requirements, sanitizer]);
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
    const handleOpenOriginalPosting = async (url) => {
        try {
            await open(url);
        }
        catch (err) {
            console.error('Failed to open URL:', err);
            // Fallback to window.open if Tauri API fails
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };
    const handleEnrich = async () => {
        if (!jobId)
            return;
        setIsEnriching(true);
        try {
            const enrichedJob = await jobApi.enrich(jobId);
            queryClient.invalidateQueries({ queryKey: ['job', jobId] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            console.log('✅ Job enriched successfully:', enrichedJob);
        }
        catch (err) {
            console.error('Failed to enrich job:', err);
            alert('Failed to enrich job. Please try again.');
        }
        finally {
            setIsEnriching(false);
        }
    };
    // Check if job needs enrichment (missing description)
    const needsEnrichment = job && (!job.description || job.description.trim() === '');
    const statusVariant = {
        'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
        'applied': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
        'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
        'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
        'rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
        'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200',
    };
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" }) }));
    }
    if (error || !job) {
        return (_jsxs("div", { className: "text-center py-12", children: [_jsx("h2", { className: "text-xl font-semibold text-destructive", children: error || 'Job not found' }), _jsxs(Button, { variant: "outline", className: "mt-4", onClick: () => navigate(-1), children: [_jsx(ArrowLeft, { className: "mr-2 h-4 w-4" }), "Back to Jobs"] })] }));
    }
    return (_jsxs("div", { className: "space-y-8 p-6 bg-gradient-to-b from-background via-background to-muted/25 min-h-screen", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(Button, { variant: "ghost", onClick: () => navigate(-1), className: "gap-2", children: [_jsx(ArrowLeft, { className: "h-4 w-4" }), "Back to Explorer"] }), _jsx("div", { className: "flex flex-wrap gap-2", children: isEditing ? (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", onClick: () => setIsEditing(false), className: "gap-2", children: [_jsx(X, { className: "h-4 w-4" }), "Cancel"] }), _jsxs(Button, { onClick: handleSave, className: "gap-2", children: [_jsx(Save, { className: "h-4 w-4" }), "Save Changes"] })] })) : (_jsxs(_Fragment, { children: [needsEnrichment && (_jsxs(Button, { variant: "outline", onClick: handleEnrich, disabled: isEnriching, className: "gap-2 border-primary/30 hover:border-primary", children: [_jsx(RefreshCw, { className: `h-4 w-4 ${isEnriching ? 'animate-spin' : ''}` }), isEnriching ? 'Enriching...' : 'Fetch Full Details'] })), _jsxs(Button, { variant: "outline", onClick: handleDelete, className: "gap-2", children: [_jsx(Trash2, { className: "h-4 w-4" }), "Delete"] }), _jsxs(Button, { onClick: () => setIsEditing(true), className: "gap-2", children: [_jsx(Edit, { className: "h-4 w-4" }), "Edit"] })] })) })] }), _jsx(Card, { className: "border-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 shadow-xl", children: _jsx(CardContent, { className: "p-6", children: _jsx("div", { className: "flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between", children: _jsxs("div", { className: "space-y-4 flex-1", children: [isEditing ? (_jsx("input", { type: "text", name: "title", value: editedJob.title || '', onChange: handleInputChange, className: "text-3xl font-bold bg-transparent border-b-2 border-primary/30 focus:outline-none focus:border-primary w-full" })) : (_jsx("h1", { className: "text-3xl font-bold tracking-tight text-foreground", children: job.title })), _jsxs("div", { className: "flex flex-wrap items-center gap-4 text-muted-foreground", children: [isEditing ? (_jsx("input", { type: "text", name: "company", value: editedJob.company || '', onChange: handleInputChange, className: "text-xl bg-transparent border-b-2 border-primary/30 focus:outline-none focus:border-primary" })) : (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Building2, { className: "h-5 w-5" }), _jsx("span", { className: "text-xl font-medium", children: job.company })] })), job.url && (_jsxs(Button, { variant: "ghost", size: "sm", className: "gap-2", onClick: () => handleOpenOriginalPosting(job.url), children: [_jsx(ExternalLink, { className: "h-4 w-4" }), "View original posting"] }))] }), _jsx("div", { className: "flex flex-wrap items-center gap-3", children: isEditing ? (['saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived'].map((status) => (_jsx("button", { type: "button", onClick: () => handleStatusChange(status), className: cn('px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize', editedJob.status === status
                                            ? statusVariant[status]
                                            : 'bg-muted hover:bg-muted/80 cursor-pointer'), children: status }, status)))) : (_jsxs(_Fragment, { children: [job.status && (_jsx(Badge, { className: cn('text-sm font-medium capitalize', statusVariant[job.status]), children: job.status })), matchQuality && job.match_score !== null && job.match_score !== undefined && (_jsxs(Badge, { className: cn('text-sm font-semibold', getMatchQualityVariant(matchQuality)), children: [_jsx(Sparkles, { className: "mr-1.5 h-3.5 w-3.5" }), matchQuality, " match \u00B7 ", job.match_score.toFixed(0), "%"] })), _jsx(Badge, { variant: "outline", className: "text-xs", children: formatSourceLabel(job.source) })] })) }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2", children: [job.location && (_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx(MapPin, { className: "h-4 w-4 text-muted-foreground flex-shrink-0" }), isEditing ? (_jsx("input", { type: "text", name: "location", value: editedJob.location || '', onChange: handleInputChange, className: "bg-transparent border-b border-primary/30 focus:outline-none focus:border-primary w-full", placeholder: "Location" })) : (_jsx("span", { className: "text-foreground", children: job.location }))] })), job.salary && (_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx(DollarSign, { className: "h-4 w-4 text-muted-foreground flex-shrink-0" }), isEditing ? (_jsx("input", { type: "text", name: "salary", value: editedJob.salary || '', onChange: handleInputChange, className: "bg-transparent border-b border-primary/30 focus:outline-none focus:border-primary w-full", placeholder: "Salary range" })) : (_jsx(Badge, { variant: "outline", className: "bg-amber-50/80 text-amber-800 border-amber-200", children: job.salary }))] })), _jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx(Briefcase, { className: "h-4 w-4 text-muted-foreground flex-shrink-0" }), _jsx("span", { className: "text-muted-foreground", children: "Source:" }), _jsx("span", { className: "text-foreground font-medium", children: formatSourceLabel(job.source) })] }), job.created_at && (_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx(Clock, { className: "h-4 w-4 text-muted-foreground flex-shrink-0" }), _jsx("span", { className: "text-muted-foreground", children: "Added:" }), _jsx("span", { className: "text-foreground", children: new Date(job.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    }) })] }))] })] }) }) }) }), job.url && (_jsx(AtsSuggestions, { jobUrl: job.url })), _jsxs(Tabs, { defaultValue: "apply", className: "space-y-6", children: [_jsxs(TabsList, { children: [userProfile && (_jsxs(TabsTrigger, { value: "apply", className: "gap-2", children: [_jsx(Rocket, { className: "h-4 w-4" }), "Apply"] })), _jsx(TabsTrigger, { value: "details", children: "Job Details" }), userProfile && (_jsxs(TabsTrigger, { value: "documents", children: [_jsx(FileText, { className: "h-4 w-4 mr-2" }), "Documents"] }))] }), _jsxs(TabsContent, { value: "details", className: "space-y-6", children: [parsedMetadata && (parsedMetadata.category || parsedMetadata.type || parsedMetadata.tags?.length || parsedMetadata.published) && (_jsx(Card, { className: "border border-primary/20 bg-primary/5 shadow-sm", children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex flex-wrap items-center gap-4 text-sm", children: [parsedMetadata.category && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Briefcase, { className: "h-4 w-4 text-primary" }), _jsx("span", { className: "text-muted-foreground", children: "Category:" }), _jsx(Badge, { variant: "outline", className: "font-medium", children: parsedMetadata.category })] })), parsedMetadata.type && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-muted-foreground", children: "Type:" }), _jsx(Badge, { variant: "outline", className: "font-medium capitalize", children: parsedMetadata.type.replace('_', ' ') })] })), parsedMetadata.tags && parsedMetadata.tags.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx(Tag, { className: "h-4 w-4 text-primary" }), _jsx("span", { className: "text-muted-foreground", children: "Tags:" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: parsedMetadata.tags.map((tag, idx) => (_jsx(Badge, { variant: "secondary", className: "text-xs font-normal", children: tag }, idx))) })] })), parsedMetadata.published && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "h-4 w-4 text-primary" }), _jsx("span", { className: "text-muted-foreground", children: "Published:" }), _jsx("span", { className: "text-foreground font-medium", children: new Date(parsedMetadata.published).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                        }) })] }))] }) }) })), _jsx(Card, { className: "border-0 shadow-xl", children: _jsxs(CardContent, { className: "p-8 space-y-10", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-2xl font-bold text-foreground border-b border-border pb-3", children: "Job Description" }), isEditing ? (_jsx(Textarea, { name: "description", value: editedJob.description || '', onChange: handleInputChange, className: "min-h-[300px] rounded-xl font-mono text-sm" })) : sanitizedDescription ? (_jsx("div", { className: "job-description-content space-y-6 text-base leading-relaxed", dangerouslySetInnerHTML: { __html: sanitizedDescription } })) : isEnriching ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 space-y-4", children: [_jsx(RefreshCw, { className: "h-8 w-8 animate-spin text-primary" }), _jsx("p", { className: "text-muted-foreground", children: "Fetching full job details..." })] })) : (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 space-y-4 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/30", children: [_jsx(Sparkles, { className: "h-10 w-10 text-muted-foreground" }), _jsx("p", { className: "text-muted-foreground text-center", children: "No description available yet" }), job.url && (_jsxs(Button, { onClick: handleEnrich, disabled: isEnriching, className: "gap-2", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), "Fetch Full Details"] }))] }))] }), _jsxs("div", { className: "space-y-4 pt-6 border-t border-border", children: [_jsx("h3", { className: "text-2xl font-bold text-foreground border-b border-border pb-3", children: "Requirements" }), isEditing ? (_jsx(Textarea, { name: "requirements", value: editedJob.requirements || '', onChange: handleInputChange, className: "min-h-[200px] rounded-xl font-mono text-sm", placeholder: "Enter job requirements..." })) : sanitizedRequirements ? (_jsx("div", { className: "job-description-content space-y-6 text-base leading-relaxed", dangerouslySetInnerHTML: { __html: sanitizedRequirements } })) : (_jsx("p", { className: "text-muted-foreground italic py-8", children: "No requirements listed." }))] })] }) })] }), userProfile && (_jsx(TabsContent, { value: "apply", children: _jsx(Card, { className: "border-0 shadow-xl", children: _jsx(CardContent, { className: "p-6", children: _jsx(ApplicationLaunchpad, { job: job, userProfile: userProfile }) }) }) })), userProfile && (_jsx(TabsContent, { value: "documents", children: _jsx(Card, { className: "border-0 shadow-xl", children: _jsx(CardContent, { className: "p-6", children: _jsx(DocumentGenerator, { job: job, userProfile: userProfile, onDocumentGenerated: (doc) => {
                                        console.log('Document generated:', doc);
                                    } }) }) }) }))] }), !userProfile && (_jsx(Card, { className: "border-0 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-pink-500/10 shadow-xl", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "text-center space-y-4", children: [_jsx("div", { className: "rounded-full bg-primary/10 p-4 w-fit mx-auto", children: _jsx(FileText, { className: "h-8 w-8 text-primary" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-foreground", children: "Unlock document generation" }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: "Set up your profile to generate tailored resumes and cover letters for jobs." })] }), _jsxs(Button, { onClick: () => navigate('/settings?tab=profile'), className: "gap-2", children: [_jsx(Rocket, { className: "h-4 w-4" }), "Go to Profile Settings"] })] }) }) }))] }));
}

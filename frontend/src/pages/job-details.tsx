import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, ExternalLink, MapPin, DollarSign, Briefcase, Save, Trash2, Edit, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Job, JobStatus, UserProfile } from '@/types/models';
import { jobApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DocumentGenerator } from '@/components/document-generator';


export function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedJob, setEditedJob] = useState<Partial<Job>>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const jobId = id ? parseInt(id) : null;

  useEffect(() => {
    // Load user profile from localStorage
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error('Failed to parse user profile:', e);
      }
    }
  }, []);

  const { data: job, isLoading, error: queryError } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobApi.get(jobId!),
    enabled: !!jobId,
  });

  useEffect(() => {
    if (job) {
      setEditedJob(job);
    }
  }, [job]);

  const error = queryError ? 'Failed to load job details' : (!job && !isLoading ? 'Job not found' : null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedJob(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = (status: JobStatus) => {
    setEditedJob(prev => ({
      ...prev,
      status
    }));
  };

  const handleSave = async () => {
    if (!job) return;
    try {
      await jobApi.update({ ...job, ...editedJob } as Job);
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save changes:', err);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!jobId || !window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await jobApi.delete(jobId);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigate('/jobs');
    } catch (err) {
      console.error('Failed to delete job:', err);
      alert('Failed to delete job. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-destructive">{error || 'Job not found'}</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
      </div>
    );
  }

  const statusVariant: Record<JobStatus, string> = {
    'saved': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'applied': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'interviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'offer': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'rejected': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
        
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Job Details</TabsTrigger>
          {userProfile && (
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-2" />
              Generate Documents
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-2">
              {isEditing ? (
                <input
                  type="text"
                  name="title"
                  value={editedJob.title || ''}
                  onChange={handleInputChange}
                  className="text-3xl font-bold bg-transparent border-b focus:outline-none focus:border-primary"
                />
              ) : (
                <h1 className="text-3xl font-bold">{job.title}</h1>
              )}
              
              <div className="flex items-center space-x-4 text-muted-foreground">
                {isEditing ? (
                  <input
                    type="text"
                    name="company"
                    value={editedJob.company || ''}
                    onChange={handleInputChange}
                    className="text-xl bg-transparent border-b focus:outline-none focus:border-primary"
                  />
                ) : (
                  <span className="text-xl">{job.company}</span>
                )}
                
                {job.url && (
                  <a 
                    href={job.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Posting
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                (['saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived'] as JobStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                      editedJob.status === status
                        ? statusVariant[status]
                        : 'bg-muted hover:bg-muted/80 cursor-pointer'
                    )}
                  >
                    {status}
                  </button>
                ))
              ) : job.status && (
                <Badge className={statusVariant[job.status]}>
                  {job.status}
                </Badge>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-4">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                {isEditing ? (
                  <input
                    type="text"
                    name="location"
                    value={editedJob.location || ''}
                    onChange={handleInputChange}
                    className="bg-transparent border-b focus:outline-none focus:border-primary w-full"
                    placeholder="Location"
                  />
                ) : (
                  <span>{job.location || 'Not specified'}</span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                {isEditing ? (
                  <input
                    type="text"
                    name="salary"
                    value={editedJob.salary || ''}
                    onChange={handleInputChange}
                    className="bg-transparent border-b focus:outline-none focus:border-primary w-full"
                    placeholder="Salary range"
                  />
                ) : (
                  <span>{job.salary || 'Not specified'}</span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <span>Source: {job.source}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span>
                  Added on {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Job Description</h3>
            {isEditing ? (
              <Textarea
                name="description"
                value={editedJob.description || ''}
                onChange={handleInputChange}
                className="min-h-[150px]"
              />
            ) : (
              <p className="whitespace-pre-line text-muted-foreground">
                {job.description || 'No description provided.'}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Requirements</h3>
            {isEditing ? (
              <Textarea
                name="requirements"
                value={editedJob.requirements || ''}
                onChange={handleInputChange}
                className="min-h-[100px]"
                placeholder="Enter job requirements..."
              />
            ) : (
              <p className="whitespace-pre-line text-muted-foreground">
                {job.requirements || 'No requirements listed.'}
              </p>
            )}
          </div>

          </div>
        </div>
        </TabsContent>

        {userProfile && (
          <TabsContent value="documents">
            <DocumentGenerator 
              job={job} 
              userProfile={userProfile}
              onDocumentGenerated={(doc) => {
                console.log('Document generated:', doc);
                // Could save to database or show notification
              }}
            />
          </TabsContent>
        )}
      </Tabs>

      {!userProfile && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Create Your Profile</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Set up your profile to generate tailored resumes and cover letters for jobs.
                </p>
              </div>
              <Button onClick={() => navigate('/settings?tab=profile')}>
                Go to Profile Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to merge class names
function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

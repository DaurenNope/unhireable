import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Mail,
  Phone,
  MapPin,
  Check,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { ApplicationStatus } from '@/types/models';
import { applicationApi, interviewApi, contactApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';


// Status display mapping
type StatusVariant = 'secondary' | 'outline' | 'default' | 'destructive';
type StatusDisplay = Record<string, { label: string; variant: StatusVariant }>;

const statusDisplay: StatusDisplay = {
  'preparing': { label: 'Saved', variant: 'secondary' as const },
  'submitted': { label: 'Applied', variant: 'outline' as const },
  'interview_scheduled': { label: 'Interview Scheduled', variant: 'default' as const },
  'offer_received': { label: 'Offer Received', variant: 'default' as const },
  'rejected': { label: 'Rejected', variant: 'destructive' as const },
  'withdrawn': { label: 'Withdrawn', variant: 'destructive' as const }
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
    queryFn: () => applicationApi.get(applicationId!),
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
  const formatDisplayDate = (dateString: string) => {
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
    if (!application) return;
    
    try {
      await applicationApi.update({
          ...application,
          notes: editedNotes
      });
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save notes:', err);
      alert('Failed to save notes. Please try again.');
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (!application) return;
    
    try {
      await applicationApi.update({
          ...application,
          status: newStatus
      });
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status. Please try again.');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!applicationId || !window.confirm('Are you sure you want to delete this application?')) return;
    
    try {
      await applicationApi.delete(applicationId);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      navigate('/applications');
    } catch (err) {
      console.error('Failed to delete application:', err);
      alert('Failed to delete application. Please try again.');
    }
  };

  // Get status display info
  const currentStatus = application ? statusDisplay[application.status] ||
    { label: application.status, variant: 'outline' as const } : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-destructive">{error || 'Application not found'}</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Applications
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button 
          onClick={() => navigate(-1)} 
          variant="outline" 
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        
        <div className="flex items-center space-x-2">
          <Badge variant={currentStatus?.variant}>
            {currentStatus?.label}
          </Badge>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {application.job_title}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                {application.company}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
               Applied on {application.applied_at ? formatDisplayDate(application.applied_at) : 'Not applied yet'}
             </p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/applications/${applicationId}/edit`)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger 
              value="overview" 
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none hover:bg-gray-100 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="interviews" 
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none hover:bg-gray-100 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Interviews ({interviews.length || 0})
            </TabsTrigger>
            <TabsTrigger 
              value="contacts" 
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none hover:bg-gray-100 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Contacts ({contacts.length || 0})
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none hover:bg-gray-100 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Application Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {(['preparing', 'submitted', 'interview_scheduled', 'offer_received', 'rejected', 'withdrawn'] as ApplicationStatus[]).map((status) => (
                      <Button
                        key={status}
                        variant={status === application?.status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusChange(status)}
                      >
                        {statusDisplay[status]?.label || status}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Notes</h3>
                    {!isEditing ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setEditedNotes(application.notes || '');
                          setIsEditing(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </Button>
                    ) : (
                      <div className="space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleSaveNotes}
                        >
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <Textarea
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      className="min-h-[150px]"
                      placeholder="Add your notes here..."
                    />
                  ) : (
                    <div className="prose dark:prose-invert max-w-none">
                      {application.notes || 'No notes added yet.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-medium mb-4">Upcoming Interviews</h3>
                  {interviews.filter(i => !i.completed).length > 0 ? (
                    <div className="space-y-4">
                      {interviews
                        .filter(i => !i.completed)
                        .map((interview) => (
                          <div key={interview.id} className="border-l-4 border-blue-500 pl-4 py-2">
                            <div className="font-medium">{interview.type} Interview</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDisplayDate(interview.scheduled_at || '')}
                            </div>
                            <div className="text-sm mt-1">
                              <MapPin className="inline h-4 w-4 mr-1" />
                              {interview.location || 'Not specified'}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming interviews scheduled.</p>
                  )}
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => navigate(`/applications/${applicationId}/interviews/new`)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Interview
                  </Button>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-medium mb-4">Key Contacts</h3>
                  <div className="space-y-4">
                    {contacts.length > 0 ? contacts.map((contact) => (
                      <div key={contact.id} className="flex items-start">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
                          {contact.name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {contact.position}
                          </div>
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center text-sm">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              <a href={`mailto:${contact.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                {contact.email}
                              </a>
                            </div>
                            {contact.phone && (
                              <div className="flex items-center text-sm">
                                <Phone className="h-4 w-4 mr-2 text-gray-400" />
                                <a href={`tel:${contact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                  {contact.phone}
                                </a>
                              </div>
                            )}
                          </div>
                          {contact.notes && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm text-gray-500 dark:text-gray-400">{contact.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No contacts added yet.</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => navigate(`/applications/${applicationId}/contacts/new`)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Contact
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="interviews" className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Interviews</h2>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Schedule Interview
              </Button>
            </div>
            
            <div className="space-y-4">
              {interviews.length > 0 ? (
                interviews.map((interview) => (
                  <div key={interview.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{interview.type} Interview</h3>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <Calendar className="inline h-4 w-4 mr-1" />
                          {formatDisplayDate(interview.scheduled_at)}
                        </div>
                        <div className="text-sm mt-1">
                          <MapPin className="inline h-4 w-4 mr-1" />
                          {interview.location}
                        </div>
                        {interview.notes && (
                          <div className="mt-2 text-sm">
                            <p className="font-medium">Notes:</p>
                            <p className="text-gray-600 dark:text-gray-300">{interview.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {interview.completed && (
                      <div className="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                        <Check className="h-4 w-4 mr-1" /> Completed
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No interviews scheduled</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get started by scheduling your first interview.
                  </p>
                  <div className="mt-6">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" /> Schedule Interview
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Contacts</h2>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Contact
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.length > 0 ? (
                contacts.map((contact) => (
                  <div key={contact.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-lg font-medium">
                        {contact.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <h3 className="font-medium">{contact.name}</h3>
                        {contact.position && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{contact.position}</p>
                        )}
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center text-sm">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            <a href={`mailto:${contact.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {contact.email}
                            </a>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center text-sm">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              <a href={`tel:${contact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                {contact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                        {contact.notes && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Notes:</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{contact.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="ml-auto">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No contacts added</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Add contacts you've interacted with during the application process.
                  </p>
                  <div className="mt-6">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" /> Add Contact
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Documents</h2>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Upload Document
              </Button>
            </div>
            
            <div className="space-y-4">
              {application.resume || application.cover_letter ? (
                <div className="space-y-4">
                  {application.resume && (
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div className="ml-4">
                          <p className="font-medium">Resume</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {application.resume}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">View</Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {application.cover_letter && (
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center">
                        <FileText className="h-8 w-8 text-green-500" />
                        <div className="ml-4">
                          <p className="font-medium">Cover Letter</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {application.cover_letter}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">View</Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No documents</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Upload your resume, cover letter, and other relevant documents.
                  </p>
                  <div className="mt-6">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" /> Upload Document
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

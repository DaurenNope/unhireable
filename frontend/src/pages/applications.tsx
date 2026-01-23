import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Briefcase, 
  MoreVertical,
  RefreshCw,
  AlertCircle,
  Edit,
  Trash2,
  FileText,
  Calendar,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Application, type ApplicationStatus, ApplicationStatuses } from '@/types/models';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { applicationApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/empty-state';

// Type for sortable columns
type SortableColumn = keyof Pick<Application, 'job_title' | 'company' | 'status' | 'applied_at' | 'updated_at'>;

// Format date helper function
const formatDate = (dateString?: string, formatStr = 'PP') => {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), formatStr);
  } catch {
    return 'Invalid date';
  }
};

// Status badge component with improved styling
const StatusBadge = ({ status }: { status: ApplicationStatus }) => {
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
  
  return (
    <Badge className={cn('whitespace-nowrap font-medium', config.className)}>
      {config.label}
    </Badge>
  );
};

// Application row component
const ApplicationRow = ({ 
  application, 
  onEdit, 
  onDelete 
}: { 
  application: Application;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) => {
  return (
    <TableRow className="group hover:bg-muted/30 transition-colors">
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <Link 
              to={`/applications/${application.id}`}
              className="font-semibold hover:text-primary transition-colors line-clamp-1"
            >
              {application.job_title || 'Untitled Application'}
            </Link>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span className="line-clamp-1">{application.company || 'No company'}</span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={application.status} />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {application.applied_at ? formatDate(application.applied_at, 'MMM d, yyyy') : 'N/A'}
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="text-sm text-muted-foreground">
          {application.updated_at ? formatDate(application.updated_at, 'MMM d, yyyy') : 'N/A'}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuItem onClick={() => application.id && onEdit(application.id)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600"
              onClick={() => application.id && onDelete(application.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

// Skeleton loader for application rows
const ApplicationRowSkeleton = () => (
  <TableRow>
    <TableCell>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </TableCell>
    <TableCell>
      <Skeleton className="h-6 w-24" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-24" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-24" />
    </TableCell>
    <TableCell className="text-right">
      <Skeleton className="ml-auto h-8 w-8" />
    </TableCell>
  </TableRow>
);

export default function Applications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [sortBy] = useState<SortableColumn>('applied_at');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Fetch applications using React Query
  const { data: applicationsData = [], isLoading: appsLoading, error: appsError, refetch } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      try {
        return await applicationApi.list();
      } catch (err: unknown) {
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
      result = result.filter(app => 
        (app.job_title?.toLowerCase().includes(term)) ||
        (app.company?.toLowerCase().includes(term)) ||
        (app.notes?.toLowerCase().includes(term))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(app => app.status === statusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (aValue === bValue) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
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

  const handleEdit = (applicationId: number) => {
    navigate(`/applications/${applicationId}`);
  };

  const handleDelete = async (applicationId: number) => {
    if (!window.confirm('Are you sure you want to delete this application?')) return;
    
    try {
      await applicationApi.delete(applicationId);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    } catch (err: unknown) {
      console.error('Failed to delete application:', err);
      alert('Failed to delete application. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Card className="border-destructive/50 bg-destructive/5 max-w-md">
          <CardContent className="pt-6">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive mx-auto" />
            <h2 className="mb-2 text-2xl font-bold">Something went wrong</h2>
            <p className="mb-6 text-muted-foreground">{error}</p>
            <Button onClick={handleRetry} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-b from-background to-muted/20 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Applications
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your job applications
          </p>
        </div>
        <Button asChild className="shadow-lg">
          <Link to="/applications/new" className="flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border/40 shadow-md">
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                className="pl-9 bg-background/50 backdrop-blur-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'all')}
              >
                <option value="all">All Statuses</option>
                <option value={ApplicationStatuses.PREPARING}>Preparing</option>
                <option value={ApplicationStatuses.SUBMITTED}>Submitted</option>
                <option value={ApplicationStatuses.INTERVIEW_SCHEDULED}>Interview Scheduled</option>
                <option value={ApplicationStatuses.OFFER_RECEIVED}>Offer Received</option>
                <option value={ApplicationStatuses.REJECTED}>Rejected</option>
                <option value={ApplicationStatuses.WITHDRAWN}>Withdrawn</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleRetry}
                disabled={isLoading}
                title="Refresh applications"
                className="h-10 w-10"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card className="overflow-hidden border-border/40 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-muted/30 to-muted/10">
          <CardTitle className="text-xl font-bold">Your Applications</CardTitle>
          <CardDescription>
            {displayedApplications.length} application{displayedApplications.length === 1 ? '' : 's'} 
            {applications.length !== displayedApplications.length && ` of ${applications.length} total`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="font-semibold">Position</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold">Applied Date</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold">Last Updated</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(3).fill(0).map((_, i) => <ApplicationRowSkeleton key={i} />)
                ) : displayedApplications.length > 0 ? (
                  displayedApplications.map((application) => (
                    <ApplicationRow 
                      key={application.id} 
                      application={application}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <EmptyState
                        icon={FileText}
                        title={searchTerm || statusFilter !== 'all' ? "No applications match your filters" : "No applications yet"}
                        description={
                          searchTerm || statusFilter !== 'all'
                            ? "Try adjusting your search terms or filters to find what you're looking for."
                            : "Start tracking your job applications. Create your first application to get started!"
                        }
                        action={
                          !searchTerm && statusFilter === 'all'
                            ? {
                                label: "Create Application",
                                onClick: () => navigate('/applications/new'),
                                icon: Plus,
                              }
                            : {
                                label: "Clear filters",
                                onClick: () => {
                                  setSearchTerm('');
                                  setStatusFilter('all');
                                },
                              }
                        }
                        className="py-8"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

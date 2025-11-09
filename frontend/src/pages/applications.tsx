import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Briefcase, 
  MoreVertical,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Application, type ApplicationStatus, ApplicationStatuses } from '@/types/models';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { applicationApi } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Type for sortable columns
type SortableColumn = keyof Pick<Application, 'job_title' | 'company' | 'status' | 'applied_at' | 'updated_at'>;

// Format date helper function
const formatDate = (dateString?: string, formatStr = 'PP') => {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), formatStr);
  } catch (e) {
    return 'Invalid date';
  }
};


// Status badge component
const StatusBadge = ({ status }: { status: ApplicationStatus }) => {
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
  
  return (
    <Badge className={cn('whitespace-nowrap', config.className)}>
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
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <div>
            <div className="font-medium">{application.job_title || 'Untitled Application'}</div>
            <div className="text-sm text-muted-foreground">{application.company || 'No company'}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={application.status} />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {application.applied_at ? formatDate(application.applied_at) : 'N/A'}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {application.updated_at ? formatDate(application.updated_at) : 'N/A'}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
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
      } catch (err: any) {
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

  // Sort function
  const sortApplications = (a: Application, b: Application) => {
    const aValue = a[sortBy] || '';
    const bValue = b[sortBy] || '';
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  };

  const displayedApplications = [...filteredAndSortedApplications].sort(sortApplications);

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
    } catch (err) {
      console.error('Failed to delete application:', err);
      alert('Failed to delete application. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="container mx-auto flex h-[60vh] flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-2xl font-bold">Something went wrong</h2>
        <p className="mb-6 text-muted-foreground">{error}</p>
        <Button onClick={handleRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Applications</h1>
            <p className="text-muted-foreground">
              Track and manage your job applications
            </p>
          </div>
          <div className="flex space-x-2">
            <Button asChild>
              <Link to="/applications/new" className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Add Application
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search applications..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleRetry}
              disabled={isLoading}
              title="Refresh applications"
              className="h-9 w-9"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableBody>
              {isLoading ? (
                // Show skeleton loaders while loading
                Array(3).fill(0).map((_, i) => <ApplicationRowSkeleton key={i} />)
              ) : displayedApplications.length > 0 ? (
                // Show applications
                displayedApplications.map((application) => (
                  <ApplicationRow 
                    key={application.id} 
                    application={application}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))
              ) : (
                // Show empty state
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Briefcase className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {searchTerm || statusFilter !== 'all' 
                          ? 'No applications match your filters.'
                          : 'No applications found. Get started by adding one.'}
                      </p>
                      <Button asChild variant="outline" className="mt-2">
                        <Link to="/applications/new">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Application
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

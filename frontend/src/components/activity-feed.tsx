import { useQuery } from '@tanstack/react-query';
import { activityApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Briefcase, 
  FileText, 
  UserPlus, 
  Calendar, 
  Trash2, 
  CheckCircle, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
  limit?: number;
  entityType?: string;
  className?: string;
}

const getActivityIcon = (entityType: string, action: string) => {
  if (action === 'deleted') {
    return <Trash2 className="h-4 w-4 text-destructive" />;
  }
  if (action === 'status_changed') {
    return <CheckCircle className="h-4 w-4 text-primary" />;
  }
  
  switch (entityType) {
    case 'job':
      return <Briefcase className="h-4 w-4 text-blue-500" />;
    case 'application':
      return <FileText className="h-4 w-4 text-green-500" />;
    case 'contact':
      return <UserPlus className="h-4 w-4 text-purple-500" />;
    case 'interview':
      return <Calendar className="h-4 w-4 text-orange-500" />;
    case 'document':
      return <FileText className="h-4 w-4 text-indigo-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getActivityColor = (entityType: string, action: string) => {
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

export function ActivityFeed({ limit = 10, entityType, className }: ActivityFeedProps) {
  const { data: activities, isLoading, error } = useQuery({
    queryKey: ['activities', entityType, limit],
    queryFn: () => activityApi.list(entityType, limit),
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest job search activities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest job search activities</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load activities. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest job search activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No activity yet</p>
            <p className="text-sm">Start creating jobs and applications to see activity here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest job search activities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${getActivityColor(activity.entity_type, activity.action)} bg-muted/50 hover:bg-muted/70 transition-colors`}
            >
              <div className="mt-0.5">
                {getActivityIcon(activity.entity_type, activity.action)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none">
                  {activity.description || `${activity.action} ${activity.entity_type}`}
                </p>
                {activity.created_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

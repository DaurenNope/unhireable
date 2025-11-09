import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { jobApi, applicationApi, interviewApi } from '@/api/client';
import type { Job, Application, ApplicationStatus, Interview } from '@/types/models';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Legend,
  Cell
} from 'recharts';

// Extended Application type for dashboard display (with job info)
type ApplicationWithJob = Application & {
  job: Job | undefined;
  job_title: string | undefined; // Derived from job.title
  company: string | undefined; // Derived from job.company
}

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ActivityFeed } from '@/components/activity-feed';

// Icons
import { 
  Calendar, 
  Briefcase, 
  CheckCircle, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Plus, 
  Search, 
  Filter, 
  X, 
  FileText, 
  TrendingUp, 
  MessageSquare, 
  CalendarDays, 
  FileSearch,
  ChevronDown
} from 'lucide-react';


interface DashboardStats {
  totalApplications: number;
  interviewsThisWeek: number;
  offersReceived: number;
  applicationRate: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: applicationsData, isLoading: applicationsLoading, refetch: refetchApplications } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      try {
        return await applicationApi.list();
      } catch (err: any) {
        console.error('Failed to fetch applications:', err);
        throw err;
      }
    },
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobApi.list(),
  });

  const { data: interviewsData, isLoading: interviewsLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewApi.list(),
  });

  const applications: Application[] = applicationsData || [];
  const jobs: Job[] = jobsData || [];
  const allInterviews: Interview[] = interviewsData || [];
  
  const isLoading = applicationsLoading || jobsLoading || interviewsLoading;

  // Debug logging
  useEffect(() => {
    if (!isLoading) {
      console.log('Dashboard Data:', {
        applications: applications.length,
        jobs: jobs.length,
        interviews: allInterviews.length,
        applicationsData: applications,
        jobsData: jobs,
      });
    }
  }, [applications, jobs, allInterviews, isLoading]);

  // Enrich applications with job data for display
  const applicationsWithJobs: ApplicationWithJob[] = applications.map(app => {
    const job = jobs.find(j => j.id === app.job_id);
    return {
      ...app,
      job: job,
      job_title: job?.title,
      company: job?.company,
    } as ApplicationWithJob;
  });

  // Get upcoming interviews (not completed, scheduled in future)
  const upcomingInterviews = useMemo(() => {
    const now = new Date();
    return allInterviews
      .filter(interview => {
        if (interview.completed) return false;
        if (!interview.scheduled_at) return false;
        const scheduledDate = new Date(interview.scheduled_at);
        return scheduledDate >= now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduled_at || 0);
        const dateB = new Date(b.scheduled_at || 0);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5)
      .map(interview => {
        const application = applications.find(app => app.id === interview.application_id);
        const job = application ? jobs.find(j => j.id === application.job_id) : null;
        return {
          ...interview,
          jobTitle: job?.title || application?.job_title || 'Unknown',
          company: job?.company || application?.company || 'Unknown',
        };
      });
  }, [allInterviews, applications, jobs]);


  // Get recent applications (last 5, sorted by updated_at)
  const recentApplications = useMemo(() => {
    return [...applicationsWithJobs]
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0);
        const dateB = new Date(b.updated_at || b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
  }, [applicationsWithJobs]);

  // Get application status counts (using correct backend status values)
  const statusCounts = {
    applied: applications.filter(app => app.status === 'submitted').length,
    interview: applications.filter(app => app.status === 'interview_scheduled').length,
    offer: applications.filter(app => app.status === 'offer_received').length,
    rejected: applications.filter(app => app.status === 'rejected').length
  };

  // Calculate stats from applications
  const displayStats: DashboardStats = {
    totalApplications: applications.length,
    interviewsThisWeek: upcomingInterviews.length,
    offersReceived: applications.filter(app => app.status === 'offer_received').length,
    applicationRate: applications.length > 0 
      ? Math.round((applications.filter(app => app.status === 'submitted').length / applications.length) * 100)
      : 0,
  };


  // Prepare chart data for BarChart (Application Status over time)
  const chartData = [
    { name: 'Preparing', total: applications.filter(app => app.status === 'preparing').length },
    { name: 'Submitted', total: applications.filter(app => app.status === 'submitted').length },
    { name: 'Interview', total: applications.filter(app => app.status === 'interview_scheduled').length },
    { name: 'Offer', total: applications.filter(app => app.status === 'offer_received').length },
    { name: 'Rejected', total: applications.filter(app => app.status === 'rejected').length },
    { name: 'Withdrawn', total: applications.filter(app => app.status === 'withdrawn').length },
  ].filter(item => item.total > 0); // Only show statuses with applications

  // Prepare pie chart data for Status Distribution
  const pieChartData = [
    { name: 'Preparing', value: applications.filter(app => app.status === 'preparing').length, fill: '#94a3b8' },
    { name: 'Submitted', value: applications.filter(app => app.status === 'submitted').length, fill: '#3b82f6' },
    { name: 'Interview Scheduled', value: applications.filter(app => app.status === 'interview_scheduled').length, fill: '#eab308' },
    { name: 'Offer Received', value: applications.filter(app => app.status === 'offer_received').length, fill: '#22c55e' },
    { name: 'Rejected', value: applications.filter(app => app.status === 'rejected').length, fill: '#ef4444' },
    { name: 'Withdrawn', value: applications.filter(app => app.status === 'withdrawn').length, fill: '#6b7280' },
  ].filter(item => item.value > 0); // Only show statuses with applications

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's what's happening with your job search.</p>
          </div>
          <Skeleton className="h-10 w-[150px]" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
        
        <div className="space-y-6">
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your job search.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search applications..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button className="gap-2" asChild>
            <Link to="/applications/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Application</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.totalApplications}</div>
            <p className="text-xs text-muted-foreground">
              {statusCounts.applied} active, {statusCounts.interview} in interview
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.interviewsThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              {displayStats.interviewsThisWeek} scheduled this week
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offers</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.offersReceived}</div>
            <p className="text-xs text-muted-foreground">
              {displayStats.offersReceived} offers received
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Application Rate</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.applicationRate}%</div>
            <div className="mt-2">
              <Progress value={displayStats.applicationRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Applications Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Recent Applications</CardTitle>
              <CardDescription>Your most recent job applications</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <Filter className="h-3.5 w-3.5" />
                <span>Filter</span>
              </Button>
              <Button size="sm" className="h-9 gap-1">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Application</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[300px]">Position</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Next Step</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentApplications.length > 0 ? (
                  recentApplications.map((application) => {
                    const appInterviews = allInterviews.filter(i => i.application_id === application.id && !i.completed);
                    const nextInterview = appInterviews.length > 0 ? appInterviews.sort((a, b) => 
                      new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime()
                    )[0] : null;
                    
                    return (
                      <TableRow key={application.id} className="group hover:bg-muted/20">
                        <TableCell className="font-medium">
                          <Link 
                            to={`/applications/${application.id}`} 
                            className="flex items-center gap-2 hover:underline hover:text-primary"
                          >
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <span className="line-clamp-1">{application.job_title || application.job?.title || 'N/A'}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{application.company || application.job?.company || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                          <span 
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                              getStatusVariant(application.status)
                            )}
                          >
                            {application.status === 'submitted' && <FileText className="h-3 w-3 mr-1" />}
                            {application.status === 'interview_scheduled' && <MessageSquare className="h-3 w-3 mr-1" />}
                            {application.status === 'offer_received' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {application.status === 'rejected' && <X className="h-3 w-3 mr-1" />}
                            {application.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            {application.applied_at 
                              ? new Date(application.applied_at).toLocaleDateString()
                              : 'Not applied'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {nextInterview ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium">{nextInterview.type}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(nextInterview.scheduled_at || '').toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No next step</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[160px]">
                              <DropdownMenuItem onClick={() => navigate(`/applications/${application.id}`)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/applications/${application.id}#interviews`)}>
                                <CalendarDays className="mr-2 h-4 w-4" />
                                Schedule
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={async () => {
                                  if (window.confirm('Are you sure you want to delete this application?')) {
                                    try {
                                      await applicationApi.delete(application.id!);
                                      refetchApplications();
                                    } catch (err) {
                                      console.error('Failed to delete application:', err);
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <FileSearch className="h-10 w-10 text-muted-foreground" />
                        <p className="text-muted-foreground">No applications found</p>
                        <Button variant="outline" size="sm" className="mt-2" asChild>
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
        </CardContent>
        <CardFooter className="border-t px-6 py-3">
          <div className="text-xs text-muted-foreground">
            Showing <strong>1-{Math.min(recentApplications.length, 5)}</strong> of <strong>{applications.length}</strong> applications
            {applications.length > 5 && (
              <Button variant="link" className="ml-2 h-auto p-0 text-xs" asChild>
                <Link to="/applications">View all</Link>
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Application Status Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Application Status</CardTitle>
                <CardDescription>Overview of your job applications</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <span>This Month</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                      }}
                      itemStyle={{
                        color: 'hsl(var(--foreground))'
                      }}
                      labelStyle={{
                        color: 'hsl(var(--muted-foreground))',
                        fontWeight: 500
                      }}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="url(#colorTotal)" 
                      radius={[4, 4, 0, 0]} 
                      animationDuration={1500}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No applications yet</p>
                    <p className="text-sm">Create applications to see statistics</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Status Distribution</CardTitle>
            <CardDescription>Breakdown of your applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={(entry: any) => {
                        const percent = typeof entry.percent === 'number' ? entry.percent : 0;
                        const name = typeof entry.name === 'string' ? entry.name : '';
                        return percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : '';
                      }}
                      labelLine={false}
                      animationDuration={1000}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value: number) => [`${value} applications`, 'Count']}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{
                        paddingTop: '20px',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No data to display</p>
                    <p className="text-sm">Create applications to see distribution</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <div className="mt-6">
        <ActivityFeed limit={10} />
      </div>
    </div>
  );
}

function getStatusVariant(status: ApplicationStatus | string) {
  switch (status) {
    case 'submitted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'interview_scheduled':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'offer_received':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'preparing':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'withdrawn':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}


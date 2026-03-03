import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Pause,
  Activity,
  Mail,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  TrendingUp,
  Target,
  Calendar,
  RefreshCw,
  Bell,
  Shield,
} from 'lucide-react';

import ApplyModeSelector from '@/components/apply-mode-selector';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

import type {
  AutoPilotStatus,
  AutoPilotConfig,
  PipelineResult,
  Alert,
  ClassifiedEmail,
} from '@/types/autopilot';

export default function AutoPilotPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch status
  const { data: status, isLoading: statusLoading } = useQuery<AutoPilotStatus>({
    queryKey: ['autopilot-status'],
    queryFn: () => invoke('get_autopilot_status'),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch config
  const { data: config, isLoading: configLoading } = useQuery<AutoPilotConfig>({
    queryKey: ['autopilot-config'],
    queryFn: () => invoke('get_autopilot_config'),
  });

  // Start mutation
  const startMutation = useMutation({
    mutationFn: () => invoke('start_autopilot'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autopilot-status'] });
    },
  });

  // Stop mutation
  const stopMutation = useMutation({
    mutationFn: () => invoke('stop_autopilot'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autopilot-status'] });
    },
  });

  // Run now mutation
  const runNowMutation = useMutation<PipelineResult>({
    mutationFn: () => invoke('autopilot_run_now'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autopilot-status'] });
    },
  });

  // Dismiss alert mutation
  const dismissAlertMutation = useMutation({
    mutationFn: (index: number) => invoke('dismiss_autopilot_alert', { index }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autopilot-status'] });
    },
  });

  const formatUptime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getAlertColor = (level: Alert['level']) => {
    switch (level) {
      case 'Success': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Info': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Warning': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Error': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getEmailCategoryColor = (category: ClassifiedEmail['category']) => {
    switch (category) {
      case 'InterviewInvitation': return 'bg-green-500';
      case 'Offer': return 'bg-emerald-500';
      case 'Assessment': return 'bg-blue-500';
      case 'Rejection': return 'bg-red-500';
      case 'InformationRequest': return 'bg-yellow-500';
      case 'ApplicationConfirmation': return 'bg-gray-500';
      case 'RecruiterOutreach': return 'bg-purple-500';
      default: return 'bg-gray-400';
    }
  };

  if (statusLoading || configLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isRunning = status?.running ?? false;
  const stats = status?.stats;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-yellow-500" />
            Auto-Pilot Mode
          </h1>
          <p className="text-muted-foreground mt-1">
            Fully automated job hunting - from discovery to application
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Apply Mode Selector - Compact */}
          <ApplyModeSelector 
            currentMode={status?.apply_mode} 
            compact 
          />

          {isRunning && (
            <Badge variant="outline" className="text-green-500 border-green-500 animate-pulse">
              <Activity className="h-3 w-3 mr-1" />
              Running for {formatUptime(status?.uptime_secs ?? 0)}
            </Badge>
          )}

          <Button
            size="lg"
            variant={isRunning ? 'destructive' : 'default'}
            onClick={() => isRunning ? stopMutation.mutate() : startMutation.mutate()}
            disabled={startMutation.isPending || stopMutation.isPending}
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop Auto-Pilot
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Auto-Pilot
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${runNowMutation.isPending ? 'animate-spin' : ''}`} />
            Run Now
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jobs Discovered</p>
                <p className="text-2xl font-bold">{stats?.total_jobs_discovered ?? 0}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Applications</p>
                <p className="text-2xl font-bold">{stats?.total_applications ?? 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Interviews</p>
                <p className="text-2xl font-bold">{stats?.total_interviews ?? 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offers</p>
                <p className="text-2xl font-bold">{stats?.total_offers ?? 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{stats?.applications_this_week ?? 0}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {status?.alerts && status.alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${getAlertColor(alert.level)}`}
                >
                  <div className="flex items-center gap-2">
                    {alert.level === 'Warning' && <AlertTriangle className="h-4 w-4" />}
                    {alert.level === 'Error' && <XCircle className="h-4 w-4" />}
                    {alert.level === 'Success' && <CheckCircle className="h-4 w-4" />}
                    {alert.level === 'Info' && <Activity className="h-4 w-4" />}
                    <span>{alert.message}</span>
                    {alert.action_required && (
                      <Badge variant="outline" className="ml-2">Action Required</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissAlertMutation.mutate(index)}
                  >
                    Dismiss
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pipeline Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Pipeline Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={isRunning ? 'default' : 'secondary'}>
                    {isRunning ? 'Active' : 'Idle'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Schedule Mode</span>
                  <span>{status?.mode ?? 'Manual'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Apply Mode</span>
                  <Badge variant="outline" className="font-normal">
                    {status?.apply_mode?.icon} {status?.apply_mode?.name ?? 'Manual'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Runs Today</span>
                  <span>{status?.scheduler.runs_today ?? 0} / {status?.scheduler.max_runs_per_day ?? 3}</span>
                </div>
                {status?.scheduler.next_run && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Next Run</span>
                    <span>{new Date(status.scheduler.next_run).toLocaleTimeString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email Monitor */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Monitor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={status?.email_monitor.connected ? 'default' : 'secondary'}>
                    {status?.email_monitor.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Emails Processed</span>
                  <span>{status?.email_monitor.emails_processed ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Actions</span>
                  <Badge variant={status?.email_monitor.pending_actions ? 'destructive' : 'secondary'}>
                    {status?.email_monitor.pending_actions ?? 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Success Rates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Success Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Response Rate</span>
                    <span>{((stats?.response_rate ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={(stats?.response_rate ?? 0) * 100} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Interview Rate</span>
                    <span>{((stats?.interview_rate ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={(stats?.interview_rate ?? 0) * 100} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Match Score</span>
                  <span>{(stats?.avg_match_score ?? 0).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Safety Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Safety Limits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dry Run Mode</span>
                  <Badge variant={config?.automation.application.dry_run ? 'secondary' : 'destructive'}>
                    {config?.automation.application.dry_run ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto Submit</span>
                  <Badge variant={config?.automation.application.auto_submit ? 'destructive' : 'secondary'}>
                    {config?.automation.application.auto_submit ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Weekly Limit</span>
                  <span>{stats?.applications_this_week ?? 0} / {config?.safety.max_applications_per_week ?? 50}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Automation events and actions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {status?.recent_activity && status.recent_activity.length > 0 ? (
                    status.recent_activity.map((activity, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          activity.success ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
                        }`}
                      >
                        {activity.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{activity.action}</div>
                          <div className="text-sm text-muted-foreground">{activity.details}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(activity.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No activity yet. Start auto-pilot to see activity here.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle>Email Classifications</CardTitle>
              <CardDescription>Recruiter responses automatically categorized</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {status?.email_monitor.recent_emails && status.email_monitor.recent_emails.length > 0 ? (
                    status.email_monitor.recent_emails.map((email) => (
                      <div
                        key={email.id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                      >
                        <div className={`w-2 h-2 rounded-full mt-2 ${getEmailCategoryColor(email.category)}`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{email.subject}</span>
                            <Badge variant="outline">{email.category}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            From: {email.from}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {email.body_preview}
                          </div>
                          {email.requires_action && email.suggested_action && (
                            <div className="mt-2 p-2 bg-yellow-500/10 rounded text-sm">
                              <strong>Action:</strong> {email.suggested_action}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-2">
                            {new Date(email.received_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No emails processed yet. Enable email monitoring to see classifications here.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          {/* Apply Mode Selector - Full Card */}
          <ApplyModeSelector currentMode={status?.apply_mode} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Search Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Search Queries</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {config?.automation.search.queries.map((q, i) => (
                      <Badge key={i} variant="secondary">{q}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Job Sources</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {config?.automation.search.sources.map((s, i) => (
                      <Badge key={i} variant="outline">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Min Match Score</Label>
                  <span>{config?.automation.filters.min_match_score}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Remote Only</Label>
                  <Switch checked={config?.automation.filters.remote_only} disabled />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Scheduling Enabled</Label>
                  <Switch checked={config?.schedule.enabled} disabled />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Mode</Label>
                  <Badge variant="outline">{config?.schedule.mode}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Run Time</Label>
                  <span>{config?.schedule.run_time ?? 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Max Runs/Day</Label>
                  <span>{config?.schedule.max_runs_per_day}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Pause on Weekends</Label>
                  <Switch checked={config?.schedule.pause_on_weekends} disabled />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Application Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Dry Run Mode</Label>
                  <Switch checked={config?.automation.application.dry_run} disabled />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Auto Submit</Label>
                  <Switch checked={config?.automation.application.auto_submit} disabled />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Max Applications/Run</Label>
                  <span>{config?.automation.application.max_applications_per_run}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Delay Between Apps</Label>
                  <span>{config?.automation.application.delay_between_applications}s</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Safety Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Max Applications/Week</Label>
                  <span>{config?.safety.max_applications_per_week}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Max Per Company</Label>
                  <span>{config?.safety.max_per_company}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Pause After Rejections</Label>
                  <span>{config?.safety.pause_after_rejections}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Confirm First N</Label>
                  <span>{config?.safety.confirm_first_n}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

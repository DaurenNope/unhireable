// Auto-Pilot Types

export interface AutoPilotConfig {
  enabled: boolean;
  automation: AutomationConfig;
  schedule: ScheduleConfig;
  email_monitor: EmailMonitorConfig;
  intelligence: IntelligenceConfig;
  safety: SafetyConfig;
}

export interface AutomationConfig {
  enabled: boolean;
  search: {
    queries: string[];
    sources: string[];
    interval_minutes: number;
    max_jobs_per_run: number;
  };
  filters: {
    min_match_score: number;
    remote_only: boolean;
    min_salary?: number;
    required_keywords: string[];
    excluded_keywords: string[];
    experience_levels: string[];
    preferred_locations: string[];
    excluded_companies: string[];
    max_job_age_days?: number;
  };
  documents: {
    generate_resume: boolean;
    generate_cover_letter: boolean;
    use_ai_enhancement: boolean;
    resume_template: string;
    cover_letter_template: string;
    export_to_pdf: boolean;
  };
  application: {
    max_applications_per_day: number;
    max_applications_per_run: number;
    auto_submit: boolean;
    dry_run: boolean;
    delay_between_applications: number;
    skip_already_applied: boolean;
    ats_priority: string[];
  };
  notifications: {
    desktop_notifications: boolean;
    email_notifications: boolean;
    notification_email?: string;
    notify_on_new_jobs: boolean;
    notify_on_application: boolean;
    notify_on_failure: boolean;
    daily_summary: boolean;
  };
  rate_limits: {
    max_requests_per_minute: number;
    source_delay_secs: number;
    random_delay_range_secs: number;
    respect_rate_limits: boolean;
  };
}

export interface ScheduleConfig {
  enabled: boolean;
  mode: ScheduleMode;
  run_time?: string;
  days_of_week: string[];
  interval_minutes?: number;
  max_runs_per_day: number;
  quiet_hours?: {
    start: string;
    end: string;
  };
  pause_on_weekends: boolean;
}

export type ScheduleMode = 'Interval' | 'Daily' | 'Weekly' | 'Continuous' | 'Manual';

export interface EmailMonitorConfig {
  enabled: boolean;
  check_interval_minutes: number;
  gmail_oauth_token?: string;
  filter_senders: string[];
  ignore_senders: string[];
  auto_categorize: boolean;
  auto_respond_confirmations: boolean;
}

export interface IntelligenceConfig {
  learn_from_success: boolean;
  adaptive_threshold: boolean;
  track_company_success: boolean;
  prioritize_similar_jobs: boolean;
}

export interface SafetyConfig {
  max_applications_per_week: number;
  max_per_company: number;
  min_hours_between_runs: number;
  pause_after_rejections: number;
  confirm_first_n: number;
}

export interface AutoPilotStatus {
  enabled: boolean;
  running: boolean;
  mode: string;
  apply_mode: ApplyModeStatus;
  uptime_secs: number;
  started_at?: string;
  pipeline: PipelineStatus;
  scheduler: SchedulerStatus;
  email_monitor: EmailMonitorStatus;
  stats: AutoPilotStats;
  recent_activity: ActivityEntry[];
  alerts: Alert[];
}

// Apply Mode Types
export interface ApplyModeStatus {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface ApplyModeInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  is_headless: boolean;
  auto_submit: boolean;
  requires_confirmation: boolean;
  min_reliability: string;
}

export interface PreApplyCheckResult {
  url: string;
  mode: string;
  ats_type?: string;
  reliability_tier: string;
  can_proceed: boolean;
  reason: string;
  recommended_mode?: string;
}

export interface PipelineStatus {
  last_run?: string;
  last_result?: string;
  jobs_discovered_today: number;
  applications_today: number;
  successful_today: number;
}

export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  mode: ScheduleMode;
  runs_today: number;
  max_runs_per_day: number;
  last_run?: string;
  next_run?: string;
  last_result_summary?: string;
}

export interface EmailMonitorStatus {
  enabled: boolean;
  connected: boolean;
  last_check?: string;
  emails_processed: number;
  pending_actions: number;
  recent_emails: ClassifiedEmail[];
}

export interface AutoPilotStats {
  total_jobs_discovered: number;
  total_applications: number;
  total_interviews: number;
  total_offers: number;
  total_rejections: number;
  response_rate: number;
  interview_rate: number;
  applications_this_week: number;
  avg_match_score: number;
  best_performing_source?: string;
}

export interface ActivityEntry {
  timestamp: string;
  action: string;
  details: string;
  success: boolean;
}

export interface Alert {
  level: AlertLevel;
  message: string;
  timestamp: string;
  action_required: boolean;
}

export type AlertLevel = 'Info' | 'Warning' | 'Error' | 'Success';

export interface ClassifiedEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body_preview: string;
  received_at: string;
  category: EmailCategory;
  confidence: number;
  extracted_data: ExtractedEmailData;
  requires_action: boolean;
  suggested_action?: string;
}

export type EmailCategory =
  | 'InterviewInvitation'
  | 'InformationRequest'
  | 'Rejection'
  | 'ApplicationConfirmation'
  | 'Assessment'
  | 'Offer'
  | 'FollowUp'
  | 'RecruiterOutreach'
  | 'Unrelated';

export interface ExtractedEmailData {
  company_name?: string;
  job_title?: string;
  recruiter_name?: string;
  interview_date?: string;
  interview_time?: string;
  interview_type?: string;
  calendar_link?: string;
  deadline?: string;
  salary_mentioned?: string;
  next_steps: string[];
}

export interface PipelineResult {
  success: boolean;
  stage_results: StageResult[];
  jobs_discovered: JobSummary[];
  jobs_applied: ApplicationSummary[];
  errors: PipelineError[];
  duration_secs: number;
}

export interface StageResult {
  stage: string;
  success: boolean;
  items_processed: number;
  items_passed: number;
  duration_secs: number;
  message?: string;
}

export interface JobSummary {
  id: number;
  title: string;
  company: string;
  source: string;
  match_score: number;
  url: string;
}

export interface ApplicationSummary {
  job_id: number;
  job_title: string;
  company: string;
  success: boolean;
  ats_type?: string;
  message: string;
}

export interface PipelineError {
  stage: string;
  message: string;
  job_id?: number;
  recoverable: boolean;
}

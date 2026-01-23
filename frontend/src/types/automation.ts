// Automation Pipeline Types

export interface AutomationConfig {
  enabled: boolean;
  search: SearchConfig;
  filters: FilterConfig;
  documents: DocumentConfig;
  application: ApplicationConfig;
  notifications: NotificationConfig;
  rate_limits: RateLimitConfig;
}

export interface SearchConfig {
  queries: string[];
  sources: string[];
  interval_minutes: number;
  max_jobs_per_run: number;
}

export interface FilterConfig {
  min_match_score: number;
  remote_only: boolean;
  min_salary?: number;
  required_keywords: string[];
  excluded_keywords: string[];
  experience_levels: string[];
  preferred_locations: string[];
  excluded_companies: string[];
  max_job_age_days?: number;
}

export interface DocumentConfig {
  generate_resume: boolean;
  generate_cover_letter: boolean;
  use_ai_enhancement: boolean;
  resume_template: string;
  cover_letter_template: string;
  export_to_pdf: boolean;
}

export interface ApplicationConfig {
  max_applications_per_day: number;
  max_applications_per_run: number;
  auto_submit: boolean;
  dry_run: boolean;
  delay_between_applications: number;
  skip_already_applied: boolean;
  ats_priority: string[];
}

export interface NotificationConfig {
  desktop_notifications: boolean;
  email_notifications: boolean;
  notification_email?: string;
  notify_on_new_jobs: boolean;
  notify_on_application: boolean;
  notify_on_failure: boolean;
  daily_summary: boolean;
}

export interface RateLimitConfig {
  max_requests_per_minute: number;
  source_delay_secs: number;
  random_delay_range_secs: number;
  respect_rate_limits: boolean;
}

export interface AutomationStatus {
  running: boolean;
  current_stage?: string;
  started_at?: string;
  last_completed_at?: string;
  next_run_at?: string;
  current_run?: RunStats;
  total_stats: AutomationStats;
  recent_activity: ActivityLogEntry[];
  last_errors: string[];
}

export interface RunStats {
  jobs_scraped: number;
  jobs_matched: number;
  jobs_filtered: number;
  documents_generated: number;
  applications_attempted: number;
  applications_successful: number;
  applications_failed: number;
  notifications_sent: number;
  duration_secs: number;
}

export interface AutomationStats {
  total_runs: number;
  total_jobs_discovered: number;
  total_jobs_matched: number;
  total_applications: number;
  successful_applications: number;
  failed_applications: number;
  applications_by_source: Record<string, number>;
  applications_by_ats: Record<string, number>;
  success_rate_by_ats: Record<string, number>;
  avg_match_score: number;
  highest_match_score: number;
  total_automation_time_secs: number;
  applications_last_7_days: number;
  applications_last_30_days: number;
}

export interface ActivityLogEntry {
  timestamp: string;
  stage: string;
  action: string;
  details?: string;
  success: boolean;
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

// Default configuration helper
export const getDefaultAutomationConfig = (): AutomationConfig => ({
  enabled: false,
  search: {
    queries: ['senior software engineer', 'backend developer'],
    sources: ['remoteok', 'wellfound', 'remotive'],
    interval_minutes: 60,
    max_jobs_per_run: 50,
  },
  filters: {
    min_match_score: 60,
    remote_only: true,
    min_salary: 80000,
    required_keywords: [],
    excluded_keywords: ['intern', 'junior'],
    experience_levels: ['mid', 'senior'],
    preferred_locations: [],
    excluded_companies: [],
    max_job_age_days: 30,
  },
  documents: {
    generate_resume: true,
    generate_cover_letter: true,
    use_ai_enhancement: true,
    resume_template: 'resume_modern',
    cover_letter_template: 'cover_letter_professional',
    export_to_pdf: true,
  },
  application: {
    max_applications_per_day: 20,
    max_applications_per_run: 5,
    auto_submit: false,
    dry_run: true,
    delay_between_applications: 30,
    skip_already_applied: true,
    ats_priority: ['Greenhouse', 'Lever', 'Workable', 'AshbyHQ'],
  },
  notifications: {
    desktop_notifications: true,
    email_notifications: false,
    notify_on_new_jobs: true,
    notify_on_application: true,
    notify_on_failure: true,
    daily_summary: true,
  },
  rate_limits: {
    max_requests_per_minute: 10,
    source_delay_secs: 5,
    random_delay_range_secs: 3,
    respect_rate_limits: true,
  },
});

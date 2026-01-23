// Constants for ApplicationStatus
export const ApplicationStatuses = {
  PREPARING: 'preparing',
  SUBMITTED: 'submitted',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  REJECTED: 'rejected',
  OFFER_RECEIVED: 'offer_received',
  WITHDRAWN: 'withdrawn',
} as const;

export type ApplicationStatus = typeof ApplicationStatuses[keyof typeof ApplicationStatuses];

// Constants for DocumentType
export const DocumentTypes = {
  RESUME: 'resume' as const,
  COVER_LETTER: 'cover_letter' as const,
  OTHER: 'other' as const,
};

export type DocumentType = typeof DocumentTypes[keyof typeof DocumentTypes];

export interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
  email?: string | null;
  last_login_at?: string | null;
}

export interface AutomationHealth {
  profile_configured: boolean;
  missing_fields: string[];
  resume_documents: number;
  credential_platforms: string[];
  chromium_available: boolean;
  playwright_available: boolean;
}

export interface ResumeEnvironmentStatus {
  pdftotext_available: boolean;
  pdftoppm_available: boolean;
  tesseract_available: boolean;
}

// Base model with common fields
export interface BaseModel {
  id?: number;
  created_at?: string;
  updated_at?: string;
}

// Job Status (matches backend snake_case)
export type JobStatus = 
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offer'  // Note: backend uses 'offer', not 'offer_received'
  | 'rejected'
  | 'archived';

// Job model
export interface Job extends BaseModel {
  title: string;
  company: string;
  url: string;
  description?: string;
  requirements?: string;
  location?: string;
  salary?: string;
  source: string;
  status: JobStatus;
  match_score?: number | null; // Match score from 0.0 to 100.0, null if not calculated
}

// Recommended Job model (for recommendation system)
export interface RecommendedJob {
  job: Job;
  recommendation_score: number; // 0.0 to 100.0
  reasons: string[]; // Why this job was recommended
}

// Contact model
export interface Contact extends BaseModel {
  job_id: number;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  notes?: string;
}

// Interview model
export interface Interview extends BaseModel {
  application_id: number;
  type: string;
  scheduled_at: string;
  location?: string;
  notes?: string;
  completed: boolean;
}

// Document model
export interface Document extends BaseModel {
  application_id: number;
  name: string;
  file_path: string;
  document_type: DocumentType;
}

// Application model
export interface Application extends BaseModel {
  job_id: number;
  job_title?: string;
  company?: string;
  applied_at?: string;
  updated_at?: string;
  status: ApplicationStatus;
  notes?: string;
  resume?: string;
  cover_letter?: string;
  job?: Job;
  contacts?: Contact[];
  interviews?: Interview[];
  documents?: Document[];
}

// Activity model
export interface Activity extends BaseModel {
  entity_type: string; // 'job', 'application', 'contact', 'interview', 'document'
  entity_id: number;
  action: string; // 'created', 'updated', 'deleted', 'status_changed'
  description: string | null;
  metadata: string | null; // JSON string
}

// Credential model
export interface Credential extends BaseModel {
  platform: string;
  username?: string | null;
  email?: string | null;
  encrypted_password?: string | null;
  cookies?: string | null;
  tokens?: string | null;
  is_active: boolean;
  last_used_at?: string | null;
  expires_at?: string | null;
}

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

// Document Generation Types
export type DocumentFormat = 'Markdown' | 'HTML' | 'PDF' | 'Text';

export interface DocumentMetadata {
  title: string;
  job_title: string;
  company: string;
  generated_at: string;
  template_used: string;
  word_count: number;
}

export interface GeneratedDocument {
  content: string;
  format: DocumentFormat;
  metadata: DocumentMetadata;
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
}

export interface SkillsProfile {
  technical_skills: string[];
  soft_skills: string[];
  experience_years: Record<string, number>;
  proficiency_levels: Record<string, string>;
}

export interface ExperienceEntry {
  company: string;
  position: string;
  duration: string;
  description: string[];
  technologies: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  year: string;
  details?: string | null;
}

export interface UserProfile {
  personal_info: PersonalInfo;
  summary: string;
  skills: SkillsProfile;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: string[];
}

export interface JobAnalysis {
  extracted_keywords: string[];
  required_skills: string[];
  preferred_skills: string[];
  experience_level: string;
  company_tone: string;
  key_responsibilities: string[];
  match_score: number;
  job_title: string;
  company: string;
}

// Job Match Result (from matching system)
export interface JobMatchResult {
  job_id: number | null;
  job: Job;
  match_score: number; // 0.0 to 100.0
  skills_match: number; // 0.0 to 100.0
  experience_match: number; // 0.0 to 100.0
  location_match: number; // 0.0 to 100.0
  matched_skills: string[];
  missing_skills: string[];
  match_reasons: string[];
  experience_level: string; // "entry", "mid", "senior", "lead"
}

export type MatchQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor';

// Email Configuration Types
export interface EmailConfig {
  smtp_server: string;
  smtp_port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  use_ssl: boolean;
}

export interface NotificationConfig {
  email_enabled: boolean;
  email_config: EmailConfig;
  notify_on_new_jobs: boolean;
  notify_on_matches: boolean;
  min_match_score_for_notification: number;
  notify_daily_summary: boolean;
  desktop_notifications_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:mm format, e.g., "22:00"
  quiet_hours_end: string; // HH:mm format, e.g., "08:00"
  max_notifications_per_hour: number; // Limit notification frequency
}

// Scheduler Configuration Types
export interface SchedulerConfig {
  enabled: boolean;
  schedule: string; // Cron expression, e.g., "0 9 * * *" for 9 AM daily
  query: string; // Default search query
  sources: string[]; // Sources to scrape, empty for all
  min_match_score: number | null; // Minimum match score to notify
  send_notifications: boolean;
}

export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  schedule: string;
  query: string;
  sources: string[];
  min_match_score: number | null;
  send_notifications: boolean;
}

// Saved Search Types
export type AlertFrequency = 'hourly' | 'daily' | 'weekly' | 'never';

export interface SavedSearchFilters {
  remote_only?: boolean;
  min_match_score?: number | null;
  status?: string | null; // "all", "saved", "applied", etc.
  skill_filter?: string | null;
  preferred_locations?: string[];
  preferred_titles?: string[];
  preferred_companies?: string[];
  avoid_companies?: string[];
  required_skills?: string[];
  preferred_skills?: string[];
  min_salary?: number | null;
  job_types?: string[];
  industries?: string[];
  must_have_benefits?: string[];
  company_size?: string | null;
}

export interface SavedSearch extends BaseModel {
  name: string;
  query: string;
  sources: string[]; // ["remotive", "remoteok", "wellfound", "greenhouse"]
  filters: SavedSearchFilters;
  alert_frequency: AlertFrequency;
  min_match_score: number;
  enabled: boolean;
  last_run_at?: string | null;
}

// Application Mode Types
export type ApplicationMode = 'manual' | 'semi-auto' | 'yolo';

export interface ApplicationConfig {
  mode: ApplicationMode;
  auto_submit: boolean;
  auto_generate_documents: boolean;
  min_match_score: number; // Minimum match score to auto-apply
  batch_apply: boolean; // Apply to multiple jobs at once
  batch_size: number; // Number of jobs to apply to in batch
  delay_between_applications: number; // Delay in seconds between applications
}

export interface SkillStat {
  name: string;
  job_count: number;
  percentage: number;
}

export interface EntityStat {
  name: string;
  job_count: number;
  percentage: number;
}

export interface TrendStat {
  name: string;
  current_count: number;
  previous_count: number;
  delta_percentage: number;
}

export interface MarketInsights {
  timeframe_days: number;
  total_jobs_previous: number;
  total_jobs_considered: number;
  remote_percentage: number;
  onsite_percentage: number;
  trending_skills: SkillStat[];
  skill_trends: TrendStat[];
  skills_to_learn: SkillStat[];
  trending_roles: EntityStat[];
  role_trends: TrendStat[];
  top_companies: EntityStat[];
  top_locations: EntityStat[];
  sources_breakdown: EntityStat[];
}

export interface ApplicationResult {
  success: boolean;
  application_id?: number;
  message: string;
  applied_at?: string;
  ats_type?: string;
  errors: string[];
}

// Resume Analysis types
export interface ResumeAnalysis {
  personal_info: PersonalInfo;
  summary?: string | null;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: string[];
  raw_text: string;
  insights: AnalysisInsights;
}

export interface PersonalInfo {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
}

export interface ExperienceEntry {
  company?: string | null;
  position?: string | null;
  duration?: string | null;
  description: string[];
  technologies: string[];
}

export interface EducationEntry {
  institution?: string | null;
  degree?: string | null;
  year?: string | null;
  details?: string | null;
}

export interface AnalysisInsights {
  total_years_experience?: number | null;
  primary_skills: string[];
  skill_categories: string[];
  strengths: string[];
  recommendations: string[];
  ats_score?: number | null;
  ats_breakdown: AtsBreakdown[];
  hr_signals: HrSignal[];
  keyword_gaps: KeywordGap[];
  job_alignment?: JobAlignmentInsights | null;
}

export interface AtsBreakdown {
  system: string;
  score: number;
  verdict: string;
  highlights: string[];
  risks: string[];
}

export type HrSignalStatus = 'positive' | 'warning' | 'critical';

export interface HrSignal {
  status: HrSignalStatus;
  label: string;
  detail: string;
}

export interface KeywordGap {
  category: string;
  missing: string[];
}

export interface JobAlignmentInsights {
  dominant_role?: string | null;
  role_confidence: number;
  keyword_match: number;
  matched_keywords: string[];
  missing_keywords: string[];
}

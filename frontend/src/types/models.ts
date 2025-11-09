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

// Job and Application types that match our Rust backend
export interface Job {
  id?: number;
  title: string;
  company: string;
  url: string;
  description?: string | null;
  requirements?: string | null;
  location?: string | null;
  salary?: string | null;
  source: string;
  status: JobStatus;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Application {
  id?: number;
  job_id: number;
  status: ApplicationStatus;
  applied_at: string;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export enum JobStatus {
  Saved = 'saved',
  Applied = 'applied',
  Interviewing = 'interviewing',
  Offer = 'offer',
  Rejected = 'rejected',
  Archived = 'archived'
}

export enum ApplicationStatus {
  Applied = 'applied',
  InterviewScheduled = 'interview_scheduled',
  Interviewed = 'interviewed',
  OfferReceived = 'offer_received',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn'
}


// Form types
export interface JobFormData {
  title: string;
  company: string;
  url: string;
  description: string;
  requirements: string;
  location: string;
  salary: string;
  status: JobStatus;
}

export interface ApplicationFormData {
  job_id: number;
  status: ApplicationStatus;
  applied_at: string;
  notes: string;
}

// API Error type
export interface ApiError {
  message: string;
  status?: number;
  details?: any;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

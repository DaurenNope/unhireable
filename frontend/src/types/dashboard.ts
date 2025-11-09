export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected' | 'archived';

export interface Application {
  id: string;
  job_title: string;
  company: string;
  status: ApplicationStatus;
  applied_date: string;
  created_at: string;
  updated_at: string;
  location?: string;
  source?: string;
  next_step?: string;
  next_step_date?: string;
  notes?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  status: ApplicationStatus;
  created_at: string;
  source: string;
  url?: string;
  description?: string;
}

export interface DashboardStats {
  totalApplications: number;
  interviewsThisWeek: number;
  offersReceived: number;
  applicationRate: number;
}

export interface Interview {
  id: string;
  applicationId: string;
  type: string;
  date: string;
  interviewer: string;
  status: string;
  notes: string;
  jobTitle: string;
  company: string;
}

export interface ApplicationApi {
  getApplications: () => Promise<Application[]>;
  getJobs: () => Promise<Job[]>;
  getStats: () => Promise<DashboardStats>;
  getInterviews: () => Promise<Interview[]>;
}

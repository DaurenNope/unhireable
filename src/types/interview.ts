export interface Interview {
  id: string;
  applicationId: string;
  type: 'phone' | 'video' | 'in-person' | 'technical' | 'behavioral' | 'unknown';
  dateTime: Date;
  duration: number; // in minutes
  interviewer?: string;
  location?: string;
  meetingLink?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  notes?: string;
  calendarEventId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewConfirmation {
  interviewId: string;
  applicationId: string;
  status: 'confirmed' | 'declined' | 'requested_reschedule';
  response: string;
  message: string;
  sentAt: Date;
}

export interface Calendar {
  id: string;
  provider: 'google' | 'outlook' | 'apple';
  accessToken?: string;
  refreshToken?: string;
  connected: boolean;
  lastSync?: Date;
}

export interface SchedulingPreferences {
  preferredDays: string[]; // ['Monday', 'Tuesday', ...]
  preferredTimes: string[]; // ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM']
  timezone: string;
  bufferTime: number; // minutes between interviews
  maxInterviewsPerDay: number;
}
import { invoke } from '@tauri-apps/api/core';
import type { 
  Activity,
  Application, 
  ApplicationStatus, 
  Contact, 
  Credential,
  Document, 
  DocumentType, 
  GeneratedDocument,
  Interview, 
  Job,
  JobAnalysis,
  UserProfile,
} from '@/types/models';

// Helper function to handle API calls
// Tauri commands return T directly, not wrapped in ApiResponse
async function apiCall<T>(command: string, args?: any): Promise<T> {
  try {
    const result = await invoke<T>(command, args || {});
    return result;
  } catch (error: any) {
    console.error(`API Error (${command}):`, error);
    // Extract error message if available
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error(`Error details:`, {
      command,
      args,
      error: errorMessage,
      fullError: error
    });
    throw new Error(errorMessage);
  }
}

// Job API
export const jobApi = {
  list: (status?: string, query?: string, page?: number, pageSize?: number) => 
    apiCall<Job[]>('get_jobs', { status, query, page, page_size: pageSize }),
  get: (id: number) => apiCall<Job | null>('get_job', { id }),
  create: (job: Omit<Job, 'id' | 'created_at' | 'updated_at'>) => 
    apiCall<Job>('create_job', { job }),
  update: (job: Job) => apiCall<Job>('update_job', { job }),
  delete: (id: number) => apiCall<void>('delete_job', { id }),
  scrape: (query: string) => apiCall<Job[]>('scrape_jobs', { query }),
  scrapeSelected: (sources: string[], query?: string) => 
    apiCall<Job[]>('scrape_jobs_selected', { sources, query }),
};

// Application API
export const applicationApi = {
  list: (jobId?: number, status?: ApplicationStatus) => 
    apiCall<Application[]>('get_applications', { 
      job_id: jobId, 
      status: status?.toString() 
    }),
  get: (id: number) => apiCall<Application>('get_application', { id }),
  create: (application: Omit<Application, 'id' | 'created_at' | 'updated_at'>) => 
    apiCall<Application>('create_application', { application }),
  update: (application: Application) => 
    apiCall<Application>('update_application', { application }),
  delete: (id: number) => apiCall<void>('delete_application', { id }),
};

// Contact API
export const contactApi = {
  list: (jobId?: number) => 
    apiCall<Contact[]>('get_contacts', { job_id: jobId }),
  create: (contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) => 
    apiCall<Contact>('create_contact', { contact }),
  update: (contact: Contact) => 
    apiCall<Contact>('update_contact', { contact }),
  delete: (id: number) => apiCall<void>('delete_contact', { id }),
};

// Interview API
export const interviewApi = {
  list: (applicationId?: number) => 
    apiCall<Interview[]>('get_interviews', { application_id: applicationId }),
  create: (interview: Omit<Interview, 'id' | 'created_at' | 'updated_at'>) => 
    apiCall<Interview>('create_interview', { interview }),
  update: (interview: Interview) => 
    apiCall<Interview>('update_interview', { interview }),
  delete: (id: number) => apiCall<void>('delete_interview', { id }),
};

// Document API
export const documentApi = {
  list: (applicationId?: number, documentType?: DocumentType) => 
    apiCall<Document[]>('get_documents', { 
      application_id: applicationId, 
      document_type: documentType?.toString() 
    }),
  create: (document: Omit<Document, 'id' | 'created_at' | 'updated_at'>) => 
    apiCall<Document>('create_document', { document }),
  update: (document: Document) => 
    apiCall<Document>('update_document', { document }),
  delete: (id: number) => apiCall<void>('delete_document', { id }),
  upload: async (file: File, applicationId: number, type: DocumentType): Promise<Document> => {
    // Generate a unique filename
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `documents/${fileName}`;
    
    // In a real Tauri app, you would save the file using the Tauri filesystem API
    // For now, we'll just create document record
    // await invoke('save_file', { 
    //   path: filePath,
    //   contents: new Uint8Array(await file.arrayBuffer())
    // });
    
    // Create document record
    return documentApi.create({
      application_id: applicationId,
      name: file.name,
      file_path: filePath,
      document_type: type,
    });
  },
};

// Activity API
export const activityApi = {
  list: (entityType?: string, limit?: number) =>
    apiCall<Activity[]>('get_activities', { entity_type: entityType, limit }),
};

// Credential API
export const credentialApi = {
  get: (platform: string) => apiCall<Credential | null>('get_credential', { platform }),
  create: (credential: Omit<Credential, 'id' | 'created_at' | 'updated_at'>) => 
    apiCall<Credential>('create_credential', credential),
  update: (credential: Credential) => 
    apiCall<Credential>('update_credential', credential),
  list: (activeOnly: boolean = false) => 
    apiCall<Credential[]>('list_credentials', { active_only: activeOnly }),
  delete: (platform: string) => 
    apiCall<void>('delete_credential', { platform }),
};

// Document Generation API
export const generatorApi = {
  generateResume: (
    profile: UserProfile,
    jobId: number,
    templateName?: string,
    improveWithAI?: boolean
  ) => apiCall<GeneratedDocument>('generate_resume', {
    profile,
    job_id: jobId,
    template_name: templateName,
    improve_with_ai: improveWithAI,
  }),
  generateCoverLetter: (
    profile: UserProfile,
    jobId: number,
    templateName?: string,
    improveWithAI?: boolean
  ) => apiCall<GeneratedDocument>('generate_cover_letter', {
    profile,
    job_id: jobId,
    template_name: templateName,
    improve_with_ai: improveWithAI,
  }),
  generateEmailVersion: (
    profile: UserProfile,
    jobId: number,
    templateName?: string,
    improveWithAI?: boolean
  ) => apiCall<GeneratedDocument>('generate_email_version', {
    profile,
    job_id: jobId,
    template_name: templateName,
    improve_with_ai: improveWithAI,
  }),
  exportToPDF: (document: GeneratedDocument, outputPath: string) =>
    apiCall<string>('export_document_to_pdf', { document, output_path: outputPath }),
  getResumeTemplates: () => apiCall<string[]>('get_available_resume_templates'),
  getCoverLetterTemplates: () => apiCall<string[]>('get_available_cover_letter_templates'),
  analyzeJob: (jobId: number) => apiCall<JobAnalysis>('analyze_job_for_profile', { job_id: jobId }),
};

// Export all APIs
export const api = {
  jobs: jobApi,
  applications: applicationApi,
  contacts: contactApi,
  interviews: interviewApi,
  documents: documentApi,
  activities: activityApi,
  credentials: credentialApi,
  generator: generatorApi,
};

export default api;

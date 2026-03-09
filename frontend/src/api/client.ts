import type {
  Activity,
  Application,
  ApplicationStatus,
  ApplicationResult,
  Contact,
  Credential,
  Document,
  DocumentType,
  EmailConfig,
  GeneratedDocument,
  Interview,
  Job,
  JobStatus,
  JobAnalysis,
  JobMatchResult,
  RecommendedJob,
  SchedulerConfig,
  SchedulerStatus,
  SavedSearch,
  UserProfile,
  MarketInsights,
  AuthStatus,
  AutomationHealth,
  ResumeAnalysis,
  ResumeEnvironmentStatus,
} from '@/types/models'
import { handleMockCommand } from './mock'
import {
  NetworkError,
  ServerError,
  TimeoutError,
  NotFoundError,
  PermissionError,
  ValidationError,
  ApiError,
  getErrorMessage
} from '@/utils/errors'
import { restApi } from './rest'

// Map Tauri commands to REST API calls
async function handleRestCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  switch (command) {
    case 'get_jobs': {
      return restApi.jobs.list({
        status: args?.['status'] as JobStatus | undefined,
        query: args?.['query'] as string,
        page: args?.['page'] as number,
        page_size: args?.['page_size'] as number,
      }) as Promise<T>;
    }
    case 'get_job':
      return restApi.jobs.get(args?.['id'] as number) as Promise<T>;

    case 'create_job':
      return restApi.jobs.create(args?.['job'] as Parameters<typeof restApi.jobs.create>[0]) as Promise<T>;

    case 'update_job': {
      const job = args?.['job'] as { id: number } & Parameters<typeof restApi.jobs.update>[1];
      return restApi.jobs.update(job.id, job) as Promise<T>;
    }
    case 'delete_job':
      return restApi.jobs.delete(args?.['id'] as number) as Promise<T>;

    case 'get_applications': {
      return restApi.applications.list({
        status: args?.['status'] as ApplicationStatus | undefined,
        job_id: args?.['job_id'] as number,
      }) as Promise<T>;
    }
    case 'get_application':
      return restApi.applications.get(args?.['id'] as number) as Promise<T>;

    case 'create_application':
      return restApi.applications.create(args?.['application'] as Parameters<typeof restApi.applications.create>[0]) as Promise<T>;

    case 'update_application': {
      const app = args?.['application'] as { id: number } & Parameters<typeof restApi.applications.update>[1];
      return restApi.applications.update(app.id, app) as Promise<T>;
    }
    case 'scrape_jobs_selected':
      return restApi.jobs.scrape(
        args?.['sources'] as string[],
        (args?.['query'] as string) || ''
      ) as Promise<T>;

    case 'auto_apply_to_jobs':
      return restApi.applications.autoApply(
        (args?.['query'] as string) || 'developer',
        (args?.['max_applications'] as number) || 5,
        (args?.['dry_run'] as boolean) ?? true
      ) as Promise<T>;

    case 'auth_get_status':
      return restApi.auth.getStatus() as Promise<T>;

    case 'auth_setup':
      return restApi.auth.setup(
        (args?.['email'] as string) || '',
        (args?.['password'] as string) || ''
      ) as Promise<T>;

    default:
      console.warn(`REST API: Command '${command}' not implemented, falling back to mock`);
      return handleMockCommand(command, args) as Promise<T>;
  }
}

// Helper function to handle API calls
// Tauri commands return T directly, not wrapped in ApiResponse
async function apiCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    // Check if Tauri is available
    if (typeof window === 'undefined' || !window.__TAURI__) {
      // Use REST API when Tauri is not available (web preview mode)
      // The REST server at localhost:3030 should be running
      console.log(`Using REST API for command: ${command}`);
      return await handleRestCommand<T>(command, args);
    }

    // Dynamically import invoke to avoid errors if Tauri isn't ready
    const { invoke } = await import('@tauri-apps/api/core');


    // Log apply_to_job calls for debugging
    if (command === 'apply_to_job') {
      console.log('🔍 apiCall: apply_to_job', {
        command,
        args,
        argsKeys: args ? Object.keys(args) : [],
        jobId: args?.jobId,
        job_id: args?.job_id,
        hasProfile: !!args?.profile,
      });
    }

    const result = await invoke<T>(command, args || {})
    return result
  } catch (error: unknown) {
    // If Tauri invoke fails due to bridge not available (web preview), fallback to mock
    const message = getErrorMessage(error)
    const tauriUnavailable =
      message.includes('window is not defined') ||
      message.includes('invoke is not a function') ||
      message.includes('Cannot read properties of undefined') ||
      typeof window === 'undefined'

    if (tauriUnavailable) {
      try {
        const mock = await handleMockCommand(command, args)
        return mock as T
      } catch (mockErr: unknown) {
        console.error(`Mock API Error (${command}):`, mockErr)
        throw mockErr
      }
    }

    // Log error for debugging (technical details)
    console.error(`API Error (${command}):`, error)
    console.error(`Error details:`, {
      command,
      args,
      errorMessage: getErrorMessage(error),
      errorString: String(error),
    })

    // Convert to appropriate error type
    const errorMessage = getErrorMessage(error).toLowerCase();

    // Network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('networkerror') ||
      errorMessage.includes('network request failed')
    ) {
      throw new NetworkError(getErrorMessage(error));
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      throw new TimeoutError(getErrorMessage(error));
    }

    // Check if error has status code (from Tauri or HTTP)
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status >= 500) {
        throw new ServerError(getErrorMessage(error), status);
      } else if (status === 404) {
        throw new NotFoundError(getErrorMessage(error));
      } else if (status === 403 || status === 401) {
        throw new PermissionError(getErrorMessage(error));
      } else if (status === 400) {
        throw new ValidationError(getErrorMessage(error));
      } else {
        throw new ApiError(getErrorMessage(error), status, error);
      }
    }

    // Re-throw as-is if we can't classify it
    throw error
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
  // Match score methods
  calculateMatchScore: (jobId: number, profile: UserProfile) =>
    apiCall<JobMatchResult>('calculate_job_match_score', { jobId, profile }), // Tauri v2 auto-converts camelCase to snake_case
  matchJobs: (profile: UserProfile, minScore?: number) =>
    apiCall<JobMatchResult[]>('match_jobs_for_profile', { profile, min_score: minScore }),
  updateMatchScores: (profile: UserProfile) =>
    apiCall<number>('update_job_match_scores', { profile }),
  // Enrichment methods
  enrich: (id: number) => apiCall<Job>('enrich_job', { id }),
  enrichBatch: (limit?: number) => apiCall<Job[]>('enrich_jobs_batch', { limit }),
  // Recommendation methods
  getRecommended: (limit?: number) => apiCall<RecommendedJob[]>('get_recommended_jobs', { limit }),
  getTrending: (limit?: number) => apiCall<RecommendedJob[]>('get_trending_jobs', { limit }),
  getSimilar: (jobId: number, limit?: number) => apiCall<Array<[Job, number]>>('get_similar_jobs', { jobId, limit }),
  trackInteraction: (jobId: number, interactionType: 'view' | 'save' | 'apply' | 'dismiss' | 'ignore') =>
    apiCall<void>('track_job_interaction', { jobId, interactionType }),
  // Discovery methods
  qualify: () => apiCall<number>('discovery_qualify'),
};

export const insightsApi = {
  getMarketInsights: (timeframeDays?: number) =>
    apiCall<MarketInsights>('get_market_insights', timeframeDays ? { timeframe_days: timeframeDays } : {}),
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
  // Auto-apply to multiple jobs
  autoApply: (query?: string, maxApplications?: number, dryRun?: boolean) =>
    apiCall<{
      jobs_scraped: number;
      jobs_filtered: number;
      applications_submitted: number;
      applications_failed: number;
      results: ApplicationResult[];
    }>('auto_apply_to_jobs', { query, max_applications: maxApplications, dry_run: dryRun }),
  // Automated application
  applyToJob: (
    jobId: number,
    profile: UserProfile,
    resumePath?: string,
    coverLetterPath?: string,
    autoSubmit?: boolean,
    testMode?: boolean,
    testEndpoint?: string
  ) => {
    // Validate jobId
    if (!jobId || typeof jobId !== 'number' || isNaN(jobId)) {
      console.error('❌ Invalid jobId:', jobId, typeof jobId);
      throw new Error(`Invalid jobId: ${jobId}. Expected a number.`);
    }

    console.log('🔍 Calling apply_to_job with:', {
      jobId,
      jobIdType: typeof jobId,
      hasProfile: !!profile,
      resumePath,
      coverLetterPath,
      autoSubmit,
      testMode,
      testEndpoint,
    });

    // The error says "missing required key jobId" - Tauri v2 expects camelCase in JS
    // Tauri automatically converts camelCase (JS) -> snake_case (Rust)
    // So we use camelCase here: jobId -> job_id in Rust
    return apiCall<ApplicationResult>('apply_to_job', {
      jobId, // camelCase - Tauri converts to job_id in Rust
      profile,
      resumePath, // camelCase - converts to resume_path
      coverLetterPath, // camelCase - converts to cover_letter_path
      autoSubmit, // camelCase - converts to auto_submit
      testMode, // camelCase - converts to test_mode
      testEndpoint, // camelCase - converts to test_endpoint
    });
  },
  // Batch apply to multiple jobs
  batchApply: (
    jobIds: number[],
    profile: UserProfile,
    config: { autoSubmit?: boolean; delayBetweenApplications?: number; testMode?: boolean; testEndpoint?: string }
  ) => apiCall<ApplicationResult[]>('batch_apply_to_jobs', {
    job_ids: jobIds,
    profile,
    auto_submit: config.autoSubmit,
    delay_between_applications: config.delayBetweenApplications || 5,
    test_mode: config.testMode,
    test_endpoint: config.testEndpoint,
  }),
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
    apiCall<Credential>('update_credential', credential as unknown as Record<string, unknown>),
  list: (activeOnly: boolean = false) =>
    apiCall<Credential[]>('list_credentials', { active_only: activeOnly }),
  delete: (platform: string) =>
    apiCall<void>('delete_credential', { platform }),
};

// User Profile API
export const profileApi = {
  get: () => apiCall<UserProfile | null>('get_user_profile'),
  save: (profile: UserProfile) => apiCall<void>('save_user_profile', { profile }),
};

// Saved Search API
export const savedSearchApi = {
  list: (enabledOnly?: boolean) =>
    apiCall<SavedSearch[]>('list_saved_searches', { enabled_only: enabledOnly ?? false }),
  get: (id: number) => apiCall<SavedSearch | null>('get_saved_search', { id }),
  create: (search: Omit<SavedSearch, 'id' | 'created_at' | 'updated_at' | 'last_run_at'>) =>
    apiCall<SavedSearch>('create_saved_search', { search }),
  update: (search: SavedSearch) => apiCall<SavedSearch>('update_saved_search', { search }),
  delete: (id: number) => apiCall<void>('delete_saved_search', { id }),
  run: (id: number) => apiCall<Job[]>('run_saved_search', { id }),
  getStatus: () => apiCall<{ total: number; enabled: number; due_for_run: number }>('get_saved_searches_status'),
  checkAndRun: () => apiCall<number>('check_and_run_saved_searches'),
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
  exportToDOCX: (document: GeneratedDocument, outputPath: string) =>
    apiCall<string>('export_document_to_docx', { document, output_path: outputPath }),
  getResumeTemplates: () => apiCall<string[]>('get_available_resume_templates'),
  getCoverLetterTemplates: () => apiCall<string[]>('get_available_cover_letter_templates'),
  analyzeJob: (jobId: number) => apiCall<JobAnalysis>('analyze_job_for_profile', { job_id: jobId }),
  // Template Preview
  previewResumeTemplate: (templateName: string) =>
    apiCall<GeneratedDocument>('preview_resume_template', { template_name: templateName }),
  previewCoverLetterTemplate: (templateName: string) =>
    apiCall<GeneratedDocument>('preview_cover_letter_template', { template_name: templateName }),
  // Bulk Export
  bulkExport: (documents: GeneratedDocument[], format: 'pdf' | 'docx', outputDir?: string) =>
    apiCall<string[]>('bulk_export_documents', {
      documents,
      format,
      output_dir: outputDir
    }),
};

// Email Notification API
export const emailApi = {
  testConnection: (config: EmailConfig) =>
    apiCall<string>('test_email_connection', { config }),
  sendTestEmail: (config: EmailConfig, to: string) =>
    apiCall<string>('send_test_email', { config, to }),
  sendJobMatchEmail: (config: EmailConfig, to: string, job: Job, matchResult: JobMatchResult) =>
    apiCall<string>('send_job_match_email_with_result', { config, to, job, match_result: matchResult }),
  sendNewJobsNotification: (config: EmailConfig, to: string, jobs: Job[], matchResults?: JobMatchResult[]) =>
    apiCall<string>('send_new_jobs_notification_email', { config, to, jobs, match_results: matchResults }),
  extractEmailsFromJobs: (jobs: Job[]) =>
    apiCall<Array<[number, string[]]>>('extract_emails_from_jobs', { jobs }),
  createContactsFromJobs: (jobs: Job[]) =>
    apiCall<number>('create_contacts_from_jobs', { jobs }),
};

// Scheduler API
export const schedulerApi = {
  getConfig: () =>
    apiCall<SchedulerConfig>('get_scheduler_config'),
  updateConfig: (config: SchedulerConfig) =>
    apiCall<string>('update_scheduler_config', { config }),
  start: () =>
    apiCall<string>('start_scheduler'),
  stop: () =>
    apiCall<string>('stop_scheduler'),
  getStatus: () =>
    apiCall<SchedulerStatus>('get_scheduler_status'),
};

export const authApi = {
  getStatus: () => apiCall<AuthStatus>('auth_get_status'),
  setup: (email: string | undefined, password: string) =>
    apiCall<void>('auth_setup', { email, password }),
  login: (password: string) => apiCall<void>('auth_login', { password }),
  logout: () => apiCall<void>('auth_logout'),
};

// Import automation types
import type {
  AutomationConfig,
  AutomationStatus,
  PipelineResult,
} from '@/types/automation';

export const automationApi = {
  healthCheck: () => apiCall<AutomationHealth>('automation_health_check'),

  // Initialize automation
  init: (config?: AutomationConfig) =>
    apiCall<boolean>('init_automation', { config }),

  // Run full automation pipeline
  runPipeline: () =>
    apiCall<PipelineResult>('run_automation_pipeline'),

  // Run with custom configuration
  runWithConfig: (config: AutomationConfig) =>
    apiCall<PipelineResult>('run_automation_with_config', { config }),

  // Quick start with simple options
  quickStart: (options?: {
    query?: string;
    maxApplications?: number;
    dryRun?: boolean;
  }) =>
    apiCall<PipelineResult>('quick_start_automation', {
      query: options?.query,
      max_applications: options?.maxApplications,
      dry_run: options?.dryRun,
    }),

  // Get current status
  getStatus: () =>
    apiCall<AutomationStatus>('get_automation_status'),

  // Get configuration
  getConfig: () =>
    apiCall<AutomationConfig>('get_automation_config'),

  // Update configuration
  updateConfig: (config: AutomationConfig) =>
    apiCall<boolean>('update_automation_config', { config }),

  // Stop automation
  stop: () =>
    apiCall<boolean>('stop_automation'),

  // Check if running
  isRunning: () =>
    apiCall<boolean>('is_automation_running'),

  // Get default configuration
  getDefaultConfig: () =>
    apiCall<AutomationConfig>('get_default_automation_config'),
};

// Persona API
export const personaApi = {
  listCatalog: () => apiCall<Array<{ slug: string; display_name: string; description: string; target_role: string }>>('list_personas_catalog'),
  loadTestPersona: (slug?: string) =>
    apiCall<{ slug: string; display_name: string; resume_path: string; cover_letter_path: string; saved_search_id: number; saved_search_name: string }>('load_test_persona', { slug }),
  dryRun: (slug?: string, autoSubmit?: boolean) =>
    apiCall<{
      slug: string;
      display_name: string;
      job_id: number;
      job_title: string;
      success: boolean;
      message: string;
      test_endpoint: string;
      resume_path: string;
      cover_letter_path: string;
      saved_search_id: number;
      application_message: string;
      ats_type?: string | null;
    }>('persona_dry_run', { slug, auto_submit: autoSubmit }),
};

// ATS API
export const atsApi = {
  getSuggestions: (jobUrl: string) =>
    apiCall<{
      ats_type: string | null;
      confidence: string;
      tips: string[];
      known_quirks: string[];
      automation_support: string;
    }>('get_ats_suggestions', { job_url: jobUrl }),
};

// Resume Analyzer API
export interface ResumeJobTarget {
  title?: string;
  description?: string;
}

export const resumeAnalyzerApi = {
  analyze: (pdfPath: string, jobTarget?: ResumeJobTarget) =>
    apiCall<ResumeAnalysis>('analyze_resume', { pdfPath, job_target: jobTarget }),
  environmentStatus: () =>
    apiCall<ResumeEnvironmentStatus>('get_resume_environment_status'),
};

// Testing API
export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration_ms: number;
  details?: Record<string, unknown>;
}

export interface SystemTestResults {
  overall_passed: boolean;
  tests: TestResult[];
  summary: string;
  total_duration_ms: number;
}

export interface ClassifiedEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body_preview: string;
  received_at: string;
  category: string;
  confidence: number;
  extracted_data: Record<string, string>;
  requires_action: boolean;
  suggested_action?: string;
}

export const testingApi = {
  runSystemTests: () => apiCall<SystemTestResults>('run_system_tests'),
  testAutomationPipeline: (query?: string) => apiCall<Record<string, unknown>>('test_automation_pipeline', { query }),
  testEmailSending: (toEmail: string) => apiCall<TestResult>('test_email_sending', { toEmail }),
  testClassifyEmail: (subject: string, body: string) => apiCall<ClassifiedEmail>('test_classify_email', { subject, body }),
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
  profile: profileApi,
  savedSearches: savedSearchApi,
  generator: generatorApi,
  email: emailApi,
  scheduler: schedulerApi,
  insights: insightsApi,
  auth: authApi,
  automation: automationApi,
  persona: personaApi,
  ats: atsApi,
  resumeAnalyzer: resumeAnalyzerApi,
  testing: testingApi,
};

export default api;

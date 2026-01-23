import { handleMockCommand } from './mock';
import { NetworkError, ServerError, TimeoutError, NotFoundError, PermissionError, ValidationError, ApiError, getErrorMessage } from '@/utils/errors';
// Helper function to handle API calls
// Tauri commands return T directly, not wrapped in ApiResponse
async function apiCall(command, args) {
    try {
        // Check if Tauri is available
        if (typeof window === 'undefined' || !window.__TAURI__) {
            console.warn(`Tauri not available, using mock for command: ${command}`);
            const mock = await handleMockCommand(command, args);
            return mock;
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
        const result = await invoke(command, args || {});
        return result;
    }
    catch (error) {
        // If Tauri invoke fails due to bridge not available (web preview), fallback to mock
        const message = getErrorMessage(error);
        const tauriUnavailable = message.includes('window is not defined') ||
            message.includes('invoke is not a function') ||
            message.includes('Cannot read properties of undefined') ||
            typeof window === 'undefined';
        if (tauriUnavailable) {
            try {
                const mock = await handleMockCommand(command, args);
                return mock;
            }
            catch (mockErr) {
                console.error(`Mock API Error (${command}):`, mockErr);
                throw mockErr;
            }
        }
        // Log error for debugging (technical details)
        console.error(`API Error (${command}):`, error);
        console.error(`Error details:`, {
            command,
            args,
            errorMessage: getErrorMessage(error),
            errorString: String(error),
        });
        // Convert to appropriate error type
        const errorMessage = getErrorMessage(error).toLowerCase();
        // Network errors
        if (errorMessage.includes('network') ||
            errorMessage.includes('fetch') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('failed to fetch') ||
            errorMessage.includes('networkerror') ||
            errorMessage.includes('network request failed')) {
            throw new NetworkError(getErrorMessage(error));
        }
        // Timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            throw new TimeoutError(getErrorMessage(error));
        }
        // Check if error has status code (from Tauri or HTTP)
        if (error && typeof error === 'object' && 'status' in error) {
            const status = error.status;
            if (status >= 500) {
                throw new ServerError(getErrorMessage(error), status);
            }
            else if (status === 404) {
                throw new NotFoundError(getErrorMessage(error));
            }
            else if (status === 403 || status === 401) {
                throw new PermissionError(getErrorMessage(error));
            }
            else if (status === 400) {
                throw new ValidationError(getErrorMessage(error));
            }
            else {
                throw new ApiError(getErrorMessage(error), status, error);
            }
        }
        // Re-throw as-is if we can't classify it
        throw error;
    }
}
// Job API
export const jobApi = {
    list: (status, query, page, pageSize) => apiCall('get_jobs', { status, query, page, page_size: pageSize }),
    get: (id) => apiCall('get_job', { id }),
    create: (job) => apiCall('create_job', { job }),
    update: (job) => apiCall('update_job', { job }),
    delete: (id) => apiCall('delete_job', { id }),
    scrape: (query) => apiCall('scrape_jobs', { query }),
    scrapeSelected: (sources, query) => apiCall('scrape_jobs_selected', { sources, query }),
    // Match score methods
    calculateMatchScore: (jobId, profile) => apiCall('calculate_job_match_score', { jobId, profile }), // Tauri v2 auto-converts camelCase to snake_case
    matchJobs: (profile, minScore) => apiCall('match_jobs_for_profile', { profile, min_score: minScore }),
    updateMatchScores: (profile) => apiCall('update_job_match_scores', { profile }),
    // Enrichment methods
    enrich: (id) => apiCall('enrich_job', { id }),
    enrichBatch: (limit) => apiCall('enrich_jobs_batch', { limit }),
    // Recommendation methods
    getRecommended: (limit) => apiCall('get_recommended_jobs', { limit }),
    getTrending: (limit) => apiCall('get_trending_jobs', { limit }),
    getSimilar: (jobId, limit) => apiCall('get_similar_jobs', { jobId, limit }),
    trackInteraction: (jobId, interactionType) => apiCall('track_job_interaction', { jobId, interactionType }),
};
export const insightsApi = {
    getMarketInsights: (timeframeDays) => apiCall('get_market_insights', timeframeDays ? { timeframe_days: timeframeDays } : {}),
};
// Application API
export const applicationApi = {
    list: (jobId, status) => apiCall('get_applications', {
        job_id: jobId,
        status: status?.toString()
    }),
    get: (id) => apiCall('get_application', { id }),
    create: (application) => apiCall('create_application', { application }),
    update: (application) => apiCall('update_application', { application }),
    delete: (id) => apiCall('delete_application', { id }),
    // Auto-apply to multiple jobs
    autoApply: (query, maxApplications, dryRun) => apiCall('auto_apply_to_jobs', { query, max_applications: maxApplications, dry_run: dryRun }),
    // Automated application
    applyToJob: (jobId, profile, resumePath, coverLetterPath, autoSubmit, testMode, testEndpoint) => {
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
        return apiCall('apply_to_job', {
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
    batchApply: (jobIds, profile, config) => apiCall('batch_apply_to_jobs', {
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
    list: (jobId) => apiCall('get_contacts', { job_id: jobId }),
    create: (contact) => apiCall('create_contact', { contact }),
    update: (contact) => apiCall('update_contact', { contact }),
    delete: (id) => apiCall('delete_contact', { id }),
};
// Interview API
export const interviewApi = {
    list: (applicationId) => apiCall('get_interviews', { application_id: applicationId }),
    create: (interview) => apiCall('create_interview', { interview }),
    update: (interview) => apiCall('update_interview', { interview }),
    delete: (id) => apiCall('delete_interview', { id }),
};
// Document API
export const documentApi = {
    list: (applicationId, documentType) => apiCall('get_documents', {
        application_id: applicationId,
        document_type: documentType?.toString()
    }),
    create: (document) => apiCall('create_document', { document }),
    update: (document) => apiCall('update_document', { document }),
    delete: (id) => apiCall('delete_document', { id }),
    upload: async (file, applicationId, type) => {
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
    list: (entityType, limit) => apiCall('get_activities', { entity_type: entityType, limit }),
};
// Credential API
export const credentialApi = {
    get: (platform) => apiCall('get_credential', { platform }),
    create: (credential) => apiCall('create_credential', credential),
    update: (credential) => apiCall('update_credential', credential),
    list: (activeOnly = false) => apiCall('list_credentials', { active_only: activeOnly }),
    delete: (platform) => apiCall('delete_credential', { platform }),
};
// User Profile API
export const profileApi = {
    get: () => apiCall('get_user_profile'),
    save: (profile) => apiCall('save_user_profile', { profile }),
};
// Saved Search API
export const savedSearchApi = {
    list: (enabledOnly) => apiCall('list_saved_searches', { enabled_only: enabledOnly ?? false }),
    get: (id) => apiCall('get_saved_search', { id }),
    create: (search) => apiCall('create_saved_search', { search }),
    update: (search) => apiCall('update_saved_search', { search }),
    delete: (id) => apiCall('delete_saved_search', { id }),
    run: (id) => apiCall('run_saved_search', { id }),
    getStatus: () => apiCall('get_saved_searches_status'),
    checkAndRun: () => apiCall('check_and_run_saved_searches'),
};
// Document Generation API
export const generatorApi = {
    generateResume: (profile, jobId, templateName, improveWithAI) => apiCall('generate_resume', {
        profile,
        job_id: jobId,
        template_name: templateName,
        improve_with_ai: improveWithAI,
    }),
    generateCoverLetter: (profile, jobId, templateName, improveWithAI) => apiCall('generate_cover_letter', {
        profile,
        job_id: jobId,
        template_name: templateName,
        improve_with_ai: improveWithAI,
    }),
    generateEmailVersion: (profile, jobId, templateName, improveWithAI) => apiCall('generate_email_version', {
        profile,
        job_id: jobId,
        template_name: templateName,
        improve_with_ai: improveWithAI,
    }),
    exportToPDF: (document, outputPath) => apiCall('export_document_to_pdf', { document, output_path: outputPath }),
    exportToDOCX: (document, outputPath) => apiCall('export_document_to_docx', { document, output_path: outputPath }),
    getResumeTemplates: () => apiCall('get_available_resume_templates'),
    getCoverLetterTemplates: () => apiCall('get_available_cover_letter_templates'),
    analyzeJob: (jobId) => apiCall('analyze_job_for_profile', { job_id: jobId }),
    // Template Preview
    previewResumeTemplate: (templateName) => apiCall('preview_resume_template', { template_name: templateName }),
    previewCoverLetterTemplate: (templateName) => apiCall('preview_cover_letter_template', { template_name: templateName }),
    // Bulk Export
    bulkExport: (documents, format, outputDir) => apiCall('bulk_export_documents', {
        documents,
        format,
        output_dir: outputDir
    }),
};
// Email Notification API
export const emailApi = {
    testConnection: (config) => apiCall('test_email_connection', { config }),
    sendTestEmail: (config, to) => apiCall('send_test_email', { config, to }),
    sendJobMatchEmail: (config, to, job, matchResult) => apiCall('send_job_match_email_with_result', { config, to, job, match_result: matchResult }),
    sendNewJobsNotification: (config, to, jobs, matchResults) => apiCall('send_new_jobs_notification_email', { config, to, jobs, match_results: matchResults }),
    extractEmailsFromJobs: (jobs) => apiCall('extract_emails_from_jobs', { jobs }),
    createContactsFromJobs: (jobs) => apiCall('create_contacts_from_jobs', { jobs }),
};
// Scheduler API
export const schedulerApi = {
    getConfig: () => apiCall('get_scheduler_config'),
    updateConfig: (config) => apiCall('update_scheduler_config', { config }),
    start: () => apiCall('start_scheduler'),
    stop: () => apiCall('stop_scheduler'),
    getStatus: () => apiCall('get_scheduler_status'),
};
export const authApi = {
    getStatus: () => apiCall('auth_get_status'),
    setup: (email, password) => apiCall('auth_setup', { email, password }),
    login: (password) => apiCall('auth_login', { password }),
    logout: () => apiCall('auth_logout'),
};
export const automationApi = {
    healthCheck: () => apiCall('automation_health_check'),
    // Initialize automation
    init: (config) => apiCall('init_automation', { config }),
    // Run full automation pipeline
    runPipeline: () => apiCall('run_automation_pipeline'),
    // Run with custom configuration
    runWithConfig: (config) => apiCall('run_automation_with_config', { config }),
    // Quick start with simple options
    quickStart: (options) => apiCall('quick_start_automation', {
        query: options?.query,
        max_applications: options?.maxApplications,
        dry_run: options?.dryRun,
    }),
    // Get current status
    getStatus: () => apiCall('get_automation_status'),
    // Get configuration
    getConfig: () => apiCall('get_automation_config'),
    // Update configuration
    updateConfig: (config) => apiCall('update_automation_config', { config }),
    // Stop automation
    stop: () => apiCall('stop_automation'),
    // Check if running
    isRunning: () => apiCall('is_automation_running'),
    // Get default configuration
    getDefaultConfig: () => apiCall('get_default_automation_config'),
};
// Persona API
export const personaApi = {
    listCatalog: () => apiCall('list_personas_catalog'),
    loadTestPersona: (slug) => apiCall('load_test_persona', { slug }),
    dryRun: (slug, autoSubmit) => apiCall('persona_dry_run', { slug, auto_submit: autoSubmit }),
};
// ATS API
export const atsApi = {
    getSuggestions: (jobUrl) => apiCall('get_ats_suggestions', { job_url: jobUrl }),
};
export const resumeAnalyzerApi = {
    analyze: (pdfPath, jobTarget) => apiCall('analyze_resume', { pdfPath, job_target: jobTarget }),
    environmentStatus: () => apiCall('get_resume_environment_status'),
};
export const testingApi = {
    runSystemTests: () => invoke('run_system_tests'),
    testAutomationPipeline: (query) => invoke('test_automation_pipeline', { query }),
    testEmailSending: (toEmail) => invoke('test_email_sending', { toEmail }),
    testClassifyEmail: (subject, body) => invoke('test_classify_email', { subject, body }),
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

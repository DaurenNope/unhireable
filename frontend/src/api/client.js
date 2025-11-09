import { invoke } from '@tauri-apps/api/core';
// Helper function to handle API calls
// Tauri commands return T directly, not wrapped in ApiResponse
async function apiCall(command, args) {
    try {
        const result = await invoke(command, args || {});
        return result;
    }
    catch (error) {
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
    list: (status, query, page, pageSize) => apiCall('get_jobs', { status, query, page, page_size: pageSize }),
    get: (id) => apiCall('get_job', { id }),
    create: (job) => apiCall('create_job', { job }),
    update: (job) => apiCall('update_job', { job }),
    delete: (id) => apiCall('delete_job', { id }),
    scrape: (query) => apiCall('scrape_jobs', { query }),
    scrapeSelected: (sources, query) => apiCall('scrape_jobs_selected', { sources, query }),
    // Match score methods
    calculateMatchScore: (jobId, profile) => apiCall('calculate_job_match_score', { job_id: jobId, profile }),
    matchJobs: (profile, minScore) => apiCall('match_jobs_for_profile', { profile, min_score: minScore }),
    updateMatchScores: (profile) => apiCall('update_job_match_scores', { profile }),
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
    getResumeTemplates: () => apiCall('get_available_resume_templates'),
    getCoverLetterTemplates: () => apiCall('get_available_cover_letter_templates'),
    analyzeJob: (jobId) => apiCall('analyze_job_for_profile', { job_id: jobId }),
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
    email: emailApi,
    scheduler: schedulerApi,
};
export default api;

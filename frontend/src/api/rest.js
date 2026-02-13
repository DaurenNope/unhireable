/**
 * REST API Client for Unhireable Web Server
 *
 * This module provides HTTP-based API calls to the Axum REST server,
 * used when running the frontend standalone (without Tauri).
 */
// Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030';
// Helper for making REST API calls
async function restCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    const response = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorBody.error || `HTTP ${response.status}`);
    }
    // Handle 204 No Content
    if (response.status === 204) {
        return undefined;
    }
    const result = await response.json();
    // Unwrap ApiResponse if present
    if (result && typeof result === 'object' && 'data' in result) {
        return result.data;
    }
    return result;
}
// Job REST API
export const restJobApi = {
    list: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.status)
            searchParams.set('status', params.status);
        if (params?.query)
            searchParams.set('query', params.query);
        if (params?.page)
            searchParams.set('page', String(params.page));
        if (params?.page_size)
            searchParams.set('page_size', String(params.page_size));
        const queryString = searchParams.toString();
        return restCall(`/api/jobs${queryString ? `?${queryString}` : ''}`);
    },
    get: (id) => restCall(`/api/jobs/${id}`),
    create: (job) => restCall('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(job),
    }),
    update: (id, job) => restCall(`/api/jobs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(job),
    }),
    delete: (id) => restCall(`/api/jobs/${id}`, { method: 'DELETE' }),
    // Scrape jobs from sources
    scrape: (sources, query) => restCall('/api/jobs/scrape', {
        method: 'POST',
        body: JSON.stringify({ sources, query }),
    }),
};
// Application REST API
export const restApplicationApi = {
    list: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.status)
            searchParams.set('status', String(params.status));
        if (params?.job_id)
            searchParams.set('job_id', String(params.job_id));
        const queryString = searchParams.toString();
        return restCall(`/api/applications${queryString ? `?${queryString}` : ''}`);
    },
    get: (id) => restCall(`/api/applications/${id}`),
    create: (application) => restCall('/api/applications', {
        method: 'POST',
        body: JSON.stringify(application),
    }),
    update: (id, application) => restCall(`/api/applications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(application),
    }),
    // Auto-apply to matching jobs
    autoApply: (query, maxApplications, dryRun) => restCall('/api/apply/auto', {
        method: 'POST',
        body: JSON.stringify({
            query,
            max_applications: maxApplications,
            dry_run: dryRun
        }),
    }),
};
export const restAuthApi = {
    getStatus: () => restCall('/api/auth/status'),
    setup: (email, password) => restCall('/api/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    }),
};
// Stats REST API
export const restStatsApi = {
    getDashboardStats: () => restCall('/api/stats'),
};
// Health REST API
export const restHealthApi = {
    check: () => restCall('/api/health'),
};
// Unified REST API export
export const restApi = {
    jobs: restJobApi,
    applications: restApplicationApi,
    auth: restAuthApi,
    stats: restStatsApi,
    health: restHealthApi,
};
// Check if we should use REST API (no Tauri available)
export function shouldUseRestApi() {
    return typeof window === 'undefined' || !window.__TAURI__;
}
// Get the appropriate API based on environment
export function getApiMode() {
    if (typeof window === 'undefined') {
        return 'mock';
    }
    if (window.__TAURI__) {
        return 'tauri';
    }
    // Default to REST API when Tauri is not available (web preview mode)
    // The REST server at localhost:3030 should be running
    return 'rest';
}
export default restApi;

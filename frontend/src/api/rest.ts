/**
 * REST API Client for Unhireable Web Server
 * 
 * This module provides HTTP-based API calls to the Axum REST server,
 * used when running the frontend standalone (without Tauri).
 */

import type {
    Application,
    ApplicationStatus,
    Job,
    JobStatus,
} from '@/types/models';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030';

// Types for API responses
interface ApiResponse<T> {
    data: T;
}

interface ApiError {
    error: string;
}

interface DashboardStats {
    total_jobs: number;
    total_applications: number;
    pending_applications: number;
    applied_count: number;
    interviews_scheduled: number;
}

interface HealthStatus {
    status: string;
    version: string;
    timestamp: string;
}

interface ScrapeResponse {
    jobs_found: number;
    jobs_saved: number;
}

interface AutoApplyResult {
    jobs_scraped: number;
    jobs_filtered: number;
    applications_submitted: number;
    applications_failed: number;
    results: Array<{
        job_id: number;
        job_title: string;
        company: string;
        status: 'applied' | 'skipped' | 'failed';
        message?: string;
    }>;
}

// Helper for making REST API calls
async function restCall<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const defaultHeaders: HeadersInit = {
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
        throw new Error((errorBody as ApiError).error || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as T;
    }

    const result = await response.json();

    // Unwrap ApiResponse if present
    if (result && typeof result === 'object' && 'data' in result) {
        return (result as ApiResponse<T>).data;
    }

    return result as T;
}

// Job REST API
export const restJobApi = {
    list: (params?: { status?: JobStatus; query?: string; page?: number; page_size?: number }) => {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set('status', params.status);
        if (params?.query) searchParams.set('query', params.query);
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.page_size) searchParams.set('page_size', String(params.page_size));

        const queryString = searchParams.toString();
        return restCall<Job[]>(`/api/jobs${queryString ? `?${queryString}` : ''}`);
    },

    get: (id: number) => restCall<Job>(`/api/jobs/${id}`),

    create: (job: Omit<Job, 'id' | 'created_at' | 'updated_at'>) =>
        restCall<Job>('/api/jobs', {
            method: 'POST',
            body: JSON.stringify(job),
        }),

    update: (id: number, job: Job) =>
        restCall<Job>(`/api/jobs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(job),
        }),

    delete: (id: number) =>
        restCall<void>(`/api/jobs/${id}`, { method: 'DELETE' }),

    // Scrape jobs from sources
    scrape: (sources: string[], query: string) =>
        restCall<ScrapeResponse>('/api/jobs/scrape', {
            method: 'POST',
            body: JSON.stringify({ sources, query }),
        }),
};

// Application REST API
export const restApplicationApi = {
    list: (params?: { status?: ApplicationStatus; job_id?: number }) => {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set('status', String(params.status));
        if (params?.job_id) searchParams.set('job_id', String(params.job_id));

        const queryString = searchParams.toString();
        return restCall<Application[]>(`/api/applications${queryString ? `?${queryString}` : ''}`);
    },

    get: (id: number) => restCall<Application>(`/api/applications/${id}`),

    create: (application: Omit<Application, 'id' | 'created_at' | 'updated_at'>) =>
        restCall<Application>('/api/applications', {
            method: 'POST',
            body: JSON.stringify(application),
        }),

    update: (id: number, application: Application) =>
        restCall<Application>(`/api/applications/${id}`, {
            method: 'PUT',
            body: JSON.stringify(application),
        }),

    // Auto-apply to matching jobs
    autoApply: (query: string, maxApplications: number, dryRun: boolean) =>
        restCall<AutoApplyResult>('/api/apply/auto', {
            method: 'POST',
            body: JSON.stringify({
                query,
                max_applications: maxApplications,
                dry_run: dryRun
            }),
        }),
};

// Auth REST API (for web mode)
interface AuthStatusResponse {
    is_setup: boolean;
    is_authenticated: boolean;
}

export const restAuthApi = {
    getStatus: () => restCall<AuthStatusResponse>('/api/auth/status'),
    setup: (email: string, password: string) =>
        restCall<{ status: string; message: string }>('/api/auth/setup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),
};

// Stats REST API
export const restStatsApi = {
    getDashboardStats: () => restCall<DashboardStats>('/api/stats'),
};

// Health REST API
export const restHealthApi = {
    check: () => restCall<HealthStatus>('/api/health'),
};

export interface AnswerPattern {
    id: string;
    labelPatterns: string[];
    excludePatterns?: string[];
    matchType?: 'all' | 'any';
    source: 'literal' | 'profile';
    literalValue?: string;
    profilePath?: string;
    fallbackPath?: string;
    default?: string;
    transform?: string;
}

export interface AnswerPatternsConfig {
    patterns: AnswerPattern[];
}

export const restAnswerPatternsApi = {
    get: (personaId = 'default') =>
        restCall<AnswerPatternsConfig>(`/api/answer-patterns?persona_id=${encodeURIComponent(personaId)}`),

    save: (config: AnswerPatternsConfig, personaId = 'default') =>
        restCall<{ status: string; persona_id: string }>(`/api/answer-patterns?persona_id=${encodeURIComponent(personaId)}`, {
            method: 'PUT',
            body: JSON.stringify(config),
        }),
};

// Unified REST API export
export const restApi = {
    jobs: restJobApi,
    applications: restApplicationApi,
    auth: restAuthApi,
    stats: restStatsApi,
    health: restHealthApi,
    answerPatterns: restAnswerPatternsApi,
};

// Check if we should use REST API (no Tauri available)
export function shouldUseRestApi(): boolean {
    return typeof window === 'undefined' || !window.__TAURI__;
}

// Get the appropriate API based on environment
export function getApiMode(): 'tauri' | 'rest' | 'mock' {
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

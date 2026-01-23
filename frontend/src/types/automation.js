// Automation Pipeline Types
// Default configuration helper
export const getDefaultAutomationConfig = () => ({
    enabled: false,
    search: {
        queries: ['senior software engineer', 'backend developer'],
        sources: ['remoteok', 'wellfound', 'remotive'],
        interval_minutes: 60,
        max_jobs_per_run: 50,
    },
    filters: {
        min_match_score: 60,
        remote_only: true,
        min_salary: 80000,
        required_keywords: [],
        excluded_keywords: ['intern', 'junior'],
        experience_levels: ['mid', 'senior'],
        preferred_locations: [],
        excluded_companies: [],
        max_job_age_days: 30,
    },
    documents: {
        generate_resume: true,
        generate_cover_letter: true,
        use_ai_enhancement: true,
        resume_template: 'resume_modern',
        cover_letter_template: 'cover_letter_professional',
        export_to_pdf: true,
    },
    application: {
        max_applications_per_day: 20,
        max_applications_per_run: 5,
        auto_submit: false,
        dry_run: true,
        delay_between_applications: 30,
        skip_already_applied: true,
        ats_priority: ['Greenhouse', 'Lever', 'Workable', 'AshbyHQ'],
    },
    notifications: {
        desktop_notifications: true,
        email_notifications: false,
        notify_on_new_jobs: true,
        notify_on_application: true,
        notify_on_failure: true,
        daily_summary: true,
    },
    rate_limits: {
        max_requests_per_minute: 10,
        source_delay_secs: 5,
        random_delay_range_secs: 3,
        respect_rate_limits: true,
    },
});

//! Automation Configuration

use serde::{Deserialize, Serialize};

/// Configuration for the full automation pipeline
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationConfig {
    /// Whether automation is enabled
    pub enabled: bool,
    
    /// Job search configuration
    pub search: SearchConfig,
    
    /// Filtering configuration
    pub filters: FilterConfig,
    
    /// Document generation configuration
    pub documents: DocumentConfig,
    
    /// Application configuration
    pub application: ApplicationConfig,
    
    /// Notification configuration
    pub notifications: NotificationConfig,
    
    /// Rate limiting configuration
    pub rate_limits: RateLimitConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    /// Search queries to run
    pub queries: Vec<String>,
    
    /// Job sources to scrape
    pub sources: Vec<String>,
    
    /// How often to scrape (in minutes)
    pub interval_minutes: u32,
    
    /// Maximum jobs to fetch per run
    pub max_jobs_per_run: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterConfig {
    /// Minimum match score (0-100) to consider
    pub min_match_score: f64,
    
    /// Only remote jobs
    pub remote_only: bool,
    
    /// Minimum salary (if specified in job)
    pub min_salary: Option<u64>,
    
    /// Required keywords in title or description
    pub required_keywords: Vec<String>,
    
    /// Keywords to exclude
    pub excluded_keywords: Vec<String>,
    
    /// Experience levels to include
    pub experience_levels: Vec<String>,
    
    /// Preferred locations (for hybrid roles)
    pub preferred_locations: Vec<String>,
    
    /// Companies to exclude (blacklist)
    pub excluded_companies: Vec<String>,
    
    /// Only apply to jobs posted within N days
    pub max_job_age_days: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentConfig {
    /// Whether to generate tailored resumes
    pub generate_resume: bool,
    
    /// Whether to generate cover letters
    pub generate_cover_letter: bool,
    
    /// Use AI to improve documents
    pub use_ai_enhancement: bool,
    
    /// Resume template to use
    pub resume_template: String,
    
    /// Cover letter template to use
    pub cover_letter_template: String,
    
    /// Export documents to PDF
    pub export_to_pdf: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationConfig {
    /// Maximum applications per day
    pub max_applications_per_day: usize,
    
    /// Maximum applications per run
    pub max_applications_per_run: usize,
    
    /// Auto-submit applications (vs just fill forms)
    pub auto_submit: bool,
    
    /// Dry run mode (don't actually submit)
    pub dry_run: bool,
    
    /// Wait time between applications (seconds)
    pub delay_between_applications: u64,
    
    /// Skip jobs already applied to
    pub skip_already_applied: bool,
    
    /// Priority order for ATS types (apply to easier ones first)
    pub ats_priority: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    /// Send desktop notifications
    pub desktop_notifications: bool,
    
    /// Send email notifications
    pub email_notifications: bool,
    
    /// Email to send notifications to
    pub notification_email: Option<String>,
    
    /// Notify on new matching jobs
    pub notify_on_new_jobs: bool,
    
    /// Notify on successful application
    pub notify_on_application: bool,
    
    /// Notify on application failure
    pub notify_on_failure: bool,
    
    /// Daily summary email
    pub daily_summary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Maximum requests per minute to any single source
    pub max_requests_per_minute: u32,
    
    /// Delay between scraping different sources (seconds)
    pub source_delay_secs: u64,
    
    /// Random delay variation (to appear more human)
    pub random_delay_range_secs: u64,
    
    /// Respect robots.txt and rate limits
    pub respect_rate_limits: bool,
}

impl Default for AutomationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            search: SearchConfig {
                queries: vec!["senior software engineer".to_string(), "backend developer".to_string()],
                sources: vec!["remoteok".to_string(), "wellfound".to_string(), "remotive".to_string()],
                interval_minutes: 60,
                max_jobs_per_run: 50,
            },
            filters: FilterConfig {
                min_match_score: 60.0,
                remote_only: true,
                min_salary: Some(80000),
                required_keywords: vec![],
                excluded_keywords: vec!["intern".to_string(), "junior".to_string()],
                experience_levels: vec!["mid".to_string(), "senior".to_string()],
                preferred_locations: vec![],
                excluded_companies: vec![],
                max_job_age_days: Some(30),
            },
            documents: DocumentConfig {
                generate_resume: true,
                generate_cover_letter: true,
                use_ai_enhancement: true,
                resume_template: "resume_modern".to_string(),
                cover_letter_template: "cover_letter_professional".to_string(),
                export_to_pdf: true,
            },
            application: ApplicationConfig {
                max_applications_per_day: 20,
                max_applications_per_run: 5,
                auto_submit: false, // Safe default
                dry_run: true, // Safe default - user must explicitly enable real submissions
                delay_between_applications: 30,
                skip_already_applied: true,
                ats_priority: vec![
                    "Greenhouse".to_string(),
                    "Lever".to_string(), 
                    "Workable".to_string(),
                    "AshbyHQ".to_string(),
                ],
            },
            notifications: NotificationConfig {
                desktop_notifications: true,
                email_notifications: false,
                notification_email: None,
                notify_on_new_jobs: true,
                notify_on_application: true,
                notify_on_failure: true,
                daily_summary: true,
            },
            rate_limits: RateLimitConfig {
                max_requests_per_minute: 10,
                source_delay_secs: 5,
                random_delay_range_secs: 3,
                respect_rate_limits: true,
            },
        }
    }
}

pub mod email;
pub mod templates;
pub mod email_extractor;

pub use email::EmailService;
pub use email::EmailConfig;
pub use templates::EmailTemplate;
pub use email_extractor::{extract_emails, extract_job_emails};

use serde::{Deserialize, Serialize};

/// Notification configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    pub email_enabled: bool,
    pub email_config: EmailConfig,
    pub notify_on_new_jobs: bool,
    pub notify_on_matches: bool,
    pub min_match_score_for_notification: f64, // Only notify if match score >= this
    pub notify_daily_summary: bool,
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            email_enabled: false,
            email_config: EmailConfig::default(),
            notify_on_new_jobs: true,
            notify_on_matches: true,
            min_match_score_for_notification: 60.0, // Notify on 60%+ matches
            notify_daily_summary: true,
        }
    }
}


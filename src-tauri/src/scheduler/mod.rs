pub mod job_scheduler;

pub use job_scheduler::JobScheduler;

use serde::{Deserialize, Serialize};

/// Scheduler configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerConfig {
    pub enabled: bool,
    pub schedule: String, // Cron expression, e.g., "0 9 * * *" for 9 AM daily
    pub query: String,    // Default search query
    pub sources: Vec<String>, // Sources to scrape, empty for all
    pub min_match_score: Option<f64>, // Minimum match score to notify
    pub send_notifications: bool,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            schedule: "0 9 * * *".to_string(), // 9 AM daily
            query: "developer".to_string(),
            sources: Vec::new(), // All sources
            min_match_score: Some(60.0), // 60% match minimum
            send_notifications: true,
        }
    }
}


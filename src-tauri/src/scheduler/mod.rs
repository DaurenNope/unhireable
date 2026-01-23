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
            sources: Vec::new(),         // All sources
            min_match_score: Some(60.0), // 60% match minimum
            send_notifications: true,
        }
    }
}

impl SchedulerConfig {
    pub fn load_from_path(path: &std::path::Path) -> anyhow::Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let file = std::fs::File::open(path)?;
        let reader = std::io::BufReader::new(file);
        let config = serde_json::from_reader(reader)?;
        Ok(config)
    }

    pub fn save_to_path(&self, path: &std::path::Path) -> anyhow::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let file = std::fs::File::create(path)?;
        let writer = std::io::BufWriter::new(file);
        serde_json::to_writer_pretty(writer, self)?;
        Ok(())
    }

    // Deprecated: Use load_from_path instead
    pub fn load() -> anyhow::Result<Self> {
        Ok(Self::default())
    }

    // Deprecated: Use save_to_path instead
    pub fn save(&self) -> anyhow::Result<()> {
        Ok(())
    }
}

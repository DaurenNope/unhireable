use crate::scraper::ScraperManager;
use crate::db::Database;
use crate::db::queries::{JobQueries, CredentialQueries};
use crate::scheduler::SchedulerConfig;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use chrono::Utc;
use serde_json;

/// Background job scheduler for automated scraping
/// Note: Using tokio::time for simple scheduling. Full cron support can be added later.
pub struct JobScheduler {
    handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    config: Arc<Mutex<SchedulerConfig>>,
    db: Arc<Mutex<Option<Database>>>,
    stop_tx: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
}

impl JobScheduler {
    pub fn new(config: SchedulerConfig, db: Arc<Mutex<Option<Database>>>) -> Self {
        Self {
            handle: Arc::new(Mutex::new(None)),
            config: Arc::new(Mutex::new(config)),
            db,
            stop_tx: Arc::new(Mutex::new(None)),
        }
    }

    /// Start the scheduler
    /// Note: This is a simplified implementation using fixed intervals.
    /// For full cron support, integrate tokio-cron-scheduler later.
    pub async fn start(&self) -> Result<()> {
        let config = self.config.lock().await.clone();
        
        if !config.enabled {
            println!("Job scheduler is disabled");
            return Ok(());
        }

        // Parse schedule to interval (simplified - assumes format like "0 9 * * *" means daily at 9 AM)
        // For now, use a simple 24-hour interval
        let interval_secs = Self::parse_schedule_to_interval(&config.schedule);
        
        let config_clone = Arc::clone(&self.config);
        let db_clone = Arc::clone(&self.db);
        let (tx, mut rx) = tokio::sync::oneshot::channel();
        
        *self.stop_tx.lock().await = Some(tx);
        
        let handle = tokio::spawn(async move {
            loop {
                // Check if we should stop
                if rx.try_recv().is_ok() {
                    println!("🛑 Job scheduler stopped");
                    break;
                }
                
                let config = config_clone.lock().await.clone();
                if config.enabled {
                    println!("🕐 Scheduled job scraping started at {}", Utc::now());
                    Self::run_scheduled_scrape(config, Arc::clone(&db_clone)).await;
                }
                
                // Wait for the interval (or until stop signal)
                tokio::select! {
                    _ = sleep(Duration::from_secs(interval_secs)) => {},
                    _ = &mut rx => {
                        println!("🛑 Job scheduler stopped");
                        break;
                    }
                }
            }
        });
        
        *self.handle.lock().await = Some(handle);
        
        println!("✅ Job scheduler started with interval: {} seconds ({} hours)", 
                 interval_secs, interval_secs / 3600);
        Ok(())
    }

    /// Stop the scheduler
    pub async fn stop(&self) -> Result<()> {
        if let Some(tx) = self.stop_tx.lock().await.take() {
            let _ = tx.send(());
        }
        
        if let Some(handle) = self.handle.lock().await.take() {
            let _ = handle.await;
            println!("🛑 Job scheduler stopped");
        }
        Ok(())
    }
    
    /// Parse cron-like schedule to interval in seconds
    /// Simplified: "0 9 * * *" -> 24 hours, "0 */6 * * *" -> 6 hours
    pub(crate) fn parse_schedule_to_interval(schedule: &str) -> u64 {
        // Very simplified parser - just check for common patterns
        if schedule.contains("*/6") || schedule.contains("0 */6") {
            return 6 * 3600; // 6 hours
        } else if schedule.contains("*/12") || schedule.contains("0 */12") {
            return 12 * 3600; // 12 hours
        } else if schedule.starts_with("0 9") || schedule.contains("* * *") {
            return 24 * 3600; // 24 hours (daily)
        }
        
        // Default to 24 hours
        24 * 3600
    }

    /// Get current scheduler configuration
    pub async fn get_config(&self) -> SchedulerConfig {
        self.config.lock().await.clone()
    }
    
    /// Check if scheduler is currently running
    pub async fn is_running(&self) -> bool {
        self.handle.lock().await.is_some()
    }
    
    /// Update scheduler configuration
    pub async fn update_config(&self, config: SchedulerConfig) -> Result<()> {
        let was_enabled = self.config.lock().await.enabled;
        *self.config.lock().await = config.clone();
        
        // Restart scheduler if it was running
        if was_enabled {
            self.stop().await?;
            if config.enabled {
                self.start().await?;
            }
        }
        
        Ok(())
    }

    /// Run a scheduled scraping job
    async fn run_scheduled_scrape(
        config: SchedulerConfig,
        db: Arc<Mutex<Option<Database>>>,
    ) {
        println!("🔍 Starting scheduled job scrape for query: '{}'", config.query);
        
        // Create scraper
        let mut scraper = ScraperManager::new();
        
        // Get Firecrawl API key if available
        {
            let db_guard = db.lock().await;
            if let Some(db) = db_guard.as_ref() {
                let conn = db.get_connection();
                if let Ok(Some(credential)) = conn.get_credential("firecrawl") {
                    if let Some(api_key) = credential.tokens.as_deref() {
                        if let Ok(tokens) = serde_json::from_str::<serde_json::Value>(api_key) {
                            if let Some(key) = tokens.get("api_key").and_then(|v| v.as_str()) {
                                scraper.set_firecrawl_key(key.to_string());
                            }
                        } else {
                            scraper.set_firecrawl_key(api_key.to_string());
                        }
                    }
                }
            }
        }
        
        // Scrape jobs
        let jobs = if config.sources.is_empty() {
            scraper.scrape_all(&config.query)
        } else {
            scraper.scrape_selected(&config.sources, &config.query)
        };
        
        match jobs {
            Ok(scraped_jobs) => {
                println!("✅ Scraped {} jobs", scraped_jobs.len());
                
                // Save jobs to database
                let db_guard = db.lock().await;
                if let Some(db) = db_guard.as_ref() {
                    let conn = db.get_connection();
                    let mut saved_count = 0;
                    
                    for mut job in scraped_jobs {
                        // Check if job already exists
                        if conn.get_job_by_url(&job.url).unwrap_or(None).is_none() {
                            if conn.create_job(&mut job).is_ok() {
                                saved_count += 1;
                            }
                        }
                    }
                    
                    println!("💾 Saved {} new jobs to database", saved_count);
                    
                    // TODO: Send notifications if enabled and jobs match criteria
                    if config.send_notifications && saved_count > 0 {
                        println!("📧 {} new jobs found (notifications not yet implemented)", saved_count);
                    }
                }
            }
            Err(e) => {
                eprintln!("❌ Scheduled scraping failed: {}", e);
            }
        }
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::TempDir;

    fn create_test_db() -> (Arc<Mutex<Option<Database>>>, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db = Database::new(db_path).unwrap();
        (Arc::new(Mutex::new(Some(db))), temp_dir)
    }

    #[tokio::test]
    async fn test_scheduler_config_default() {
        let config = SchedulerConfig::default();
        assert_eq!(config.schedule, "0 9 * * *");
        assert_eq!(config.query, "developer");
        assert!(!config.enabled);
        assert_eq!(config.sources, Vec::<String>::new());
        assert_eq!(config.min_match_score, Some(60.0));
        assert!(config.send_notifications);
    }

    #[test]
    fn test_scheduler_config_serialization() {
        let config = SchedulerConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: SchedulerConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.schedule, deserialized.schedule);
        assert_eq!(config.query, deserialized.query);
        assert_eq!(config.enabled, deserialized.enabled);
    }

    #[test]
    fn test_parse_schedule_to_interval() {
        // Test daily schedule
        assert_eq!(JobScheduler::parse_schedule_to_interval("0 9 * * *"), 24 * 3600);
        
        // Test 6-hour schedule
        assert_eq!(JobScheduler::parse_schedule_to_interval("0 */6 * * *"), 6 * 3600);
        
        // Test 12-hour schedule
        assert_eq!(JobScheduler::parse_schedule_to_interval("0 */12 * * *"), 12 * 3600);
        
        // Test default (unknown pattern)
        assert_eq!(JobScheduler::parse_schedule_to_interval("unknown"), 24 * 3600);
    }

    #[tokio::test]
    async fn test_scheduler_creation() {
        let (db, _temp_dir) = create_test_db();
        let config = SchedulerConfig::default();
        let scheduler = JobScheduler::new(config, db);
        
        // Scheduler should be created but not running
        assert!(!scheduler.is_running().await);
    }

    #[tokio::test]
    async fn test_scheduler_start_stop() {
        let (db, _temp_dir) = create_test_db();
        let mut config = SchedulerConfig::default();
        config.enabled = true;
        config.schedule = "0 */1 * * *".to_string(); // Every hour for faster testing
        
        let scheduler = JobScheduler::new(config, db);
        
        // Start scheduler
        let result = scheduler.start().await;
        assert!(result.is_ok());
        assert!(scheduler.is_running().await);
        
        // Stop scheduler
        let result = scheduler.stop().await;
        assert!(result.is_ok());
        // Give it a moment to stop
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        assert!(!scheduler.is_running().await);
    }

    #[tokio::test]
    async fn test_scheduler_start_disabled() {
        let (db, _temp_dir) = create_test_db();
        let config = SchedulerConfig::default(); // enabled = false by default
        let scheduler = JobScheduler::new(config, db);
        
        // Start scheduler (should not start if disabled)
        let result = scheduler.start().await;
        assert!(result.is_ok());
        // Should not be running because config.enabled = false
        assert!(!scheduler.is_running().await);
    }

    #[tokio::test]
    async fn test_scheduler_get_config() {
        let (db, _temp_dir) = create_test_db();
        let mut config = SchedulerConfig::default();
        config.query = "test query".to_string();
        config.enabled = true;
        
        let scheduler = JobScheduler::new(config.clone(), db);
        let retrieved_config = scheduler.get_config().await;
        
        assert_eq!(retrieved_config.query, "test query");
        assert_eq!(retrieved_config.enabled, true);
        assert_eq!(retrieved_config.schedule, config.schedule);
    }

    #[tokio::test]
    async fn test_scheduler_update_config() {
        let (db, _temp_dir) = create_test_db();
        let config = SchedulerConfig::default();
        let scheduler = JobScheduler::new(config, db);
        
        // Update config
        let mut new_config = SchedulerConfig::default();
        new_config.query = "updated query".to_string();
        new_config.enabled = false; // Keep disabled to avoid actual scraping
        
        let result = scheduler.update_config(new_config.clone()).await;
        assert!(result.is_ok());
        
        let retrieved_config = scheduler.get_config().await;
        assert_eq!(retrieved_config.query, "updated query");
        assert_eq!(retrieved_config.enabled, false);
    }

    #[tokio::test]
    async fn test_scheduler_stop_when_not_running() {
        let (db, _temp_dir) = create_test_db();
        let config = SchedulerConfig::default();
        let scheduler = JobScheduler::new(config, db);
        
        // Stop scheduler that's not running (should not error)
        let result = scheduler.stop().await;
        assert!(result.is_ok());
    }
}


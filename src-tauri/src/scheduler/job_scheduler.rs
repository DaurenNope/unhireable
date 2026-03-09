use crate::db::queries::{CredentialQueries, JobQueries, SavedSearchQueries};
use crate::db::Database;
use crate::scheduler::SchedulerConfig;
use crate::scraper::ScraperManager;
use anyhow::Result;
use chrono::Utc;
use serde_json;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

/// Background job scheduler for automated scraping
/// Note: Using tokio::time for simple scheduling. Full cron support can be added later.
pub struct JobScheduler {
    handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    config: Arc<Mutex<SchedulerConfig>>,
    db: Arc<Mutex<Option<Database>>>,
    stop_tx: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    app_handle: Arc<std::sync::Mutex<Option<tauri::AppHandle>>>,
}

impl JobScheduler {
    pub fn new(
        config: SchedulerConfig,
        db: Arc<Mutex<Option<Database>>>,
        app_handle: Arc<std::sync::Mutex<Option<tauri::AppHandle>>>,
    ) -> Self {
        Self {
            handle: Arc::new(Mutex::new(None)),
            config: Arc::new(Mutex::new(config)),
            db,
            stop_tx: Arc::new(Mutex::new(None)),
            app_handle,
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
        let app_handle_clone = Arc::clone(&self.app_handle);
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
                    // Run both legacy config-based scraping and saved searches
                    Self::run_scheduled_scrape(config.clone(), Arc::clone(&db_clone), Arc::clone(&app_handle_clone)).await;
                }

                // Always check and run saved searches (they have their own enabled flag)
                Self::run_saved_searches(Arc::clone(&db_clone), Arc::clone(&app_handle_clone))
                    .await;

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

        println!(
            "✅ Job scheduler started with interval: {} seconds ({} hours)",
            interval_secs,
            interval_secs / 3600
        );
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

    /// Get scheduler status
    pub async fn get_status(&self) -> serde_json::Value {
        let config = self.config.lock().await;
        let running = self.handle.lock().await.is_some();

        serde_json::json!({
            "running": running,
            "enabled": config.enabled,
            "schedule": config.schedule,
            "query": config.query,
            "sources": config.sources,
        })
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
        app_handle: Arc<std::sync::Mutex<Option<tauri::AppHandle>>>,
    ) {
        println!(
            "🔍 Starting scheduled job scrape for query: '{}'",
            config.query
        );

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

        // Scrape jobs - wrap in spawn_blocking to avoid runtime conflicts
        let query = config.query.clone();
        let sources = config.sources.clone();
        let jobs = match tokio::task::spawn_blocking(move || {
            if sources.is_empty() {
                scraper.scrape_all(&query)
            } else {
                scraper.scrape_selected(&sources, &query)
            }
        })
        .await
        {
            Ok(result) => result,
            Err(e) => {
                eprintln!("❌ Scraping task panicked: {}", e);
                return;
            }
        };

        match jobs {
            Ok(scraped_jobs) => {
                println!("✅ Scraped {} jobs", scraped_jobs.len());

                // Save jobs to database
                let mut saved_count = 0;
                {
                    let db_guard = db.lock().await;
                    if let Some(db_ref) = db_guard.as_ref() {
                        let conn = db_ref.get_connection();
                        for mut job in scraped_jobs {
                            // Check if job already exists
                            if conn.get_job_by_url(&job.url).unwrap_or(None).is_none() {
                                if conn.create_job(&mut job).is_ok() {
                                    saved_count += 1;
                                }
                            }
                        }
                    }
                } // db_guard and conn dropped here

                if saved_count > 0 {
                    println!("💾 Saved {} new jobs to database", saved_count);

                    // --- CLOSED LOOP: Qualify Scouted Jobs ---
                    println!("🧠 Running Brain qualification on new scouted jobs...");
                    let brain = crate::intelligence::Brain::new(Arc::clone(&db));
                    if let Ok(qualified_count) = brain.process_scouted_jobs().await {
                        if qualified_count > 0 {
                            println!("✅ Qualified {} jobs", qualified_count);
                            
                            // --- CLOSED LOOP: Trigger Auto-Apply for Top-Tier Prospects ---
                            println!("🚀 Checking for top-tier prospects to auto-apply...");
                            if let Ok(applied_count) = brain.auto_apply_prospects().await {
                                if applied_count > 0 {
                                    println!("✨ Auto-applied to {} high-match prospects!", applied_count);
                                    
                                    // Trigger event for frontend
                                    let handler = app_handle.lock().unwrap();
                                    if let Some(h) = handler.as_ref() {
                                        use tauri::Emitter;
                                        let _ = h.emit("auto-apply-triggered", applied_count);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("❌ Scraping failed: {}", e);
            }
        }
    }

    /// Run saved searches that are due for execution
    async fn run_saved_searches(
        db: Arc<Mutex<Option<Database>>>,
        app_handle: Arc<std::sync::Mutex<Option<tauri::AppHandle>>>,
    ) {
        let searches = {
            let db_guard = db.lock().await;
            if let Some(db) = db_guard.as_ref() {
                let conn = db.get_connection();
                match conn.get_saved_searches_due_for_run() {
                    Ok(searches) => searches,
                    Err(e) => {
                        eprintln!("❌ Failed to get saved searches: {}", e);
                        return;
                    }
                }
            } else {
                return;
            }
        };

        if searches.is_empty() {
            return;
        }

        println!("🔍 Running {} saved searches", searches.len());

        for search in searches {
            println!("  📋 Running saved search: '{}'", search.name);

            let search_id = match search.id {
                Some(id) => id,
                None => continue,
            };

            // Run the saved search
            let new_jobs = Self::execute_saved_search(&search, Arc::clone(&db)).await;

            // Update last_run_at
            {
                let db_guard = db.lock().await;
                if let Some(db) = db_guard.as_ref() {
                    let conn = db.get_connection();
                    if let Err(e) = conn.update_saved_search_last_run(search_id) {
                        eprintln!(
                            "⚠️ Failed to update last_run_at for search {}: {}",
                            search_id, e
                        );
                    }
                }
            }

            // Send notification if new jobs found
            if !new_jobs.is_empty() {
                Self::send_notification_for_new_jobs(
                    Arc::clone(&app_handle),
                    &search.name,
                    new_jobs.len(),
                )
                .await;
            }
        }
    }

    /// Execute a single saved search and return new jobs found
    async fn execute_saved_search(
        search: &crate::db::models::SavedSearch,
        db: Arc<Mutex<Option<Database>>>,
    ) -> Vec<crate::db::models::Job> {
        use crate::scraper::config::ScraperConfig;
        use crate::scraper::JobScraper;

        // Get Firecrawl API key if available
        let firecrawl_key = {
            let db_guard = db.lock().await;
            if let Some(db) = db_guard.as_ref() {
                let conn = db.get_connection();
                if let Ok(Some(credential)) = conn.get_credential("firecrawl") {
                    if let Some(api_key) = credential.tokens.as_deref() {
                        if let Ok(tokens) = serde_json::from_str::<serde_json::Value>(api_key) {
                            tokens
                                .get("api_key")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                                .or_else(|| Some(api_key.to_string()))
                        } else {
                            Some(api_key.to_string())
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        };

        let mut config = ScraperConfig::default();
        if let Some(key) = firecrawl_key {
            config.firecrawl_api_key = Some(key);
            config.use_firecrawl = true;
        }

        let mut new_jobs = Vec::new();

        // Scrape from each source - wrap in spawn_blocking to avoid runtime conflicts
        for source in &search.sources {
            let query = search.query.clone();
            let config_clone = config.clone();
            let source_str = source.clone();

            let jobs_result = match tokio::task::spawn_blocking(move || match source_str.as_str() {
                "remotive" => crate::scraper::remotive::RemotiveScraper
                    .scrape_with_config(&query, &config_clone),
                "remoteok" => crate::scraper::remote_ok::RemoteOkScraper
                    .scrape_with_config(&query, &config_clone),
                "wellfound" => crate::scraper::wellfound::WellfoundScraper
                    .scrape_with_config(&query, &config_clone),
                "greenhouse" => crate::scraper::greenhouse_board::GreenhouseBoardScraper
                    .scrape_with_config(&query, &config_clone),
                _ => Ok(Vec::new()),
            })
            .await
            {
                Ok(result) => result,
                Err(e) => {
                    eprintln!("❌ Scraping task panicked for source {}: {}", source, e);
                    continue;
                }
            };

            match jobs_result {
                Ok(mut jobs) => {
                    // Filter jobs based on saved search criteria
                    let db_guard = db.lock().await;
                    if let Some(db) = db_guard.as_ref() {
                        let conn = db.get_connection();

                        for mut job in jobs.drain(..) {
                            // Check if job already exists
                            if conn.get_job_by_url(&job.url).unwrap_or(None).is_some() {
                                continue;
                            }

                            // Apply filters
                            if search.filters.remote_only {
                                if let Some(location) = &job.location {
                                    if !location.to_lowercase().contains("remote") {
                                        continue;
                                    }
                                } else {
                                    continue;
                                }
                            }

                            // Check match score
                            let min_score = search
                                .filters
                                .min_match_score
                                .unwrap_or(search.min_match_score as i32);
                            if let Some(score) = job.match_score {
                                if (score as i32) < min_score {
                                    continue;
                                }
                            } else if min_score > 0 {
                                // Job doesn't have a match score yet, skip if min_score required
                                continue;
                            }

                            // Check skill filter
                            if let Some(skill_filter) = &search.filters.skill_filter {
                                let skill_lower = skill_filter.to_lowercase();
                                let matches_title = job.title.to_lowercase().contains(&skill_lower);
                                let matches_desc = job
                                    .description
                                    .as_ref()
                                    .map(|d| d.to_lowercase().contains(&skill_lower))
                                    .unwrap_or(false);
                                let matches_req = job
                                    .requirements
                                    .as_ref()
                                    .map(|r| r.to_lowercase().contains(&skill_lower))
                                    .unwrap_or(false);

                                if !matches_title && !matches_desc && !matches_req {
                                    continue;
                                }
                            }

                            // Save job to database
                            if conn.create_job(&mut job).is_ok() {
                                new_jobs.push(job);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("⚠️ Failed to scrape {}: {}", source, e);
                }
            }
        }

        new_jobs
    }

    /// Send desktop notification for new jobs
    async fn send_notification_for_new_jobs(
        app_handle: Arc<std::sync::Mutex<Option<tauri::AppHandle>>>,
        search_name: &str,
        job_count: usize,
    ) {
        let title = format!("New jobs found: {}", search_name);
        let body = format!("Found {} new matching jobs", job_count);

        // Try to send desktop notification directly
        if let Some(app) = app_handle.lock().unwrap().as_ref().cloned() {
            let title_clone = title.clone();
            let body_clone = body.clone();
            let _ = tauri::async_runtime::spawn(async move {
                use tauri_plugin_notification::NotificationExt;
                let _permission = app.notification().request_permission();
                let _ = app
                    .notification()
                    .builder()
                    .title(&title_clone)
                    .body(&body_clone)
                    .show();
            });
        }

        println!(
            "🔔 Notification: Found {} new jobs for search '{}'",
            job_count, search_name
        );
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
        assert_eq!(
            JobScheduler::parse_schedule_to_interval("0 9 * * *"),
            24 * 3600
        );

        // Test 6-hour schedule
        assert_eq!(
            JobScheduler::parse_schedule_to_interval("0 */6 * * *"),
            6 * 3600
        );

        // Test 12-hour schedule
        assert_eq!(
            JobScheduler::parse_schedule_to_interval("0 */12 * * *"),
            12 * 3600
        );

        // Test default (unknown pattern)
        assert_eq!(
            JobScheduler::parse_schedule_to_interval("unknown"),
            24 * 3600
        );
    }

    #[tokio::test]
    async fn test_scheduler_creation() {
        let (db, _temp_dir) = create_test_db();
        let config = SchedulerConfig::default();
        let app_handle = Arc::new(std::sync::Mutex::new(None));
        let scheduler = JobScheduler::new(config, db, app_handle);

        // Scheduler should be created but not running
        assert!(!scheduler.is_running().await);
    }

    #[tokio::test]
    async fn test_scheduler_start_stop() {
        let (db, _temp_dir) = create_test_db();
        let mut config = SchedulerConfig::default();
        config.enabled = true;
        config.schedule = "0 */1 * * *".to_string(); // Every hour for faster testing

        let app_handle = Arc::new(std::sync::Mutex::new(None));
        let scheduler = JobScheduler::new(config, db, app_handle);

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
        let app_handle = Arc::new(std::sync::Mutex::new(None));
        let scheduler = JobScheduler::new(config, db, app_handle);

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

        let app_handle = Arc::new(std::sync::Mutex::new(None));
        let scheduler = JobScheduler::new(config.clone(), db, app_handle);
        let retrieved_config = scheduler.get_config().await;

        assert_eq!(retrieved_config.query, "test query");
        assert_eq!(retrieved_config.enabled, true);
        assert_eq!(retrieved_config.schedule, config.schedule);
    }

    #[tokio::test]
    async fn test_scheduler_update_config() {
        let (db, _temp_dir) = create_test_db();
        let config = SchedulerConfig::default();
        let app_handle = Arc::new(std::sync::Mutex::new(None));
        let scheduler = JobScheduler::new(config, db, app_handle);

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
        let app_handle = Arc::new(std::sync::Mutex::new(None));
        let scheduler = JobScheduler::new(config, db, app_handle);

        // Stop scheduler that's not running (should not error)
        let result = scheduler.stop().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_autonomous_loop_logic() {
        let (db_arc, _temp_dir) = create_test_db();
        
        // 1. Setup a profile (user_profile table with profile_data JSON)
        {
            let db_guard = db_arc.lock().await;
            let db = db_guard.as_ref().unwrap();
            let conn = db.get_connection();
            let profile_json = r#"{"personal_info":{"name":"Test User","email":"test@example.com","phone":null,"location":"Remote","linkedin":null,"github":null,"portfolio":null},"summary":"Expert in Rust and React with 5+ years experience","skills":{"technical_skills":["Rust","React"],"soft_skills":[],"experience_years":{"Rust":5,"React":5},"proficiency_levels":{}},"experience":[{"company":"Tech Corp","position":"Senior Rust Engineer","duration":"5 years","description":["Built systems in Rust"],"technologies":["Rust","React"]}],"education":[],"projects":[]}"#;
            conn.execute(
                "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, datetime('now'))",
                [profile_json],
            ).unwrap();
            
            // 2. Setup a scouted job that matches well
            let mut job = crate::db::models::Job {
                id: None,
                title: "Senior Rust Engineer".to_string(),
                company: "Tech Corp".to_string(),
                url: "https://example.com/rust-job".to_string(),
                location: Some("Remote".to_string()),
                description: Some("Rust and React developer.".to_string()),
                status: crate::db::models::JobStatus::Scouted,
                match_score: None,
                ..Default::default()
            };
            conn.create_job(&mut job).unwrap();
        }
        
        let config = SchedulerConfig {
            enabled: true,
            ..Default::default()
        };
        
        // 3. Manually trigger the "scraped" logic part
        let brain = crate::intelligence::Brain::new(Arc::clone(&db_arc));
        let qualified = brain.process_scouted_jobs().await.unwrap();
        assert_eq!(qualified, 1);
        
        // Check if promoted
        {
            let db_guard = db_arc.lock().await;
            let db = db_guard.as_ref().unwrap();
            let conn = db.get_connection();
            let updated_job = conn.get_job_by_url("https://example.com/rust-job").unwrap().unwrap();
            let score = updated_job.match_score.unwrap();
            assert!(score >= 50.0, "match_score should be >= 50, got {}", score);
            // Promotion to Prospect happens when heuristic score >= 80
            let expected_status = if score >= 80.0 {
                crate::db::models::JobStatus::Prospect
            } else {
                crate::db::models::JobStatus::Scouted
            };
            assert_eq!(updated_job.status, expected_status, "status should match score threshold");
        }
    }
}

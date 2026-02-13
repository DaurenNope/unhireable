//! Application Queue - Manages job application automation
//!
//! Processes jobs one-by-one with human-like delays to avoid detection.
//! Uses the Browser Bridge to communicate with Chrome extension.

use crate::automation::bridge::{ApplyStatus, BrowserBridge};
use crate::db::models::Job;
use crate::db::Database;
use crate::generator::UserProfile;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tokio::time::{sleep, Duration};

/// Configuration for the application queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueConfig {
    /// Minimum delay between applications (seconds)
    pub min_delay_secs: u64,
    /// Maximum delay between applications (seconds)
    pub max_delay_secs: u64,
    /// Maximum applications per hour
    pub max_apps_per_hour: u32,
    /// Maximum applications per day (no LinkedIn Premium = ~25)
    pub max_apps_per_day: u32,
    /// Minimum match score to auto-apply (0.0 - 1.0)
    pub match_threshold: f64,
    /// Whether to auto-submit or just fill forms
    pub auto_submit: bool,
    /// Use human-like behavior
    pub human_mode: bool,
    /// Pause between batches (seconds)
    pub batch_pause_secs: u64,
    /// Jobs per batch before pause
    pub batch_size: u32,
}

impl Default for QueueConfig {
    fn default() -> Self {
        Self {
            min_delay_secs: 45,    // Minimum 45 seconds between apps
            max_delay_secs: 120,   // Maximum 2 minutes between apps
            max_apps_per_hour: 10, // Max 10 per hour
            max_apps_per_day: 25,  // Conservative for non-Premium
            match_threshold: 0.70, // 70% match minimum
            auto_submit: true,     // Auto-submit by default
            human_mode: true,      // Human-like behavior
            batch_pause_secs: 300, // 5 minute pause between batches
            batch_size: 5,         // 5 jobs per batch
        }
    }
}

/// A job in the application queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedJob {
    pub job: Job,
    pub match_score: f64,
    pub apply_method: ApplyMethod,
    pub status: QueueStatus,
    pub attempts: u32,
    pub last_error: Option<String>,
    pub queued_at: chrono::DateTime<chrono::Utc>,
}

/// How to apply to a job
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ApplyMethod {
    /// LinkedIn Easy Apply (modal form)
    LinkedInEasyApply,
    /// External ATS (redirect to company site)
    ExternalAts(String), // ATS name: "Greenhouse", "Lever", etc.
    /// Unknown application method
    Unknown,
}

impl ApplyMethod {
    /// Detect apply method from job URL and description
    pub fn detect(url: &str, _description: Option<&str>) -> Self {
        let url_lower = url.to_lowercase();

        if url_lower.contains("linkedin.com") {
            // Check if it's Easy Apply
            // In reality, we'd need to check the page for the Easy Apply button
            ApplyMethod::LinkedInEasyApply
        } else if url_lower.contains("greenhouse.io") {
            ApplyMethod::ExternalAts("Greenhouse".to_string())
        } else if url_lower.contains("lever.co") {
            ApplyMethod::ExternalAts("Lever".to_string())
        } else if url_lower.contains("ashbyhq.com") {
            ApplyMethod::ExternalAts("Ashby".to_string())
        } else if url_lower.contains("workday.com") {
            ApplyMethod::ExternalAts("Workday".to_string())
        } else {
            ApplyMethod::Unknown
        }
    }
}

/// Status of a queued job
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QueueStatus {
    Pending,
    InProgress,
    Applied,
    Failed,
    Skipped,
    ManualRequired,
}

/// Overall queue state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QueueState {
    Idle,
    Running,
    Paused,
    Stopped,
}

/// Queue statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QueueStats {
    pub total_queued: usize,
    pub pending: usize,
    pub applied: usize,
    pub failed: usize,
    pub skipped: usize,
    pub manual_required: usize,
    pub apps_this_hour: u32,
    pub apps_today: u32,
}

/// The application queue manager
pub struct ApplicationQueue {
    jobs: Arc<RwLock<VecDeque<QueuedJob>>>,
    state: Arc<RwLock<QueueState>>,
    config: Arc<RwLock<QueueConfig>>,
    bridge: Arc<Mutex<BrowserBridge>>,
    stats: Arc<RwLock<QueueStats>>,
    db: Arc<Mutex<Option<Database>>>,
    profile: Arc<RwLock<Option<UserProfile>>>,
    hour_start: Arc<RwLock<chrono::DateTime<chrono::Utc>>>,
    day_start: Arc<RwLock<chrono::DateTime<chrono::Utc>>>,
}

impl ApplicationQueue {
    pub fn new(
        bridge: BrowserBridge,
        db: Arc<Mutex<Option<Database>>>,
        config: QueueConfig,
    ) -> Self {
        Self {
            jobs: Arc::new(RwLock::new(VecDeque::new())),
            state: Arc::new(RwLock::new(QueueState::Idle)),
            config: Arc::new(RwLock::new(config)),
            bridge: Arc::new(Mutex::new(bridge)),
            stats: Arc::new(RwLock::new(QueueStats::default())),
            db,
            profile: Arc::new(RwLock::new(None)),
            hour_start: Arc::new(RwLock::new(chrono::Utc::now())),
            day_start: Arc::new(RwLock::new(chrono::Utc::now())),
        }
    }

    /// Set the user profile to use for applications
    pub async fn set_profile(&self, profile: UserProfile) {
        *self.profile.write().await = Some(profile);
    }

    /// Add a job to the queue if it meets the threshold
    pub async fn add_job(&self, job: Job, match_score: f64) -> bool {
        let config = self.config.read().await;

        if match_score < config.match_threshold {
            return false; // Below threshold
        }

        let apply_method = ApplyMethod::detect(&job.url, job.description.as_deref());

        let queued_job = QueuedJob {
            job,
            match_score,
            apply_method,
            status: QueueStatus::Pending,
            attempts: 0,
            last_error: None,
            queued_at: chrono::Utc::now(),
        };

        let mut jobs = self.jobs.write().await;
        jobs.push_back(queued_job);

        // Update stats
        let mut stats = self.stats.write().await;
        stats.total_queued += 1;
        stats.pending += 1;

        true
    }

    /// Add multiple jobs to the queue (sorted by match score)
    pub async fn add_jobs(&self, jobs: Vec<(Job, f64)>) -> usize {
        let mut added = 0;

        // Sort by match score (highest first)
        let mut sorted_jobs = jobs;
        sorted_jobs.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        for (job, score) in sorted_jobs {
            if self.add_job(job, score).await {
                added += 1;
            }
        }

        added
    }

    /// Start processing the queue
    pub async fn start(&self) -> Result<()> {
        {
            let mut state = self.state.write().await;
            if *state == QueueState::Running {
                return Ok(()); // Already running
            }
            *state = QueueState::Running;
        }

        println!("🚀 Application queue started");

        // Clone references for the spawned task
        let jobs = self.jobs.clone();
        let state = self.state.clone();
        let config = self.config.clone();
        let bridge = self.bridge.clone();
        let stats = self.stats.clone();
        let profile = self.profile.clone();
        let hour_start = self.hour_start.clone();
        let day_start = self.day_start.clone();

        // Spawn the processing task
        tokio::spawn(async move {
            let mut batch_count = 0u32;

            loop {
                // Check if we should stop
                {
                    let current_state = state.read().await;
                    if *current_state == QueueState::Stopped {
                        break;
                    }
                    if *current_state == QueueState::Paused {
                        sleep(Duration::from_secs(1)).await;
                        continue;
                    }
                }

                // Check rate limits
                {
                    let cfg = config.read().await;
                    let mut current_stats = stats.write().await;

                    // Reset hourly counter if needed
                    let now = chrono::Utc::now();
                    let hour_diff = now.signed_duration_since(*hour_start.read().await);
                    if hour_diff.num_hours() >= 1 {
                        current_stats.apps_this_hour = 0;
                        *hour_start.write().await = now;
                    }

                    // Reset daily counter if needed
                    let day_diff = now.signed_duration_since(*day_start.read().await);
                    if day_diff.num_hours() >= 24 {
                        current_stats.apps_today = 0;
                        *day_start.write().await = now;
                    }

                    // Check limits
                    if current_stats.apps_this_hour >= cfg.max_apps_per_hour {
                        println!("⏸️  Hourly limit reached, waiting...");
                        sleep(Duration::from_secs(60)).await;
                        continue;
                    }

                    if current_stats.apps_today >= cfg.max_apps_per_day {
                        println!("⏸️  Daily limit reached, stopping queue");
                        *state.write().await = QueueState::Stopped;
                        break;
                    }
                }

                // Get next job
                let job = {
                    let mut queue = jobs.write().await;
                    queue
                        .iter_mut()
                        .find(|j| j.status == QueueStatus::Pending)
                        .map(|j| {
                            j.status = QueueStatus::InProgress;
                            j.clone()
                        })
                };

                match job {
                    Some(mut queued_job) => {
                        println!(
                            "📋 Processing: {} at {}",
                            queued_job.job.title, queued_job.job.company
                        );

                        // Get profile
                        let user_profile = profile.read().await.clone();
                        if user_profile.is_none() {
                            println!("❌ No user profile set");
                            queued_job.status = QueueStatus::Failed;
                            queued_job.last_error = Some("No profile configured".to_string());

                            // Update in queue
                            let mut queue = jobs.write().await;
                            if let Some(j) =
                                queue.iter_mut().find(|j| j.job.url == queued_job.job.url)
                            {
                                *j = queued_job;
                            }
                            continue;
                        }

                        let cfg = config.read().await;

                        // Apply to the job
                        let profile_json =
                            serde_json::to_value(&user_profile.unwrap()).unwrap_or_default();
                        let result = bridge
                            .lock()
                            .await
                            .apply_to_job(&queued_job.job.url, profile_json, cfg.auto_submit)
                            .await;

                        match result {
                            Ok(status) => {
                                queued_job.status = match status {
                                    ApplyStatus::Success => QueueStatus::Applied,
                                    ApplyStatus::Failed => QueueStatus::Failed,
                                    ApplyStatus::ManualRequired => QueueStatus::ManualRequired,
                                    _ => QueueStatus::Failed,
                                };

                                if queued_job.status == QueueStatus::Applied {
                                    let mut current_stats = stats.write().await;
                                    current_stats.applied += 1;
                                    current_stats.apps_this_hour += 1;
                                    current_stats.apps_today += 1;
                                    current_stats.pending = current_stats.pending.saturating_sub(1);
                                    println!("✅ Applied successfully!");
                                    batch_count += 1;
                                } else {
                                    let mut current_stats = stats.write().await;
                                    if queued_job.status == QueueStatus::Failed {
                                        current_stats.failed += 1;
                                    } else {
                                        current_stats.manual_required += 1;
                                    }
                                    current_stats.pending = current_stats.pending.saturating_sub(1);
                                }
                            }
                            Err(e) => {
                                queued_job.status = QueueStatus::Failed;
                                queued_job.last_error = Some(e.to_string());
                                queued_job.attempts += 1;

                                let mut current_stats = stats.write().await;
                                current_stats.failed += 1;
                                current_stats.pending = current_stats.pending.saturating_sub(1);

                                println!("❌ Application failed: {}", e);
                            }
                        }

                        // Update job in queue
                        {
                            let mut queue = jobs.write().await;
                            if let Some(j) =
                                queue.iter_mut().find(|j| j.job.url == queued_job.job.url)
                            {
                                *j = queued_job;
                            }
                        }

                        // Random delay before next application
                        let delay = {
                            use rand::Rng;
                            let cfg = config.read().await;
                            let mut rng = rand::thread_rng();
                            rng.gen_range(cfg.min_delay_secs..=cfg.max_delay_secs)
                        };
                        println!("⏳ Waiting {} seconds before next application...", delay);
                        sleep(Duration::from_secs(delay)).await;

                        // Batch pause
                        let batch_size = config.read().await.batch_size;
                        if batch_count >= batch_size {
                            let pause = config.read().await.batch_pause_secs;
                            println!("☕ Batch complete, taking {} second break...", pause);
                            sleep(Duration::from_secs(pause)).await;
                            batch_count = 0;
                        }
                    }
                    None => {
                        // No more pending jobs
                        println!("✅ Queue empty - all jobs processed");
                        *state.write().await = QueueState::Idle;
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Pause the queue
    pub async fn pause(&self) {
        *self.state.write().await = QueueState::Paused;
        println!("⏸️  Queue paused");
    }

    /// Resume the queue
    pub async fn resume(&self) {
        let current = self.state.read().await.clone();
        if current == QueueState::Paused {
            *self.state.write().await = QueueState::Running;
            println!("▶️  Queue resumed");
        }
    }

    /// Stop the queue
    pub async fn stop(&self) {
        *self.state.write().await = QueueState::Stopped;
        println!("⏹️  Queue stopped");
    }

    /// Get current queue state
    pub async fn get_state(&self) -> QueueState {
        self.state.read().await.clone()
    }

    /// Get queue statistics
    pub async fn get_stats(&self) -> QueueStats {
        self.stats.read().await.clone()
    }

    /// Get all queued jobs
    pub async fn get_jobs(&self) -> Vec<QueuedJob> {
        self.jobs.read().await.iter().cloned().collect()
    }

    /// Update configuration
    pub async fn update_config(&self, config: QueueConfig) {
        *self.config.write().await = config;
    }

    /// Clear the queue
    pub async fn clear(&self) {
        self.jobs.write().await.clear();
        *self.stats.write().await = QueueStats::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automation::bridge::create_bridge;

    #[test]
    fn test_apply_method_detection() {
        assert_eq!(
            ApplyMethod::detect("https://www.linkedin.com/jobs/view/123", None),
            ApplyMethod::LinkedInEasyApply
        );

        assert_eq!(
            ApplyMethod::detect("https://boards.greenhouse.io/company/job", None),
            ApplyMethod::ExternalAts("Greenhouse".to_string())
        );

        assert_eq!(
            ApplyMethod::detect("https://jobs.lever.co/company/job", None),
            ApplyMethod::ExternalAts("Lever".to_string())
        );
    }

    #[test]
    fn test_queue_config_default() {
        let config = QueueConfig::default();
        assert_eq!(config.max_apps_per_day, 25);
        assert_eq!(config.match_threshold, 0.70);
    }
}

//! Auto-Pilot Mode
//! 
//! The fully automated job hunting system that runs everything end-to-end

use crate::automation::config::AutomationConfig;
use crate::automation::email_monitor::{
    ClassifiedEmail, EmailCategory, EmailClassifier, EmailMonitorConfig, EmailMonitorStatus,
};
use crate::automation::orchestrator::AutomationOrchestrator;
use crate::automation::pipeline::PipelineResult;
use crate::automation::scheduler::{AutomationScheduler, ScheduleConfig, SchedulerStatus};
use crate::db::Database;
use crate::generator::UserProfile;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Complete auto-pilot configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoPilotConfig {
    /// Master enable switch
    pub enabled: bool,
    
    /// Automation pipeline config
    pub automation: AutomationConfig,
    
    /// Scheduling config
    pub schedule: ScheduleConfig,
    
    /// Email monitoring config
    pub email_monitor: EmailMonitorConfig,
    
    /// Intelligence features
    pub intelligence: IntelligenceConfig,
    
    /// Safety limits
    pub safety: SafetyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceConfig {
    /// Learn from successful applications
    pub learn_from_success: bool,
    
    /// Adjust match score threshold based on results
    pub adaptive_threshold: bool,
    
    /// Track which companies respond positively
    pub track_company_success: bool,
    
    /// Prioritize jobs similar to successful applications
    pub prioritize_similar_jobs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyConfig {
    /// Maximum applications per week
    pub max_applications_per_week: u32,
    
    /// Maximum applications per company
    pub max_per_company: u32,
    
    /// Minimum hours between applications
    pub min_hours_between_runs: u32,
    
    /// Stop if too many rejections in a row
    pub pause_after_rejections: u32,
    
    /// Require confirmation for first N applications
    pub confirm_first_n: u32,
}

impl Default for AutoPilotConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            automation: AutomationConfig::default(),
            schedule: ScheduleConfig::default(),
            email_monitor: EmailMonitorConfig::default(),
            intelligence: IntelligenceConfig {
                learn_from_success: true,
                adaptive_threshold: true,
                track_company_success: true,
                prioritize_similar_jobs: true,
            },
            safety: SafetyConfig {
                max_applications_per_week: 50,
                max_per_company: 3,
                min_hours_between_runs: 4,
                pause_after_rejections: 10,
                confirm_first_n: 5,
            },
        }
    }
}

/// Auto-pilot status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoPilotStatus {
    pub enabled: bool,
    pub running: bool,
    pub mode: String,
    /// Apply mode: Manual, SemiAuto, or Autopilot
    pub apply_mode: ApplyModeStatus,
    pub uptime_secs: f64,
    pub started_at: Option<DateTime<Utc>>,
    
    /// Pipeline status
    pub pipeline: PipelineStatus,
    
    /// Scheduler status  
    pub scheduler: SchedulerStatus,
    
    /// Email monitor status
    pub email_monitor: EmailMonitorStatus,
    
    /// Overall statistics
    pub stats: AutoPilotStats,
    
    /// Recent activity
    pub recent_activity: Vec<ActivityEntry>,
    
    /// Any warnings or alerts
    pub alerts: Vec<Alert>,
}

/// Apply mode status for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyModeStatus {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PipelineStatus {
    pub last_run: Option<DateTime<Utc>>,
    pub last_result: Option<String>,
    pub jobs_discovered_today: usize,
    pub applications_today: usize,
    pub successful_today: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AutoPilotStats {
    pub total_jobs_discovered: usize,
    pub total_applications: usize,
    pub total_interviews: usize,
    pub total_offers: usize,
    pub total_rejections: usize,
    pub response_rate: f64,
    pub interview_rate: f64,
    pub applications_this_week: usize,
    pub avg_match_score: f64,
    pub best_performing_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEntry {
    pub timestamp: DateTime<Utc>,
    pub action: String,
    pub details: String,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub level: AlertLevel,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub action_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertLevel {
    Info,
    Warning,
    Error,
    Success,
}

use crate::applicator::ApplyMode;

/// The main Auto-Pilot controller
pub struct AutoPilot {
    config: Arc<Mutex<AutoPilotConfig>>,
    db: Arc<Mutex<Option<Database>>>,
    app_dir: Arc<Mutex<Option<std::path::PathBuf>>>,
    profile: Arc<Mutex<Option<UserProfile>>>,
    
    // Components
    scheduler: Arc<Mutex<Option<AutomationScheduler>>>,
    email_classifier: Arc<EmailClassifier>,
    
    // State
    running: Arc<Mutex<bool>>,
    started_at: Arc<Mutex<Option<DateTime<Utc>>>>,
    stats: Arc<Mutex<AutoPilotStats>>,
    activity_log: Arc<Mutex<Vec<ActivityEntry>>>,
    alerts: Arc<Mutex<Vec<Alert>>>,
    processed_emails: Arc<Mutex<Vec<ClassifiedEmail>>>,
    applications_this_week: Arc<Mutex<usize>>,
    consecutive_rejections: Arc<Mutex<usize>>,
    
    // Apply mode
    apply_mode: Arc<Mutex<ApplyMode>>,
}

impl AutoPilot {
    pub fn new(
        config: AutoPilotConfig,
        db: Arc<Mutex<Option<Database>>>,
        app_dir: Arc<Mutex<Option<std::path::PathBuf>>>,
    ) -> Self {
        Self {
            config: Arc::new(Mutex::new(config)),
            db,
            app_dir,
            profile: Arc::new(Mutex::new(None)),
            scheduler: Arc::new(Mutex::new(None)),
            email_classifier: Arc::new(EmailClassifier::new()),
            running: Arc::new(Mutex::new(false)),
            started_at: Arc::new(Mutex::new(None)),
            stats: Arc::new(Mutex::new(AutoPilotStats::default())),
            activity_log: Arc::new(Mutex::new(Vec::new())),
            alerts: Arc::new(Mutex::new(Vec::new())),
            processed_emails: Arc::new(Mutex::new(Vec::new())),
            applications_this_week: Arc::new(Mutex::new(0)),
            consecutive_rejections: Arc::new(Mutex::new(0)),
            apply_mode: Arc::new(Mutex::new(ApplyMode::Manual)), // Safe default
        }
    }

    /// Set user profile
    pub async fn set_profile(&self, profile: UserProfile) {
        *self.profile.lock().await = Some(profile);
    }
    
    /// Get current apply mode
    pub async fn get_apply_mode(&self) -> ApplyMode {
        *self.apply_mode.lock().await
    }
    
    /// Set apply mode
    pub async fn set_apply_mode(&self, mode: ApplyMode) {
        *self.apply_mode.lock().await = mode;
        self.log_activity(
            &format!("Apply mode changed to {}", mode.name()),
            mode.description(),
            true,
        ).await;
    }

    /// Start auto-pilot mode
    pub async fn start(&self) -> Result<()> {
        let config = self.config.lock().await.clone();
        
        if !config.enabled {
            return Err(anyhow::anyhow!("Auto-pilot is disabled in configuration"));
        }

        let profile = self.profile.lock().await.clone()
            .ok_or_else(|| anyhow::anyhow!("User profile not set"))?;

        *self.running.lock().await = true;
        *self.started_at.lock().await = Some(Utc::now());

        self.log_activity("Auto-pilot started", "Full automation mode activated", true).await;
        self.add_alert(AlertLevel::Success, "Auto-pilot mode activated", false).await;

        println!("\n");
        println!("╔════════════════════════════════════════════════════════════╗");
        println!("║            🚀 AUTO-PILOT MODE ACTIVATED 🚀                 ║");
        println!("╠════════════════════════════════════════════════════════════╣");
        println!("║  Your job hunting is now fully automated!                  ║");
        println!("║                                                            ║");
        println!("║  The system will:                                          ║");
        println!("║  • 🔍 Discover new jobs matching your profile              ║");
        println!("║  • 📄 Generate tailored resumes & cover letters            ║");
        println!("║  • 🚀 Submit applications automatically                    ║");
        println!("║  • 📧 Monitor your inbox for responses                     ║");
        println!("║  • 🔔 Notify you of interviews and offers                  ║");
        println!("║                                                            ║");
        println!("║  Safety: Dry-run={}, Max/week={}                           ║", 
                 config.automation.application.dry_run, 
                 config.safety.max_applications_per_week);
        println!("╚════════════════════════════════════════════════════════════╝");
        println!("\n");

        // Initialize scheduler
        let scheduler = AutomationScheduler::new(
            config.schedule.clone(),
            config.automation.clone(),
            self.db.clone(),
            self.app_dir.clone(),
        );
        scheduler.set_profile(profile).await;
        
        *self.scheduler.lock().await = Some(scheduler);

        // Start the scheduler in background
        let scheduler_ref = self.scheduler.clone();
        let running_ref = self.running.clone();
        let stats_ref = self.stats.clone();
        let activity_ref = self.activity_log.clone();
        let alerts_ref = self.alerts.clone();
        let config_ref = self.config.clone();
        let apps_week_ref = self.applications_this_week.clone();

        tokio::spawn(async move {
            loop {
                if !*running_ref.lock().await {
                    break;
                }

                // Check safety limits
                let config = config_ref.lock().await.clone();
                let apps_this_week = *apps_week_ref.lock().await;
                
                if apps_this_week >= config.safety.max_applications_per_week as usize {
                    let mut alerts = alerts_ref.lock().await;
                    alerts.push(Alert {
                        level: AlertLevel::Warning,
                        message: "Weekly application limit reached. Pausing until next week.".to_string(),
                        timestamp: Utc::now(),
                        action_required: false,
                    });
                    break;
                }

                // Run scheduler if available
                if let Some(scheduler) = scheduler_ref.lock().await.as_ref() {
                    match scheduler.run_once().await {
                        Ok(result) => {
                            // Update stats
                            let mut stats = stats_ref.lock().await;
                            stats.total_jobs_discovered += result.jobs_discovered.len();
                            stats.total_applications += result.jobs_applied.len();
                            stats.applications_this_week += result.jobs_applied.iter().filter(|a| a.success).count();
                            
                            *apps_week_ref.lock().await += result.jobs_applied.iter().filter(|a| a.success).count();

                            // Log activity
                            let mut activity = activity_ref.lock().await;
                            activity.push(ActivityEntry {
                                timestamp: Utc::now(),
                                action: "Pipeline completed".to_string(),
                                details: result.summary(),
                                success: result.success,
                            });
                        }
                        Err(e) => {
                            let mut activity = activity_ref.lock().await;
                            activity.push(ActivityEntry {
                                timestamp: Utc::now(),
                                action: "Pipeline failed".to_string(),
                                details: e.to_string(),
                                success: false,
                            });
                        }
                    }
                }

                // Wait before next check
                tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            }
        });

        Ok(())
    }

    /// Stop auto-pilot mode
    pub async fn stop(&self) {
        *self.running.lock().await = false;
        
        if let Some(scheduler) = self.scheduler.lock().await.as_ref() {
            scheduler.stop().await;
        }

        self.log_activity("Auto-pilot stopped", "Automation paused", true).await;
        self.add_alert(AlertLevel::Info, "Auto-pilot mode deactivated", false).await;

        println!("\n🛑 Auto-pilot mode stopped\n");
    }

    /// Process an email and classify it
    pub async fn process_email(&self, from: &str, subject: &str, body: &str) -> ClassifiedEmail {
        let (category, confidence) = self.email_classifier.classify(subject, body);
        let extracted = self.email_classifier.extract_data(subject, body);
        let (requires_action, suggested_action) = self.email_classifier.requires_action(&category);

        // Clone for later use
        let suggested_action_for_alert = suggested_action.clone();
        
        let email = ClassifiedEmail {
            id: uuid::Uuid::new_v4().to_string(),
            from: from.to_string(),
            to: String::new(),
            subject: subject.to_string(),
            body_preview: body.chars().take(200).collect(),
            received_at: Utc::now(),
            category: category.clone(),
            confidence,
            extracted_data: extracted,
            requires_action,
            suggested_action,
        };

        // Update stats based on category
        {
            let mut stats = self.stats.lock().await;
            match category {
                EmailCategory::InterviewInvitation => stats.total_interviews += 1,
                EmailCategory::Offer => stats.total_offers += 1,
                EmailCategory::Rejection => {
                    stats.total_rejections += 1;
                    *self.consecutive_rejections.lock().await += 1;
                }
                _ => {}
            }
        }

        // Check for pause after rejections
        let config = self.config.lock().await.clone();
        let rejections = *self.consecutive_rejections.lock().await;
        if rejections >= config.safety.pause_after_rejections as usize {
            self.add_alert(
                AlertLevel::Warning,
                &format!("{} consecutive rejections. Consider reviewing your profile.", rejections),
                true,
            ).await;
        }

        // Store email
        self.processed_emails.lock().await.push(email.clone());

        // Add alert for actionable emails
        if requires_action {
            self.add_alert(
                AlertLevel::Info,
                &format!("Action required: {} - {}", subject, suggested_action_for_alert.unwrap_or_default()),
                true,
            ).await;
        }

        email
    }

    /// Get current status
    pub async fn get_status(&self) -> AutoPilotStatus {
        let config = self.config.lock().await.clone();
        let running = *self.running.lock().await;
        let started_at = *self.started_at.lock().await;
        
        let uptime = started_at
            .map(|s| (Utc::now() - s).num_seconds() as f64)
            .unwrap_or(0.0);

        let scheduler_status = if let Some(scheduler) = self.scheduler.lock().await.as_ref() {
            scheduler.get_status().await
        } else {
            SchedulerStatus {
                enabled: config.schedule.enabled,
                running: false,
                mode: config.schedule.mode,
                runs_today: 0,
                max_runs_per_day: config.schedule.max_runs_per_day,
                last_run: None,
                next_run: None,
                last_result_summary: None,
            }
        };

        let current_apply_mode = *self.apply_mode.lock().await;
        
        AutoPilotStatus {
            enabled: config.enabled,
            running,
            mode: format!("{:?}", config.schedule.mode),
            apply_mode: ApplyModeStatus {
                id: format!("{:?}", current_apply_mode).to_lowercase(),
                name: current_apply_mode.name().to_string(),
                icon: current_apply_mode.icon().to_string(),
                description: current_apply_mode.description().to_string(),
            },
            uptime_secs: uptime,
            started_at,
            pipeline: PipelineStatus::default(),
            scheduler: scheduler_status,
            email_monitor: EmailMonitorStatus {
                enabled: config.email_monitor.enabled,
                connected: false,
                last_check: None,
                emails_processed: self.processed_emails.lock().await.len(),
                pending_actions: self.processed_emails.lock().await
                    .iter()
                    .filter(|e| e.requires_action)
                    .count(),
                recent_emails: self.processed_emails.lock().await
                    .iter()
                    .rev()
                    .take(10)
                    .cloned()
                    .collect(),
            },
            stats: self.stats.lock().await.clone(),
            recent_activity: self.activity_log.lock().await
                .iter()
                .rev()
                .take(20)
                .cloned()
                .collect(),
            alerts: self.alerts.lock().await
                .iter()
                .rev()
                .take(10)
                .cloned()
                .collect(),
        }
    }

    /// Update configuration
    pub async fn update_config(&self, config: AutoPilotConfig) {
        *self.config.lock().await = config;
    }

    /// Get configuration
    pub async fn get_config(&self) -> AutoPilotConfig {
        self.config.lock().await.clone()
    }

    /// Manually trigger a pipeline run
    pub async fn run_now(&self) -> Result<PipelineResult> {
        let profile = self.profile.lock().await.clone()
            .ok_or_else(|| anyhow::anyhow!("User profile not set"))?;
        
        let config = self.config.lock().await.clone();
        
        let orchestrator = AutomationOrchestrator::new(
            config.automation,
            self.db.clone(),
            self.app_dir.clone(),
        );

        let result = orchestrator.run_pipeline(&profile).await?;
        
        // Update stats
        {
            let mut stats = self.stats.lock().await;
            stats.total_jobs_discovered += result.jobs_discovered.len();
            stats.total_applications += result.jobs_applied.len();
        }

        self.log_activity("Manual run completed", &result.summary(), result.success).await;

        Ok(result)
    }

    /// Log an activity
    async fn log_activity(&self, action: &str, details: &str, success: bool) {
        let mut log = self.activity_log.lock().await;
        log.push(ActivityEntry {
            timestamp: Utc::now(),
            action: action.to_string(),
            details: details.to_string(),
            success,
        });
        
        // Keep only last 100 entries
        let len = log.len();
        if len > 100 {
            log.drain(0..len - 100);
        }
    }

    /// Add an alert
    async fn add_alert(&self, level: AlertLevel, message: &str, action_required: bool) {
        let mut alerts = self.alerts.lock().await;
        alerts.push(Alert {
            level,
            message: message.to_string(),
            timestamp: Utc::now(),
            action_required,
        });
        
        // Keep only last 50 alerts
        let len = alerts.len();
        if len > 50 {
            alerts.drain(0..len - 50);
        }
    }

    /// Clear an alert
    pub async fn dismiss_alert(&self, index: usize) {
        let mut alerts = self.alerts.lock().await;
        if index < alerts.len() {
            alerts.remove(index);
        }
    }

    /// Reset weekly counter (call at start of week)
    pub async fn reset_weekly_stats(&self) {
        *self.applications_this_week.lock().await = 0;
        self.log_activity("Weekly stats reset", "New week started", true).await;
    }

    /// Reset consecutive rejections counter (call after a success)
    pub async fn reset_rejection_counter(&self) {
        *self.consecutive_rejections.lock().await = 0;
    }
}

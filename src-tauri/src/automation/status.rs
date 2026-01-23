//! Automation Status Tracking

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Current status of the automation system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationStatus {
    /// Whether automation is currently running
    pub running: bool,
    
    /// Current stage of the pipeline
    pub current_stage: Option<String>,
    
    /// When automation was last started
    pub started_at: Option<DateTime<Utc>>,
    
    /// When the last run completed
    pub last_completed_at: Option<DateTime<Utc>>,
    
    /// Next scheduled run
    pub next_run_at: Option<DateTime<Utc>>,
    
    /// Current run statistics
    pub current_run: Option<RunStats>,
    
    /// Overall statistics
    pub total_stats: AutomationStats,
    
    /// Recent activity log
    pub recent_activity: Vec<ActivityLogEntry>,
    
    /// Any errors from the last run
    pub last_errors: Vec<String>,
}

/// Statistics for a single automation run
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RunStats {
    pub jobs_scraped: usize,
    pub jobs_matched: usize,
    pub jobs_filtered: usize,
    pub documents_generated: usize,
    pub applications_attempted: usize,
    pub applications_successful: usize,
    pub applications_failed: usize,
    pub notifications_sent: usize,
    pub duration_secs: f64,
}

/// Overall automation statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AutomationStats {
    /// Total runs completed
    pub total_runs: usize,
    
    /// Total jobs discovered
    pub total_jobs_discovered: usize,
    
    /// Total jobs matched (above threshold)
    pub total_jobs_matched: usize,
    
    /// Total applications submitted
    pub total_applications: usize,
    
    /// Successful applications
    pub successful_applications: usize,
    
    /// Failed applications
    pub failed_applications: usize,
    
    /// Applications per source
    pub applications_by_source: HashMap<String, usize>,
    
    /// Applications per ATS type
    pub applications_by_ats: HashMap<String, usize>,
    
    /// Success rate by ATS type
    pub success_rate_by_ats: HashMap<String, f64>,
    
    /// Average match score of applied jobs
    pub avg_match_score: f64,
    
    /// Highest match score found
    pub highest_match_score: f64,
    
    /// Total time spent on automation (seconds)
    pub total_automation_time_secs: f64,
    
    /// Last 7 days application count
    pub applications_last_7_days: usize,
    
    /// Last 30 days application count  
    pub applications_last_30_days: usize,
}

/// Activity log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityLogEntry {
    pub timestamp: DateTime<Utc>,
    pub stage: String,
    pub action: String,
    pub details: Option<String>,
    pub success: bool,
}

/// Record of a job application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobApplicationRecord {
    pub job_id: i64,
    pub job_title: String,
    pub company: String,
    pub job_url: String,
    pub source: String,
    pub match_score: f64,
    pub ats_type: Option<String>,
    pub applied_at: DateTime<Utc>,
    pub success: bool,
    pub error_message: Option<String>,
    pub resume_used: Option<String>,
    pub cover_letter_used: Option<String>,
}

impl Default for AutomationStatus {
    fn default() -> Self {
        Self {
            running: false,
            current_stage: None,
            started_at: None,
            last_completed_at: None,
            next_run_at: None,
            current_run: None,
            total_stats: AutomationStats::default(),
            recent_activity: Vec::new(),
            last_errors: Vec::new(),
        }
    }
}

impl AutomationStatus {
    /// Add an activity log entry
    pub fn log_activity(&mut self, stage: &str, action: &str, details: Option<String>, success: bool) {
        let entry = ActivityLogEntry {
            timestamp: Utc::now(),
            stage: stage.to_string(),
            action: action.to_string(),
            details,
            success,
        };
        
        self.recent_activity.insert(0, entry);
        
        // Keep only last 100 entries
        if self.recent_activity.len() > 100 {
            self.recent_activity.truncate(100);
        }
    }
    
    /// Update current stage
    pub fn set_stage(&mut self, stage: &str) {
        self.current_stage = Some(stage.to_string());
        self.log_activity(stage, "started", None, true);
    }
    
    /// Mark automation as started
    pub fn mark_started(&mut self) {
        self.running = true;
        self.started_at = Some(Utc::now());
        self.current_run = Some(RunStats::default());
        self.last_errors.clear();
    }
    
    /// Mark automation as completed
    pub fn mark_completed(&mut self) {
        self.running = false;
        self.last_completed_at = Some(Utc::now());
        self.current_stage = None;
        
        if let Some(run) = &self.current_run {
            self.total_stats.total_runs += 1;
            self.total_stats.total_jobs_discovered += run.jobs_scraped;
            self.total_stats.total_jobs_matched += run.jobs_matched;
            self.total_stats.total_applications += run.applications_attempted;
            self.total_stats.successful_applications += run.applications_successful;
            self.total_stats.failed_applications += run.applications_failed;
            self.total_stats.total_automation_time_secs += run.duration_secs;
        }
    }
    
    /// Add an error
    pub fn add_error(&mut self, error: String) {
        self.last_errors.push(error);
    }
}

//! Automation Pipeline Stages

use serde::{Deserialize, Serialize};
use crate::db::models::Job;

/// Pipeline stages
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PipelineStage {
    /// Discovering jobs from sources
    Discovery,
    /// Matching jobs against profile
    Matching,
    /// Filtering based on criteria
    Filtering,
    /// Generating documents
    DocumentGeneration,
    /// Applying to jobs
    Application,
    /// Sending notifications
    Notification,
    /// Completed
    Completed,
}

impl PipelineStage {
    pub fn as_str(&self) -> &'static str {
        match self {
            PipelineStage::Discovery => "discovery",
            PipelineStage::Matching => "matching",
            PipelineStage::Filtering => "filtering",
            PipelineStage::DocumentGeneration => "document_generation",
            PipelineStage::Application => "application",
            PipelineStage::Notification => "notification",
            PipelineStage::Completed => "completed",
        }
    }
    
    pub fn description(&self) -> &'static str {
        match self {
            PipelineStage::Discovery => "🔍 Discovering jobs from sources",
            PipelineStage::Matching => "🎯 Calculating match scores",
            PipelineStage::Filtering => "🔎 Filtering jobs by criteria",
            PipelineStage::DocumentGeneration => "📝 Generating tailored documents",
            PipelineStage::Application => "🚀 Submitting applications",
            PipelineStage::Notification => "🔔 Sending notifications",
            PipelineStage::Completed => "✅ Pipeline completed",
        }
    }
}

/// Result of a pipeline run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineResult {
    pub success: bool,
    pub stage_results: Vec<StageResult>,
    pub jobs_discovered: Vec<JobSummary>,
    pub jobs_applied: Vec<ApplicationSummary>,
    pub errors: Vec<PipelineError>,
    pub duration_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageResult {
    pub stage: String,
    pub success: bool,
    pub items_processed: usize,
    pub items_passed: usize,
    pub duration_secs: f64,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSummary {
    pub id: i64,
    pub title: String,
    pub company: String,
    pub source: String,
    pub match_score: f64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationSummary {
    pub job_id: i64,
    pub job_title: String,
    pub company: String,
    pub success: bool,
    pub ats_type: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineError {
    pub stage: String,
    pub message: String,
    pub job_id: Option<i64>,
    pub recoverable: bool,
}

impl PipelineResult {
    pub fn new() -> Self {
        Self {
            success: true,
            stage_results: Vec::new(),
            jobs_discovered: Vec::new(),
            jobs_applied: Vec::new(),
            errors: Vec::new(),
            duration_secs: 0.0,
        }
    }
    
    pub fn add_stage_result(&mut self, result: StageResult) {
        if !result.success {
            self.success = false;
        }
        self.stage_results.push(result);
    }
    
    pub fn add_error(&mut self, stage: &str, message: &str, job_id: Option<i64>, recoverable: bool) {
        self.errors.push(PipelineError {
            stage: stage.to_string(),
            message: message.to_string(),
            job_id,
            recoverable,
        });
        if !recoverable {
            self.success = false;
        }
    }
    
    pub fn summary(&self) -> String {
        let applied_count = self.jobs_applied.len();
        let successful = self.jobs_applied.iter().filter(|a| a.success).count();
        let discovered = self.jobs_discovered.len();
        
        format!(
            "Pipeline {}: Discovered {} jobs, Applied to {} ({} successful), {} errors in {:.1}s",
            if self.success { "completed" } else { "failed" },
            discovered,
            applied_count,
            successful,
            self.errors.len(),
            self.duration_secs
        )
    }
}

impl Default for PipelineResult {
    fn default() -> Self {
        Self::new()
    }
}

/// A job that has been processed through the pipeline
#[derive(Debug, Clone)]
pub struct ProcessedJob {
    pub job: Job,
    pub match_score: f64,
    pub passed_filters: bool,
    pub filter_reasons: Vec<String>,
    pub resume_path: Option<String>,
    pub cover_letter_path: Option<String>,
    pub application_result: Option<ApplicationSummary>,
}

impl ProcessedJob {
    pub fn new(job: Job) -> Self {
        Self {
            match_score: job.match_score.unwrap_or(0.0),
            job,
            passed_filters: true,
            filter_reasons: Vec::new(),
            resume_path: None,
            cover_letter_path: None,
            application_result: None,
        }
    }
    
    pub fn fail_filter(&mut self, reason: &str) {
        self.passed_filters = false;
        self.filter_reasons.push(reason.to_string());
    }
}

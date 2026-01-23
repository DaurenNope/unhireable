pub mod apply_mode;
pub mod ats_api;
pub mod ats_detector;
pub mod form_filler;
pub mod reliability;
pub mod retry;
pub mod templates;
pub mod test_endpoint;
pub mod verification;
pub mod workflow;

pub use apply_mode::{ApplyMode, PendingApplication, PendingStatus, PreApplyCheck};
pub use ats_api::AtsApiHandler;
pub use ats_detector::{AtsDetector, AtsType};
pub use form_filler::FormFiller;
pub use reliability::{
    get_reliability, is_safe_for_auto_apply, AutoApplyInfo, ReliabilityTier, SmartApplyConfig,
};
pub use retry::{RetryConfig, RetryExecutor, RetryResult};
pub use templates::{ApplicationTemplate, TemplateManager};
pub use test_endpoint::TestEndpointSubmitter;
pub use verification::{ApplicationVerifier, SuccessTracking, VerificationResult};
pub use workflow::{Workflow, WorkflowOrchestrator, WorkflowState, WorkflowStep, WorkflowStepType};

use crate::db::models::Job;
use crate::generator::UserProfile;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationResult {
    pub success: bool,
    pub application_id: Option<i64>,
    pub message: String,
    pub applied_at: Option<chrono::DateTime<chrono::Utc>>,
    pub ats_type: Option<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationConfig {
    /// Application mode: Manual, SemiAuto, or Autopilot
    #[serde(default)]
    pub mode: ApplyMode,
    /// Legacy auto_submit field (derived from mode)
    #[serde(default)]
    pub auto_submit: bool,
    pub upload_resume: bool,
    pub upload_cover_letter: bool,
    pub resume_path: Option<String>,
    pub cover_letter_path: Option<String>,
    pub wait_for_confirmation: bool,
    pub timeout_secs: u64,
    /// Smart apply configuration for reliability-based filtering
    #[serde(default)]
    pub smart_apply: SmartApplyConfig,
    /// Whether to use smart apply filtering
    #[serde(default)]
    pub use_smart_apply: bool,
}

impl Default for ApplicationConfig {
    fn default() -> Self {
        Self {
            mode: ApplyMode::Manual, // Safe default
            auto_submit: false,      // Derived from mode
            upload_resume: true,
            upload_cover_letter: true,
            resume_path: None,
            cover_letter_path: None,
            wait_for_confirmation: true,
            timeout_secs: 120,
            smart_apply: SmartApplyConfig::default(),
            use_smart_apply: true,
        }
    }
}

impl ApplicationConfig {
    /// Create config from mode
    pub fn from_mode(mode: ApplyMode) -> Self {
        Self {
            mode,
            auto_submit: mode.auto_submit(),
            wait_for_confirmation: mode.requires_confirmation(),
            ..Default::default()
        }
    }

    /// Set the mode and update related fields
    pub fn set_mode(&mut self, mode: ApplyMode) {
        self.mode = mode;
        self.auto_submit = mode.auto_submit();
        self.wait_for_confirmation = mode.requires_confirmation();
    }
}

#[derive(Debug, Clone)]
pub struct JobApplicator {
    config: ApplicationConfig,
    ats_api: AtsApiHandler,
}

impl JobApplicator {
    pub fn new() -> Self {
        Self {
            config: ApplicationConfig::default(),
            ats_api: AtsApiHandler::new(),
        }
    }

    pub fn with_config(config: ApplicationConfig) -> Self {
        Self {
            config,
            ats_api: AtsApiHandler::new(),
        }
    }

    /// Create applicator with a specific mode
    pub fn with_mode(mode: ApplyMode) -> Self {
        Self {
            config: ApplicationConfig::from_mode(mode),
            ats_api: AtsApiHandler::new(),
        }
    }

    /// Get current apply mode
    pub fn mode(&self) -> ApplyMode {
        self.config.mode
    }

    /// Pre-check if a job can be applied to with current mode
    pub fn pre_check(&self, url: &str) -> PreApplyCheck {
        PreApplyCheck::check(url, self.config.mode)
    }

    /// Apply to a job using browser automation or test endpoint
    pub async fn apply_to_job(
        &self,
        job: &Job,
        profile: &UserProfile,
        resume_path: Option<&str>,
        cover_letter_path: Option<&str>,
    ) -> Result<ApplicationResult> {
        // Check if this is a test endpoint (httpbin.org or custom test endpoint)
        let is_test_endpoint = job.url.contains("httpbin.org")
            || job.url.contains("test")
            || job.url.contains("localhost")
            || job.title.starts_with("[TEST]");

        if is_test_endpoint {
            println!(
                "🧪 TEST MODE: Using test endpoint submitter for: {}",
                job.url
            );
            return self
                .apply_to_test_endpoint(job, profile, resume_path, cover_letter_path)
                .await;
        }

        // Detect ATS system
        let ats_type = AtsDetector::detect_ats(&job.url);
        let reliability = get_reliability(&ats_type);

        println!(
            "🚀 Starting automated application for: {} at {}",
            job.title, job.company
        );
        println!("   URL: {}", job.url);
        println!("   Detected ATS: {:?}", ats_type);
        println!(
            "   Reliability: {:?} ({}% estimated success)",
            reliability,
            reliability.estimated_success_rate()
        );

        // Smart apply check - skip unreliable ATS if enabled
        if self.config.use_smart_apply {
            let (should_apply, reason) = self.config.smart_apply.should_auto_apply(&job.url);
            if !should_apply {
                println!("⚠️  SMART APPLY: Skipping auto-apply - {}", reason);
                return Ok(ApplicationResult {
                    success: false,
                    application_id: None,
                    message: format!(
                        "Skipped by smart apply: {}. Manual application recommended for {} jobs.",
                        reason,
                        reliability.description()
                    ),
                    applied_at: None,
                    ats_type: ats_type.map(|a| format!("{:?}", a)),
                    errors: vec![format!("Smart apply filter: {}", reason)],
                });
            }
            println!("✅ SMART APPLY: Proceeding - {}", reason);
        }

        // Attempt ATS API integration first if supported
        if self.ats_api.supports(&ats_type) {
            if let Some(ats) = ats_type.clone() {
                println!("🌐 Attempting {:?} API integration before automation…", ats);
                match self
                    .ats_api
                    .apply_via_api(ats.clone(), job, profile, resume_path, cover_letter_path)
                    .await
                {
                    Ok(result) => {
                        if result.success {
                            println!("✅ Application submitted via {:?} API", ats);
                            return Ok(result);
                        } else {
                            println!(
                                "⚠️  {:?} API returned non-success, falling back to automation: {}",
                                ats, result.message
                            );
                        }
                    }
                    Err(err) => {
                        println!(
                            "⚠️  {:?} API submission failed (will fallback to automation): {}",
                            ats, err
                        );
                    }
                }
            }
        }

        // Mode-based check
        let mode = self.config.mode;
        let min_reliability = mode.minimum_reliability();
        
        if reliability < min_reliability {
            println!(
                "⚠️  MODE CHECK: {} mode requires {:?}+ reliability, but this is {:?}",
                mode, min_reliability, reliability
            );
            
            let recommended = if reliability <= ReliabilityTier::Low {
                ApplyMode::Manual
            } else {
                ApplyMode::SemiAuto
            };
            
            return Ok(ApplicationResult {
                success: false,
                application_id: None,
                message: format!(
                    "{} mode cannot apply to {:?} reliability ATS. Use {} mode instead.",
                    mode, reliability, recommended
                ),
                applied_at: None,
                ats_type: ats_type.map(|a| format!("{:?}", a)),
                errors: vec![format!("Reliability {:?} below {:?} minimum", reliability, min_reliability)],
            });
        }

        // Log mode info
        println!("   Mode: {} - {}", mode, mode.description());

        // Create form filler with mode-specific settings
        let form_filler = FormFiller::new()
            .with_timeout(self.config.timeout_secs)
            .with_auto_submit(mode.auto_submit())
            .with_wait_for_confirmation(mode.requires_confirmation());

        // Record metrics: start timing for automation operation
        let automation_start_time = std::time::Instant::now();
        
        // Fill form and submit
        match form_filler
            .fill_and_submit(&job.url, profile, resume_path, cover_letter_path, &ats_type)
            .await
        {
            Ok(_) => {
                let _duration = automation_start_time.elapsed().as_secs_f64();
                
                // Record success metrics
                crate::metrics::APPLICATIONS_CREATED.inc();
                
                let message = match mode {
                    ApplyMode::Manual => "Form filled - browser open for your review. Click Submit when ready.".to_string(),
                    ApplyMode::SemiAuto => "Form filled - awaiting your confirmation to submit.".to_string(),
                    ApplyMode::Autopilot => "Application submitted automatically!".to_string(),
                };
                
                println!("✅ {}", message);
                Ok(ApplicationResult {
                    success: true,
                    application_id: None,
                    message,
                    applied_at: Some(chrono::Utc::now()),
                    ats_type: ats_type.map(|a| format!("{:?}", a)),
                    errors: vec![],
                })
            }
            Err(e) => {
                eprintln!("❌ Application failed: {}", e);
                Ok(ApplicationResult {
                    success: false,
                    application_id: None,
                    message: format!("Application failed: {}", e),
                    applied_at: None,
                    ats_type: ats_type.map(|a| format!("{:?}", a)),
                    errors: vec![e.to_string()],
                })
            }
        }
    }

    /// Apply to test endpoint (for testing)
    async fn apply_to_test_endpoint(
        &self,
        job: &Job,
        profile: &UserProfile,
        resume_path: Option<&str>,
        cover_letter_path: Option<&str>,
    ) -> Result<ApplicationResult> {
        let submitter = TestEndpointSubmitter::new(job.url.clone());

        match submitter
            .submit_application(job, profile, resume_path, cover_letter_path)
            .await
        {
            Ok(message) => {
                println!("✅ Test application submitted successfully!");
                Ok(ApplicationResult {
                    success: true,
                    application_id: None,
                    message,
                    applied_at: Some(chrono::Utc::now()),
                    ats_type: Some("TestEndpoint".to_string()),
                    errors: vec![],
                })
            }
            Err(e) => {
                eprintln!("❌ Test application failed: {}", e);
                Ok(ApplicationResult {
                    success: false,
                    application_id: None,
                    message: format!("Test application failed: {}", e),
                    applied_at: None,
                    ats_type: Some("TestEndpoint".to_string()),
                    errors: vec![e.to_string()],
                })
            }
        }
    }
}

impl Default for JobApplicator {
    fn default() -> Self {
        Self::new()
    }
}

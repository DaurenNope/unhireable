use crate::db::models::Job;
use crate::generator::UserProfile;
use anyhow::{anyhow, Result};
use std::env;

use super::ats_detector::AtsType;
use super::ApplicationResult;

/// Handler responsible for routing application attempts through native ATS APIs
/// whenever credentials are available. Falls back to browser automation if an
/// integration is unavailable or fails.
#[derive(Debug, Default, Clone)]
pub struct AtsApiHandler {
    greenhouse: Option<GreenhouseClient>,
    // Placeholder for future ATS clients (Lever, Workable, SmartRecruiters, etc.)
}

impl AtsApiHandler {
    pub fn new() -> Self {
        Self {
            greenhouse: GreenhouseClient::from_env(),
        }
    }

    /// Returns true if we have credentials and a client for the provided ATS.
    pub fn supports(&self, ats_type: &Option<AtsType>) -> bool {
        match ats_type {
            Some(AtsType::Greenhouse) => self.greenhouse.is_some(),
            // Additional ATS systems will plug into this matcher.
            _ => false,
        }
    }

    /// Attempt to submit an application via a native ATS API.
    /// Returns Ok(ApplicationResult) on success, Err otherwise.
    pub async fn apply_via_api(
        &self,
        ats_type: AtsType,
        job: &Job,
        profile: &UserProfile,
        resume_path: Option<&str>,
        cover_letter_path: Option<&str>,
    ) -> Result<ApplicationResult> {
        match ats_type {
            AtsType::Greenhouse => {
                let client = self
                    .greenhouse
                    .as_ref()
                    .ok_or_else(|| anyhow!("Greenhouse API client not configured"))?;

                client
                    .submit_application(job, profile, resume_path, cover_letter_path)
                    .await
            }
            _ => Err(anyhow!(
                "ATS type {:?} is not yet supported via API integration",
                ats_type
            )),
        }
    }
}

/// Minimal Greenhouse API client stub. Provides detection of credentials and
/// a placeholder submit implementation so we can defer to browser automation
/// until the full API flow is implemented.
#[derive(Debug, Clone)]
struct GreenhouseClient {
    api_token: String,
}

impl GreenhouseClient {
    fn from_env() -> Option<Self> {
        let token = env::var("UNHIREABLE_GREENHOUSE_API_KEY").ok()?;
        if token.trim().is_empty() {
            None
        } else {
            Some(Self { api_token: token })
        }
    }

    async fn submit_application(
        &self,
        job: &Job,
        _profile: &UserProfile,
        _resume_path: Option<&str>,
        _cover_letter_path: Option<&str>,
    ) -> Result<ApplicationResult> {
        let token_present = !self.api_token.is_empty();
        println!(
            "⚙️  Greenhouse API integration stub invoked for job {} (token configured: {})",
            job.url, token_present
        );
        Err(anyhow!(
            "Greenhouse API submission not yet implemented. Falling back to automation."
        ))
    }
}

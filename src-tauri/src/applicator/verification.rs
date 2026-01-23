use crate::applicator::ApplicationResult;
use crate::db::models::Job;
use serde::{Deserialize, Serialize};

/// Application verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    /// Whether the application was verified as successfully submitted
    pub verified: bool,
    /// Confidence level (0.0 to 1.0)
    pub confidence: f64,
    /// Verification method used
    pub method: VerificationMethod,
    /// Evidence found during verification
    pub evidence: Vec<String>,
    /// Timestamp of verification
    pub verified_at: Option<chrono::DateTime<chrono::Utc>>,
    /// URL where verification was performed
    pub verification_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerificationMethod {
    UrlPattern,
    PageContent,
    ConfirmationEmail,
    DatabaseCheck,
    Manual,
    Unknown,
}

/// Success tracking for applications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessTracking {
    /// Job ID
    pub job_id: Option<i64>,
    /// Application ID
    pub application_id: Option<i64>,
    /// Initial application result
    pub initial_result: ApplicationResult,
    /// Verification result
    pub verification: Option<VerificationResult>,
    /// Whether application was tracked as successful
    pub tracked_as_success: bool,
    /// Timestamp when tracked
    pub tracked_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Follow-up actions needed
    pub follow_up_actions: Vec<String>,
}

/// Application verifier for confirming successful submissions
pub struct ApplicationVerifier;

impl ApplicationVerifier {
    /// Verify application by checking URL patterns
    pub fn verify_by_url(url: &str) -> VerificationResult {
        let url_lower = url.to_lowercase();
        let mut evidence = Vec::new();
        let mut confidence: f64 = 0.0;
        let mut verified = false;

        // Success indicators in URL
        let success_patterns = vec![
            "success",
            "thank",
            "thank-you",
            "confirmation",
            "submitted",
            "received",
            "application-received",
            "complete",
        ];

        let failure_patterns = vec![
            "error",
            "failed",
            "invalid",
            "missing",
            "required",
        ];

        for pattern in &success_patterns {
            if url_lower.contains(pattern) {
                evidence.push(format!("URL contains '{}' pattern", pattern));
                confidence += 0.3;
                verified = true;
            }
        }

        for pattern in &failure_patterns {
            if url_lower.contains(pattern) {
                evidence.push(format!("URL contains '{}' pattern (failure indicator)", pattern));
                confidence -= 0.5;
                verified = false;
            }
        }

        confidence = confidence.min(1.0).max(0.0);

        VerificationResult {
            verified,
            confidence,
            method: VerificationMethod::UrlPattern,
            evidence,
            verified_at: Some(chrono::Utc::now()),
            verification_url: Some(url.to_string()),
        }
    }

    /// Verify application by checking page content
    pub fn verify_by_content(content: &str) -> VerificationResult {
        let content_lower = content.to_lowercase();
        let mut evidence = Vec::new();
        let mut confidence: f64 = 0.0;
        let mut verified = false;

        // Success indicators in page content
        let success_phrases = vec![
            "thank you",
            "application received",
            "submitted successfully",
            "we received your application",
            "confirmation",
            "your application has been",
            "application submitted",
            "successfully submitted",
        ];

        let failure_phrases = vec![
            "error occurred",
            "failed to submit",
            "required field",
            "missing required",
            "validation error",
            "please correct",
        ];

        for phrase in &success_phrases {
            if content_lower.contains(phrase) {
                evidence.push(format!("Page content contains: '{}'", phrase));
                confidence += 0.2;
                verified = true;
            }
        }

        for phrase in &failure_phrases {
            if content_lower.contains(phrase) {
                evidence.push(format!("Page content contains: '{}' (failure indicator)", phrase));
                confidence -= 0.3;
                verified = false;
            }
        }

        // Check if form is still present (indicates failure)
        if content_lower.contains("<form") && !verified {
            evidence.push("Form still present on page (may indicate submission failure)".to_string());
            confidence -= 0.2;
        }

        confidence = confidence.min(1.0).max(0.0);

        VerificationResult {
            verified,
            confidence,
            method: VerificationMethod::PageContent,
            evidence,
            verified_at: Some(chrono::Utc::now()),
            verification_url: None,
        }
    }

    /// Create a manual verification result
    pub fn manual_verification(verified: bool, notes: Option<String>) -> VerificationResult {
        let mut evidence = vec!["Manually verified by user".to_string()];
        if let Some(notes) = notes {
            evidence.push(format!("Notes: {}", notes));
        }

        VerificationResult {
            verified,
            confidence: if verified { 1.0 } else { 0.0 },
            method: VerificationMethod::Manual,
            evidence,
            verified_at: Some(chrono::Utc::now()),
            verification_url: None,
        }
    }

    /// Create success tracking from application result
    pub fn track_success(
        job: &Job,
        application_result: ApplicationResult,
        verification: Option<VerificationResult>,
    ) -> SuccessTracking {
        let tracked_as_success = application_result.success
            && verification
                .as_ref()
                .map(|v| v.verified && v.confidence >= 0.5)
                .unwrap_or(false);

        let mut follow_up_actions = Vec::new();

        if !tracked_as_success {
            follow_up_actions.push("Review application manually".to_string());
            if verification.is_none() {
                follow_up_actions.push("Verify application status manually".to_string());
            }
        } else {
            follow_up_actions.push("Monitor for response from employer".to_string());
            follow_up_actions.push("Follow up in 1-2 weeks if no response".to_string());
        }

        SuccessTracking {
            job_id: job.id,
            application_id: application_result.application_id,
            initial_result: application_result,
            verification,
            tracked_as_success,
            tracked_at: Some(chrono::Utc::now()),
            follow_up_actions,
        }
    }
}

impl Default for ApplicationVerifier {
    fn default() -> Self {
        Self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::applicator::ApplicationResult;

    #[test]
    fn test_verify_by_url_success() {
        let result = ApplicationVerifier::verify_by_url(
            "https://example.com/apply/thank-you?application=123",
        );

        assert!(result.verified);
        assert!(result.confidence > 0.0);
        assert!(matches!(result.method, VerificationMethod::UrlPattern));
    }

    #[test]
    fn test_verify_by_url_failure() {
        let result = ApplicationVerifier::verify_by_url("https://example.com/apply/error");

        assert!(!result.verified);
    }

    #[test]
    fn test_verify_by_content_success() {
        let content = r#"
            <html>
                <body>
                    <h1>Thank you for your application</h1>
                    <p>We have received your application and will review it shortly.</p>
                </body>
            </html>
        "#;

        let result = ApplicationVerifier::verify_by_content(content);

        assert!(result.verified);
        assert!(result.confidence > 0.0);
    }

    #[test]
    fn test_track_success_with_verification() {
        let job = Job {
            id: Some(1),
            title: "Test Job".to_string(),
            company: "Test Company".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: None,
            requirements: None,
            location: None,
            salary: None,
            source: "test".to_string(),
            status: crate::db::models::JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        };

        let application_result = ApplicationResult {
            success: true,
            application_id: Some(1),
            message: "Application submitted".to_string(),
            applied_at: Some(chrono::Utc::now()),
            ats_type: Some("Greenhouse".to_string()),
            errors: vec![],
        };

        let verification = Some(ApplicationVerifier::verify_by_url(
            "https://example.com/thank-you",
        ));

        let tracking = ApplicationVerifier::track_success(&job, application_result, verification);

        assert!(tracking.tracked_as_success);
        assert!(tracking.verification.is_some());
    }
}







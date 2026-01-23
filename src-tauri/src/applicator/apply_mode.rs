//! Application Modes
//! Defines the three levels of automation for job applications

use serde::{Deserialize, Serialize};

/// Application mode - controls level of automation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ApplyMode {
    /// Manual Review Mode
    /// - Browser opens VISIBLE (not headless)
    /// - Form is filled automatically
    /// - User reviews and clicks Submit manually
    /// - Best for: Important jobs, first-time testing
    #[default]
    Manual,

    /// Semi-Automatic Mode  
    /// - Browser runs headless
    /// - Form is filled automatically
    /// - Pauses before submit for confirmation (via notification)
    /// - User can approve/reject from notification
    /// - Best for: Regular use with oversight
    SemiAuto,

    /// Full Autopilot Mode
    /// - Browser runs headless
    /// - Form is filled automatically
    /// - Submit button clicked automatically
    /// - Only applies to HIGH reliability ATS (Greenhouse, Lever, etc.)
    /// - Best for: Bulk applications to trusted ATS
    Autopilot,
}

impl ApplyMode {
    /// Whether browser should run headless
    pub fn is_headless(&self) -> bool {
        match self {
            ApplyMode::Manual => false,    // Visible browser
            ApplyMode::SemiAuto => true,   // Headless
            ApplyMode::Autopilot => true,  // Headless
        }
    }

    /// Whether to auto-submit without user action
    pub fn auto_submit(&self) -> bool {
        match self {
            ApplyMode::Manual => false,    // User clicks submit
            ApplyMode::SemiAuto => false,  // Wait for confirmation
            ApplyMode::Autopilot => true,  // Auto submit
        }
    }

    /// Whether to wait for user confirmation before submit
    pub fn requires_confirmation(&self) -> bool {
        match self {
            ApplyMode::Manual => false,    // User is already reviewing
            ApplyMode::SemiAuto => true,   // Send notification, wait for confirm
            ApplyMode::Autopilot => false, // No confirmation needed
        }
    }

    /// Minimum reliability tier for this mode
    pub fn minimum_reliability(&self) -> super::ReliabilityTier {
        use super::ReliabilityTier;
        match self {
            ApplyMode::Manual => ReliabilityTier::VeryLow,    // Can try anything manually
            ApplyMode::SemiAuto => ReliabilityTier::Low,      // Reasonable threshold
            ApplyMode::Autopilot => ReliabilityTier::Medium,  // Only reliable ATS
        }
    }

    /// Human-readable description
    pub fn description(&self) -> &'static str {
        match self {
            ApplyMode::Manual => "Manual Review - Browser opens, you review and submit",
            ApplyMode::SemiAuto => "Semi-Auto - Forms filled, confirm via notification",
            ApplyMode::Autopilot => "Full Autopilot - Automatic submission to reliable ATS",
        }
    }

    /// Short name for display
    pub fn name(&self) -> &'static str {
        match self {
            ApplyMode::Manual => "Manual",
            ApplyMode::SemiAuto => "Semi-Auto",
            ApplyMode::Autopilot => "Autopilot",
        }
    }

    /// Icon for UI
    pub fn icon(&self) -> &'static str {
        match self {
            ApplyMode::Manual => "👁️",
            ApplyMode::SemiAuto => "⚡",
            ApplyMode::Autopilot => "🚀",
        }
    }
}

impl std::fmt::Display for ApplyMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} {}", self.icon(), self.name())
    }
}

/// Result of a pre-apply check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreApplyCheck {
    pub mode: ApplyMode,
    pub url: String,
    pub ats_type: Option<String>,
    pub reliability_tier: String,
    pub can_proceed: bool,
    pub reason: String,
    pub recommended_mode: Option<ApplyMode>,
}

impl PreApplyCheck {
    /// Check if a URL is suitable for the given mode
    pub fn check(url: &str, mode: ApplyMode) -> Self {
        use super::{get_reliability, AtsDetector, ReliabilityTier};

        let ats_type = AtsDetector::detect_ats(url);
        let reliability = get_reliability(&ats_type);
        let min_reliability = mode.minimum_reliability();

        let can_proceed = reliability >= min_reliability;

        let reason = if can_proceed {
            format!(
                "{:?} ATS meets {:?} mode requirements",
                reliability, mode
            )
        } else {
            format!(
                "{:?} reliability is below {:?} minimum ({:?})",
                reliability, mode, min_reliability
            )
        };

        // Recommend a better mode if current mode won't work
        let recommended_mode = if !can_proceed {
            match reliability {
                ReliabilityTier::VeryLow | ReliabilityTier::Low => Some(ApplyMode::Manual),
                ReliabilityTier::Unknown => Some(ApplyMode::SemiAuto),
                _ => None,
            }
        } else {
            None
        };

        Self {
            mode,
            url: url.to_string(),
            ats_type: ats_type.map(|t| format!("{:?}", t)),
            reliability_tier: format!("{:?}", reliability),
            can_proceed,
            reason,
            recommended_mode,
        }
    }
}

/// Pending application waiting for user confirmation (Semi-Auto mode)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingApplication {
    pub id: String,
    pub job_title: String,
    pub company: String,
    pub url: String,
    pub ats_type: Option<String>,
    pub reliability: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub status: PendingStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PendingStatus {
    AwaitingConfirmation,
    Approved,
    Rejected,
    Expired,
}

impl PendingApplication {
    pub fn new(job_title: &str, company: &str, url: &str, ats_type: Option<String>) -> Self {
        use super::get_reliability;
        let reliability = get_reliability(&super::AtsDetector::detect_ats(url));
        
        let now = chrono::Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            job_title: job_title.to_string(),
            company: company.to_string(),
            url: url.to_string(),
            ats_type,
            reliability: format!("{:?}", reliability),
            created_at: now,
            expires_at: now + chrono::Duration::minutes(10), // 10 min to confirm
            status: PendingStatus::AwaitingConfirmation,
        }
    }

    pub fn is_expired(&self) -> bool {
        chrono::Utc::now() > self.expires_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manual_mode_settings() {
        let mode = ApplyMode::Manual;
        assert!(!mode.is_headless());
        assert!(!mode.auto_submit());
        assert!(!mode.requires_confirmation());
    }

    #[test]
    fn test_semi_auto_mode_settings() {
        let mode = ApplyMode::SemiAuto;
        assert!(mode.is_headless());
        assert!(!mode.auto_submit());
        assert!(mode.requires_confirmation());
    }

    #[test]
    fn test_autopilot_mode_settings() {
        let mode = ApplyMode::Autopilot;
        assert!(mode.is_headless());
        assert!(mode.auto_submit());
        assert!(!mode.requires_confirmation());
    }

    #[test]
    fn test_pre_apply_check_greenhouse() {
        let check = PreApplyCheck::check(
            "https://boards.greenhouse.io/company/jobs/123",
            ApplyMode::Autopilot,
        );
        assert!(check.can_proceed);
        assert_eq!(check.ats_type, Some("Greenhouse".to_string()));
    }

    #[test]
    fn test_pre_apply_check_workday_autopilot() {
        let check = PreApplyCheck::check(
            "https://company.wd5.myworkdayjobs.com/job/123",
            ApplyMode::Autopilot,
        );
        assert!(!check.can_proceed);
        assert!(check.recommended_mode.is_some());
    }
}

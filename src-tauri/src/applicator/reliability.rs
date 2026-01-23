//! ATS Reliability Filter
//! Categorizes ATS systems by automation success rate and provides filtering

use super::ats_detector::AtsType;
use serde::{Deserialize, Serialize};

/// Reliability tier for ATS systems
/// Ordered from worst (0) to best (4) for comparison purposes
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ReliabilityTier {
    /// <20% success rate - Heavy anti-automation, CAPTCHAs, or broken
    VeryLow = 0,
    /// 20-50% success rate - Complex or inconsistent forms
    Low = 1,
    /// Unknown ATS - generic form filling (~40%)
    Unknown = 2,
    /// 50-80% success rate - Reasonably consistent forms
    Medium = 3,
    /// 80%+ success rate - API integration or very consistent forms
    High = 4,
}

impl ReliabilityTier {
    /// Get the minimum tier for auto-apply (default: Medium)
    pub fn minimum_for_auto_apply() -> Self {
        ReliabilityTier::Medium
    }

    /// Check if this tier meets the minimum for auto-apply
    pub fn is_auto_apply_safe(&self) -> bool {
        *self >= ReliabilityTier::Medium
    }

    /// Get estimated success rate as percentage
    pub fn estimated_success_rate(&self) -> u8 {
        match self {
            ReliabilityTier::High => 85,
            ReliabilityTier::Medium => 60,
            ReliabilityTier::Low => 35,
            ReliabilityTier::VeryLow => 15,
            ReliabilityTier::Unknown => 40,
        }
    }

    /// Human-readable description
    pub fn description(&self) -> &'static str {
        match self {
            ReliabilityTier::High => "High reliability - API or consistent forms",
            ReliabilityTier::Medium => "Medium reliability - Generally works",
            ReliabilityTier::Low => "Low reliability - May require manual review",
            ReliabilityTier::VeryLow => "Very low - Not recommended for auto-apply",
            ReliabilityTier::Unknown => "Unknown ATS - Results may vary",
        }
    }
}

/// Get the reliability tier for an ATS type
pub fn get_reliability(ats_type: &Option<AtsType>) -> ReliabilityTier {
    match ats_type {
        // HIGH RELIABILITY - API integration or very consistent forms
        Some(AtsType::Greenhouse) => ReliabilityTier::High, // Has API integration
        Some(AtsType::Lever) => ReliabilityTier::High,      // Very clean forms
        Some(AtsType::AshbyHQ) => ReliabilityTier::High,    // Modern, consistent
        Some(AtsType::Workable) => ReliabilityTier::High,   // Import from resume feature

        // MEDIUM RELIABILITY - Reasonably consistent forms
        Some(AtsType::SmartRecruiters) => ReliabilityTier::Medium,
        Some(AtsType::Recruitee) => ReliabilityTier::Medium,
        Some(AtsType::JazzHR) => ReliabilityTier::Medium,
        Some(AtsType::BambooHR) => ReliabilityTier::Medium,
        Some(AtsType::Personio) => ReliabilityTier::Medium,
        Some(AtsType::Teamtailor) => ReliabilityTier::Medium,
        Some(AtsType::BreezyHR) => ReliabilityTier::Medium,
        Some(AtsType::PinPoint) => ReliabilityTier::Medium,
        Some(AtsType::Recruiterflow) => ReliabilityTier::Medium,
        Some(AtsType::Manatal) => ReliabilityTier::Medium,
        Some(AtsType::ZohoRecruit) => ReliabilityTier::Medium,

        // LOW RELIABILITY - Complex or inconsistent forms
        Some(AtsType::Jobvite) => ReliabilityTier::Low,
        Some(AtsType::Bullhorn) => ReliabilityTier::Low,
        Some(AtsType::Erecruit) => ReliabilityTier::Low,
        Some(AtsType::ADP) => ReliabilityTier::Low,
        Some(AtsType::PeopleFluent) => ReliabilityTier::Low,
        Some(AtsType::JobDiva) => ReliabilityTier::Low,

        // VERY LOW RELIABILITY - Enterprise complexity, heavy anti-automation
        Some(AtsType::Workday) => ReliabilityTier::VeryLow,           // Multi-page, auth required
        Some(AtsType::LinkedInEasyApply) => ReliabilityTier::VeryLow, // Rate limits, CAPTCHA
        Some(AtsType::ICIMS) => ReliabilityTier::VeryLow,             // Complex enterprise
        Some(AtsType::Taleo) => ReliabilityTier::VeryLow,             // Legacy, inconsistent
        Some(AtsType::OracleTaleo) => ReliabilityTier::VeryLow,
        Some(AtsType::SuccessFactors) => ReliabilityTier::VeryLow,
        Some(AtsType::SAPSuccessFactors) => ReliabilityTier::VeryLow,
        Some(AtsType::Cornerstone) => ReliabilityTier::VeryLow,

        // Catch-all for any other ATS types
        Some(AtsType::RecruiteeBoard) => ReliabilityTier::Medium,
        Some(AtsType::Generic) => ReliabilityTier::Unknown,

        // Unknown - might work, might not
        None => ReliabilityTier::Unknown,
    }
}

/// Check if a job URL is safe for auto-apply based on ATS detection
pub fn is_safe_for_auto_apply(url: &str) -> bool {
    use super::ats_detector::AtsDetector;
    let ats_type = AtsDetector::detect_ats(url);
    let tier = get_reliability(&ats_type);
    tier.is_auto_apply_safe()
}

/// Get detailed info about a URL's auto-apply suitability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoApplyInfo {
    pub url: String,
    pub ats_type: Option<String>,
    pub tier: ReliabilityTier,
    pub estimated_success_rate: u8,
    pub safe_for_auto_apply: bool,
    pub recommendation: String,
}

impl AutoApplyInfo {
    pub fn analyze(url: &str) -> Self {
        use super::ats_detector::AtsDetector;
        let ats_type = AtsDetector::detect_ats(url);
        let tier = get_reliability(&ats_type);
        let success_rate = tier.estimated_success_rate();
        let safe = tier.is_auto_apply_safe();

        let recommendation = if safe {
            if tier == ReliabilityTier::High {
                "Recommended for auto-apply. High success rate expected.".to_string()
            } else {
                "Suitable for auto-apply with reasonable success rate.".to_string()
            }
        } else {
            match tier {
                ReliabilityTier::Low => {
                    "Consider manual review. Auto-apply may have issues.".to_string()
                }
                ReliabilityTier::VeryLow => {
                    "Not recommended for auto-apply. Manual application advised.".to_string()
                }
                _ => "Unknown ATS. Results may vary.".to_string(),
            }
        };

        Self {
            url: url.to_string(),
            ats_type: ats_type.map(|t| format!("{:?}", t)),
            tier,
            estimated_success_rate: success_rate,
            safe_for_auto_apply: safe,
            recommendation,
        }
    }
}

/// Configuration for smart auto-apply
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartApplyConfig {
    /// Minimum reliability tier for auto-apply
    pub minimum_tier: ReliabilityTier,
    /// Whether to skip jobs that require login
    pub skip_login_required: bool,
    /// Maximum daily applications (rate limiting)
    pub max_daily_applications: u32,
    /// Delay between applications in seconds
    pub delay_between_applications: u64,
    /// Whether to create draft applications for low-reliability jobs
    pub create_drafts_for_low_reliability: bool,
    /// Specific ATS types to always skip
    pub skip_ats_types: Vec<String>,
    /// Specific ATS types to always allow (override tier check)
    pub force_allow_ats_types: Vec<String>,
}

impl Default for SmartApplyConfig {
    fn default() -> Self {
        Self {
            minimum_tier: ReliabilityTier::Medium,
            skip_login_required: true,
            max_daily_applications: 50,
            delay_between_applications: 30,
            create_drafts_for_low_reliability: true,
            skip_ats_types: vec![
                "LinkedInEasyApply".to_string(),
                "Workday".to_string(),
            ],
            force_allow_ats_types: vec![
                "Greenhouse".to_string(),
                "Lever".to_string(),
            ],
        }
    }
}

impl SmartApplyConfig {
    /// Check if a URL should be auto-applied based on config
    pub fn should_auto_apply(&self, url: &str) -> (bool, String) {
        use super::ats_detector::AtsDetector;
        let ats_type = AtsDetector::detect_ats(url);
        let ats_name = ats_type.as_ref().map(|t| format!("{:?}", t));

        // Check force allow list
        if let Some(name) = &ats_name {
            if self.force_allow_ats_types.iter().any(|t| t == name) {
                return (true, format!("{} is in force-allow list", name));
            }
        }

        // Check skip list
        if let Some(name) = &ats_name {
            if self.skip_ats_types.iter().any(|t| t == name) {
                return (false, format!("{} is in skip list", name));
            }
        }

        // Check reliability tier
        let tier = get_reliability(&ats_type);
        if tier < self.minimum_tier {
            return (
                false,
                format!(
                    "Reliability tier {:?} below minimum {:?}",
                    tier, self.minimum_tier
                ),
            );
        }

        (true, "Meets auto-apply criteria".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greenhouse_is_high_reliability() {
        let tier = get_reliability(&Some(AtsType::Greenhouse));
        assert_eq!(tier, ReliabilityTier::High);
        assert!(tier.is_auto_apply_safe());
    }

    #[test]
    fn test_workday_is_very_low_reliability() {
        let tier = get_reliability(&Some(AtsType::Workday));
        assert_eq!(tier, ReliabilityTier::VeryLow);
        assert!(!tier.is_auto_apply_safe());
    }

    #[test]
    fn test_unknown_ats_default_tier() {
        let tier = get_reliability(&None);
        assert_eq!(tier, ReliabilityTier::Unknown);
    }

    #[test]
    fn test_auto_apply_info() {
        let info = AutoApplyInfo::analyze("https://boards.greenhouse.io/company/jobs/123");
        assert!(info.safe_for_auto_apply);
        assert_eq!(info.tier, ReliabilityTier::High);
    }
}

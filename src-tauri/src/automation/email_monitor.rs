//! Email Monitor for tracking recruiter responses
//! 
//! Monitors inbox for job-related emails and categorizes them

use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Email classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EmailCategory {
    /// Positive response - interview invitation, callback request
    InterviewInvitation,
    /// Request for more information
    InformationRequest,
    /// Rejection email
    Rejection,
    /// Application confirmation/receipt
    ApplicationConfirmation,
    /// Assessment/coding challenge
    Assessment,
    /// Offer letter
    Offer,
    /// Follow-up reminder
    FollowUp,
    /// Generic recruiter outreach
    RecruiterOutreach,
    /// Unrelated/spam
    Unrelated,
}

/// Parsed email with classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassifiedEmail {
    pub id: String,
    pub from: String,
    pub to: String,
    pub subject: String,
    pub body_preview: String,
    pub received_at: DateTime<Utc>,
    pub category: EmailCategory,
    pub confidence: f64,
    pub extracted_data: ExtractedEmailData,
    pub requires_action: bool,
    pub suggested_action: Option<String>,
}

/// Data extracted from email
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtractedEmailData {
    pub company_name: Option<String>,
    pub job_title: Option<String>,
    pub recruiter_name: Option<String>,
    pub interview_date: Option<String>,
    pub interview_time: Option<String>,
    pub interview_type: Option<String>, // phone, video, onsite
    pub calendar_link: Option<String>,
    pub deadline: Option<String>,
    pub salary_mentioned: Option<String>,
    pub next_steps: Vec<String>,
}

/// Email monitor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailMonitorConfig {
    pub enabled: bool,
    pub check_interval_minutes: u32,
    pub gmail_oauth_token: Option<String>,
    pub filter_senders: Vec<String>, // Only process emails from these domains
    pub ignore_senders: Vec<String>, // Ignore emails from these
    pub auto_categorize: bool,
    pub auto_respond_confirmations: bool,
}

impl Default for EmailMonitorConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            check_interval_minutes: 15,
            gmail_oauth_token: None,
            filter_senders: vec![
                "greenhouse.io".to_string(),
                "lever.co".to_string(),
                "ashbyhq.com".to_string(),
                "workable.com".to_string(),
                "smartrecruiters.com".to_string(),
                "linkedin.com".to_string(),
                "indeed.com".to_string(),
            ],
            ignore_senders: vec![
                "noreply@".to_string(),
                "no-reply@".to_string(),
                "mailer-daemon".to_string(),
            ],
            auto_categorize: true,
            auto_respond_confirmations: false,
        }
    }
}

/// Email classifier using pattern matching
pub struct EmailClassifier {
    patterns: HashMap<EmailCategory, Vec<Regex>>,
}

impl EmailClassifier {
    pub fn new() -> Self {
        let mut patterns = HashMap::new();
        
        // Interview invitation patterns
        patterns.insert(EmailCategory::InterviewInvitation, vec![
            Regex::new(r"(?i)schedule.*interview").unwrap(),
            Regex::new(r"(?i)interview.*invitation").unwrap(),
            Regex::new(r"(?i)would like to.*speak").unwrap(),
            Regex::new(r"(?i)set up.*call").unwrap(),
            Regex::new(r"(?i)phone screen").unwrap(),
            Regex::new(r"(?i)next.*round").unwrap(),
            Regex::new(r"(?i)meet.*team").unwrap(),
            Regex::new(r"(?i)technical interview").unwrap(),
            Regex::new(r"(?i)on-?site").unwrap(),
            Regex::new(r"(?i)video call").unwrap(),
            Regex::new(r"(?i)calendly\.com").unwrap(),
        ]);

        // Rejection patterns
        patterns.insert(EmailCategory::Rejection, vec![
            Regex::new(r"(?i)unfortunately").unwrap(),
            Regex::new(r"(?i)not.*move forward").unwrap(),
            Regex::new(r"(?i)decided.*other candidates").unwrap(),
            Regex::new(r"(?i)not.*right fit").unwrap(),
            Regex::new(r"(?i)position.*filled").unwrap(),
            Regex::new(r"(?i)regret to inform").unwrap(),
            Regex::new(r"(?i)will not be.*proceeding").unwrap(),
            Regex::new(r"(?i)after careful consideration").unwrap(),
        ]);

        // Application confirmation patterns
        patterns.insert(EmailCategory::ApplicationConfirmation, vec![
            Regex::new(r"(?i)application.*received").unwrap(),
            Regex::new(r"(?i)thank.*applying").unwrap(),
            Regex::new(r"(?i)confirm.*application").unwrap(),
            Regex::new(r"(?i)successfully.*submitted").unwrap(),
            Regex::new(r"(?i)we.*reviewing").unwrap(),
        ]);

        // Assessment patterns
        patterns.insert(EmailCategory::Assessment, vec![
            Regex::new(r"(?i)coding.*challenge").unwrap(),
            Regex::new(r"(?i)take-?home").unwrap(),
            Regex::new(r"(?i)technical.*assessment").unwrap(),
            Regex::new(r"(?i)hackerrank").unwrap(),
            Regex::new(r"(?i)codility").unwrap(),
            Regex::new(r"(?i)leetcode").unwrap(),
            Regex::new(r"(?i)complete.*test").unwrap(),
        ]);

        // Offer patterns
        patterns.insert(EmailCategory::Offer, vec![
            Regex::new(r"(?i)offer.*letter").unwrap(),
            Regex::new(r"(?i)extend.*offer").unwrap(),
            Regex::new(r"(?i)pleased to offer").unwrap(),
            Regex::new(r"(?i)job offer").unwrap(),
            Regex::new(r"(?i)compensation.*package").unwrap(),
            Regex::new(r"(?i)starting.*salary").unwrap(),
        ]);

        // Information request patterns
        patterns.insert(EmailCategory::InformationRequest, vec![
            Regex::new(r"(?i)could you.*provide").unwrap(),
            Regex::new(r"(?i)please.*send").unwrap(),
            Regex::new(r"(?i)additional.*information").unwrap(),
            Regex::new(r"(?i)few.*questions").unwrap(),
            Regex::new(r"(?i)clarify").unwrap(),
        ]);

        // Recruiter outreach patterns
        patterns.insert(EmailCategory::RecruiterOutreach, vec![
            Regex::new(r"(?i)came across.*profile").unwrap(),
            Regex::new(r"(?i)exciting.*opportunity").unwrap(),
            Regex::new(r"(?i)perfect.*fit").unwrap(),
            Regex::new(r"(?i)reach.*out").unwrap(),
            Regex::new(r"(?i)open to.*opportunities").unwrap(),
        ]);

        Self { patterns }
    }

    /// Classify an email
    pub fn classify(&self, subject: &str, body: &str) -> (EmailCategory, f64) {
        let text = format!("{} {}", subject, body);
        let mut scores: HashMap<EmailCategory, f64> = HashMap::new();

        for (category, patterns) in &self.patterns {
            let mut matches = 0;
            for pattern in patterns {
                if pattern.is_match(&text) {
                    matches += 1;
                }
            }
            if matches > 0 {
                let score = matches as f64 / patterns.len() as f64;
                scores.insert(category.clone(), score);
            }
        }

        // Find best match
        scores
            .into_iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .unwrap_or((EmailCategory::Unrelated, 0.0))
    }

    /// Extract data from email
    pub fn extract_data(&self, subject: &str, body: &str) -> ExtractedEmailData {
        let text = format!("{} {}", subject, body);
        let mut data = ExtractedEmailData::default();

        // Extract company name (often in subject or signature)
        let company_re = Regex::new(r"(?i)(?:at|from|with)\s+([A-Z][a-zA-Z0-9\s&]+(?:Inc|LLC|Ltd|Corp)?)")
            .unwrap();
        if let Some(cap) = company_re.captures(&text) {
            data.company_name = Some(cap[1].trim().to_string());
        }

        // Extract recruiter name
        let name_re = Regex::new(r"(?i)(?:Hi,?\s*)?I'?m\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)")
            .unwrap();
        if let Some(cap) = name_re.captures(&text) {
            data.recruiter_name = Some(cap[1].to_string());
        }

        // Extract calendar links
        let calendar_re = Regex::new(r"(https?://(?:calendly\.com|cal\.com|meet\.google\.com)/[^\s]+)")
            .unwrap();
        if let Some(cap) = calendar_re.captures(&text) {
            data.calendar_link = Some(cap[1].to_string());
        }

        // Extract interview type
        if text.to_lowercase().contains("phone") {
            data.interview_type = Some("phone".to_string());
        } else if text.to_lowercase().contains("video") || text.to_lowercase().contains("zoom") {
            data.interview_type = Some("video".to_string());
        } else if text.to_lowercase().contains("onsite") || text.to_lowercase().contains("on-site") {
            data.interview_type = Some("onsite".to_string());
        }

        // Extract deadlines
        let deadline_re = Regex::new(r"(?i)(?:by|before|deadline[:\s]+)([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)")
            .unwrap();
        if let Some(cap) = deadline_re.captures(&text) {
            data.deadline = Some(cap[1].to_string());
        }

        data
    }

    /// Determine if email requires action
    pub fn requires_action(&self, category: &EmailCategory) -> (bool, Option<String>) {
        match category {
            EmailCategory::InterviewInvitation => {
                (true, Some("Schedule interview - check calendar link or reply with availability".to_string()))
            }
            EmailCategory::InformationRequest => {
                (true, Some("Respond with requested information".to_string()))
            }
            EmailCategory::Assessment => {
                (true, Some("Complete coding challenge by deadline".to_string()))
            }
            EmailCategory::Offer => {
                (true, Some("Review offer and respond".to_string()))
            }
            EmailCategory::FollowUp => {
                (true, Some("Send follow-up response".to_string()))
            }
            _ => (false, None),
        }
    }
}

impl Default for EmailClassifier {
    fn default() -> Self {
        Self::new()
    }
}

/// Email monitor state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmailMonitorStatus {
    pub enabled: bool,
    pub connected: bool,
    pub last_check: Option<DateTime<Utc>>,
    pub emails_processed: usize,
    pub pending_actions: usize,
    pub recent_emails: Vec<ClassifiedEmail>,
}

/// Statistics about processed emails
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmailStats {
    pub total_processed: usize,
    pub interviews_found: usize,
    pub rejections: usize,
    pub assessments: usize,
    pub offers: usize,
    pub pending_responses: usize,
}

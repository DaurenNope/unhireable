//! Email Monitor for tracking recruiter responses
//!
//! Monitors inbox for job-related emails and categorizes them

use chrono::{DateTime, Utc};
use mailparse::{parse_mail, MailHeaderMap};
use native_tls::TlsConnector;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

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

impl std::fmt::Display for EmailCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            EmailCategory::InterviewInvitation => "Interview Invitation",
            EmailCategory::InformationRequest => "Information Request",
            EmailCategory::Rejection => "Rejection",
            EmailCategory::ApplicationConfirmation => "Application Confirmation",
            EmailCategory::Assessment => "Assessment",
            EmailCategory::Offer => "Offer",
            EmailCategory::FollowUp => "Follow-up",
            EmailCategory::RecruiterOutreach => "Recruiter Outreach",
            EmailCategory::Unrelated => "Unrelated",
        };
        write!(f, "{}", name)
    }
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
    pub imap_server: String,
    pub imap_port: u16,
    pub imap_username: String,
    pub imap_password: String,
    pub use_imap_ssl: bool,
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
            imap_server: "imap.gmail.com".to_string(),
            imap_port: 993,
            imap_username: String::new(),
            imap_password: String::new(),
            use_imap_ssl: true,
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
        patterns.insert(
            EmailCategory::InterviewInvitation,
            vec![
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
            ],
        );

        // Rejection patterns
        patterns.insert(
            EmailCategory::Rejection,
            vec![
                Regex::new(r"(?i)unfortunately").unwrap(),
                Regex::new(r"(?i)not.*move forward").unwrap(),
                Regex::new(r"(?i)decided.*other candidates").unwrap(),
                Regex::new(r"(?i)not.*right fit").unwrap(),
                Regex::new(r"(?i)position.*filled").unwrap(),
                Regex::new(r"(?i)regret to inform").unwrap(),
                Regex::new(r"(?i)will not be.*proceeding").unwrap(),
                Regex::new(r"(?i)after careful consideration").unwrap(),
            ],
        );

        // Application confirmation patterns
        patterns.insert(
            EmailCategory::ApplicationConfirmation,
            vec![
                Regex::new(r"(?i)application.*received").unwrap(),
                Regex::new(r"(?i)thank.*applying").unwrap(),
                Regex::new(r"(?i)confirm.*application").unwrap(),
                Regex::new(r"(?i)successfully.*submitted").unwrap(),
                Regex::new(r"(?i)we.*reviewing").unwrap(),
            ],
        );

        // Assessment patterns
        patterns.insert(
            EmailCategory::Assessment,
            vec![
                Regex::new(r"(?i)coding.*challenge").unwrap(),
                Regex::new(r"(?i)take-?home").unwrap(),
                Regex::new(r"(?i)technical.*assessment").unwrap(),
                Regex::new(r"(?i)hackerrank").unwrap(),
                Regex::new(r"(?i)codility").unwrap(),
                Regex::new(r"(?i)leetcode").unwrap(),
                Regex::new(r"(?i)complete.*test").unwrap(),
            ],
        );

        // Offer patterns
        patterns.insert(
            EmailCategory::Offer,
            vec![
                Regex::new(r"(?i)offer.*letter").unwrap(),
                Regex::new(r"(?i)extend.*offer").unwrap(),
                Regex::new(r"(?i)pleased to offer").unwrap(),
                Regex::new(r"(?i)job offer").unwrap(),
                Regex::new(r"(?i)compensation.*package").unwrap(),
                Regex::new(r"(?i)starting.*salary").unwrap(),
            ],
        );

        // Information request patterns
        patterns.insert(
            EmailCategory::InformationRequest,
            vec![
                Regex::new(r"(?i)could you.*provide").unwrap(),
                Regex::new(r"(?i)please.*send").unwrap(),
                Regex::new(r"(?i)additional.*information").unwrap(),
                Regex::new(r"(?i)few.*questions").unwrap(),
                Regex::new(r"(?i)clarify").unwrap(),
            ],
        );

        // Recruiter outreach patterns
        patterns.insert(
            EmailCategory::RecruiterOutreach,
            vec![
                Regex::new(r"(?i)came across.*profile").unwrap(),
                Regex::new(r"(?i)exciting.*opportunity").unwrap(),
                Regex::new(r"(?i)perfect.*fit").unwrap(),
                Regex::new(r"(?i)reach.*out").unwrap(),
                Regex::new(r"(?i)open to.*opportunities").unwrap(),
            ],
        );

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
        let company_re =
            Regex::new(r"(?i)(?:at|from|with)\s+([A-Z][a-zA-Z0-9\s&]+(?:Inc|LLC|Ltd|Corp)?)")
                .unwrap();
        if let Some(cap) = company_re.captures(&text) {
            data.company_name = Some(cap[1].trim().to_string());
        }

        // Extract recruiter name
        let name_re =
            Regex::new(r"(?i)(?:Hi,?\s*)?I'?m\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)").unwrap();
        if let Some(cap) = name_re.captures(&text) {
            data.recruiter_name = Some(cap[1].to_string());
        }

        // Extract calendar links
        let calendar_re =
            Regex::new(r"(https?://(?:calendly\.com|cal\.com|meet\.google\.com)/[^\s]+)").unwrap();
        if let Some(cap) = calendar_re.captures(&text) {
            data.calendar_link = Some(cap[1].to_string());
        }

        // Extract interview type
        if text.to_lowercase().contains("phone") {
            data.interview_type = Some("phone".to_string());
        } else if text.to_lowercase().contains("video") || text.to_lowercase().contains("zoom") {
            data.interview_type = Some("video".to_string());
        } else if text.to_lowercase().contains("onsite") || text.to_lowercase().contains("on-site")
        {
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
            EmailCategory::InterviewInvitation => (
                true,
                Some(
                    "Schedule interview - check calendar link or reply with availability"
                        .to_string(),
                ),
            ),
            EmailCategory::InformationRequest => {
                (true, Some("Respond with requested information".to_string()))
            }
            EmailCategory::Assessment => (
                true,
                Some("Complete coding challenge by deadline".to_string()),
            ),
            EmailCategory::Offer => (true, Some("Review offer and respond".to_string())),
            EmailCategory::FollowUp => (true, Some("Send follow-up response".to_string())),
            _ => (false, None),
        }
    }
}

impl Default for EmailClassifier {
    fn default() -> Self {
        Self::new()
    }
}

/// Email monitor service
pub struct EmailMonitor {
    config: EmailMonitorConfig,
    classifier: Arc<EmailClassifier>,
    status: EmailMonitorStatus,
}

impl EmailMonitor {
    pub fn new(config: EmailMonitorConfig) -> Self {
        Self {
            config,
            classifier: Arc::new(EmailClassifier::new()),
            status: EmailMonitorStatus::default(),
        }
    }

    /// Check for new emails and process them
    pub async fn check_emails(&mut self) -> Result<Vec<ClassifiedEmail>, Box<dyn std::error::Error>> {
        if !self.config.enabled {
            return Ok(vec![]);
        }

        let tls = TlsConnector::builder().build()?;
        let tcp_stream = std::net::TcpStream::connect((self.config.imap_server.as_str(), self.config.imap_port))?;
        let tls_stream = tls.connect(self.config.imap_server.as_str(), tcp_stream)?;
        let client = imap::Client::new(tls_stream);

        let mut session = client.login(&self.config.imap_username, &self.config.imap_password).map_err(|e| e.0)?;

        session.select("INBOX")?;

        // Search for recent messages (last 24 hours)
        let since_date = (Utc::now() - chrono::Duration::days(1)).format("%d-%b-%Y").to_string();
        let query = format!("SINCE {}", since_date);

        let message_ids = session.search(query)?;
        let mut processed_emails = Vec::new();

        // Convert to vec and sort descending to get newest first
        let mut ids: Vec<_> = message_ids.into_iter().collect();
        ids.sort_by(|a, b| b.cmp(a)); // Sort descending

        for id in ids.into_iter().take(50) { // Process last 50 emails
            if let Ok(lines) = session.fetch(format!("{}", id), "RFC822") {
                for line in lines.iter() {
                    if let Some(body) = line.body() {
                        if let Ok(parsed) = parse_mail(body) {
                            if let Some(email) = self.process_email(&parsed, id) {
                                processed_emails.push(email);
                            }
                        }
                    }
                }
            }
        }

        session.logout()?;

        self.status.last_check = Some(Utc::now());
        self.status.emails_processed += processed_emails.len();

        Ok(processed_emails)
    }

    fn process_email(&self, parsed: &mailparse::ParsedMail, message_id: u32) -> Option<ClassifiedEmail> {
        let from = parsed.headers.get_first_header("From")?.get_value();
        let subject = parsed.headers.get_first_header("Subject").map(|h| h.get_value()).unwrap_or_default();
        let to = parsed.headers.get_first_header("To").map(|h| h.get_value()).unwrap_or_default();

        // Extract body
        let body = match parsed.get_body() {
            Ok(text) => text,
            Err(_) => return None, // Skip emails we can't parse
        };

        // Check if sender should be filtered
        if !self.should_process_sender(&from) {
            return None;
        }

        let (category, confidence) = self.classifier.classify(&subject, &body);
        let extracted_data = self.classifier.extract_data(&subject, &body);
        let (requires_action, suggested_action) = self.classifier.requires_action(&category);

        Some(ClassifiedEmail {
            id: message_id.to_string(),
            from,
            to,
            subject,
            body_preview: body.chars().take(200).collect(),
            received_at: Utc::now(), // TODO: Extract from email headers
            category,
            confidence,
            extracted_data,
            requires_action,
            suggested_action,
        })
    }

    fn should_process_sender(&self, from: &str) -> bool {
        // Check ignore list first
        for ignore in &self.config.ignore_senders {
            if from.to_lowercase().contains(ignore) {
                return false;
            }
        }

        // If filter list is empty, process all
        if self.config.filter_senders.is_empty() {
            return true;
        }

        // Check if sender matches filter
        for filter in &self.config.filter_senders {
            if from.to_lowercase().contains(filter) {
                return true;
            }
        }

        false
    }

    pub fn get_status(&self) -> &EmailMonitorStatus {
        &self.status
    }

    /// Update application status based on classified email
    pub fn update_application_status(
        &self,
        email: &ClassifiedEmail,
        db: &crate::db::Database,
    ) -> Result<(), Box<dyn std::error::Error>> {
        use crate::db::models::{ApplicationStatus, Interview};
        use crate::db::queries::{ApplicationQueries, InterviewQueries, JobQueries};

        let conn = db.get_connection();

        // Find matching application based on email content
        let applications = conn.list_applications(None, None)?;

        let mut matching_app = None;
        for app in &applications {
            let job = conn.get_job(app.job_id)?;
            if let Some(job) = job {
                // Match by company name or job title in email
                let company_match = email.extracted_data.company_name
                    .as_ref()
                    .map(|c| job.company.to_lowercase().contains(&c.to_lowercase()))
                    .unwrap_or(false);

                let title_match = email.extracted_data.job_title
                    .as_ref()
                    .map(|t| job.title.to_lowercase().contains(&t.to_lowercase()))
                    .unwrap_or(false);

                if company_match || title_match {
                    matching_app = Some(app.clone());
                    break;
                }
            }
        }

        if let Some(mut app) = matching_app {
            // Update status based on email category
            let new_status = match email.category {
                EmailCategory::InterviewInvitation => ApplicationStatus::InterviewScheduled,
                EmailCategory::Rejection => ApplicationStatus::Rejected,
                EmailCategory::Offer => ApplicationStatus::OfferReceived,
                EmailCategory::ApplicationConfirmation => {
                    // Keep current status or mark as submitted if still preparing
                    if app.status == ApplicationStatus::Preparing {
                        ApplicationStatus::Submitted
                    } else {
                        app.status.clone()
                    }
                }
                _ => app.status.clone(),
            };

            if new_status != app.status {
                app.status = new_status;
                app.updated_at = Some(Utc::now());
                app.notes = Some(format!(
                    "{}\n[{}] {}",
                    app.notes.unwrap_or_default(),
                    email.category,
                    email.subject
                ));

                conn.update_application(&app)?;
                println!("✅ Updated application status: {} -> {}", app.id.unwrap_or(0), app.status);
            }

            // Create interview record if it's an interview invitation
            if email.category == EmailCategory::InterviewInvitation {
                let mut interview = Interview {
                    id: None,
                    application_id: app.id.unwrap(),
                    r#type: email.extracted_data.interview_type.clone().unwrap_or("unknown".to_string()),
                    scheduled_at: Utc::now(), // TODO: Parse actual date
                    location: email.extracted_data.calendar_link.clone(),
                    notes: Some(format!("{} - {}", email.subject, email.extracted_data.recruiter_name.clone().unwrap_or_default())),
                    completed: false, // Add this field
                    created_at: Some(Utc::now()),
                    updated_at: Some(Utc::now()),
                };

                conn.create_interview(&mut interview)?;
                println!("✅ Created interview record for application {}", app.id.unwrap());
            }
        }

        Ok(())
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

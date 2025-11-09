use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: Option<i64>,
    pub title: String,
    pub company: String,
    pub url: String,
    pub description: Option<String>,
    pub requirements: Option<String>,
    pub location: Option<String>,
    pub salary: Option<String>,
    pub source: String,
    pub status: JobStatus,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Saved,
    Applied,
    Interviewing,
    Rejected,
    Offer,
    Archived,
}

impl FromStr for JobStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "saved" => Ok(JobStatus::Saved),
            "applied" => Ok(JobStatus::Applied),
            "interviewing" => Ok(JobStatus::Interviewing),
            "rejected" => Ok(JobStatus::Rejected),
            "offer" => Ok(JobStatus::Offer),
            "archived" => Ok(JobStatus::Archived),
            _ => Err(format!("Unknown job status: {}", s)),
        }
    }
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            JobStatus::Saved => "saved",
            JobStatus::Applied => "applied",
            JobStatus::Interviewing => "interviewing",
            JobStatus::Rejected => "rejected",
            JobStatus::Offer => "offer",
            JobStatus::Archived => "archived",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub id: Option<i64>,
    pub job_id: i64,
    pub applied_at: Option<DateTime<Utc>>,
    pub status: ApplicationStatus,
    pub notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: Option<i64>,
    pub job_id: i64,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub position: Option<String>,
    pub notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Interview {
    pub id: Option<i64>,
    pub application_id: i64,
    pub r#type: String,
    pub scheduled_at: DateTime<Utc>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub completed: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentType {
    Resume,
    CoverLetter,
    Other,
}

impl FromStr for DocumentType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "resume" => Ok(DocumentType::Resume),
            "cover_letter" | "cover letter" => Ok(DocumentType::CoverLetter),
            "other" => Ok(DocumentType::Other),
            _ => Err(format!("Unknown document type: {}", s)),
        }
    }
}

impl std::fmt::Display for DocumentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DocumentType::Resume => write!(f, "resume"),
            DocumentType::CoverLetter => write!(f, "cover_letter"),
            DocumentType::Other => write!(f, "other"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: Option<i64>,
    pub application_id: i64,
    pub name: String,
    pub file_path: PathBuf,
    pub document_type: DocumentType,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ApplicationStatus {
    Preparing,
    Submitted,
    InterviewScheduled,
    Rejected,
    OfferReceived,
    Withdrawn,
}

impl FromStr for ApplicationStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "preparing" => Ok(ApplicationStatus::Preparing),
            "submitted" => Ok(ApplicationStatus::Submitted),
            "interview_scheduled" => Ok(ApplicationStatus::InterviewScheduled),
            "rejected" => Ok(ApplicationStatus::Rejected),
            "offer_received" => Ok(ApplicationStatus::OfferReceived),
            "withdrawn" => Ok(ApplicationStatus::Withdrawn),
            _ => Err(format!("Unknown application status: {}", s)),
        }
    }
}

impl std::fmt::Display for ApplicationStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ApplicationStatus::Preparing => "preparing",
            ApplicationStatus::Submitted => "submitted",
            ApplicationStatus::InterviewScheduled => "interview_scheduled",
            ApplicationStatus::Rejected => "rejected",
            ApplicationStatus::OfferReceived => "offer_received",
            ApplicationStatus::Withdrawn => "withdrawn",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: Option<i64>,
    pub entity_type: String, // 'job', 'application', 'contact', 'interview', 'document'
    pub entity_id: i64,
    pub action: String, // 'created', 'updated', 'deleted', 'status_changed'
    pub description: Option<String>,
    pub metadata: Option<String>, // JSON string for additional data
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: Option<i64>,
    pub platform: String, // 'linkedin', 'wellfound', 'hhkz', etc.
    pub username: Option<String>,
    pub email: Option<String>,
    pub encrypted_password: Option<String>, // Encrypted password
    pub cookies: Option<String>, // JSON string of cookies
    pub tokens: Option<String>, // JSON string of tokens
    pub is_active: bool,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

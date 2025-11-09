pub mod resume;
pub mod cover_letter;
pub mod templates;
pub mod ai_integration;
pub mod pdf_export;

pub use resume::ResumeGenerator;
pub use cover_letter::CoverLetterGenerator;
pub use templates::TemplateManager;
pub use ai_integration::AIIntegration;
pub use pdf_export::PDFExporter;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedDocument {
    pub content: String,
    pub format: DocumentFormat,
    pub metadata: DocumentMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DocumentFormat {
    Markdown,
    HTML,
    PDF,
    Text,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub title: String,
    pub job_title: String,
    pub company: String,
    pub generated_at: chrono::DateTime<chrono::Utc>,
    pub template_used: String,
    pub word_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalInfo {
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub location: Option<String>,
    pub linkedin: Option<String>,
    pub github: Option<String>,
    pub portfolio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsProfile {
    pub technical_skills: Vec<String>,
    pub soft_skills: Vec<String>,
    pub experience_years: HashMap<String, u32>,
    pub proficiency_levels: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceEntry {
    pub company: String,
    pub position: String,
    pub duration: String,
    pub description: Vec<String>,
    pub technologies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EducationEntry {
    pub institution: String,
    pub degree: String,
    pub year: String,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub personal_info: PersonalInfo,
    pub summary: String,
    pub skills: SkillsProfile,
    pub experience: Vec<ExperienceEntry>,
    pub education: Vec<EducationEntry>,
    pub projects: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobAnalysis {
    pub extracted_keywords: Vec<String>,
    pub required_skills: Vec<String>,
    pub preferred_skills: Vec<String>,
    pub experience_level: String,
    pub company_tone: String,
    pub key_responsibilities: Vec<String>,
    pub match_score: f64,
    pub job_title: String,
    pub company: String,
}

pub type GenerationResult = Result<GeneratedDocument, anyhow::Error>;

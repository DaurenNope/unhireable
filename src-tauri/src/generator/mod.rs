pub mod ai_integration;
pub mod ats_optimizer;
pub mod bulk_generator;
pub mod cache;
pub mod cover_letter;
pub mod docx_export;
pub mod event_handler;
pub mod multi_language;
pub mod multi_provider_ai;
pub mod pdf_export;
pub mod quality_scorer;
pub mod queue_processor;
pub mod resume;
pub mod template_marketplace;
pub mod templates;
pub mod version_control;

pub use ai_integration::AIIntegration;
pub use ats_optimizer::{ATSOptimizer, ATSOptimizationResult, ATSCompatibilityReport};
pub use bulk_generator::{BulkGenerator, BulkGenerationRequest, BulkGenerationResult};
pub use cache::{DocumentCache, CacheStats};
pub use cover_letter::CoverLetterGenerator;
pub use docx_export::DOCXExporter;
pub use event_handler::DocumentGenerationEventHandler;
pub use multi_language::{MultiLanguageTranslator, Language};
pub use multi_provider_ai::{MultiProviderAI, AIProvider, AIProviderConfig};
pub use pdf_export::PDFExporter;
pub use quality_scorer::{QualityScorer, QualityScore};
pub use queue_processor::BulkGenerationQueueProcessor;
pub use resume::ResumeGenerator;
pub use template_marketplace::{TemplateMarketplace, MarketplaceTemplate, TemplateCategory, TemplateType};
pub use templates::TemplateManager;
pub use version_control::{VersionControl, DocumentVersion, VersionHistory, VersionMetadata};

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

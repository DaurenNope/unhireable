pub mod analyzer;
pub mod ocr;
pub mod parser;

pub use analyzer::ResumeAnalyzer;
pub use parser::ResumeParser;

use serde::{Deserialize, Serialize};
use which::which;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeAnalysis {
    pub personal_info: PersonalInfo,
    pub summary: Option<String>,
    pub skills: Vec<String>,
    pub experience: Vec<ExperienceEntry>,
    pub education: Vec<EducationEntry>,
    pub projects: Vec<String>,
    pub raw_text: String,
    pub insights: AnalysisInsights,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalInfo {
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>,
    pub linkedin: Option<String>,
    pub github: Option<String>,
    pub portfolio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceEntry {
    pub company: Option<String>,
    pub position: Option<String>,
    pub duration: Option<String>,
    pub description: Vec<String>,
    pub technologies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EducationEntry {
    pub institution: Option<String>,
    pub degree: Option<String>,
    pub year: Option<String>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisInsights {
    pub total_years_experience: Option<f64>,
    pub primary_skills: Vec<String>,
    pub skill_categories: Vec<String>,
    pub strengths: Vec<String>,
    pub recommendations: Vec<String>,
    pub ats_score: Option<f64>, // Aggregate ATS-friendly score (0-100)
    pub ats_breakdown: Vec<AtsBreakdown>,
    pub hr_signals: Vec<HrSignal>,
    pub keyword_gaps: Vec<KeywordGap>,
    pub job_alignment: Option<JobAlignmentInsights>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobTargetInput {
    pub title: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtsBreakdown {
    pub system: String,
    pub score: f64,
    pub verdict: String,
    pub highlights: Vec<String>,
    pub risks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeywordGap {
    pub category: String,
    pub missing: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobAlignmentInsights {
    pub dominant_role: Option<String>,
    pub role_confidence: f64,
    pub keyword_match: f64,
    pub matched_keywords: Vec<String>,
    pub missing_keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzerDependencyStatus {
    pub pdftotext_available: bool,
    pub pdftoppm_available: bool,
    pub tesseract_available: bool,
}

impl AnalyzerDependencyStatus {
    pub fn is_ready(&self) -> bool {
        self.pdftotext_available && self.pdftoppm_available && self.tesseract_available
    }
}

pub fn dependency_status() -> AnalyzerDependencyStatus {
    AnalyzerDependencyStatus {
        pdftotext_available: which("pdftotext").is_ok(),
        pdftoppm_available: which("pdftoppm").is_ok(),
        tesseract_available: which("tesseract").is_ok(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HrSignal {
    pub status: HrSignalStatus,
    pub label: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HrSignalStatus {
    Positive,
    Warning,
    Critical,
}

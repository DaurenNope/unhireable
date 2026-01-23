use serde::{Deserialize, Serialize};

/// Questions to ask users to understand their job preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobQuestionnaire {
    // Location preferences
    pub remote_preference: RemotePreference,
    pub preferred_locations: Vec<String>, // If hybrid/onsite, which cities/countries?

    // Role preferences
    pub preferred_titles: Vec<String>, // ["Software Engineer", "Senior Developer"]
    pub preferred_companies: Vec<String>, // Companies they're interested in
    pub avoid_companies: Vec<String>,  // Companies to exclude

    // Skills & Experience
    pub required_skills: Vec<String>,  // Must-have skills
    pub preferred_skills: Vec<String>, // Nice-to-have skills
    pub experience_level: ExperienceLevel,
    pub years_experience: Option<u32>,

    // Compensation
    pub min_salary: Option<u32>,         // Minimum salary in USD
    pub salary_currency: Option<String>, // "USD", "EUR", etc.

    // Job type
    pub job_types: Vec<JobType>, // Full-time, Part-time, Contract, etc.
    pub industries: Vec<String>, // Tech, Finance, Healthcare, etc.

    // Other preferences
    pub must_have_benefits: Vec<String>, // ["health insurance", "401k", "unlimited PTO"]
    pub company_size: Option<CompanySize>,
    pub funding_stage: Option<FundingStage>, // For startups
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RemotePreference {
    RemoteOnly,
    Hybrid,
    Onsite,
    Any,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExperienceLevel {
    Entry,
    Mid,
    Senior,
    Lead,
    Any,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobType {
    FullTime,
    PartTime,
    Contract,
    Internship,
    Freelance,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CompanySize {
    Startup,    // 1-50
    Small,      // 51-200
    Medium,     // 201-1000
    Large,      // 1001-5000
    Enterprise, // 5000+
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FundingStage {
    Bootstrapped,
    Seed,
    SeriesA,
    SeriesB,
    SeriesC,
    Ipo,
    Public,
}

impl Default for JobQuestionnaire {
    fn default() -> Self {
        Self {
            remote_preference: RemotePreference::Any,
            preferred_locations: Vec::new(),
            preferred_titles: Vec::new(),
            preferred_companies: Vec::new(),
            avoid_companies: Vec::new(),
            required_skills: Vec::new(),
            preferred_skills: Vec::new(),
            experience_level: ExperienceLevel::Any,
            years_experience: None,
            min_salary: None,
            salary_currency: Some("USD".to_string()),
            job_types: vec![JobType::FullTime],
            industries: Vec::new(),
            must_have_benefits: Vec::new(),
            company_size: None,
            funding_stage: None,
        }
    }
}

/// Convert questionnaire to filter criteria
impl JobQuestionnaire {
    pub fn to_filter_criteria(&self) -> FilterCriteria {
        FilterCriteria {
            remote_only: self.remote_preference == RemotePreference::RemoteOnly,
            preferred_locations: self.preferred_locations.clone(),
            title_keywords: self.preferred_titles.clone(),
            preferred_companies: self.preferred_companies.clone(),
            avoid_companies: self.avoid_companies.clone(),
            required_skills: self.required_skills.clone(),
            preferred_skills: self.preferred_skills.clone(),
            min_match_score: None, // Will be calculated
            min_salary: self.min_salary,
            job_types: self.job_types.clone(),
            industries: self.industries.clone(),
            must_have_benefits: self.must_have_benefits.clone(),
            company_size: self.company_size.clone(),
            funding_stage: self.funding_stage.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct FilterCriteria {
    pub remote_only: bool,
    pub preferred_locations: Vec<String>,
    pub title_keywords: Vec<String>,
    pub preferred_companies: Vec<String>,
    pub avoid_companies: Vec<String>,
    pub required_skills: Vec<String>,
    pub preferred_skills: Vec<String>,
    pub min_match_score: Option<f64>,
    pub min_salary: Option<u32>,
    pub job_types: Vec<JobType>,
    pub industries: Vec<String>,
    pub must_have_benefits: Vec<String>,
    pub company_size: Option<CompanySize>,
    pub funding_stage: Option<FundingStage>,
}

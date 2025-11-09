pub mod job_matcher;
pub mod skills_analyzer;

pub use job_matcher::JobMatcher;
pub use skills_analyzer::SkillsAnalyzer;

use crate::db::models::Job;
use serde::{Deserialize, Serialize};

/// Job match result with score and reasons
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobMatchResult {
    pub job_id: Option<i64>,
    pub job: Job,
    pub match_score: f64, // 0.0 to 100.0
    pub skills_match: f64, // 0.0 to 100.0
    pub experience_match: f64, // 0.0 to 100.0
    pub location_match: f64, // 0.0 to 100.0
    pub matched_skills: Vec<String>,
    pub missing_skills: Vec<String>,
    pub match_reasons: Vec<String>,
    pub experience_level: String, // "entry", "mid", "senior", "lead"
}

impl JobMatchResult {
    pub fn new(job: Job) -> Self {
        Self {
            job_id: job.id,
            job,
            match_score: 0.0,
            skills_match: 0.0,
            experience_match: 0.0,
            location_match: 0.0,
            matched_skills: Vec::new(),
            missing_skills: Vec::new(),
            match_reasons: Vec::new(),
            experience_level: "unknown".to_string(),
        }
    }

    pub fn is_good_match(&self, threshold: f64) -> bool {
        self.match_score >= threshold
    }

    pub fn get_match_quality(&self) -> MatchQuality {
        match self.match_score {
            score if score >= 80.0 => MatchQuality::Excellent,
            score if score >= 60.0 => MatchQuality::Good,
            score if score >= 40.0 => MatchQuality::Fair,
            _ => MatchQuality::Poor,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MatchQuality {
    Excellent, // 80-100%
    Good,      // 60-79%
    Fair,      // 40-59%
    Poor,      // 0-39%
}

impl std::fmt::Display for MatchQuality {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MatchQuality::Excellent => write!(f, "Excellent"),
            MatchQuality::Good => write!(f, "Good"),
            MatchQuality::Fair => write!(f, "Fair"),
            MatchQuality::Poor => write!(f, "Poor"),
        }
    }
}


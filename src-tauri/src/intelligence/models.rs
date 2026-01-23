/// Data models for Intelligence Agent API

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobMatchRequest {
    pub job_description: String,
    pub resume_text: Option<String>,
    pub skills: Option<Vec<String>>,
    pub experience_years: Option<f64>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobMatchResponse {
    pub match_score: f64,
    pub skills_match: f64,
    pub experience_match: f64,
    pub location_match: f64,
    pub matched_skills: Vec<String>,
    pub missing_skills: Vec<String>,
    pub match_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationRequest {
    pub user_id: String,
    pub job_ids: Vec<i64>,
    pub preferences: Option<HashMap<String, serde_json::Value>>,
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationResponse {
    pub recommendations: Vec<HashMap<String, serde_json::Value>>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillGapRequest {
    pub current_skills: Vec<String>,
    pub target_role: String,
    pub market_data: Option<Vec<HashMap<String, serde_json::Value>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillGapAnalysis {
    pub target_role: String,
    pub current_skills: Vec<String>,
    pub required_skills: Vec<String>,
    pub missing_skills: Vec<String>,
    pub coverage_score: f64,
    pub priority_skills: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerPathRequest {
    pub current_skills: Vec<String>,
    pub current_role: Option<String>,
    pub target_role: Option<String>,
    pub experience_years: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerPathResponse {
    pub current_role: Option<String>,
    pub target_role: Option<String>,
    pub steps: Vec<HashMap<String, serde_json::Value>>,
    pub skills_to_develop: Vec<String>,
    pub estimated_timeline: Option<String>,
    pub similarity_to_target: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationSuccessPrediction {
    pub job_id: i64,
    pub success_probability: f64,
    pub confidence: String,
    pub factors: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketTrends {
    pub timeframe_days: i32,
    pub skills_trends: Vec<HashMap<String, serde_json::Value>>,
    pub location_trends: Vec<HashMap<String, serde_json::Value>>,
    pub role_trends: Vec<HashMap<String, serde_json::Value>>,
    pub salary_trends: HashMap<String, serde_json::Value>,
    pub remote_trends: HashMap<String, serde_json::Value>,
    pub demand_indicators: HashMap<String, serde_json::Value>,
}














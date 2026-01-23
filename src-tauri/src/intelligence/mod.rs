/// Intelligence Agent integration module
/// Provides Rust interface to the Python ML microservice

use crate::error::Result;
use std::collections::HashMap;

mod client;
mod models;
mod event_handler;

pub use client::IntelligenceClient;
pub use models::*;
pub use event_handler::IntelligenceEventHandler;

/// Intelligence Agent service wrapper
pub struct IntelligenceAgent {
    client: IntelligenceClient,
}

impl IntelligenceAgent {
    /// Create a new Intelligence Agent instance
    pub fn new(base_url: Option<String>) -> Self {
        let base_url = base_url.unwrap_or_else(|| {
            std::env::var("INTELLIGENCE_AGENT_URL")
                .unwrap_or_else(|_| "http://localhost:8000".to_string())
        });
        Self {
            client: IntelligenceClient::new(base_url),
        }
    }

    /// Calculate job match score using ML models
    pub async fn calculate_match(
        &self,
        job_description: &str,
        resume_text: Option<&str>,
        skills: Option<&[String]>,
        experience_years: Option<f64>,
        location: Option<&str>,
    ) -> Result<JobMatchResponse> {
        let request = JobMatchRequest {
            job_description: job_description.to_string(),
            resume_text: resume_text.map(|s| s.to_string()),
            skills: skills.map(|s| s.to_vec()),
            experience_years,
            location: location.map(|s| s.to_string()),
        };

        self.client.match_job(&request).await
    }

    /// Get personalized job recommendations
    pub async fn get_recommendations(
        &self,
        user_id: &str,
        previous_job_ids: &[i64],
        preferences: Option<HashMap<String, String>>,
        limit: usize,
    ) -> Result<RecommendationResponse> {
        let request = RecommendationRequest {
            user_id: user_id.to_string(),
            job_ids: previous_job_ids.to_vec(),
            preferences: preferences.map(|p| {
                p.into_iter()
                    .map(|(k, v)| (k, serde_json::Value::String(v)))
                    .collect()
            }),
            limit,
        };

        self.client.get_recommendations(&request).await
    }

    /// Get skill gap analysis
    pub async fn analyze_skill_gap(
        &self,
        current_skills: &[String],
        target_role: &str,
        market_data: Option<Vec<HashMap<String, serde_json::Value>>>,
    ) -> Result<SkillGapAnalysis> {
        let request = SkillGapRequest {
            current_skills: current_skills.to_vec(),
            target_role: target_role.to_string(),
            market_data: market_data.map(|data| {
                data.into_iter()
                    .map(|m| {
                        m.into_iter()
                            .map(|(k, v)| (k, v))
                            .collect::<HashMap<String, serde_json::Value>>()
                    })
                    .collect()
            }),
        };

        self.client.analyze_skill_gap(&request).await
    }

    /// Get career path recommendations
    pub async fn get_career_path(
        &self,
        current_skills: &[String],
        current_role: Option<&str>,
        target_role: Option<&str>,
        experience_years: Option<f64>,
    ) -> Result<CareerPathResponse> {
        let request = CareerPathRequest {
            current_skills: current_skills.to_vec(),
            current_role: current_role.map(|s| s.to_string()),
            target_role: target_role.map(|s| s.to_string()),
            experience_years,
        };

        self.client.get_career_path(&request).await
    }

    /// Predict application success probability
    pub async fn predict_application_success(
        &self,
        job_id: i64,
        user_skills: &[String],
        experience_years: f64,
        match_score: f64,
    ) -> Result<ApplicationSuccessPrediction> {
        self.client
            .predict_application_success(job_id, user_skills, experience_years, match_score)
            .await
    }

    /// Get market trends and insights
    pub async fn get_market_trends(
        &self,
        skills: Option<&[String]>,
        locations: Option<&[String]>,
        timeframe_days: i32,
    ) -> Result<MarketTrends> {
        self.client
            .get_market_trends(skills, locations, timeframe_days)
            .await
    }

    /// Track user interaction event
    pub async fn track_event(
        &self,
        event_type: &str,
        user_id: &str,
        job_id: Option<i64>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<()> {
        self.client
            .track_event(event_type, user_id, job_id, metadata)
            .await
    }
}

impl Default for IntelligenceAgent {
    fn default() -> Self {
        Self::new(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_intelligence_agent_creation() {
        let agent = IntelligenceAgent::default();
        // Just test that it can be created
        assert!(true);
    }
}







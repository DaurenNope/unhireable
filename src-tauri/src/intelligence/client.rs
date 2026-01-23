/// HTTP client for Intelligence Agent API

use crate::error::Result;
use crate::intelligence::models::*;
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;

pub struct IntelligenceClient {
    client: Client,
    base_url: String,
}

impl IntelligenceClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    pub async fn match_job(&self, request: &JobMatchRequest) -> Result<JobMatchResponse> {
        // Record metrics: start timing
        let start_time = std::time::Instant::now();
        
        let url = self.url("/api/v1/matching/match");
        let response = self
            .client
            .post(&url)
            .json(request)
            .send()
            .await
            .map_err(|e| {
                // Record error metric
                crate::metrics::INTELLIGENCE_API_ERRORS.inc();
                crate::error::Error::Custom(format!("HTTP error: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            // Record error metric
            crate::metrics::INTELLIGENCE_API_ERRORS.inc();
            return Err(crate::error::Error::Custom(format!(
                "Intelligence Agent API error ({}): {}",
                status, text
            )));
        }

        let match_response: JobMatchResponse = response
            .json()
            .await
            .map_err(|e| crate::error::Error::Custom(format!("Parse error: {}", e)))?;

        // Record success metrics
        let duration = start_time.elapsed().as_secs_f64();
        crate::metrics::INTELLIGENCE_API_CALLS.inc();
        crate::metrics::INTELLIGENCE_API_DURATION.observe(duration);

        Ok(match_response)
    }

    pub async fn get_recommendations(
        &self,
        request: &RecommendationRequest,
    ) -> Result<RecommendationResponse> {
        // Record metrics: start timing
        let start_time = std::time::Instant::now();
        
        let url = self.url("/api/v1/recommendations/jobs");
        let response = self
            .client
            .post(&url)
            .json(request)
            .send()
            .await
            .map_err(|e| {
                crate::metrics::INTELLIGENCE_API_ERRORS.inc();
                crate::error::Error::Custom(format!("HTTP error: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            crate::metrics::INTELLIGENCE_API_ERRORS.inc();
            return Err(crate::error::Error::Custom(format!(
                "Intelligence Agent API error ({}): {}",
                status, text
            )));
        }

        let rec_response: RecommendationResponse = response
            .json()
            .await
            .map_err(|e| crate::error::Error::Custom(format!("Parse error: {}", e)))?;

        // Record success metrics
        let duration = start_time.elapsed().as_secs_f64();
        crate::metrics::INTELLIGENCE_API_CALLS.inc();
        crate::metrics::INTELLIGENCE_API_DURATION.observe(duration);

        Ok(rec_response)
    }

    pub async fn analyze_skill_gap(&self, request: &SkillGapRequest) -> Result<SkillGapAnalysis> {
        // Record metrics: start timing
        let start_time = std::time::Instant::now();
        
        let url = self.url("/api/v1/skill-gap/analyze");
        let response = self
            .client
            .post(&url)
            .json(request)
            .send()
            .await
            .map_err(|e| {
                crate::metrics::INTELLIGENCE_API_ERRORS.inc();
                crate::error::Error::Custom(format!("HTTP error: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            crate::metrics::INTELLIGENCE_API_ERRORS.inc();
            return Err(crate::error::Error::Custom(format!(
                "Intelligence Agent API error ({}): {}",
                status, text
            )));
        }

        let analysis: SkillGapAnalysis = response
            .json()
            .await
            .map_err(|e| crate::error::Error::Custom(format!("Parse error: {}", e)))?;

        // Record success metrics
        let duration = start_time.elapsed().as_secs_f64();
        crate::metrics::INTELLIGENCE_API_CALLS.inc();
        crate::metrics::INTELLIGENCE_API_DURATION.observe(duration);

        Ok(analysis)
    }

    pub async fn get_career_path(&self, request: &CareerPathRequest) -> Result<CareerPathResponse> {
        // Record metrics: start timing
        let start_time = std::time::Instant::now();
        
        let url = self.url("/api/v1/career-path/recommendations");
        let response = self
            .client
            .post(&url)
            .json(request)
            .send()
            .await
            .map_err(|e| {
                crate::metrics::INTELLIGENCE_API_ERRORS.inc();
                crate::error::Error::Custom(format!("HTTP error: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            crate::metrics::INTELLIGENCE_API_ERRORS.inc();
            return Err(crate::error::Error::Custom(format!(
                "Intelligence Agent API error ({}): {}",
                status, text
            )));
        }

        let path: CareerPathResponse = response
            .json()
            .await
            .map_err(|e| crate::error::Error::Custom(format!("Parse error: {}", e)))?;

        // Record success metrics
        let duration = start_time.elapsed().as_secs_f64();
        crate::metrics::INTELLIGENCE_API_CALLS.inc();
        crate::metrics::INTELLIGENCE_API_DURATION.observe(duration);

        Ok(path)
    }

    pub async fn predict_application_success(
        &self,
        job_id: i64,
        user_skills: &[String],
        experience_years: f64,
        match_score: f64,
    ) -> Result<ApplicationSuccessPrediction> {
        // Record metrics: start timing
        let start_time = std::time::Instant::now();
        
        let url = self.url("/api/v1/predictive/application-success");
        let body = json!({
            "job_id": job_id,
            "user_skills": user_skills,
            "experience_years": experience_years,
            "match_score": match_score,
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                crate::metrics::INTELLIGENCE_API_ERRORS.inc();
                crate::error::Error::Custom(format!("HTTP error: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            crate::metrics::INTELLIGENCE_API_ERRORS.inc();
            return Err(crate::error::Error::Custom(format!(
                "Intelligence Agent API error ({}): {}",
                status, text
            )));
        }

        let prediction: ApplicationSuccessPrediction = response
            .json()
            .await
            .map_err(|e| crate::error::Error::Custom(format!("Parse error: {}", e)))?;

        // Record success metrics
        let duration = start_time.elapsed().as_secs_f64();
        crate::metrics::INTELLIGENCE_API_CALLS.inc();
        crate::metrics::INTELLIGENCE_API_DURATION.observe(duration);

        Ok(prediction)
    }

    pub async fn get_market_trends(
        &self,
        skills: Option<&[String]>,
        locations: Option<&[String]>,
        timeframe_days: i32,
    ) -> Result<MarketTrends> {
        // Record metrics: start timing
        let start_time = std::time::Instant::now();
        
        let url = self.url("/api/v1/market-insights/trends");
        let mut body = json!({
            "timeframe_days": timeframe_days,
        });

        if let Some(skills) = skills {
            body["skills"] = json!(skills);
        }

        if let Some(locations) = locations {
            body["locations"] = json!(locations);
        }

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                crate::metrics::INTELLIGENCE_API_ERRORS.inc();
                crate::error::Error::Custom(format!("HTTP error: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            crate::metrics::INTELLIGENCE_API_ERRORS.inc();
            return Err(crate::error::Error::Custom(format!(
                "Intelligence Agent API error ({}): {}",
                status, text
            )));
        }

        let trends: MarketTrends = response
            .json()
            .await
            .map_err(|e| crate::error::Error::Custom(format!("Parse error: {}", e)))?;

        // Record success metrics
        let duration = start_time.elapsed().as_secs_f64();
        crate::metrics::INTELLIGENCE_API_CALLS.inc();
        crate::metrics::INTELLIGENCE_API_DURATION.observe(duration);

        Ok(trends)
    }

    pub async fn track_event(
        &self,
        event_type: &str,
        user_id: &str,
        job_id: Option<i64>,
        metadata: Option<HashMap<String, Value>>,
    ) -> Result<()> {
        let url = self.url("/api/v1/analytics/track");
        let mut params = vec![
            ("event_type", event_type.to_string()),
            ("user_id", user_id.to_string()),
        ];

        if let Some(job_id) = job_id {
            params.push(("job_id", job_id.to_string()));
        }

        let mut request = self.client.post(&url);

        for (key, value) in params {
            request = request.query(&[(key, value)]);
        }

        if let Some(metadata) = metadata {
            request = request.json(&json!({ "metadata": metadata }));
        }

        let response = request
            .send()
            .await
            .map_err(|e| crate::error::Error::Custom(format!("HTTP error: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(crate::error::Error::Custom(format!(
                "Intelligence Agent API error ({}): {}",
                status, text
            )));
        }

        Ok(())
    }

    pub async fn health_check(&self) -> Result<bool> {
        let url = self.url("/health");
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| crate::error::Error::Custom(format!("HTTP error: {}", e)))?;

        Ok(response.status().is_success())
    }
}







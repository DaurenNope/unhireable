//! Jooble API Scraper
//! Free API with generous limits
//! Docs: https://jooble.org/api/about

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const JOOBLE_API_BASE: &str = "https://jooble.org/api";

#[derive(Debug, Serialize)]
struct JoobleRequest {
    keywords: String,
    location: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    radius: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    salary: Option<u32>,
    page: u32,
}

#[derive(Debug, Deserialize)]
struct JoobleResponse {
    jobs: Vec<JoobleJob>,
    #[serde(rename = "totalCount")]
    total_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct JoobleJob {
    id: Option<String>,
    title: Option<String>,
    snippet: Option<String>,
    link: Option<String>,
    company: Option<String>,
    location: Option<String>,
    salary: Option<String>,
    source: Option<String>,
    #[serde(rename = "type")]
    job_type: Option<String>,
    updated: Option<String>,
}

pub struct JoobleScraper;

impl JoobleScraper {
    fn map_job(job: JoobleJob) -> Option<Job> {
        let title = job.title?.trim().to_string();
        let url = job.link?.trim().to_string();
        let company = job.company.unwrap_or_else(|| "Unknown Company".to_string());

        if title.is_empty() || url.is_empty() {
            return None;
        }

        let mut desc_parts = Vec::new();
        if let Some(jt) = job.job_type.as_ref().filter(|t| !t.is_empty()) {
            desc_parts.push(format!("Type: {}", jt));
        }
        if let Some(src) = job.source.as_ref().filter(|s| !s.is_empty()) {
            desc_parts.push(format!("Source: {}", src));
        }
        if let Some(updated) = job.updated.as_ref().filter(|u| !u.is_empty()) {
            desc_parts.push(format!("Updated: {}", updated));
        }

        let description = if desc_parts.is_empty() {
            job.snippet.clone()
        } else {
            Some(format!(
                "{}\n\n{}",
                desc_parts.join(" | "),
                job.snippet.unwrap_or_default()
            ))
        };

        Some(Job {
            id: job.id.and_then(|id| id.parse().ok()),
            title,
            company,
            url,
            description,
            requirements: None,
            location: job.location,
            salary: job.salary,
            source: "jooble".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        })
    }
}

impl JobScraper for JoobleScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        // Check for API key
        let api_key = config
            .jooble_api_key
            .clone()
            .or_else(|| std::env::var("JOOBLE_API_KEY").ok());

        let api_key = match api_key {
            Some(key) => key,
            None => {
                println!("⚠️  Jooble: No API key. Set JOOBLE_API_KEY environment variable");
                println!("   Get free API key at: https://jooble.org/api/about");
                return Ok(Vec::new());
            }
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .context("Failed to build HTTP client for Jooble")?;

        let url = format!("{}/{}", JOOBLE_API_BASE, api_key);

        let request_body = JoobleRequest {
            keywords: query.trim().to_string(),
            location: "Remote".to_string(),
            radius: None,
            salary: None,
            page: 1,
        };

        println!("🔍 Fetching jobs from Jooble API...");

        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .context("Failed to fetch Jooble API")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            println!("⚠️  Jooble API error: {} - {}", status, &body[..200.min(body.len())]);
            return Ok(Vec::new());
        }

        let jooble_response: JoobleResponse = response
            .json()
            .context("Failed to parse Jooble API response")?;

        println!(
            "   Jooble returned {} jobs (total available: {:?})",
            jooble_response.jobs.len(),
            jooble_response.total_count
        );

        let jobs: Vec<Job> = jooble_response
            .jobs
            .into_iter()
            .filter_map(Self::map_job)
            .take(50)
            .collect();

        if jobs.is_empty() {
            println!("⚠️  Jooble: No jobs found for '{}'", query);
        } else {
            println!("✅ Successfully fetched {} jobs from Jooble", jobs.len());
        }

        Ok(jobs)
    }
}

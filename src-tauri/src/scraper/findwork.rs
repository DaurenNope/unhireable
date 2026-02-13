//! Findwork API Scraper
//! Free API for tech/developer jobs
//! Docs: https://findwork.dev/developers/

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::time::Duration;

const FINDWORK_API_URL: &str = "https://findwork.dev/api/jobs/";

#[derive(Debug, Deserialize)]
struct FindworkResponse {
    count: Option<u32>,
    results: Vec<FindworkJob>,
}

#[derive(Debug, Deserialize)]
struct FindworkJob {
    id: Option<u64>,
    role: Option<String>,
    company_name: Option<String>,
    company_num_employees: Option<String>,
    employment_type: Option<String>,
    location: Option<String>,
    remote: Option<bool>,
    logo: Option<String>,
    url: Option<String>,
    text: Option<String>,
    date_posted: Option<String>,
    keywords: Option<Vec<String>>,
    source: Option<String>,
}

pub struct FindworkScraper;

impl FindworkScraper {
    fn map_job(job: FindworkJob) -> Option<Job> {
        let title = job.role?.trim().to_string();
        let company = job.company_name?.trim().to_string();
        let url = job.url?.trim().to_string();

        if title.is_empty() || company.is_empty() || url.is_empty() {
            return None;
        }

        // Build location
        let location = match (job.location, job.remote) {
            (Some(loc), Some(true)) => Some(format!("{} (Remote)", loc)),
            (Some(loc), _) => Some(loc),
            (None, Some(true)) => Some("Remote".to_string()),
            _ => None,
        };

        // Build description with metadata
        let mut desc_parts = Vec::new();

        if let Some(emp_type) = job.employment_type.filter(|t| !t.is_empty()) {
            desc_parts.push(format!("Type: {}", emp_type));
        }

        if let Some(size) = job.company_num_employees.filter(|s| !s.is_empty()) {
            desc_parts.push(format!("Company size: {}", size));
        }

        if let Some(keywords) = job.keywords.filter(|k| !k.is_empty()) {
            desc_parts.push(format!("Skills: {}", keywords.join(", ")));
        }

        if let Some(posted) = job.date_posted.filter(|d| !d.is_empty()) {
            desc_parts.push(format!("Posted: {}", posted));
        }

        if let Some(src) = job.source.filter(|s| !s.is_empty()) {
            desc_parts.push(format!("Source: {}", src));
        }

        let description = if desc_parts.is_empty() {
            job.text.clone()
        } else {
            Some(format!(
                "{}\n\n{}",
                desc_parts.join(" | "),
                job.text.unwrap_or_default()
            ))
        };

        Some(Job {
            id: job.id.map(|id| id as i64),
            title,
            company,
            url,
            description,
            requirements: None,
            location,
            salary: None, // Findwork doesn't provide salary
            source: "findwork".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        })
    }
}

impl JobScraper for FindworkScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        // Check for API key (optional but recommended)
        let api_key = config
            .findwork_api_key
            .clone()
            .or_else(|| std::env::var("FINDWORK_API_KEY").ok());

        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (compatible; UnhireableBot/1.0)")
            .build()
            .context("Failed to build HTTP client for Findwork")?;

        // Findwork API parameters:
        // - search: keyword search
        // - remote: true for remote jobs
        // - location: filter by location
        let url = format!(
            "{}?search={}&remote=true",
            FINDWORK_API_URL,
            urlencoding::encode(query.trim())
        );

        println!("🔍 Fetching jobs from Findwork API...");

        let mut request = client.get(&url);
        
        // Add API key if available
        if let Some(key) = api_key {
            request = request.header("Authorization", format!("Token {}", key));
        }

        let response = request
            .send()
            .context("Failed to fetch Findwork API")?;

        if !response.status().is_success() {
            let status = response.status();
            if status.as_u16() == 401 {
                println!("⚠️  Findwork: API key required. Set FINDWORK_API_KEY");
                println!("   Get free API key at: https://findwork.dev/developers/");
                return Ok(Vec::new());
            }
            let body = response.text().unwrap_or_default();
            println!("⚠️  Findwork API error: {} - {}", status, &body[..200.min(body.len())]);
            return Ok(Vec::new());
        }

        let findwork_response: FindworkResponse = response
            .json()
            .context("Failed to parse Findwork API response")?;

        println!(
            "   Findwork returned {} jobs (total: {:?})",
            findwork_response.results.len(),
            findwork_response.count
        );

        let jobs: Vec<Job> = findwork_response
            .results
            .into_iter()
            .filter_map(Self::map_job)
            .take(50)
            .collect();

        if jobs.is_empty() {
            println!("⚠️  Findwork: No jobs found for '{}'", query);
        } else {
            println!("✅ Successfully fetched {} jobs from Findwork", jobs.len());
        }

        Ok(jobs)
    }
}

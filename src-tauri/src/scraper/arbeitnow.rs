//! Arbeitnow API Scraper
//! Free API, no authentication required, focused on EU/remote jobs
//! Docs: https://www.arbeitnow.com/api

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::time::Duration;

const ARBEITNOW_API_URL: &str = "https://www.arbeitnow.com/api/job-board-api";

#[derive(Debug, Deserialize)]
struct ArbeitnowResponse {
    data: Vec<ArbeitnowJob>,
    links: Option<ArbeitnowLinks>,
    meta: Option<ArbeitnowMeta>,
}

#[derive(Debug, Deserialize)]
struct ArbeitnowJob {
    slug: Option<String>,
    title: Option<String>,
    description: Option<String>,
    company_name: Option<String>,
    location: Option<String>,
    remote: Option<bool>,
    url: Option<String>,
    tags: Option<Vec<String>>,
    job_types: Option<Vec<String>>,
    created_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ArbeitnowLinks {
    next: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ArbeitnowMeta {
    total: Option<u32>,
    per_page: Option<u32>,
    current_page: Option<u32>,
    last_page: Option<u32>,
}

pub struct ArbeitnowScraper;

impl ArbeitnowScraper {
    fn map_job(job: ArbeitnowJob) -> Option<Job> {
        let title = job.title?.trim().to_string();
        let company = job.company_name?.trim().to_string();
        let url = job
            .url
            .or_else(|| {
                job.slug
                    .as_ref()
                    .map(|s| format!("https://www.arbeitnow.com/view/{}", s))
            })
            .unwrap_or_default();

        if title.is_empty() || company.is_empty() || url.is_empty() {
            return None;
        }

        // Build location string
        let location = match (job.location, job.remote) {
            (Some(loc), Some(true)) => Some(format!("{} (Remote)", loc)),
            (Some(loc), _) => Some(loc),
            (None, Some(true)) => Some("Remote".to_string()),
            _ => None,
        };

        // Build description with metadata
        let mut desc_parts = Vec::new();

        if let Some(job_types) = job.job_types.filter(|t| !t.is_empty()) {
            desc_parts.push(format!("Type: {}", job_types.join(", ")));
        }

        if let Some(tags) = job.tags.filter(|t| !t.is_empty()) {
            desc_parts.push(format!("Tags: {}", tags.join(", ")));
        }

        if let Some(created) = job.created_at {
            // Convert Unix timestamp to date string
            if let Some(dt) = chrono::DateTime::from_timestamp(created, 0) {
                desc_parts.push(format!("Posted: {}", dt.format("%Y-%m-%d")));
            }
        }

        let description = if desc_parts.is_empty() {
            job.description.clone()
        } else {
            Some(format!(
                "{}\n\n{}",
                desc_parts.join(" | "),
                job.description.unwrap_or_default()
            ))
        };

        Some(Job {
            id: None,
            title,
            company,
            url,
            description,
            requirements: None,
            location,
            salary: None, // Arbeitnow doesn't provide salary in API
            source: "arbeitnow".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        })
    }
}

impl JobScraper for ArbeitnowScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (compatible; UnhireableBot/1.0)")
            .build()
            .context("Failed to build HTTP client for Arbeitnow")?;

        println!("🔍 Fetching jobs from Arbeitnow API...");

        let response = client
            .get(ARBEITNOW_API_URL)
            .send()
            .context("Failed to fetch Arbeitnow API")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            println!(
                "⚠️  Arbeitnow API error: {} - {}",
                status,
                &body[..200.min(body.len())]
            );
            return Ok(Vec::new());
        }

        let arbeitnow_response: ArbeitnowResponse = response
            .json()
            .context("Failed to parse Arbeitnow API response")?;

        let total = arbeitnow_response
            .meta
            .as_ref()
            .and_then(|m| m.total);

        println!(
            "   Arbeitnow returned {} jobs (total available: {:?})",
            arbeitnow_response.data.len(),
            total
        );

        // Filter by query keywords
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();

        let jobs: Vec<Job> = arbeitnow_response
            .data
            .into_iter()
            .filter_map(Self::map_job)
            .filter(|job| {
                if query_words.is_empty() {
                    return true;
                }
                let job_text = format!(
                    "{} {} {}",
                    job.title.to_lowercase(),
                    job.company.to_lowercase(),
                    job.description
                        .as_ref()
                        .map(|d| d.to_lowercase())
                        .unwrap_or_default()
                );
                query_words.iter().any(|w| job_text.contains(w))
            })
            .take(50)
            .collect();

        if jobs.is_empty() {
            println!("⚠️  Arbeitnow: No jobs found matching '{}'", query);
        } else {
            println!("✅ Successfully fetched {} jobs from Arbeitnow", jobs.len());
        }

        Ok(jobs)
    }
}

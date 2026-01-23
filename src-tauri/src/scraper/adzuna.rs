//! Adzuna API Scraper
//! Free tier: 250 calls/month, returns up to 50 results per call
//! Docs: https://developer.adzuna.com/

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::time::Duration;

const ADZUNA_API_BASE: &str = "https://api.adzuna.com/v1/api/jobs";

#[derive(Debug, Deserialize)]
struct AdzunaResponse {
    results: Vec<AdzunaJob>,
    count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct AdzunaJob {
    id: Option<String>,
    title: Option<String>,
    description: Option<String>,
    redirect_url: Option<String>,
    company: Option<AdzunaCompany>,
    location: Option<AdzunaLocation>,
    salary_min: Option<f64>,
    salary_max: Option<f64>,
    contract_type: Option<String>,
    category: Option<AdzunaCategory>,
    created: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AdzunaCompany {
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AdzunaLocation {
    display_name: Option<String>,
    area: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct AdzunaCategory {
    label: Option<String>,
    tag: Option<String>,
}

pub struct AdzunaScraper;

impl AdzunaScraper {
    fn map_job(job: AdzunaJob) -> Option<Job> {
        let title = job.title?.trim().to_string();
        let url = job.redirect_url?.trim().to_string();
        let company = job
            .company
            .and_then(|c| c.display_name)
            .unwrap_or_else(|| "Unknown Company".to_string());

        if title.is_empty() || url.is_empty() {
            return None;
        }

        let location = job.location.and_then(|loc| {
            loc.display_name
                .or_else(|| loc.area.and_then(|a| a.first().cloned()))
        });

        let salary = match (job.salary_min, job.salary_max) {
            (Some(min), Some(max)) if min > 0.0 && max > 0.0 => {
                Some(format!("${:.0}k - ${:.0}k", min / 1000.0, max / 1000.0))
            }
            (Some(min), _) if min > 0.0 => Some(format!("${:.0}k+", min / 1000.0)),
            (_, Some(max)) if max > 0.0 => Some(format!("Up to ${:.0}k", max / 1000.0)),
            _ => None,
        };

        let mut desc_parts = Vec::new();
        if let Some(cat) = job.category.and_then(|c| c.label) {
            desc_parts.push(format!("Category: {}", cat));
        }
        if let Some(contract) = job.contract_type {
            desc_parts.push(format!("Type: {}", contract));
        }
        if let Some(created) = job.created {
            desc_parts.push(format!("Posted: {}", created));
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
            id: job.id.and_then(|id| id.parse().ok()),
            title,
            company,
            url,
            description,
            requirements: None,
            location,
            salary,
            source: "adzuna".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        })
    }
}

impl JobScraper for AdzunaScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        // Check for API credentials
        let app_id = config
            .adzuna_app_id
            .clone()
            .or_else(|| std::env::var("ADZUNA_APP_ID").ok());
        let api_key = config
            .adzuna_api_key
            .clone()
            .or_else(|| std::env::var("ADZUNA_API_KEY").ok());

        let (app_id, api_key) = match (app_id, api_key) {
            (Some(id), Some(key)) => (id, key),
            _ => {
                println!("⚠️  Adzuna: No API credentials. Set ADZUNA_APP_ID and ADZUNA_API_KEY");
                println!("   Get free API key at: https://developer.adzuna.com/");
                return Ok(Vec::new());
            }
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (compatible; UnhireableBot/1.0)")
            .build()
            .context("Failed to build HTTP client for Adzuna")?;

        // Country codes: us, gb, au, ca, de, fr, in, nl, nz, pl, za
        let country = config
            .adzuna_country
            .clone()
            .unwrap_or_else(|| "us".to_string());

        let url = format!(
            "{}/{}/search/1?app_id={}&app_key={}&results_per_page=50&what={}&what_or=remote",
            ADZUNA_API_BASE,
            country,
            app_id,
            api_key,
            urlencoding::encode(query.trim())
        );

        println!("🔍 Fetching jobs from Adzuna API ({})...", country);

        let response = client
            .get(&url)
            .send()
            .context("Failed to fetch Adzuna API")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            println!("⚠️  Adzuna API error: {} - {}", status, &body[..200.min(body.len())]);
            return Ok(Vec::new());
        }

        let adzuna_response: AdzunaResponse = response
            .json()
            .context("Failed to parse Adzuna API response")?;

        println!(
            "   Adzuna returned {} jobs (total available: {:?})",
            adzuna_response.results.len(),
            adzuna_response.count
        );

        let jobs: Vec<Job> = adzuna_response
            .results
            .into_iter()
            .filter_map(Self::map_job)
            .collect();

        if jobs.is_empty() {
            println!("⚠️  Adzuna: No jobs found for '{}'", query);
        } else {
            println!("✅ Successfully fetched {} jobs from Adzuna", jobs.len());
        }

        Ok(jobs)
    }
}

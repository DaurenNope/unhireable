//! Jobicy API Scraper
//! Free API for remote jobs, no authentication required
//! Docs: https://jobicy.com/api

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::time::Duration;

const JOBICY_API_URL: &str = "https://jobicy.com/api/v2/remote-jobs";

#[derive(Debug, Deserialize)]
struct JobicyResponse {
    #[serde(default)]
    jobs: Vec<JobicyJob>,
    #[serde(rename = "jobCount")]
    job_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct JobicyJob {
    id: Option<u64>,
    url: Option<String>,
    #[serde(rename = "jobTitle")]
    job_title: Option<String>,
    #[serde(rename = "companyName")]
    company_name: Option<String>,
    #[serde(rename = "companyLogo")]
    company_logo: Option<String>,
    #[serde(rename = "jobIndustry")]
    job_industry: Option<Vec<String>>,
    #[serde(rename = "jobType")]
    job_type: Option<Vec<String>>,
    #[serde(rename = "jobGeo")]
    job_geo: Option<String>,
    #[serde(rename = "jobLevel")]
    job_level: Option<String>,
    #[serde(rename = "jobExcerpt")]
    job_excerpt: Option<String>,
    #[serde(rename = "jobDescription")]
    job_description: Option<String>,
    #[serde(rename = "pubDate")]
    pub_date: Option<String>,
    #[serde(rename = "annualSalaryMin")]
    salary_min: Option<String>,
    #[serde(rename = "annualSalaryMax")]
    salary_max: Option<String>,
    #[serde(rename = "salaryCurrency")]
    salary_currency: Option<String>,
}

pub struct JobicyScraper;

impl JobicyScraper {
    fn map_job(job: JobicyJob) -> Option<Job> {
        let title = job.job_title?.trim().to_string();
        let company = job.company_name?.trim().to_string();
        let url = job.url?.trim().to_string();

        if title.is_empty() || company.is_empty() || url.is_empty() {
            return None;
        }

        // Build location from job_geo
        let location = job.job_geo.map(|geo| {
            if geo.to_lowercase().contains("anywhere") {
                "Remote (Worldwide)".to_string()
            } else {
                format!("Remote ({})", geo)
            }
        });

        // Build salary string
        let salary = match (job.salary_min, job.salary_max, job.salary_currency) {
            (Some(min), Some(max), Some(currency)) if !min.is_empty() && !max.is_empty() => {
                Some(format!("{} {} - {} {}", currency, min, currency, max))
            }
            (Some(min), _, Some(currency)) if !min.is_empty() => {
                Some(format!("{} {}+", currency, min))
            }
            _ => None,
        };

        // Build description with metadata
        let mut desc_parts = Vec::new();

        if let Some(industries) = job.job_industry.filter(|i| !i.is_empty()) {
            desc_parts.push(format!("Industry: {}", industries.join(", ")));
        }

        if let Some(types) = job.job_type.filter(|t| !t.is_empty()) {
            desc_parts.push(format!("Type: {}", types.join(", ")));
        }

        if let Some(level) = job.job_level.filter(|l| !l.is_empty()) {
            desc_parts.push(format!("Level: {}", level));
        }

        if let Some(pub_date) = job.pub_date.filter(|d| !d.is_empty()) {
            desc_parts.push(format!("Posted: {}", pub_date));
        }

        let description = if desc_parts.is_empty() {
            job.job_description.or(job.job_excerpt)
        } else {
            Some(format!(
                "{}\n\n{}",
                desc_parts.join(" | "),
                job.job_description.or(job.job_excerpt).unwrap_or_default()
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
            salary,
            source: "jobicy".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        })
    }
}

impl JobScraper for JobicyScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (compatible; JobezBot/1.0)")
            .build()
            .context("Failed to build HTTP client for Jobicy")?;

        // Jobicy API parameters:
        // - count: number of listings (max 50)
        // - geo: filter by region (e.g., "usa", "europe")
        // - industry: filter by category
        // - tag: filter by skill/technology
        let url = format!(
            "{}?count=50&tag={}",
            JOBICY_API_URL,
            urlencoding::encode(query.trim())
        );

        println!("🔍 Fetching jobs from Jobicy API...");

        let response = client
            .get(&url)
            .send()
            .context("Failed to fetch Jobicy API")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            println!("⚠️  Jobicy API error: {} - {}", status, &body[..200.min(body.len())]);
            return Ok(Vec::new());
        }

        let jobicy_response: JobicyResponse = response
            .json()
            .context("Failed to parse Jobicy API response")?;

        println!(
            "   Jobicy returned {} jobs (total: {:?})",
            jobicy_response.jobs.len(),
            jobicy_response.job_count
        );

        // Filter by query keywords
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();

        let jobs: Vec<Job> = jobicy_response
            .jobs
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
                    job.description.as_ref().map(|d| d.to_lowercase()).unwrap_or_default()
                );
                query_words.iter().any(|w| job_text.contains(w))
            })
            .take(50)
            .collect();

        if jobs.is_empty() {
            println!("⚠️  Jobicy: No jobs found for '{}'", query);
        } else {
            println!("✅ Successfully fetched {} jobs from Jobicy", jobs.len());
        }

        Ok(jobs)
    }
}

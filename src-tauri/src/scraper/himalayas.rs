//! Himalayas API Scraper
//! Free API for quality remote jobs
//! Docs: https://himalayas.app/api

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::time::Duration;

const HIMALAYAS_API_URL: &str = "https://himalayas.app/jobs/api";

#[derive(Debug, Deserialize)]
struct HimalayasResponse {
    jobs: Vec<HimalayasJob>,
    #[serde(rename = "totalJobs")]
    total_jobs: Option<u32>,
    #[serde(rename = "pageCount")]
    page_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct HimalayasJob {
    id: Option<String>,
    title: Option<String>,
    #[serde(rename = "companyName")]
    company_name: Option<String>,
    #[serde(rename = "companyLogo")]
    company_logo: Option<String>,
    excerpt: Option<String>,
    description: Option<String>,
    #[serde(rename = "applicationLink")]
    application_link: Option<String>,
    #[serde(rename = "pubDate")]
    pub_date: Option<String>,
    categories: Option<Vec<String>>,
    #[serde(rename = "companyTimezone")]
    timezone: Option<String>,
    #[serde(rename = "locationRestrictions")]
    location_restrictions: Option<Vec<String>>,
    seniority: Option<Vec<String>>,
    #[serde(rename = "minSalary")]
    min_salary: Option<i64>,
    #[serde(rename = "maxSalary")]
    max_salary: Option<i64>,
}

pub struct HimalayasScraper;

impl HimalayasScraper {
    fn map_job(job: HimalayasJob) -> Option<Job> {
        let title = job.title?.trim().to_string();
        let company = job.company_name?.trim().to_string();
        
        // Build URL - either application link or construct from ID
        let url = job.application_link
            .filter(|u| !u.is_empty())
            .or_else(|| {
                job.id.as_ref().map(|id| format!("https://himalayas.app/jobs/{}", id))
            })?;

        if title.is_empty() || company.is_empty() {
            return None;
        }

        // Build location from restrictions
        let location = job.location_restrictions.map(|locs| {
            if locs.is_empty() || locs.iter().any(|l| l.to_lowercase() == "worldwide") {
                "Remote (Worldwide)".to_string()
            } else {
                format!("Remote ({})", locs.join(", "))
            }
        }).or(Some("Remote".to_string()));

        // Build salary string
        let salary = match (job.min_salary, job.max_salary) {
            (Some(min), Some(max)) if min > 0 && max > 0 => {
                Some(format!("${:.0}k - ${:.0}k", min as f64 / 1000.0, max as f64 / 1000.0))
            }
            (Some(min), _) if min > 0 => {
                Some(format!("${:.0}k+", min as f64 / 1000.0))
            }
            _ => None,
        };

        // Build description with metadata
        let mut desc_parts = Vec::new();

        if let Some(categories) = job.categories.filter(|c| !c.is_empty()) {
            desc_parts.push(format!("Categories: {}", categories.join(", ")));
        }

        if let Some(seniority) = job.seniority.filter(|s| !s.is_empty()) {
            desc_parts.push(format!("Level: {}", seniority.join(", ")));
        }

        if let Some(tz) = job.timezone.filter(|t| !t.is_empty()) {
            desc_parts.push(format!("Timezone: {}", tz));
        }

        if let Some(posted) = job.pub_date.filter(|d| !d.is_empty()) {
            desc_parts.push(format!("Posted: {}", posted));
        }

        let description = if desc_parts.is_empty() {
            job.description.or(job.excerpt)
        } else {
            Some(format!(
                "{}\n\n{}",
                desc_parts.join(" | "),
                job.description.or(job.excerpt).unwrap_or_default()
            ))
        };

        Some(Job {
            id: None, // Himalayas uses string IDs
            title,
            company,
            url,
            description,
            requirements: None,
            location,
            salary,
            source: "himalayas".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        })
    }
}

impl JobScraper for HimalayasScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (compatible; UnhireableBot/1.0)")
            .build()
            .context("Failed to build HTTP client for Himalayas")?;

        // Himalayas API - fetches all remote jobs, we filter client-side
        println!("🔍 Fetching jobs from Himalayas API...");

        let response = client
            .get(HIMALAYAS_API_URL)
            .send()
            .context("Failed to fetch Himalayas API")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            println!("⚠️  Himalayas API error: {} - {}", status, &body[..200.min(body.len())]);
            return Ok(Vec::new());
        }

        let himalayas_response: HimalayasResponse = response
            .json()
            .context("Failed to parse Himalayas API response")?;

        println!(
            "   Himalayas returned {} jobs (total: {:?})",
            himalayas_response.jobs.len(),
            himalayas_response.total_jobs
        );

        // Filter by query keywords
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();

        let jobs: Vec<Job> = himalayas_response
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
            println!("⚠️  Himalayas: No jobs found matching '{}'", query);
        } else {
            println!("✅ Successfully fetched {} jobs from Himalayas", jobs.len());
        }

        Ok(jobs)
    }
}

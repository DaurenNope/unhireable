//! The Muse API Scraper
//! Free API, no authentication required
//! Docs: https://www.themuse.com/developers/api/v2

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::time::Duration;

const MUSE_API_URL: &str = "https://www.themuse.com/api/public/jobs";

#[derive(Debug, Deserialize)]
struct MuseResponse {
    results: Vec<MuseJob>,
    total: Option<u32>,
    page: Option<u32>,
    page_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct MuseJob {
    id: Option<u64>,
    name: Option<String>,
    #[serde(rename = "short_name")]
    short_name: Option<String>,
    company: Option<MuseCompany>,
    locations: Option<Vec<MuseLocation>>,
    levels: Option<Vec<MuseLevel>>,
    categories: Option<Vec<MuseCategory>>,
    refs: Option<MuseRefs>,
    contents: Option<String>,
    publication_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MuseCompany {
    name: Option<String>,
    short_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MuseLocation {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MuseLevel {
    name: Option<String>,
    short_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MuseCategory {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MuseRefs {
    landing_page: Option<String>,
}

pub struct TheMuseScraper;

impl TheMuseScraper {
    fn map_job(job: MuseJob) -> Option<Job> {
        let title = job.name?.trim().to_string();
        let company = job
            .company
            .and_then(|c| c.name)
            .unwrap_or_else(|| "Unknown Company".to_string());

        // Build URL from refs or construct from short_name
        let url = job
            .refs
            .and_then(|r| r.landing_page)
            .or_else(|| {
                job.short_name
                    .map(|sn| format!("https://www.themuse.com/jobs/{}", sn))
            })
            .unwrap_or_default();

        if title.is_empty() || url.is_empty() {
            return None;
        }

        // Location
        let location = job.locations.and_then(|locs| {
            let loc_names: Vec<String> = locs.into_iter().filter_map(|l| l.name).collect();
            if loc_names.is_empty() {
                None
            } else {
                Some(loc_names.join(", "))
            }
        });

        // Build description with metadata
        let mut desc_parts = Vec::new();

        if let Some(levels) = job.levels {
            let level_names: Vec<String> = levels.into_iter().filter_map(|l| l.name).collect();
            if !level_names.is_empty() {
                desc_parts.push(format!("Level: {}", level_names.join(", ")));
            }
        }

        if let Some(categories) = job.categories {
            let cat_names: Vec<String> = categories.into_iter().filter_map(|c| c.name).collect();
            if !cat_names.is_empty() {
                desc_parts.push(format!("Category: {}", cat_names.join(", ")));
            }
        }

        if let Some(pub_date) = job.publication_date {
            desc_parts.push(format!("Posted: {}", pub_date));
        }

        let description = if desc_parts.is_empty() {
            job.contents.clone()
        } else {
            Some(format!(
                "{}\n\n{}",
                desc_parts.join(" | "),
                job.contents.unwrap_or_default()
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
            salary: None, // Muse API doesn't provide salary
            source: "themuse".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        })
    }
}

impl JobScraper for TheMuseScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (compatible; UnhireableBot/1.0)")
            .build()
            .context("Failed to build HTTP client for The Muse")?;

        // The Muse API uses category parameter, not direct search
        // Map common queries to categories
        let category = match query.to_lowercase().as_str() {
            q if q.contains("engineer") || q.contains("developer") || q.contains("software") => {
                "Software Engineering"
            }
            q if q.contains("data") || q.contains("analytics") => "Data Science",
            q if q.contains("design") || q.contains("ux") || q.contains("ui") => "Design",
            q if q.contains("product") || q.contains("pm") => "Product",
            q if q.contains("market") => "Marketing",
            q if q.contains("devops") || q.contains("sre") || q.contains("infrastructure") => {
                "IT"
            }
            _ => "Software Engineering", // Default to software
        };

        let url = format!(
            "{}?category={}&location=Flexible%20/%20Remote&page=1",
            MUSE_API_URL,
            urlencoding::encode(category)
        );

        println!("🔍 Fetching jobs from The Muse API (category: {})...", category);

        let response = client
            .get(&url)
            .send()
            .context("Failed to fetch The Muse API")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            println!("⚠️  The Muse API error: {} - {}", status, &body[..200.min(body.len())]);
            return Ok(Vec::new());
        }

        let muse_response: MuseResponse = response
            .json()
            .context("Failed to parse The Muse API response")?;

        println!(
            "   The Muse returned {} jobs (total: {:?}, page: {:?}/{:?})",
            muse_response.results.len(),
            muse_response.total,
            muse_response.page,
            muse_response.page_count
        );

        // Additional keyword filtering
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();

        let jobs: Vec<Job> = muse_response
            .results
            .into_iter()
            .filter_map(Self::map_job)
            .filter(|job| {
                // Keep all jobs if query is generic, otherwise filter
                if query_words.is_empty()
                    || query_lower.contains("engineer")
                    || query_lower.contains("developer")
                {
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
            println!("⚠️  The Muse: No jobs found for '{}'", query);
        } else {
            println!("✅ Successfully fetched {} jobs from The Muse", jobs.len());
        }

        Ok(jobs)
    }
}

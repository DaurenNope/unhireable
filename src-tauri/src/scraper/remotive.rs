use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::collections::HashSet;
use std::thread;
use std::time::Duration;

const REMOTIVE_API_URL: &str = "https://remotive.com/api/remote-jobs";

#[derive(Debug, Deserialize)]
struct RemotiveResponse {
    #[serde(rename = "job-count")]
    job_count: Option<u32>,
    jobs: Vec<RemotiveJob>,
}

#[derive(Debug, Deserialize)]
struct RemotiveJob {
    id: Option<u64>,
    url: Option<String>,
    title: Option<String>,
    company_name: Option<String>,
    category: Option<String>,
    job_type: Option<String>,
    salary: Option<String>,
    candidate_required_location: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
    #[serde(rename = "publication_date")]
    publication_date: Option<String>,
}

pub struct RemotiveScraper;

impl RemotiveScraper {
    fn map_job(job: RemotiveJob) -> Option<Job> {
        let title = job.title?.trim().to_string();
        let company = job.company_name?.trim().to_string();
        let url = job.url?.trim().to_string();

        if title.is_empty() || company.is_empty() || url.is_empty() {
            return None;
        }

        let mut description_parts = Vec::new();
        if let Some(category) = job.category.as_ref().filter(|c| !c.is_empty()) {
            description_parts.push(format!("Category: {}", category));
        }
        if let Some(job_type) = job.job_type.as_ref().filter(|t| !t.is_empty()) {
            description_parts.push(format!("Type: {}", job_type));
        }
        if let Some(tags) = job.tags.as_ref().filter(|tags| !tags.is_empty()) {
            description_parts.push(format!("Tags: {}", tags.join(", ")));
        }
        if let Some(pub_date) = job.publication_date.as_ref().filter(|d| !d.is_empty()) {
            description_parts.push(format!("Published: {}", pub_date));
        }

        let description = if description_parts.is_empty() {
            job.description.clone()
        } else {
            Some(description_parts.join("\n"))
        };

        let location = job.candidate_required_location.and_then(|loc| {
            let trimmed = loc.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });

        let salary = job.salary.and_then(|s| {
            let trimmed = s.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });

        Some(Job {
            id: job.id.map(|id| id as i64),
            title,
            company,
            url,
            description,
            requirements: job.description,
            location,
            salary,
            source: "remotive".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        })
    }
}

impl JobScraper for RemotiveScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .context("Failed to build HTTP client for Remotive")?;

        // Remotive API: the search parameter does server-side filtering
        // If query has multiple words, try each word separately, then combine results
        // This helps when the API doesn't match multi-word queries well
        let url = if query.trim().is_empty() {
            REMOTIVE_API_URL.to_string()
        } else {
            let query_trimmed = query.trim();
            // Try the full query first
            format!(
                "{}?search={}",
                REMOTIVE_API_URL,
                urlencoding::encode(query_trimmed)
            )
        };

        println!("Fetching jobs from Remotive API: {}", url);

        let query_trimmed = query.trim();

        // Try full query first
        let response = client
            .get(&url)
            .send()
            .context("Failed to fetch Remotive API")?
            .error_for_status()
            .context("Remotive API returned error status")?;

        let remotive_response: RemotiveResponse = response
            .json()
            .context("Failed to parse Remotive API response")?;

        println!(
            "Remotive returned {} jobs for query '{}' (reported job-count: {:?})",
            remotive_response.jobs.len(),
            query_trimmed,
            remotive_response.job_count
        );

        let mut jobs: Vec<Job> = remotive_response
            .jobs
            .into_iter()
            .filter_map(Self::map_job)
            .collect();

        // If no jobs found and query has multiple words, try individual words
        if jobs.is_empty() && !query_trimmed.is_empty() {
            let query_words: Vec<&str> = query_trimmed.split_whitespace().collect();
            if query_words.len() > 1 {
                println!("   No jobs for full query, trying individual words...");
                let mut seen_urls = HashSet::new();

                for word in &query_words {
                    let word_url =
                        format!("{}?search={}", REMOTIVE_API_URL, urlencoding::encode(word));

                    if let Ok(word_response) = client
                        .get(&word_url)
                        .send()
                        .context("Failed to fetch Remotive API for word")
                    {
                        if let Ok(word_resp) = word_response.error_for_status() {
                            if let Ok(word_remotive) = word_resp.json::<RemotiveResponse>() {
                                println!(
                                    "   Query '{}' returned {} jobs",
                                    word,
                                    word_remotive.jobs.len()
                                );
                                for job in word_remotive.jobs {
                                    if let Some(mapped_job) = Self::map_job(job) {
                                        if seen_urls.insert(mapped_job.url.clone()) {
                                            jobs.push(mapped_job);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    // Small delay between requests
                    thread::sleep(Duration::from_millis(300));
                }
            }
        }

        // Client-side filtering: match if ANY word from query appears (more flexible)
        // The API already does server-side filtering, so we just do additional refinement
        if !query_trimmed.is_empty() && !jobs.is_empty() {
            let query_lower = query_trimmed.to_lowercase();
            let query_words: Vec<String> = query_lower
                .split_whitespace()
                .map(|s| s.to_string())
                .collect();
            jobs.retain(|job| {
                let job_text = format!(
                    "{} {} {} {}",
                    job.title.to_lowercase(),
                    job.company.to_lowercase(),
                    job.description
                        .as_ref()
                        .map(|d| d.to_lowercase())
                        .unwrap_or_default(),
                    job.requirements
                        .as_ref()
                        .map(|r| r.to_lowercase())
                        .unwrap_or_default(),
                );
                // Match if ANY query word appears in the job text
                query_words.iter().any(|word| job_text.contains(word))
            });
        }

        if jobs.len() > 50 {
            jobs.truncate(50);
        }

        if jobs.is_empty() {
            println!("⚠️  Remotive returned no jobs for query '{}'", query);
        } else {
            println!("✅ Successfully fetched {} jobs from Remotive", jobs.len());
        }

        Ok(jobs)
    }
}

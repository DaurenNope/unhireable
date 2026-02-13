//! HackerNews Who's Hiring Scraper
//! Scrapes the monthly "Who is hiring?" threads from HackerNews
//! https://news.ycombinator.com/item?id=<thread_id>
//!
//! These threads are posted on the first of each month and contain
//! high-quality job postings from YC companies and startups.

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::time::Duration;

const HN_API_BASE: &str = "https://hacker-news.firebaseio.com/v0";
const HN_USER: &str = "whoishiring";

#[derive(Debug, Deserialize)]
struct HnUser {
    submitted: Vec<u64>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct HnItem {
    id: u64,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    kids: Vec<u64>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    #[serde(default)]
    by: Option<String>,
    #[serde(default)]
    time: Option<u64>,
}

pub struct HackerNewsScraper;

impl HackerNewsScraper {
    /// Find the most recent "Who is hiring?" thread
    fn find_latest_hiring_thread(client: &Client) -> Result<Option<u64>> {
        // Get whoishiring user's submissions
        let user_url = format!("{}/user/{}.json", HN_API_BASE, HN_USER);
        let user: HnUser = client
            .get(&user_url)
            .send()
            .context("Failed to fetch whoishiring user")?
            .json()
            .context("Failed to parse user JSON")?;

        // Check recent submissions for "Who is hiring" threads
        for &item_id in user.submitted.iter().take(10) {
            let item_url = format!("{}/item/{}.json", HN_API_BASE, item_id);
            if let Ok(resp) = client.get(&item_url).send() {
                if let Ok(item) = resp.json::<HnItem>() {
                    if let Some(title) = &item.title {
                        if title.contains("Who is hiring?") {
                            return Ok(Some(item_id));
                        }
                    }
                }
            }
        }
        Ok(None)
    }

    /// Parse a comment into a Job
    fn parse_comment_to_job(item: &HnItem) -> Option<Job> {
        let text = item.text.as_ref()?;

        // HN job posts typically start with company name in first line
        let lines: Vec<&str> = text.lines().collect();
        if lines.is_empty() {
            return None;
        }

        // Extract company (usually first line or before "|")
        let first_line = lines[0];
        let parts: Vec<&str> = first_line.split('|').collect();

        let company = parts
            .first()
            .map(|s| html_escape::decode_html_entities(s.trim()).to_string())
            .unwrap_or_else(|| "Unknown Company".to_string());

        // Try to extract title from parts (often: Company | Title | Location | ...)
        let title = if parts.len() > 1 {
            html_escape::decode_html_entities(parts[1].trim()).to_string()
        } else {
            "Multiple Positions".to_string()
        };

        // Try to extract location
        let location = if parts.len() > 2 {
            Some(html_escape::decode_html_entities(parts[2].trim()).to_string())
        } else if text.to_lowercase().contains("remote") {
            Some("Remote".to_string())
        } else {
            None
        };

        // Check if remote
        let is_remote = text.to_lowercase().contains("remote");

        // Build description from full text
        let description = html_escape::decode_html_entities(text).to_string();

        // Build URL to the HN comment
        let url = format!("https://news.ycombinator.com/item?id={}", item.id);

        Some(Job {
            id: None,
            title,
            company,
            url,
            description: Some(description),
            requirements: None,
            location: if is_remote {
                Some("Remote".to_string())
            } else {
                location
            },
            salary: None,
                    contact_email: None,
            source: "hackernews".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        })..Default::default()
        })
    }

    /// Filter jobs by query
    fn matches_query(job: &Job, query: &str) -> bool {
        if query.trim().is_empty() {
            return true;
        }

        let query_lower = query.to_lowercase();
        let keywords: Vec<&str> = query_lower.split_whitespace().collect();

        let searchable = format!(
            "{} {} {} {}",
            job.title.to_lowercase(),
            job.company.to_lowercase(),
            job.description.as_deref().unwrap_or("").to_lowercase(),
            job.location.as_deref().unwrap_or("").to_lowercase()
        );

        keywords.iter().all(|kw| searchable.contains(kw))
    }
}

impl JobScraper for HackerNewsScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (compatible; JobScraper/1.0)")
            .build()
            .context("Failed to build HTTP client for HackerNews")?;

        println!("🍊 Fetching HackerNews Who's Hiring thread...");

        // Find the latest hiring thread
        let thread_id = Self::find_latest_hiring_thread(&client)?
            .context("Could not find a recent 'Who is hiring?' thread")?;

        println!("📋 Found thread ID: {}", thread_id);

        // Get the thread item to get comment IDs
        let thread_url = format!("{}/item/{}.json", HN_API_BASE, thread_id);
        let thread: HnItem = client
            .get(&thread_url)
            .send()
            .context("Failed to fetch thread")?
            .json()
            .context("Failed to parse thread JSON")?;

        let comment_ids = thread.kids;
        println!("📝 Found {} job postings in thread", comment_ids.len());

        // Fetch comments (limit to first 100 for speed)
        let mut jobs = Vec::new();
        let max_comments = 100.min(comment_ids.len());

        for &comment_id in comment_ids.iter().take(max_comments) {
            let comment_url = format!("{}/item/{}.json", HN_API_BASE, comment_id);
            if let Ok(resp) = client.get(&comment_url).send() {
                if let Ok(item) = resp.json::<HnItem>() {
                    if let Some(job) = Self::parse_comment_to_job(&item) {
                        if Self::matches_query(&job, query) {
                            jobs.push(job);
                        }
                    }
                }
            }
        }

        if jobs.is_empty() {
            println!("⚠️  No HackerNews jobs found matching '{}'", query);
        } else {
            println!(
                "✅ Found {} jobs from HackerNews matching '{}'",
                jobs.len(),
                query
            );
        }

        Ok(jobs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_comment() {
        let item = HnItem {
            id: 12345,
            title: None,
            text: Some("Acme Corp | Senior Engineer | Remote | $150k-200k".to_string()),
            kids: vec![],
            item_type: Some("comment".to_string()),
            by: Some("test".to_string()),
            time: Some(1234567890),
        };

        let job = HackerNewsScraper::parse_comment_to_job(&item);
        assert!(job.is_some());
        let job = job.unwrap();
        assert_eq!(job.company, "Acme Corp");
        assert_eq!(job.title, "Senior Engineer");
    }
}

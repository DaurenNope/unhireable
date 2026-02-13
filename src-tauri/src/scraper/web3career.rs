//! Web3Career Scraper
//! Scrapes jobs from web3.career - one of the largest Web3 job boards
//! https://web3.career

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::time::Duration;

const WEB3_CAREER_URL: &str = "https://web3.career";

pub struct Web3CareerScraper;

impl Web3CareerScraper {
    fn parse_jobs_from_html(html: &str) -> Vec<Job> {
        let document = Html::parse_document(html);
        let mut jobs = Vec::new();

        // Updated selectors to match web3.career HTML structure (Jan 2026)
        // Job rows have [data-jobid] attribute and class containing "table_row"
        let job_selector = Selector::parse("tr[data-jobid]").ok();
        let title_selector = Selector::parse("h2").ok();
        let company_selector = Selector::parse("h3").ok();
        let link_selector = Selector::parse("a[href]").ok();

        if let Some(job_sel) = job_selector {
            for job_element in document.select(&job_sel) {
                // Extract title from h2 element
                let title = title_selector
                    .as_ref()
                    .and_then(|s| job_element.select(s).next())
                    .map(|e| e.text().collect::<String>().trim().to_string())
                    .filter(|s| !s.is_empty());

                // Extract company from h3 element
                let company = company_selector
                    .as_ref()
                    .and_then(|s| job_element.select(s).next())
                    .map(|e| e.text().collect::<String>().trim().to_string())
                    .filter(|s| !s.is_empty());

                // Extract URL from first link with href
                let url = link_selector
                    .as_ref()
                    .and_then(|s| job_element.select(s).next())
                    .and_then(|e| e.value().attr("href"))
                    .map(|href| {
                        if href.starts_with("http") {
                            href.to_string()
                        } else {
                            format!("{}{}", WEB3_CAREER_URL, href)
                        }
                    });

                // Location is usually in the onclick URL path or visible text
                // For now, default to Remote since most web3.career jobs are remote
                let location = Some("Remote".to_string());

                if let (Some(title), Some(company), Some(url)) = (title, company, url) {
                    jobs.push(Job {
                        id: None,
                        title,
                        company,
                        url,
                        description: Some("Web3/Blockchain/Crypto position".to_string()),
                        requirements: None,
                        location,
                        salary: None,
                    contact_email: None,
                        source: "web3career".to_string(),
                        status: JobStatus::Saved,
                        match_score: None,
                        created_at: None,
                        updated_at: None,
                                ..Default::default()
        })..Default::default()
                    });
                }
            }
        }

        jobs
    }
}

impl JobScraper for Web3CareerScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .context("Failed to build HTTP client for Web3Career")?;

        // Build search URL
        let url = if query.trim().is_empty() {
            format!("{}/remote-jobs", WEB3_CAREER_URL)
        } else {
            format!(
                "{}/{}+remote-jobs",
                WEB3_CAREER_URL,
                urlencoding::encode(query.trim())
            )
        };

        println!("🌐 Fetching Web3 jobs from: {}", url);

        let response = client
            .get(&url)
            .send()
            .context("Failed to fetch Web3Career")?;

        // Check for CloudFlare protection
        if response.status().as_u16() == 403 || response.status().as_u16() == 503 {
            println!("⚠️  Web3Career is protected by CloudFlare, trying alternative approach...");
            return Ok(Vec::new());
        }

        let html = response
            .text()
            .context("Failed to get Web3Career response text")?;

        let jobs = Self::parse_jobs_from_html(&html);

        if jobs.is_empty() {
            println!(
                "⚠️  No Web3 jobs found for query '{}' (site may require JavaScript)",
                query
            );
        } else {
            println!("✅ Found {} Web3 jobs from Web3Career", jobs.len());
        }

        Ok(jobs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_html() {
        let jobs = Web3CareerScraper::parse_jobs_from_html("<html></html>");
        assert!(jobs.is_empty());
    }
}

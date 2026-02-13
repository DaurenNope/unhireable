use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use serde_json::Value;
use std::collections::HashSet;
use std::time::Duration;

/// Scraper for Lever and Greenhouse ATS job boards
/// These scrapers work by scraping individual company job board pages
pub struct LeverGreenhouseScraper {
    _ats_type: AtsType,
}

#[derive(Debug, Clone, Copy)]
enum AtsType {
    Lever,
    Greenhouse,
}

impl LeverGreenhouseScraper {
    /// Create a new Lever scraper
    pub fn lever() -> Self {
        Self {
            _ats_type: AtsType::Lever,
        }
    }

    /// Create a new Greenhouse scraper
    pub fn greenhouse() -> Self {
        Self {
            _ats_type: AtsType::Greenhouse,
        }
    }

    /// Detect ATS type from URL
    fn detect_ats_from_url(url: &str) -> Option<AtsType> {
        let url_lower = url.to_lowercase();
        if url_lower.contains("lever.co") || url_lower.contains("jobs.lever.co") {
            Some(AtsType::Lever)
        } else if url_lower.contains("greenhouse.io") || url_lower.contains("boards.greenhouse.io")
        {
            Some(AtsType::Greenhouse)
        } else {
            None
        }
    }

    /// Scrape jobs from a Lever job board
    fn scrape_lever(&self, url: &str, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Unhireable Job Scraper)")
            .build()
            .context("Failed to build HTTP client for Lever")?;

        println!("Fetching jobs from Lever: {}", url);

        // Try to fetch the HTML page
        let response = client
            .get(url)
            .send()
            .context("Failed to fetch Lever page")?
            .error_for_status()
            .context("Lever returned an error status")?;

        let body = response.text().context("Failed to read response body")?;

        // Lever often uses a JSON API endpoint
        // Try to find the API endpoint in the HTML or use the jobs API directly
        let jobs = if url.contains("/api/") {
            // Already an API endpoint
            self.parse_lever_api(&body)?
        } else {
            // Try to extract jobs from HTML
            self.parse_lever_html(&body, url)?
        };

        // Filter by query if provided
        let query_lower = query.trim().to_lowercase();
        let filtered_jobs: Vec<Job> = if query_lower.is_empty() {
            jobs
        } else {
            jobs.into_iter()
                .filter(|job| {
                    job.title.to_lowercase().contains(&query_lower)
                        || job.company.to_lowercase().contains(&query_lower)
                        || job
                            .description
                            .as_ref()
                            .map(|d| d.to_lowercase().contains(&query_lower))
                            .unwrap_or(false)
                })
                .collect()
        };

        if filtered_jobs.is_empty() {
            Err(anyhow::anyhow!(
                "Lever returned no jobs for the query '{}'",
                query
            ))
        } else {
            println!(
                "Successfully fetched {} jobs from Lever",
                filtered_jobs.len()
            );
            Ok(filtered_jobs)
        }
    }

    /// Parse Lever API response (JSON)
    fn parse_lever_api(&self, json: &str) -> Result<Vec<Job>> {
        let jobs_data: Value =
            serde_json::from_str(json).context("Failed to parse Lever API response")?;

        let mut jobs = Vec::new();
        let jobs_array = jobs_data
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("Lever API response is not an array"))?;

        for job_data in jobs_array {
            let title = job_data["text"]
                .as_str()
                .map(|s| s.to_string())
                .unwrap_or_default();

            if title.is_empty() {
                continue;
            }

            let company = job_data["hostedUrl"]
                .as_str()
                .and_then(|url| {
                    // Extract company name from URL (e.g., jobs.lever.co/companyname)
                    url.split('/').nth(3).map(|s| s.to_string())
                })
                .unwrap_or_else(|| "Unknown Company".to_string());

            let job_url = job_data["hostedUrl"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| job_data["applyUrl"].as_str().map(|s| s.to_string()))
                .unwrap_or_default();

            if job_url.is_empty() {
                continue;
            }

            let description = job_data["descriptionPlain"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| {
                    job_data["description"]
                        .as_str()
                        .map(|s| Self::strip_html_tags(s))
                });

            let location = job_data["categories"]["location"]
                .as_str()
                .map(|s| s.to_string());

            jobs.push(Job {
                id: None,
                title,
                company,
                url: job_url,
                description,
                requirements: None,
                location,
                salary: None,
                source: "lever".to_string(),
                status: JobStatus::Saved,
                match_score: None,
                created_at: None,
                updated_at: None,
                        ..Default::default()
        });
        }

        Ok(jobs)
    }

    /// Parse Lever HTML page
    fn parse_lever_html(&self, html: &str, base_url: &str) -> Result<Vec<Job>> {
        let document = Html::parse_document(html);
        let mut jobs = Vec::new();
        let mut seen_urls = HashSet::new();

        // Lever HTML structure - try multiple selectors
        let job_selectors = vec![
            "div.posting",
            "a.posting-title",
            "div.posting-list-item",
            "li.posting",
        ];

        for job_sel_str in &job_selectors {
            let job_selector = match Selector::parse(job_sel_str) {
                Ok(s) => s,
                Err(_) => continue,
            };

            for job_element in document.select(&job_selector) {
                // Try to find title and URL
                let mut title = String::new();
                let mut url = String::new();

                // Try to find link
                let link_selector = Selector::parse("a").unwrap();
                if let Some(link) = job_element.select(&link_selector).next() {
                    title = link.text().collect::<String>().trim().to_string();
                    if let Some(href) = link.value().attr("href") {
                        url = if href.starts_with("http") {
                            href.to_string()
                        } else if href.starts_with("/") {
                            // Extract base URL from original URL
                            let base = base_url.split('/').take(3).collect::<Vec<_>>().join("/");
                            format!("{}{}", base, href)
                        } else {
                            format!("{}/{}", base_url.trim_end_matches('/'), href)
                        };
                    }
                }

                // Fallback: try to get title from text content
                if title.is_empty() {
                    title = job_element.text().collect::<String>().trim().to_string();
                }

                if title.is_empty() || url.is_empty() {
                    continue;
                }

                if !seen_urls.insert(url.clone()) {
                    continue;
                }

                // Try to extract company from URL or page
                let company = base_url
                    .split('/')
                    .nth(3)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "Unknown Company".to_string());

                // Try to extract location
                let location_selector =
                    Selector::parse(".posting-category, .location, span.location").unwrap();
                let location = job_element
                    .select(&location_selector)
                    .next()
                    .map(|e| e.text().collect::<String>().trim().to_string())
                    .filter(|l| !l.is_empty());

                jobs.push(Job {
                    id: None,
                    title,
                    company,
                    url,
                    description: None,
                    requirements: None,
                    location,
                    salary: None,
                    source: "lever".to_string(),
                    status: JobStatus::Saved,
                    match_score: None,
                    created_at: None,
                    updated_at: None,
                            ..Default::default()
        });
            }

            if !jobs.is_empty() {
                break;
            }
        }

        Ok(jobs)
    }

    /// Scrape jobs from a Greenhouse job board
    fn scrape_greenhouse(
        &self,
        url: &str,
        query: &str,
        config: &ScraperConfig,
    ) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Unhireable Job Scraper)")
            .build()
            .context("Failed to build HTTP client for Greenhouse")?;

        println!("Fetching jobs from Greenhouse: {}", url);

        // Greenhouse uses a JSON API
        // Try to construct API URL from job board URL
        let api_url = if url.contains("/jobs") {
            // Replace /jobs with /api/v1/jobs
            url.replace("/jobs", "/api/v1/jobs")
        } else if url.contains("boards.greenhouse.io") {
            // Extract board token and construct API URL
            let board_token = url.split('/').last().unwrap_or("");
            format!(
                "https://boards-api.greenhouse.io/v1/boards/{}/jobs",
                board_token
            )
        } else {
            url.to_string()
        };

        let response = client
            .get(&api_url)
            .send()
            .context("Failed to fetch Greenhouse API")?
            .error_for_status()
            .context("Greenhouse API returned an error status")?;

        let body = response.text().context("Failed to read response body")?;
        let jobs_data: Value =
            serde_json::from_str(&body).context("Failed to parse Greenhouse API response")?;

        let mut jobs = Vec::new();
        let jobs_array = jobs_data["jobs"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("Greenhouse API response is missing jobs array"))?;

        for job_data in jobs_array {
            let title = job_data["title"]
                .as_str()
                .map(|s| s.to_string())
                .unwrap_or_default();

            if title.is_empty() {
                continue;
            }

            let company = job_data["company"]["name"]
                .as_str()
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    // Try to extract from URL
                    url.split('/')
                        .nth(3)
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "Unknown Company".to_string())
                });

            let job_url = job_data["absolute_url"]
                .as_str()
                .map(|s| s.to_string())
                .unwrap_or_default();

            if job_url.is_empty() {
                continue;
            }

            let description = job_data["content"]
                .as_str()
                .map(|s| Self::strip_html_tags(s));

            let location = job_data["location"]["name"].as_str().map(|s| s.to_string());

            jobs.push(Job {
                id: None,
                title,
                company,
                url: job_url,
                description,
                requirements: None,
                location,
                salary: None,
                source: "greenhouse".to_string(),
                status: JobStatus::Saved,
                match_score: None,
                created_at: None,
                updated_at: None,
                        ..Default::default()
        });
        }

        // Filter by query if provided
        let query_lower = query.trim().to_lowercase();
        let filtered_jobs: Vec<Job> = if query_lower.is_empty() {
            jobs
        } else {
            jobs.into_iter()
                .filter(|job| {
                    job.title.to_lowercase().contains(&query_lower)
                        || job.company.to_lowercase().contains(&query_lower)
                        || job
                            .description
                            .as_ref()
                            .map(|d| d.to_lowercase().contains(&query_lower))
                            .unwrap_or(false)
                })
                .collect()
        };

        if filtered_jobs.is_empty() {
            Err(anyhow::anyhow!(
                "Greenhouse returned no jobs for the query '{}'",
                query
            ))
        } else {
            println!(
                "Successfully fetched {} jobs from Greenhouse",
                filtered_jobs.len()
            );
            Ok(filtered_jobs)
        }
    }

    fn strip_html_tags(html: &str) -> String {
        static TAG_REGEX: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
        let regex = TAG_REGEX.get_or_init(|| regex::Regex::new(r"(?s)<[^>]*>").unwrap());
        let without_tags = regex.replace_all(html, " ");
        without_tags
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    }
}

impl JobScraper for LeverGreenhouseScraper {
    fn scrape(&self, _query: &str) -> Result<Vec<Job>> {
        // For Lever/Greenhouse, we need a URL to scrape from
        // This is a placeholder - in practice, users would provide company job board URLs
        Err(anyhow::anyhow!(
            "Lever/Greenhouse scraper requires a company job board URL. Use scrape_with_config with a URL."
        ))
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        // Check if config has a URL (we can extend ScraperConfig to include optional URL)
        // For now, we'll use the query as a URL if it looks like one
        let url = if query.starts_with("http://") || query.starts_with("https://") {
            query
        } else {
            // Default to a well-known company's job board for testing
            // In practice, users would provide URLs via UI
            return Err(anyhow::anyhow!(
                "Lever/Greenhouse scraper requires a company job board URL (e.g., https://jobs.lever.co/companyname or https://boards.greenhouse.io/companyname)"
            ));
        };

        // Detect ATS type from URL
        let ats_type = Self::detect_ats_from_url(&url).ok_or_else(|| {
            anyhow::anyhow!("URL does not appear to be a Lever or Greenhouse job board")
        })?;

        match ats_type {
            AtsType::Lever => self.scrape_lever(&url, "", config), // Query is the URL
            AtsType::Greenhouse => self.scrape_greenhouse(&url, "", config),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_ats_from_url() {
        assert!(matches!(
            LeverGreenhouseScraper::detect_ats_from_url("https://jobs.lever.co/company"),
            Some(AtsType::Lever)
        ));
        assert!(matches!(
            LeverGreenhouseScraper::detect_ats_from_url("https://boards.greenhouse.io/company"),
            Some(AtsType::Greenhouse)
        ));
        assert!(LeverGreenhouseScraper::detect_ats_from_url("https://example.com").is_none());
    }
}

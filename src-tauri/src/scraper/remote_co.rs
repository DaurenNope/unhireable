use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::collections::HashSet;
use std::time::Duration;

const REMOTE_CO_BASE_URL: &str = "https://remote.co";

pub struct RemoteCoScraper;

impl RemoteCoScraper {
    fn build_search_url(query: &str) -> String {
        let q = urlencoding::encode(query.trim());
        // Remote.co uses /remote-jobs/search/ with search_keywords parameter
        // Also try the main jobs page if search doesn't work
        if q.is_empty() {
            format!("{}/remote-jobs/", REMOTE_CO_BASE_URL)
        } else {
            format!(
                "{}/remote-jobs/search/?search_keywords={}",
                REMOTE_CO_BASE_URL, q
            )
        }
    }

    fn parse_jobs(html: &str) -> Vec<Job> {
        let document = Html::parse_document(html);

        // Remote.co uses various structures - try multiple selector patterns
        let job_selectors = vec![
            "article.job",
            "div.job_listing",
            ".job-listing",
            ".job-item",
            "li[class*='job']",
            "div[class*='job']",
            "tr.job",
        ];

        let title_selectors = vec![
            "h3.job_title a",
            "h2.job-title a",
            ".job-title a",
            "h3 a",
            "h2 a",
            "a[class*='title']",
            "a[class*='job-title']",
        ];

        let company_selectors = vec![
            ".company_name",
            ".company-name",
            ".company",
            "[class*='company']",
        ];

        let location_selectors = vec![
            ".location",
            ".job-location",
            ".region",
            "[class*='location']",
        ];

        let mut jobs = Vec::new();
        let mut seen_urls = HashSet::new();

        // Try each job selector pattern
        for job_sel_str in &job_selectors {
            let job_selector = match Selector::parse(job_sel_str) {
                Ok(s) => s,
                Err(_) => continue,
            };

            for job_element in document.select(&job_selector) {
                // Try to find title and URL using multiple selector patterns
                let mut title = String::new();
                let mut url = String::new();

                for title_sel_str in &title_selectors {
                    let title_selector = match Selector::parse(title_sel_str) {
                        Ok(s) => s,
                        Err(_) => continue,
                    };

                    if let Some(link) = job_element.select(&title_selector).next() {
                        title = link.text().collect::<String>().trim().to_string();
                        if let Some(href) = link.value().attr("href") {
                            url = if href.starts_with("http") {
                                href.to_string()
                            } else if href.starts_with("/") {
                                format!("{}{}", REMOTE_CO_BASE_URL, href)
                            } else {
                                format!("{}/{}", REMOTE_CO_BASE_URL, href)
                            };
                        }
                        if !title.is_empty() {
                            break;
                        }
                    }
                }

                // Fallback: try to find any link in the job element
                if url.is_empty() {
                    let link_selector = Selector::parse("a").unwrap();
                    if let Some(link) = job_element.select(&link_selector).next() {
                        if let Some(href) = link.value().attr("href") {
                            url = if href.starts_with("http") {
                                href.to_string()
                            } else if href.starts_with("/") {
                                format!("{}{}", REMOTE_CO_BASE_URL, href)
                            } else {
                                format!("{}/{}", REMOTE_CO_BASE_URL, href)
                            };
                        }
                        if title.is_empty() {
                            title = link.text().collect::<String>().trim().to_string();
                        }
                    }
                }

                if title.is_empty() || url.is_empty() {
                    continue;
                }

                if !seen_urls.insert(url.clone()) {
                    continue;
                }

                // Extract company using multiple selector patterns
                let mut company = "Unknown Company".to_string();
                for company_sel_str in &company_selectors {
                    let company_selector = match Selector::parse(company_sel_str) {
                        Ok(s) => s,
                        Err(_) => continue,
                    };
                    if let Some(company_elem) = job_element.select(&company_selector).next() {
                        company = company_elem.text().collect::<String>().trim().to_string();
                        if !company.is_empty() && company != "Unknown Company" {
                            break;
                        }
                    }
                }

                // Extract location
                let mut location = None;
                for location_sel_str in &location_selectors {
                    let location_selector = match Selector::parse(location_sel_str) {
                        Ok(s) => s,
                        Err(_) => continue,
                    };
                    if let Some(location_elem) = job_element.select(&location_selector).next() {
                        let loc_text = location_elem.text().collect::<String>().trim().to_string();
                        if !loc_text.is_empty() {
                            location = Some(loc_text);
                            break;
                        }
                    }
                }

                // Try to extract description/snippet
                let description_selector =
                    Selector::parse(".job-description, .job-excerpt, .summary, p").unwrap();
                let description = job_element
                    .select(&description_selector)
                    .next()
                    .map(|e| e.text().collect::<String>().trim().to_string())
                    .filter(|d| !d.is_empty() && d.len() > 20);

                jobs.push(Job {
                    id: None,
                    title,
                    company,
                    url,
                    description,
                    requirements: None,
                    location: location.or(Some("Remote".to_string())),
                    salary: None, // Remote.co doesn't typically show salary in listings
                    source: "remote.co".to_string(),
                    status: JobStatus::Saved,
                    match_score: None,
                    created_at: None,
                    updated_at: None,
                });
            }

            // If we found jobs with this selector, break
            if !jobs.is_empty() {
                break;
            }
        }

        jobs
    }

    /// Scrape using browser automation (fallback for blocked requests)
    fn scrape_with_browser(
        &self,
        url: &str,
        query: &str,
        config: &ScraperConfig,
    ) -> Result<Vec<Job>> {
        use crate::scraper::browser::BrowserScraper;

        println!("🌐 Remote.co: Using browser automation to bypass blocking...");

        let browser_timeout = std::cmp::max(config.timeout_secs, 60);
        let max_attempts = 3;
        let mut last_error: Option<anyhow::Error> = None;
        let mut resolved_html: Option<String> = None;
        if BrowserScraper::is_playwright_available() || BrowserScraper::is_chromium_available() {
            for attempt in 1..=max_attempts {
                println!("   Browser automation attempt {}...", attempt);
                let scraper = BrowserScraper::new().with_timeout(browser_timeout);
                match scraper.scrape(url) {
                    Ok(html) => {
                        if html.len() < 5000 {
                            println!(
                                "   Browser automation returned small HTML ({} bytes) - likely blocked/redirect",
                                html.len()
                            );
                            last_error = Some(anyhow::anyhow!("HTML too small ({})", html.len()));
                            std::thread::sleep(Duration::from_secs((attempt * 2) as u64));
                            continue;
                        }
                        resolved_html = Some(html);
                        last_error = None;
                        break;
                    }
                    Err(e) => {
                        let err_msg = e.to_string();
                        if err_msg.contains("ERR_HTTP2_PROTOCOL_ERROR")
                            || err_msg.contains("ERR_NETWORK")
                            || err_msg.contains("Timeout")
                            || err_msg.contains("timeout")
                        {
                            eprintln!(
                                "⚠️  Remote.co: Browser attempt {} failed ({}). Retrying...",
                                attempt, err_msg
                            );
                            last_error = Some(anyhow::anyhow!(err_msg));
                            std::thread::sleep(Duration::from_secs((attempt * 2) as u64));
                            continue;
                        } else {
                            return Err(e);
                        }
                    }
                }
            }
            if resolved_html.is_none() {
                if let Some(err) = last_error {
                    eprintln!(
                        "⚠️  Remote.co: All browser automation attempts failed: {}",
                        err
                    );
                }
                return Ok(Vec::new());
            }
        } else {
            return Err(anyhow::anyhow!(
                "Browser automation requested but neither Playwright nor Chrome is available"
            ));
        }
        let html = resolved_html.expect("HTML should be present when browser automation succeeds");

        println!(
            "   Browser automation returned {} bytes of HTML",
            html.len()
        );

        let mut jobs = Self::parse_jobs(&html);
        println!(
            "Parsed {} jobs from Remote.co HTML (via browser)",
            jobs.len()
        );

        // Filter by query if provided
        let query_lower = query.trim().to_lowercase();
        if !query_lower.is_empty() {
            let query_words: Vec<&str> = query_lower
                .split_whitespace()
                .filter(|w| !w.is_empty())
                .collect();
            jobs.retain(|job| Self::job_matches_query(job, &query_lower, &query_words));
        }

        // Limit count
        if jobs.len() > 50 {
            jobs.truncate(50);
        }

        if jobs.is_empty() {
            println!("⚠️  Remote.co: No jobs found (query: '{}')", query);
            // Return empty instead of error - this is a valid state
            Ok(vec![])
        } else {
            println!(
                "✅ Successfully fetched {} jobs from Remote.co (via browser)",
                jobs.len()
            );
            Ok(jobs)
        }
    }

    fn job_matches_query(job: &Job, query_lower: &str, query_words: &[&str]) -> bool {
        if query_lower.is_empty() || query_words.is_empty() {
            return true;
        }

        let mut haystack = vec![job.title.to_lowercase(), job.company.to_lowercase()];
        if let Some(desc) = &job.description {
            haystack.push(desc.to_lowercase());
        }
        if let Some(loc) = &job.location {
            haystack.push(loc.to_lowercase());
        }
        let combined = haystack.join(" ");

        if combined.contains(query_lower) {
            return true;
        }

        let matches = query_words
            .iter()
            .filter(|word| combined.contains(*word))
            .count();

        matches >= query_words.len().min(2)
    }
}

impl JobScraper for RemoteCoScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let url = Self::build_search_url(query);
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .context("Failed to build HTTP client for Remote.co")?;

        println!("Fetching jobs from: {}", url);

        // Courtesy per-domain delay
        {
            use rand::{thread_rng, Rng};
            let mut rng = thread_rng();
            let min = config.per_domain_min_delay_ms as i64;
            let max = config.per_domain_max_delay_ms as i64;
            let ms = if max > min {
                rng.gen_range(min..=max)
            } else {
                min
            }
            .max(0) as u64;
            std::thread::sleep(std::time::Duration::from_millis(ms));
        }

        // Try direct HTTP request with retries/backoff
        let mut body = String::new();
        let mut last_err: Option<anyhow::Error> = None;
        let mut attempt = 0;
        while attempt < config.retry_attempts {
            attempt += 1;
            match client.get(&url).send() {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        body = resp
                            .text()
                            .context("Failed to read Remote.co response body")?;
                        break;
                    } else {
                        eprintln!(
                            "⚠️  Remote.co status code: {} (attempt {}/{})",
                            status, attempt, config.retry_attempts
                        );
                        last_err = Some(anyhow::anyhow!("Status {}", status));
                    }
                }
                Err(e) => {
                    eprintln!(
                        "⚠️  Remote.co HTTP request failed (attempt {}/{}): {}",
                        attempt, config.retry_attempts, e
                    );
                    last_err = Some(anyhow::anyhow!(e));
                }
            }
            let delay = (config.retry_delay_secs as f64
                * config.retry_backoff_factor.powi((attempt - 1) as i32))
                as u64;
            std::thread::sleep(Duration::from_secs(delay.max(1)));
        }
        if body.is_empty() {
            eprintln!("⚠️  Remote.co: falling back to browser automation after retries");
            if config.use_browser_automation {
                return self.scrape_with_browser(&url, query, config);
            }
            if let Some(e) = last_err {
                eprintln!("Remote.co last error: {}", e);
            }
            return Ok(vec![]);
        }
        println!("Remote.co response body length: {} bytes", body.len());

        let mut jobs = Self::parse_jobs(&body);
        println!("Parsed {} jobs from Remote.co HTML", jobs.len());

        // Filter by query if provided
        let query_lower = query.trim().to_lowercase();
        if !query_lower.is_empty() {
            let query_words: Vec<&str> = query_lower
                .split_whitespace()
                .filter(|w| !w.is_empty())
                .collect();
            jobs.retain(|job| Self::job_matches_query(job, &query_lower, &query_words));
        }

        // Limit count
        if jobs.len() > 50 {
            jobs.truncate(50);
        }

        if jobs.is_empty() {
            eprintln!("⚠️  Remote.co: No jobs found after parsing. This could mean:");
            eprintln!("   - HTML structure changed (check selectors)");
            eprintln!("   - No jobs match query '{}'", query);
            eprintln!(
                "   - Response body was {} bytes (might be empty or error page)",
                body.len()
            );
            // Return empty vec instead of error - let other scrapers continue
            Ok(vec![])
        } else {
            println!("✅ Successfully fetched {} jobs from Remote.co", jobs.len());
            Ok(jobs)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::JobStatus;

    #[test]
    fn job_matches_query_works() {
        let job = Job {
            id: None,
            title: "Frontend Developer".into(),
            company: "Tech Startup".into(),
            url: "https://remote.co/job/123".into(),
            description: Some("React, TypeScript, Node.js".into()),
            requirements: None,
            location: Some("Remote".into()),
            salary: None,
            source: "remote.co".into(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        };

        let frontend = vec!["frontend"];
        let react = vec!["react"];
        let tech = vec!["tech", "startup"];
        let python = vec!["python"];
        let empty: Vec<&str> = vec![];

        assert!(RemoteCoScraper::job_matches_query(
            &job, "frontend", &frontend
        ));
        assert!(RemoteCoScraper::job_matches_query(&job, "react", &react));
        assert!(RemoteCoScraper::job_matches_query(
            &job,
            "tech startup",
            &tech
        ));
        assert!(!RemoteCoScraper::job_matches_query(&job, "python", &python));
        assert!(RemoteCoScraper::job_matches_query(&job, "", &empty)); // Empty query matches all
    }
}

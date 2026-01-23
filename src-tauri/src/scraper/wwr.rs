use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::collections::HashSet;
use std::time::Duration;

// Note: query parameter is needed for scrape_with_browser but we capture it from the URL
// For now, we'll parse it from the URL or use an empty string

const WWR_URL: &str = "https://weworkremotely.com/remote-jobs/search?term=";

pub struct WwrScraper;

impl WwrScraper {
    fn build_search_url(query: &str) -> String {
        let q = urlencoding::encode(query.trim());
        format!("{}{}", WWR_URL, q)
    }

    fn parse_jobs(html: &str) -> Vec<Job> {
        let document = Html::parse_document(html);
        println!("WWR: Parsing HTML document ({} bytes)", html.len());

        // WWR structure can vary - try multiple patterns
        let job_selectors = vec![
            "li.feature",
            "li.job",
            "li[class*='job']",
            "article.job",
            "div.job",
            "tr.job",
            "section.jobs li",
            "ul li",
        ];

        let title_selectors = vec![
            "span.title",
            ".title",
            "h3",
            "h2",
            "a.job-title",
            "a[class*='title']",
        ];

        let company_selectors = vec![
            "span.company",
            ".company",
            "span.company-name",
            ".company-name",
            "[class*='company']",
        ];

        let region_selectors = vec![
            "span.region",
            ".region",
            ".location",
            "span.location",
            "[class*='location']",
        ];

        let mut jobs = Vec::new();
        let mut seen = HashSet::new();

        // Try each job selector pattern
        for job_sel_str in &job_selectors {
            let job_selector = match Selector::parse(job_sel_str) {
                Ok(s) => s,
                Err(_) => continue,
            };

            for job_element in document.select(&job_selector) {
                // Try to find a link first (jobs usually have links)
                let link_selector = Selector::parse("a").unwrap();
                let link = job_element.select(&link_selector).next();

                let (title, url, company, location) = if let Some(link_elem) = link {
                    // Extract URL
                    let href = link_elem.value().attr("href").unwrap_or("");
                    let url = if href.starts_with("http") {
                        href.to_string()
                    } else if href.starts_with("/") {
                        format!("https://weworkremotely.com{}", href)
                    } else {
                        continue; // Skip if no valid URL
                    };

                    if !seen.insert(url.clone()) {
                        continue;
                    }

                    // Try to extract title from link or nearby elements
                    let mut title = String::new();
                    for title_sel_str in &title_selectors {
                        let title_selector = match Selector::parse(title_sel_str) {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        if let Some(title_elem) = link_elem.select(&title_selector).next() {
                            title = title_elem.text().collect::<String>().trim().to_string();
                            if !title.is_empty() {
                                break;
                            }
                        }
                    }
                    if title.is_empty() {
                        title = link_elem.text().collect::<String>().trim().to_string();
                    }

                    // Extract company
                    let mut company = String::new();
                    for company_sel_str in &company_selectors {
                        let company_selector = match Selector::parse(company_sel_str) {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        if let Some(company_elem) = job_element.select(&company_selector).next() {
                            company = company_elem.text().collect::<String>().trim().to_string();
                            if !company.is_empty() {
                                break;
                            }
                        }
                    }

                    // Extract location
                    let mut location = None;
                    for region_sel_str in &region_selectors {
                        let region_selector = match Selector::parse(region_sel_str) {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        if let Some(region_elem) = job_element.select(&region_selector).next() {
                            let loc_text =
                                region_elem.text().collect::<String>().trim().to_string();
                            if !loc_text.is_empty() {
                                location = Some(loc_text);
                                break;
                            }
                        }
                    }

                    (title, url, company, location)
                } else {
                    continue; // Skip if no link found
                };

                if title.is_empty() || url.is_empty() {
                    continue;
                }

                jobs.push(Job {
                    id: None,
                    title,
                    company: if company.is_empty() {
                        "Unknown Company".to_string()
                    } else {
                        company
                    },
                    url,
                    description: None,
                    requirements: None,
                    location: location.or(Some("Remote".to_string())),
                    salary: None,
                    source: "weworkremotely".to_string(),
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

    fn job_matches_query(job: &Job, query_lower: &str, query_words: &[&str]) -> bool {
        if query_words.is_empty() {
            return true;
        }

        let mut components = vec![job.title.to_lowercase(), job.company.to_lowercase()];
        if let Some(location) = &job.location {
            components.push(location.to_lowercase());
        }
        let job_text = components.join(" ");

        if job_text.contains(query_lower) {
            return true;
        }

        let match_count = query_words
            .iter()
            .filter(|word| job_text.contains(*word))
            .count();

        match_count >= query_words.len().min(2)
    }

    /// Scrape using browser automation (fallback for blocked requests)
    fn scrape_with_browser(
        &self,
        url: &str,
        query: &str,
        config: &ScraperConfig,
    ) -> Result<Vec<Job>> {
        use crate::scraper::browser::BrowserScraper;

        println!("🌐 WeWorkRemotely: Using browser automation to bypass blocking...");

        // Try Playwright first (better stealth)
        let html = if BrowserScraper::is_playwright_available() {
            println!("   Using Playwright for better stealth...");
            BrowserScraper::new()
                .with_timeout(config.timeout_secs)
                .scrape(url)?
        } else if BrowserScraper::is_chromium_available() {
            println!("   Using headless Chrome...");
            BrowserScraper::new()
                .with_timeout(config.timeout_secs)
                .scrape(url)?
        } else {
            return Err(anyhow::anyhow!(
                "Browser automation requested but neither Playwright nor Chrome is available"
            ));
        };

        println!(
            "   Browser automation returned {} bytes of HTML",
            html.len()
        );

        let mut jobs = Self::parse_jobs(&html);
        println!("Parsed {} jobs from WWR HTML (via browser)", jobs.len());

        // Filter by query if provided (use flexible word matching)
        let query_lower = query.trim().to_lowercase();
        if !query_lower.is_empty() {
            let query_words: Vec<&str> = query_lower
                .split_whitespace()
                .filter(|w| !w.is_empty())
                .collect();
            jobs.retain(|j| Self::job_matches_query(j, &query_lower, &query_words));
        }

        // Limit count
        if jobs.len() > 50 {
            jobs.truncate(50);
        }

        if jobs.is_empty() {
            eprintln!("⚠️  WeWorkRemotely: No jobs found even with browser automation");
            Ok(vec![])
        } else {
            println!(
                "✅ Successfully fetched {} jobs from WeWorkRemotely (via browser)",
                jobs.len()
            );
            Ok(jobs)
        }
    }
}

impl JobScraper for WwrScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let url = Self::build_search_url(query);
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .context("Failed to build HTTP client for WWR")?;

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
                        body = resp.text().context("Failed to read WWR response body")?;
                        break;
                    } else {
                        eprintln!(
                            "⚠️  WWR status code: {} (attempt {}/{})",
                            status, attempt, config.retry_attempts
                        );
                        last_err = Some(anyhow::anyhow!("Status {}", status));
                    }
                }
                Err(e) => {
                    eprintln!(
                        "⚠️  WWR HTTP request failed (attempt {}/{}): {}",
                        attempt, config.retry_attempts, e
                    );
                    last_err = Some(anyhow::anyhow!(e));
                }
            }
            // Backoff
            let delay = (config.retry_delay_secs as f64
                * config.retry_backoff_factor.powi((attempt - 1) as i32))
                as u64;
            std::thread::sleep(Duration::from_secs(delay.max(1)));
        }

        if body.is_empty() {
            eprintln!("⚠️  WWR: falling back to browser automation after retries");
            if config.use_browser_automation {
                return self.scrape_with_browser(&url, query, config);
            }
            if let Some(e) = last_err {
                eprintln!("WWR last error: {}", e);
            }
            return Ok(vec![]);
        }

        println!("WWR response body length: {} bytes", body.len());

        let mut jobs = Self::parse_jobs(&body);
        println!("Parsed {} jobs from WWR HTML", jobs.len());

        // Basic post-filter: use flexible word matching (all words must appear)
        let q_lower = query.trim().to_lowercase();
        if !q_lower.is_empty() {
            let initial_count = jobs.len();
            let query_words: Vec<&str> = q_lower
                .split_whitespace()
                .filter(|w| !w.is_empty())
                .collect();
            jobs.retain(|j| Self::job_matches_query(j, &q_lower, &query_words));
            println!(
                "After filtering by query '{}': {} jobs (from {})",
                query,
                jobs.len(),
                initial_count
            );
        }

        // Limit count
        if jobs.len() > 50 {
            jobs.truncate(50);
        }

        if jobs.is_empty() {
            eprintln!("⚠️  WeWorkRemotely: No jobs found after parsing. This could mean:");
            eprintln!("   - HTML structure changed (check selectors)");
            eprintln!("   - No jobs match query '{}'", query);
            eprintln!("   - Response body was {} bytes", body.len());
            // Return empty vec instead of error - let other scrapers continue
            Ok(vec![])
        } else {
            println!(
                "✅ Successfully fetched {} jobs from WeWorkRemotely",
                jobs.len()
            );
            Ok(jobs)
        }
    }
}

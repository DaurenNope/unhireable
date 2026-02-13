use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use reqwest::header;
use scraper::{ElementRef, Html, Selector};
use std::collections::HashSet;
use std::thread;
use std::time::Duration;

pub struct IndeedScraper;

impl IndeedScraper {
    fn wrap_with_proxy(url: &str, config: &ScraperConfig) -> String {
        if let Some(api_key) = &config.scraper_api_key {
            format!(
                "https://api.scraperapi.com/?api_key={}&keep_headers=true&url={}",
                api_key,
                urlencoding::encode(url)
            )
        } else {
            url.to_string()
        }
    }

    fn build_browser(config: &ScraperConfig) -> crate::scraper::browser::BrowserScraper {
        use crate::scraper::browser::BrowserScraper;
        let mut browser = BrowserScraper::new().with_timeout(config.timeout_secs + 10);
        if let Some(cookie) = &config.indeed_cookie {
            browser = browser.with_cookie_header(cookie.clone());
        }
        browser
    }

    fn build_search_url(query: &str, start: u32) -> String {
        let q = urlencoding::encode(query.trim());
        // Indeed uses /jobs with q parameter and start parameter for pagination
        // start=0 is page 1, start=10 is page 2, start=20 is page 3, etc.
        if q.is_empty() {
            if start > 0 {
                format!("https://www.indeed.com/jobs?start={}", start)
            } else {
                "https://www.indeed.com/jobs".to_string()
            }
        } else {
            if start > 0 {
                format!(
                    "https://www.indeed.com/jobs?q={}&l=Remote&sort=date&start={}",
                    q, start
                )
            } else {
                format!("https://www.indeed.com/jobs?q={}&l=Remote&sort=date", q)
            }
        }
    }

    fn clean_text(text: &str) -> String {
        text.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn extract_text(element: &ElementRef) -> String {
        Self::clean_text(&element.text().collect::<Vec<_>>().join(" "))
    }

    fn parse_jobs(html: &str) -> Vec<Job> {
        let document = Html::parse_document(html);
        let mut jobs = Vec::new();
        let mut seen_urls = HashSet::new();

        // Indeed uses jobsearch-SerpJobCard class
        let job_selector =
            match Selector::parse("div[data-jk], div.job_seen_beacon, div.jobsearch-SerpJobCard") {
                Ok(s) => s,
                Err(_) => return jobs,
            };

        let title_selector = match Selector::parse("h2.jobTitle a, a[data-jk], h2 a") {
            Ok(s) => s,
            Err(_) => return jobs,
        };

        let company_selector = match Selector::parse(
            "span.companyName, div.companyName, a[data-testid='company-name']",
        ) {
            Ok(s) => s,
            Err(_) => return jobs,
        };

        let location_selector =
            match Selector::parse("div.companyLocation, span[data-testid='text-location']") {
                Ok(s) => s,
                Err(_) => return jobs,
            };

        let salary_selector = match Selector::parse(
            "div.salary-snippet, span[data-testid='attribute_snippet_testid']",
        ) {
            Ok(s) => s,
            Err(_) => return jobs,
        };

        for job_element in document.select(&job_selector) {
            // Extract job ID for URL construction
            let job_id = job_element
                .value()
                .attr("data-jk")
                .or_else(|| {
                    job_element
                        .select(&title_selector)
                        .next()
                        .and_then(|a| a.value().attr("data-jk"))
                })
                .unwrap_or("");

            if job_id.is_empty() {
                continue;
            }

            // Extract title and URL
            let title_elem = job_element.select(&title_selector).next();
            let title = title_elem
                .as_ref()
                .map(|e| e.text().collect::<String>().trim().to_string())
                .unwrap_or_default();

            if title.is_empty() {
                continue;
            }

            let url = format!("https://www.indeed.com/viewjob?jk={}", job_id);

            // Extract company
            let company = job_element
                .select(&company_selector)
                .next()
                .map(|e| e.text().collect::<String>().trim().to_string())
                .filter(|c| !c.is_empty())
                .unwrap_or_else(|| "Unknown Company".to_string());

            // Extract location
            let location = job_element
                .select(&location_selector)
                .next()
                .map(|e| e.text().collect::<String>().trim().to_string())
                .filter(|l| !l.is_empty());

            // Extract salary
            let salary = job_element
                .select(&salary_selector)
                .next()
                .map(|e| {
                    let text = e.text().collect::<String>().trim().to_string();
                    if text.to_lowercase().contains("salary") || text.contains("$") {
                        Some(text)
                    } else {
                        None
                    }
                })
                .flatten();

            // Extract snippet/description
            let snippet_selector = match Selector::parse(
                "div.job-snippet, span.summary, div.summary, div[id*='job-snippet']",
            ) {
                Ok(s) => s,
                Err(_) => return jobs,
            };

            let mut description = job_element
                .select(&snippet_selector)
                .next()
                .map(|e| Self::extract_text(&e))
                .filter(|d| !d.is_empty());

            // Fallback: build description from bullet points if snippet missing
            if description.is_none() {
                if let Ok(bullet_selector) = Selector::parse("ul li") {
                    let bullets: Vec<String> = job_element
                        .select(&bullet_selector)
                        .map(|li| Self::extract_text(&li))
                        .filter(|text| !text.is_empty())
                        .take(6)
                        .collect();

                    if !bullets.is_empty() {
                        let bullet_text = bullets
                            .into_iter()
                            .map(|b| format!("• {}", b))
                            .collect::<Vec<_>>()
                            .join("\n");
                        description = Some(bullet_text);
                    }
                }
            }

            // If we still don't have description, include company + title snippet so UI isn't empty
            if description.is_none() {
                let fallback_title = job_element
                    .select(&title_selector)
                    .next()
                    .map(|e| Self::extract_text(&e))
                    .unwrap_or_else(|| title.clone());
                description = Some(format!("{} at {}", fallback_title, company));
            }

            // Deduplicate by URL
            if !seen_urls.insert(url.clone()) {
                continue;
            }

            jobs.push(Job {
                id: None,
                title,
                company,
                url,
                description,
                requirements: None,
                location: location.or(Some("Remote".to_string())),
                salary,
                source: "indeed".to_string(),
                status: JobStatus::Saved,
                match_score: None,
                created_at: None,
                updated_at: None,
                        ..Default::default()
        });

            // No hard limit - pagination will handle this
        }

        jobs
    }

    fn job_matches_query(job: &Job, query_lower: &str) -> bool {
        if query_lower.is_empty() {
            return true;
        }

        // Split query into individual words for more flexible matching
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();

        // Check if any query word matches in title, company, description, or location
        let title_lower = job.title.to_lowercase();
        let company_lower = job.company.to_lowercase();
        let desc_lower = job
            .description
            .as_ref()
            .map(|d| d.to_lowercase())
            .unwrap_or_default();
        let loc_lower = job
            .location
            .as_ref()
            .map(|l| l.to_lowercase())
            .unwrap_or_default();

        // Match if at least one word from query appears in any field
        query_words.iter().any(|word| {
            title_lower.contains(word)
                || company_lower.contains(word)
                || desc_lower.contains(word)
                || loc_lower.contains(word)
        })
    }
}

impl IndeedScraper {
    /// Scrape using browser automation (fallback for blocked requests)
    fn scrape_with_browser(url: &str, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        use crate::scraper::browser::BrowserScraper;

        println!("🌐 Indeed: Using browser automation to bypass blocking...");

        let html = if BrowserScraper::is_playwright_available() {
            println!("   Using Playwright for better stealth...");
            Self::build_browser(config).scrape(url)?
        } else if BrowserScraper::is_chromium_available() {
            println!("   Using headless Chrome...");
            Self::build_browser(config).scrape(url)?
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
        println!("Parsed {} jobs from Indeed HTML (via browser)", jobs.len());

        // Filter by query if provided
        let query_lower = query.trim().to_lowercase();
        if !query_lower.is_empty() {
            let before_count = jobs.len();
            jobs.retain(|job| Self::job_matches_query(job, &query_lower));
            let after_count = jobs.len();
            if before_count > after_count {
                println!(
                    "  Filtered {} jobs to {} matching query '{}'",
                    before_count, after_count, query
                );
            }
        }

        if jobs.is_empty() {
            println!("⚠️  Indeed: No jobs found even with browser automation");
            Ok(Vec::new())
        } else {
            println!(
                "✅ Successfully fetched {} jobs from Indeed (via browser)",
                jobs.len()
            );
            Ok(jobs)
        }
    }
}

impl JobScraper for IndeedScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let max_pages = if config.max_pages == 0 {
            5
        } else {
            config.max_pages
        }; // Default to 5 pages
        let mut all_jobs = Vec::new();
        let mut seen_urls = HashSet::new();

        // Indeed shows 10-15 jobs per page, uses start parameter (0, 10, 20, 30, ...)
        // Loop through pages
        for page in 0..max_pages {
            let start = page * 10; // Indeed uses start=0, 10, 20, 30, etc.
            let url = Self::build_search_url(query, start);

            println!("Fetching jobs from Indeed (page {}): {}", page + 1, url);

            let client = Client::builder()
                .timeout(Duration::from_secs(config.timeout_secs))
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build()
                .context("Failed to build HTTP client for Indeed")?;
            let target_url = Self::wrap_with_proxy(&url, config);

            // Try direct HTTP request with retries
            let mut body = String::new();
            let mut last_err: Option<anyhow::Error> = None;
            let mut attempt = 0;
            while attempt < config.retry_attempts {
                attempt += 1;
                let mut request = client.get(&target_url);
                if let Some(cookie_header) = &config.indeed_cookie {
                    request = request.header(header::COOKIE, cookie_header);
                }
                match request.send() {
                    Ok(resp) => {
                        let status = resp.status();
                        if status.is_success() {
                            body = resp.text().context("Failed to read Indeed response body")?;
                            break;
                        } else {
                            eprintln!(
                                "⚠️  Indeed status code: {} (attempt {}/{})",
                                status, attempt, config.retry_attempts
                            );
                            // Store status code in error for 403 detection
                            last_err =
                                Some(anyhow::anyhow!("Status {} {}", status.as_u16(), status));
                        }
                    }
                    Err(e) => {
                        eprintln!(
                            "⚠️  Indeed HTTP request failed (attempt {}/{}): {}",
                            attempt, config.retry_attempts, e
                        );
                        last_err = Some(anyhow::anyhow!(e));
                    }
                }
                let delay = (config.retry_delay_secs as f64
                    * config.retry_backoff_factor.powi((attempt - 1) as i32))
                    as u64;
                thread::sleep(Duration::from_secs(delay.max(1)));
            }

            // If we got 403 on first page, try browser automation as fallback
            if body.is_empty() && page == 0 {
                if let Some(e) = &last_err {
                    let err_str = e.to_string();
                    if (err_str.contains("403") || err_str.contains("Forbidden"))
                        && config.use_browser_automation
                    {
                        eprintln!("⚠️  Indeed: Got 403, falling back to browser automation...");
                        // Browser automation can only do one page at a time for now
                        return Self::scrape_with_browser(&url, query, config);
                    }
                }
                if let Some(e) = last_err {
                    eprintln!("Indeed last error: {}", e);
                }
                println!(
                    "⚠️  Indeed: No response received for page {}, stopping pagination",
                    page + 1
                );
                break;
            }

            if body.is_empty() {
                // No more pages
                println!(
                    "   📄 Page {} returned empty - reached end of results",
                    page + 1
                );
                break;
            }

            let mut page_jobs = Self::parse_jobs(&body);
            println!("   Parsed {} jobs from page {}", page_jobs.len(), page + 1);

            // Filter by query if provided
            let query_lower = query.trim().to_lowercase();
            if !query_lower.is_empty() {
                let before_count = page_jobs.len();
                page_jobs.retain(|job| Self::job_matches_query(job, &query_lower));
                let after_count = page_jobs.len();
                if before_count > after_count {
                    println!(
                        "     Filtered {} jobs to {} matching query '{}'",
                        before_count, after_count, query
                    );
                }
            }

            // Deduplicate across pages using seen_urls
            let mut new_jobs = Vec::new();
            for job in page_jobs {
                if seen_urls.insert(job.url.clone()) {
                    new_jobs.push(job);
                }
            }

            if new_jobs.is_empty() {
                println!(
                    "   📄 Page {} returned no new jobs - reached end of results",
                    page + 1
                );
                break;
            }

            println!(
                "   📄 Page {}: Found {} new jobs ({} total so far)",
                page + 1,
                new_jobs.len(),
                all_jobs.len() + new_jobs.len()
            );
            all_jobs.append(&mut new_jobs);

            // Add delay between pages
            if page < max_pages - 1 {
                thread::sleep(Duration::from_millis(500));
            }
        }

        if all_jobs.is_empty() {
            println!("⚠️  Indeed: No jobs found");
            Ok(Vec::new())
        } else {
            println!(
                "✅ Successfully scraped {} jobs from Indeed (across {} page{})",
                all_jobs.len(),
                if all_jobs.is_empty() {
                    0
                } else {
                    let pages = (all_jobs.len() as f32 / 10.0).ceil() as u32;
                    pages.min(max_pages)
                },
                if all_jobs.len() <= 10 { "" } else { "s" }
            );
            Ok(all_jobs)
        }
    }
}

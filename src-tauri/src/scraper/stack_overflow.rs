use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::Result;
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::thread;
use std::time::Duration;

pub struct StackOverflowScraper;

impl JobScraper for StackOverflowScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &crate::scraper::config::ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let mut jobs = Vec::new();
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
            .timeout(Duration::from_secs(30))
            .build()?;

        // Stack Overflow Jobs - try RSS feed first (more reliable, no auth needed)
        // Note: Stack Overflow uses Cloudflare protection, so RSS may be blocked
        let encoded_query = urlencoding::encode(query);
        let rss_url = format!(
            "https://stackoverflow.com/jobs/feed?q={}&l=Remote",
            encoded_query
        );
        let html_url = format!(
            "https://stackoverflow.com/jobs?q={}&l=Remote",
            encoded_query
        );

        println!(
            "🔍 Scraping Stack Overflow Jobs (trying RSS feed first): {}",
            rss_url
        );

        // Try RSS feed first (no authentication needed)
        match client.get(&rss_url).send() {
            Ok(response) => {
                // Extract content-type before consuming response
                let content_type = response
                    .headers()
                    .get("content-type")
                    .and_then(|h| h.to_str().ok())
                    .unwrap_or("")
                    .to_string();

                println!("📡 RSS response content-type: {}", content_type);
                match response.text() {
                    Ok(feed_text) => {
                        println!("📄 RSS feed length: {} bytes", feed_text.len());

                        // Check if it looks like XML/RSS (even if content-type is wrong)
                        if feed_text.trim_start().starts_with("<?xml")
                            || feed_text.contains("<rss")
                            || feed_text.contains("<feed")
                            || feed_text.contains("<item")
                            || content_type.contains("xml")
                            || content_type.contains("rss")
                            || content_type.contains("atom")
                        {
                            println!("📡 Found RSS/XML feed, parsing...");

                            // Parse RSS/XML feed
                            let document = Html::parse_document(&feed_text);
                            let item_selector = Selector::parse("item, entry").unwrap();

                            for item in document.select(&item_selector) {
                                let title_sel = Selector::parse("title").unwrap();
                                let link_sel = Selector::parse("link").unwrap();
                                let desc_sel = Selector::parse("description").unwrap();

                                let title = item
                                    .select(&title_sel)
                                    .next()
                                    .and_then(|e| e.text().next())
                                    .map(|s| s.trim().to_string())
                                    .unwrap_or_default();

                                let link = item
                                    .select(&link_sel)
                                    .next()
                                    .and_then(|e| {
                                        e.text().next().or_else(|| e.value().attr("href"))
                                    })
                                    .map(|s| s.trim().to_string())
                                    .unwrap_or_default();

                                let description = item
                                    .select(&desc_sel)
                                    .next()
                                    .and_then(|e| e.text().next())
                                    .map(|s| s.trim().to_string());

                                // Try to extract company from title (format: "Job Title - Company Name")
                                let (job_title, company) = if title.contains(" - ") {
                                    let parts: Vec<&str> = title.splitn(2, " - ").collect();
                                    if parts.len() == 2 {
                                        (parts[0].trim().to_string(), parts[1].trim().to_string())
                                    } else {
                                        (title.clone(), "Unknown".to_string())
                                    }
                                } else {
                                    (title.clone(), "Unknown".to_string())
                                };

                                if !job_title.is_empty() && !link.is_empty() {
                                    jobs.push(Job {
                                        id: None,
                                        title: job_title,
                                        company,
                                        url: link,
                                        description,
                                        requirements: None,
                                        location: Some("Remote".to_string()),
                                        salary: None,
                                        source: "Stack Overflow".to_string(),
                                        status: JobStatus::Saved,
                                        match_score: None,
                                        created_at: Some(chrono::Utc::now()),
                                        updated_at: Some(chrono::Utc::now()),
                                    });
                                }
                            }

                            if !jobs.is_empty() {
                                println!(
                                    "✅ Found {} jobs from Stack Overflow RSS feed",
                                    jobs.len()
                                );
                                thread::sleep(Duration::from_millis(500));
                                return Ok(jobs);
                            }
                        } else {
                            println!("⚠️  RSS feed doesn't appear to be XML/RSS format (likely Cloudflare protection)");
                        }
                    }
                    Err(e) => {
                        eprintln!("⚠️  Failed to read RSS feed: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("⚠️  Failed to fetch RSS feed: {}", e);
            }
        }

        // Fallback to HTML scraping if RSS didn't work
        println!("⚠️  RSS feed didn't work, trying HTML page: {}", html_url);

        let html = if config.use_browser_automation && jobs.is_empty() {
            use crate::scraper::browser::BrowserScraper;
            if BrowserScraper::is_playwright_available() || BrowserScraper::is_chromium_available()
            {
                println!("🌐 Using browser automation for Stack Overflow...");
                BrowserScraper::new().scrape(&html_url).unwrap_or_else(|e| {
                    eprintln!("⚠️  Browser automation failed: {}, falling back to HTTP", e);
                    client
                        .get(&html_url)
                        .send()
                        .and_then(|r| r.text())
                        .unwrap_or_default()
                })
            } else {
                client.get(&html_url).send()?.text()?
            }
        } else if jobs.is_empty() {
            client.get(&html_url).send()?.text()?
        } else {
            String::new() // Already got jobs from RSS
        };

        if html.is_empty() && !jobs.is_empty() {
            // Already got jobs from RSS, return early
            return Ok(jobs);
        }

        println!("📄 Received {} bytes of HTML", html.len());

        // Debug: log first 1000 chars to see structure
        if html.len() > 0 {
            let preview = html.chars().take(1000).collect::<String>();
            println!("🔍 HTML preview: {}...", preview);
        }

        let document = Html::parse_document(&html);

        // Updated selectors - try multiple patterns for Stack Overflow Jobs
        let job_card_selector = Selector::parse(
            "div[data-jobid], div.-job, div.listResults > div, article[data-jobid], .-job, [data-jobid]"
        ).unwrap_or_else(|_| {
            Selector::parse("div").unwrap()
        });

        let title_selector = Selector::parse(
            "h2 a, a.job-link, a[data-job-id], a[href*='/jobs/'], h2 > a, .job-title a",
        )
        .unwrap_or_else(|_| Selector::parse("a[href*='/jobs/']").unwrap());

        let company_selector = Selector::parse(
            "h3 span, span.employer, .employer, [data-testid='employer'], .company-name",
        )
        .unwrap_or_else(|_| Selector::parse("span").unwrap());

        let location_selector = Selector::parse(
            "span.fc-black-500, .location, span[title], [data-testid='location'], .job-location",
        )
        .unwrap_or_else(|_| Selector::parse("span").unwrap());

        // Also try finding by text patterns in the HTML
        println!("🔍 Searching for job-related patterns in HTML...");
        let job_count_in_html = html.matches("job").count() + html.matches("Job").count();
        println!("📊 Found {} mentions of 'job' in HTML", job_count_in_html);

        println!("🔍 Looking for job cards with selector...");
        let job_elements: Vec<_> = document.select(&job_card_selector).collect();
        println!(
            "📋 Found {} potential job card elements",
            job_elements.len()
        );

        for job_element in job_elements {
            let title = job_element
                .select(&title_selector)
                .next()
                .and_then(|e| e.text().next())
                .unwrap_or("Unknown")
                .trim()
                .to_string();

            let company = job_element
                .select(&company_selector)
                .next()
                .and_then(|e| e.text().next())
                .unwrap_or("Unknown")
                .trim()
                .to_string();

            let location = job_element
                .select(&location_selector)
                .next()
                .and_then(|e| e.text().next())
                .map(|s| s.trim().to_string());

            let job_url = job_element
                .select(&title_selector)
                .next()
                .and_then(|e| e.value().attr("href"))
                .map(|href| {
                    if href.starts_with("http") {
                        href.to_string()
                    } else {
                        format!("https://stackoverflow.com{}", href)
                    }
                })
                .unwrap_or_else(|| format!("https://stackoverflow.com/jobs?q={}", encoded_query));

            if !title.is_empty() && title != "Unknown" {
                jobs.push(Job {
                    id: None,
                    title,
                    company,
                    url: job_url,
                    description: None,
                    requirements: None,
                    location,
                    salary: None,
                    source: "Stack Overflow".to_string(),
                    status: JobStatus::Saved,
                    match_score: None,
                    created_at: Some(chrono::Utc::now()),
                    updated_at: Some(chrono::Utc::now()),
                });
            }
        }

        thread::sleep(Duration::from_millis(500));
        println!("✅ Found {} jobs from Stack Overflow", jobs.len());
        Ok(jobs)
    }
}

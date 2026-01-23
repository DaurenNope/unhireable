use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::Result;
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::thread;
use std::time::Duration;

pub struct DiceScraper;

impl JobScraper for DiceScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &crate::scraper::config::ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let mut jobs = Vec::new();
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
            .timeout(Duration::from_secs(30))
            .build()?;

        // Dice search URL
        let encoded_query = urlencoding::encode(query);
        let url = format!(
            "https://www.dice.com/jobs?q={}&location=Remote",
            encoded_query
        );

        println!("🔍 Scraping Dice: {}", url);

        let response = if config.use_browser_automation {
            use crate::scraper::browser::BrowserScraper;
            if BrowserScraper::is_playwright_available() || BrowserScraper::is_chromium_available()
            {
                BrowserScraper::new().scrape(&url).unwrap_or_else(|_| {
                    client
                        .get(&url)
                        .send()
                        .and_then(|r| r.text())
                        .unwrap_or_default()
                })
            } else {
                client.get(&url).send()?.text()?
            }
        } else {
            client.get(&url).send()?.text()?
        };

        println!("📄 Received {} bytes of HTML", response.len());

        // Debug: log first 500 chars to see structure
        if response.len() > 0 {
            let preview = response.chars().take(500).collect::<String>();
            println!("🔍 HTML preview: {}...", preview);
        }

        let document = Html::parse_document(&response);

        // Updated selectors for Dice's 2025 React-based structure
        // Job cards use data-testid="job-card" with data-job-guid attribute
        let job_card_selector = Selector::parse(r#"div[data-testid="job-card"]"#)
            .unwrap_or_else(|_| Selector::parse("div[data-job-guid]").unwrap());

        // Title is in link with data-testid="job-search-job-detail-link"
        let title_selector = Selector::parse(r#"a[data-testid="job-search-job-detail-link"]"#)
            .unwrap_or_else(|_| Selector::parse("a[href*='job-detail']").unwrap());

        println!("🔍 Looking for job cards...");
        let job_elements: Vec<_> = document.select(&job_card_selector).collect();
        println!(
            "📋 Found {} potential job card elements",
            job_elements.len()
        );

        for job_element in job_elements {
            // Get title from the link's aria-label or text content
            let title_link = job_element.select(&title_selector).next();
            
            let title = title_link
                .and_then(|e| {
                    // Try aria-label first (more reliable)
                    e.value().attr("aria-label")
                        .map(|s| s.to_string())
                        .or_else(|| e.text().next().map(|s| s.trim().to_string()))
                })
                .unwrap_or_default();

            // Get job URL from the title link
            let job_url = title_link
                .and_then(|e| e.value().attr("href"))
                .map(|href| {
                    if href.starts_with("http") {
                        href.to_string()
                    } else {
                        format!("https://www.dice.com{}", href)
                    }
                })
                .unwrap_or_else(|| format!("https://www.dice.com/jobs?q={}", encoded_query));

            // Company name - look for company-related elements
            let company_selector = Selector::parse(r#"a[data-testid*="company"], span[data-testid*="company"]"#)
                .unwrap_or_else(|_| Selector::parse("a[href*='/company/']").unwrap());
            let company = job_element
                .select(&company_selector)
                .next()
                .and_then(|e| e.text().next())
                .map(|s| s.trim().to_string())
                .unwrap_or_else(|| "Unknown Company".to_string());

            // Location - look for location-related spans
            let location_selector = Selector::parse(r#"span[data-testid*="location"]"#)
                .unwrap_or_else(|_| Selector::parse("span").unwrap());
            let location = job_element
                .select(&location_selector)
                .next()
                .and_then(|e| e.text().next())
                .map(|s| s.trim().to_string());

            // Try to extract salary if present
            let salary_selector = Selector::parse(r#"span[data-testid*="salary"]"#)
                .unwrap_or_else(|_| Selector::parse("span.salary").unwrap());
            let salary = job_element
                .select(&salary_selector)
                .next()
                .and_then(|e| e.text().next())
                .map(|s| s.trim().to_string());

            if !title.is_empty() {
                jobs.push(Job {
                    id: None,
                    title,
                    company,
                    url: job_url,
                    description: None,
                    requirements: None,
                    location,
                    salary,
                    source: "dice".to_string(),
                    status: JobStatus::Saved,
                    match_score: None,
                    created_at: Some(chrono::Utc::now()),
                    updated_at: Some(chrono::Utc::now()),
                });
            }
        }

        thread::sleep(Duration::from_millis(500));
        println!("✅ Found {} jobs from Dice", jobs.len());
        Ok(jobs)
    }
}

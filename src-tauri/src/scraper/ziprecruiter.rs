use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::Result;
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::thread;
use std::time::Duration;

pub struct ZipRecruiterScraper;

impl JobScraper for ZipRecruiterScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &crate::scraper::config::ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let mut jobs = Vec::new();
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
            .timeout(Duration::from_secs(30))
            .build()?;

        // ZipRecruiter search URL
        let encoded_query = urlencoding::encode(query);
        let url = format!(
            "https://www.ziprecruiter.com/jobs-search?search={}&location=Remote&radius=0&remote=only",
            encoded_query
        );

        println!("🔍 Scraping ZipRecruiter: {}", url);

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

        // Check if HTML indicates no jobs or blocked page
        let response_lower = response.to_lowercase();
        // ZipRecruiter often shows "0 jobs" in title when there are legitimately no results or blocked
        if response_lower.contains("0 jobs") && response_lower.contains("now hiring") {
            println!("⚠️  ZipRecruiter: Title indicates 0 jobs found for query");
            // Still try to parse - might be false positive
        }
        if response_lower.contains("sign in") && response_lower.contains("ziprecruiter")
            || response_lower.contains("login required")
            || response_lower.contains("blocked")
            || (response.len() > 10000 && response_lower.matches("job").count() < 3)
        {
            println!(
                "⚠️  ZipRecruiter: Likely blocked or requires login (HTML size: {} bytes)",
                response.len()
            );
            println!("   Returning empty - ZipRecruiter may require authentication");
            return Ok(Vec::new());
        }

        // Debug: log first 500 chars to see structure
        if response.len() > 0 {
            let preview = response.chars().take(500).collect::<String>();
            println!("🔍 HTML preview: {}...", preview);
        }

        let document = Html::parse_document(&response);

        // ZipRecruiter job listing selectors - updated with more fallbacks
        let job_card_selector = Selector::parse(
            "article.job_result, article[data-testid='job-card'], div.job_result, .job_result",
        )
        .unwrap_or_else(|_| Selector::parse("article").unwrap());

        let title_selector =
            Selector::parse("a.job_link, a[data-testid='job-title'], h2 a, .job_title a")
                .unwrap_or_else(|_| Selector::parse("a").unwrap());

        let company_selector = Selector::parse(
            "a.company_name, a[data-testid='company-name'], .company_name, span.company",
        )
        .unwrap_or_else(|_| Selector::parse("span").unwrap());

        let location_selector = Selector::parse(
            "span.job_location, span[data-testid='job-location'], .job_location, div.location",
        )
        .unwrap_or_else(|_| Selector::parse("span").unwrap());

        println!("🔍 Looking for job cards...");
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
                        format!("https://www.ziprecruiter.com{}", href)
                    }
                })
                .unwrap_or_else(|| {
                    format!(
                        "https://www.ziprecruiter.com/jobs-search?search={}",
                        encoded_query
                    )
                });

            // Try to extract salary
            let salary_selector = Selector::parse("span.salary")
                .unwrap_or_else(|_| Selector::parse("div.compensation").unwrap());
            let salary = job_element
                .select(&salary_selector)
                .next()
                .and_then(|e| e.text().next())
                .map(|s| s.trim().to_string());

            if !title.is_empty() && title != "Unknown" {
                jobs.push(Job {
                    id: None,
                    title,
                    company,
                    url: job_url,
                    description: None,
                    requirements: None,
                    location,
                    salary,
                    source: "ZipRecruiter".to_string(),
                    status: JobStatus::Saved,
                    match_score: None,
                    created_at: Some(chrono::Utc::now()),
                    updated_at: Some(chrono::Utc::now()),
                });
            }
        }

        thread::sleep(Duration::from_millis(500));
        println!("✅ Found {} jobs from ZipRecruiter", jobs.len());
        Ok(jobs)
    }
}

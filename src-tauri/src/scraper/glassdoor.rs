use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::Result;
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::thread;
use std::time::Duration;

pub struct GlassdoorScraper;

impl JobScraper for GlassdoorScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &crate::scraper::config::ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let mut jobs = Vec::new();
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
            .timeout(Duration::from_secs(30))
            .build()?;

        // Glassdoor search URL
        let encoded_query = urlencoding::encode(query);
        let url = format!(
            "https://www.glassdoor.com/Job/jobs.htm?sc.keyword={}&locT=N&locId=1&locKeyword=Remote&remoteWorkType=1",
            encoded_query
        );

        println!("🔍 Scraping Glassdoor: {}", url);

        let response = if config.use_browser_automation {
            // Use browser automation if available
            use crate::scraper::browser::BrowserScraper;
            if BrowserScraper::is_playwright_available() || BrowserScraper::is_chromium_available()
            {
                BrowserScraper::new().scrape(&url).unwrap_or_else(|_| {
                    // Fallback to HTTP request
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

        // Check if HTML indicates blocked/login page
        let response_lower = response.to_lowercase();
        if response_lower.contains("sign in") && response_lower.contains("glassdoor")
            || response_lower.contains("login required")
            || response_lower.contains("please sign in")
            || response_lower.contains("blocked")
            || (response.len() > 10000 && response_lower.matches("job").count() < 5)
        {
            println!(
                "⚠️  Glassdoor: Likely blocked or requires login (HTML size: {} bytes)",
                response.len()
            );
            println!("   Returning empty - Glassdoor often requires authentication");
            return Ok(Vec::new());
        }

        // Debug: log first 500 chars to see structure
        if response.len() > 0 {
            let preview = response.chars().take(500).collect::<String>();
            println!("🔍 HTML preview: {}...", preview);
        }

        let document = Html::parse_document(&response);

        // Glassdoor job listing selectors - updated with more fallbacks
        let job_card_selector = Selector::parse("div[data-test='job-listing'], li.react-job-listing, article[data-test='job-listing'], .jobListing").unwrap_or_else(|_| {
            Selector::parse("li").unwrap()
        });

        let title_selector =
            Selector::parse("a[data-test='job-title'], a.jobTitle, h2 a, .jobTitle a")
                .unwrap_or_else(|_| Selector::parse("a").unwrap());

        let company_selector = Selector::parse(
            "span[data-test='employer-name'], span.employerName, .employerName, span.employer",
        )
        .unwrap_or_else(|_| Selector::parse("span").unwrap());

        let location_selector =
            Selector::parse("span[data-test='job-location'], div.loc, .location, span.location")
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

            // Try to extract job URL
            let job_url = job_element
                .select(&title_selector)
                .next()
                .and_then(|e| e.value().attr("href"))
                .map(|href| {
                    if href.starts_with("http") {
                        href.to_string()
                    } else {
                        format!("https://www.glassdoor.com{}", href)
                    }
                })
                .unwrap_or_else(|| {
                    format!(
                        "https://www.glassdoor.com/Job/jobs.htm?sc.keyword={}",
                        encoded_query
                    )
                });

            // Try to extract salary if available
            let salary_selector = Selector::parse("span[data-test='detailSalary']")
                .unwrap_or_else(|_| Selector::parse("span.salaryText").unwrap());
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
                    source: "Glassdoor".to_string(),
                    status: JobStatus::Saved,
                    match_score: None,
                    created_at: Some(chrono::Utc::now()),
                    updated_at: Some(chrono::Utc::now()),
                });
            }
        }

        // Rate limiting
        thread::sleep(Duration::from_millis(500));

        println!("✅ Found {} jobs from Glassdoor", jobs.len());
        Ok(jobs)
    }
}

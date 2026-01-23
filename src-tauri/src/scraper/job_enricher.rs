use crate::db::models::Job;
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::time::Duration;

pub struct JobEnricher;

impl JobEnricher {
    /// Enrich a job by fetching full details from its URL
    pub fn enrich_job(job: &mut Job) -> Result<()> {
        // Skip if already has description
        if job.description.is_some() && !job.description.as_ref().unwrap().trim().is_empty() {
            return Ok(());
        }

        println!("🔍 Enriching job: {} at {}", job.title, job.company);

        // For React sites like Wellfound, try browser automation first
        let html = if job.source.to_lowercase().contains("wellfound")
            || job.url.contains("wellfound.com")
        {
            // Wellfound is a React site - needs browser automation for proper rendering
            use crate::scraper::browser::BrowserScraper;

            if BrowserScraper::is_playwright_available() || BrowserScraper::is_chromium_available()
            {
                println!("   Using browser automation for Wellfound (React site)...");
                Self::scrape_with_browser(&job.url, 3)?
            } else {
                // No browser automation - Wellfound won't work with plain HTTP
                return Err(anyhow::anyhow!(
                    "Wellfound requires browser automation (Playwright/Chrome) for React rendering"
                ));
            }
        } else {
            // For other sites, use HTTP
            Self::fetch_with_http(&job.url)?
        };

        let had_description_before = job.description.is_some();
        Self::extract_details_from_html(&html, job)?;

        // Log whether we actually extracted a description
        let has_description_after = job
            .description
            .as_ref()
            .map(|d| !d.trim().is_empty() && d.len() > 50)
            .unwrap_or(false);

        if has_description_after && !had_description_before {
            println!(
                "   ✅ Extracted description ({} chars)",
                job.description.as_ref().unwrap().len()
            );
        } else if !has_description_after {
            println!(
                "   ⚠️  No description extracted from page (HTML size: {} bytes)",
                html.len()
            );
        }

        Ok(())
    }

    fn scrape_with_browser(url: &str, max_attempts: usize) -> Result<String> {
        use crate::scraper::browser::BrowserScraper;

        let mut last_error: Option<anyhow::Error> = None;
        for attempt in 1..=max_attempts {
            let result = BrowserScraper::new().with_timeout(45).scrape(url);

            match result {
                Ok(html) => {
                    if html.len() > 5000 {
                        return Ok(html);
                    } else {
                        println!(
                            "   Browser automation returned small HTML ({} bytes) on attempt {} ({}).",
                            html.len(),
                            attempt,
                            if html.to_lowercase().contains("cloudflare") {
                                "likely Cloudflare/block page"
                            } else {
                                "possible redirect/error"
                            }
                        );
                        last_error = Some(anyhow::anyhow!(
                            "Browser HTML too small ({} bytes)",
                            html.len()
                        ));
                        std::thread::sleep(std::time::Duration::from_millis(
                            (attempt as u64) * 3000,
                        ));
                        continue;
                    }
                }
                Err(e) => {
                    println!("   Browser automation attempt {} failed: {}", attempt, e);
                    last_error = Some(e);
                    std::thread::sleep(std::time::Duration::from_millis((attempt as u64) * 3000));
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            anyhow::anyhow!("All browser automation attempts failed or returned small HTML")
        }))
    }

    /// Fetch HTML using HTTP request
    fn fetch_with_http(url: &str) -> Result<String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .context("Failed to build HTTP client")?;

        client
            .get(url)
            .send()
            .context("Failed to fetch job page")?
            .text()
            .context("Failed to read job page response")
    }

    /// Extract job details from HTML based on source
    fn extract_details_from_html(html: &str, job: &mut Job) -> Result<()> {
        let document = Html::parse_document(html);

        match job.source.to_lowercase().as_str() {
            "hh.kz" | "hhkz" => Self::extract_hh_kz_details(&document, job),
            "indeed" | "indeed.com" => Self::extract_indeed_details(&document, job),
            "remotive" | "remotive.com" => Self::extract_remotive_details(&document, job),
            "remoteok" | "remoteok.com" => Self::extract_remoteok_details(&document, job),
            "wellfound" | "angel.co" => Self::extract_wellfound_details(&document, job),
            _ => Self::extract_generic_details(&document, job),
        }
    }

    fn extract_hh_kz_details(document: &Html, job: &mut Job) -> Result<()> {
        // hh.kz detail page selectors
        let desc_selectors = [
            "div[data-qa='vacancy-description']",
            "div.vacancy-description",
            "div.g-user-content",
            "div[class*='description']",
        ];

        let req_selectors = [
            "div[data-qa='vacancy-section']",
            "div.vacancy-section",
            "div[class*='requirement']",
        ];

        for sel in &desc_selectors {
            if let Ok(selector) = Selector::parse(sel) {
                if let Some(elem) = document.select(&selector).next() {
                    let text = elem.text().collect::<String>().trim().to_string();
                    if !text.is_empty() && text.len() > 50 {
                        job.description = Some(text);
                        break;
                    }
                }
            }
        }

        for sel in &req_selectors {
            if let Ok(selector) = Selector::parse(sel) {
                if let Some(elem) = document.select(&selector).next() {
                    let text = elem.text().collect::<String>().trim().to_string();
                    if !text.is_empty() && text.len() > 20 {
                        job.requirements = Some(text);
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    fn extract_indeed_details(document: &Html, job: &mut Job) -> Result<()> {
        let desc_selectors = [
            "div#jobDescriptionText",
            "div.jobsearch-jobDescriptionText",
            "div[data-testid='job-description']",
            "div.description",
        ];

        for sel in &desc_selectors {
            if let Ok(selector) = Selector::parse(sel) {
                if let Some(elem) = document.select(&selector).next() {
                    let text = elem.text().collect::<String>().trim().to_string();
                    if !text.is_empty() && text.len() > 50 {
                        job.description = Some(text);
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    fn extract_remotive_details(document: &Html, job: &mut Job) -> Result<()> {
        // Remotive usually has full description in listing, but check detail page
        let desc_selectors = [
            "div.job-description",
            "div.description",
            "div[class*='description']",
        ];

        for sel in &desc_selectors {
            if let Ok(selector) = Selector::parse(sel) {
                if let Some(elem) = document.select(&selector).next() {
                    let text = elem.text().collect::<String>().trim().to_string();
                    if !text.is_empty() && text.len() > 50 {
                        job.description = Some(text);
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    fn extract_remoteok_details(document: &Html, job: &mut Job) -> Result<()> {
        let desc_selectors = [
            "div.description",
            "div.job-description",
            "div[class*='description']",
        ];

        for sel in &desc_selectors {
            if let Ok(selector) = Selector::parse(sel) {
                if let Some(elem) = document.select(&selector).next() {
                    let text = elem.text().collect::<String>().trim().to_string();
                    if !text.is_empty() && text.len() > 50 {
                        job.description = Some(text);
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    fn extract_wellfound_details(document: &Html, job: &mut Job) -> Result<()> {
        // Wellfound (formerly AngelList) uses React, so selectors need to be flexible
        let desc_selectors = [
            // Modern Wellfound structure
            "div[data-test='JobDescription']",
            "div[class*='JobDescription']",
            "div[class*='job-description']",
            "div[class*='description']",
            // Content sections
            "section[class*='description']",
            "div[class*='content']",
            "div[class*='Content']",
            // Generic patterns
            "div.description",
            "div.job-description",
            // Fallback: look for main content area
            "main div[class*='text']",
            "article",
        ];

        let req_selectors = [
            "div[class*='requirement']",
            "div[class*='Requirement']",
            "div[class*='qualification']",
            "ul[class*='requirement']",
            "section[class*='requirement']",
        ];

        // Try description selectors
        for sel in &desc_selectors {
            if let Ok(selector) = Selector::parse(sel) {
                for elem in document.select(&selector) {
                    let text = elem.text().collect::<String>().trim().to_string();
                    // Filter out navigation, headers, and very short text
                    if !text.is_empty()
                        && text.len() > 100
                        && text.len() < 50000
                        && !text.to_lowercase().contains("apply now")
                        && !text.to_lowercase().contains("share this job")
                    {
                        // Check if it looks like actual job content
                        let text_lower = text.to_lowercase();
                        if text_lower.contains("responsibilit")
                            || text_lower.contains("requirement")
                            || text_lower.contains("qualification")
                            || text_lower.contains("experience")
                            || text_lower.contains("skill")
                            || text_lower.contains("about")
                            || text_lower.contains("role")
                            || text_lower.len() > 200
                        // Long text is likely description
                        {
                            job.description = Some(text);
                            break;
                        }
                    }
                }
                if job.description.is_some() {
                    break;
                }
            }
        }

        // Try requirements selectors
        for sel in &req_selectors {
            if let Ok(selector) = Selector::parse(sel) {
                for elem in document.select(&selector) {
                    let text = elem.text().collect::<String>().trim().to_string();
                    if !text.is_empty() && text.len() > 20 {
                        job.requirements = Some(text);
                        break;
                    }
                }
                if job.requirements.is_some() {
                    break;
                }
            }
        }

        // If we still don't have description, try extracting from main/article tags
        if job.description.is_none() {
            let main_selectors = ["main", "article", "div[role='main']"];
            for sel in &main_selectors {
                if let Ok(selector) = Selector::parse(sel) {
                    if let Some(elem) = document.select(&selector).next() {
                        let text = elem.text().collect::<String>().trim().to_string();
                        // Extract meaningful content (skip navigation, headers)
                        let lines: Vec<&str> = text
                            .lines()
                            .map(|l| l.trim())
                            .filter(|l| !l.is_empty() && l.len() > 20)
                            .collect();

                        if lines.len() > 3 {
                            let content = lines.join("\n");
                            if content.len() > 200 {
                                job.description = Some(content);
                                break;
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn extract_generic_details(document: &Html, job: &mut Job) -> Result<()> {
        // Generic fallback: look for common description patterns
        let desc_selectors = [
            "div.job-description",
            "div.description",
            "div[class*='description']",
            "div[class*='content']",
            "article",
            "main",
        ];

        for sel in &desc_selectors {
            if let Ok(selector) = Selector::parse(sel) {
                if let Some(elem) = document.select(&selector).next() {
                    let text = elem.text().collect::<String>().trim().to_string();
                    // Filter out very short or very long text (likely navigation/header)
                    if !text.is_empty() && text.len() > 100 && text.len() < 50000 {
                        // Check if it looks like a job description (has common keywords)
                        let text_lower = text.to_lowercase();
                        if text_lower.contains("responsibilit")
                            || text_lower.contains("requirement")
                            || text_lower.contains("qualification")
                            || text_lower.contains("experience")
                            || text_lower.contains("skill")
                        {
                            job.description = Some(text);
                            break;
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

use crate::db::models::Job;
use crate::scraper::{config, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use reqwest::header;
use scraper::{Html, Selector};
use std::thread;
use std::time::Duration;

pub struct WellfoundScraper;

fn retry_with_backoff<F, T>(mut f: F, max_attempts: u32, delay_secs: u64) -> Result<T>
where
    F: FnMut() -> Result<T>,
{
    let mut last_error = None;
    for attempt in 1..=max_attempts {
        match f() {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_error = Some(e);
                if attempt < max_attempts {
                    let delay = delay_secs * (attempt as u64);
                    eprintln!(
                        "Wellfound scrape attempt {} failed, retrying in {}s...",
                        attempt, delay
                    );
                    thread::sleep(Duration::from_secs(delay));
                }
            }
        }
    }
    Err(last_error.unwrap())
}

fn wrap_with_proxy(url: &str, scraper_config: &config::ScraperConfig) -> String {
    if let Some(api_key) = &scraper_config.scraper_api_key {
        format!(
            "https://api.scraperapi.com/?api_key={}&keep_headers=true&url={}",
            api_key,
            urlencoding::encode(url)
        )
    } else {
        url.to_string()
    }
}

fn build_browser(
    scraper_config: &config::ScraperConfig,
) -> crate::scraper::browser::BrowserScraper {
    use crate::scraper::browser::BrowserScraper;
    let mut browser = BrowserScraper::new().with_timeout(scraper_config.timeout_secs + 10);
    if let Some(cookie_header) = &scraper_config.wellfound_cookie {
        browser = browser.with_cookie_header(cookie_header.clone());
    }
    browser
}

fn parse_wellfound_html(html: &str) -> Result<Vec<Job>> {
    println!("🔍 Parsing Wellfound HTML ({} bytes)...", html.len());

    // Check if HTML is too small (likely Cloudflare challenge or error page)
    if html.len() < 1000 {
        eprintln!(
            "⚠️  Wellfound HTML is too small ({} bytes) - likely blocked or error page",
            html.len()
        );
        // Save for debugging (cross-platform temp directory)
        let temp_dir = std::env::temp_dir();
        let debug_path = temp_dir.join(format!(
            "wellfound_debug_small_{}.html",
            chrono::Utc::now().timestamp()
        ));
        if let Err(e) = std::fs::write(&debug_path, html) {
            eprintln!("⚠️  Could not save debug HTML: {}", e);
        } else {
            println!("💾 Saved small HTML to: {}", debug_path.display());
        }
        // Return empty instead of trying to parse
        return Ok(Vec::new());
    }

    // Save HTML for debugging if no jobs found (cross-platform temp directory)
    if std::env::var("DEBUG_HTML").is_ok() {
        let temp_dir = std::env::temp_dir();
        let debug_path = temp_dir.join(format!(
            "wellfound_debug_{}.html",
            chrono::Utc::now().timestamp()
        ));
        if let Err(e) = std::fs::write(&debug_path, html) {
            eprintln!("⚠️  Could not save debug HTML: {}", e);
        } else {
            println!("💾 Saved debug HTML to: {}", debug_path.display());
        }
    }

    let document = Html::parse_document(html);

    // Updated selectors based on Wellfound's current structure (as of 2024)
    // Wellfound uses React, so we need flexible selectors
    let selectors = [
        // Modern Wellfound structure
        (
            "div[class*='JobCard'], div[class*='job-card'], article[class*='JobCard']",
            "a[class*='job-title'], a[class*='title'], h3 a, h2 a, a[href*='/jobs/']",
            "div[class*='company'], div[class*='Company'], a[class*='company-name'], span[class*='company']",
            "div[class*='location'], span[class*='location'], div[class*='Location']",
        ),
        // Alternative patterns
        (
            "div[data-testid*='job'], div[data-testid*='Job'], li[data-testid*='job']",
            "a[href*='/jobs/'], h3 a, h2 a",
            "div, span, a",
            "div, span",
        ),
        // Wellfound-specific structure: job links with company in sibling div
        // Structure: <div class="mb-1"><a href="/jobs/...">Title</a></div><div class="text-sm"><span>Company • </span><span>Location • Salary</span></div>
        // For this selector, element IS the link, company/location will be extracted manually
        (
            "a[href*='/jobs/'], a[href*='/startup-jobs/'], a[href*='/role/']",
            "a",
            "div, span", // Placeholder - will extract manually
            "div, span", // Placeholder - will extract manually
        ),
        // Original selectors (for backwards compatibility)
        (
            "div.job-listing, div[class*='job-listing']",
            "h3.job-title, h3[class*='job-title'], h2, h3",
            "div.company-name, div[class*='company-name'], div[class*='Company']",
            "div.job-location, div[class*='job-location'], div[class*='location']",
        ),
    ];

    let mut jobs = Vec::new();

    for (job_sel, title_sel, company_sel, location_sel) in &selectors {
        let job_selector = match Selector::parse(job_sel) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let title_selector = match Selector::parse(title_sel) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let company_selector = match Selector::parse(company_sel) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let location_selector = match Selector::parse(location_sel) {
            Ok(s) => s,
            Err(_) => continue,
        };

        let job_elements: Vec<_> = document.select(&job_selector).collect();
        println!(
            "   Found {} potential job elements with selector: {}",
            job_elements.len(),
            job_sel
        );

        // Debug: If we're looking for job links and found 0, try a simpler selector
        if job_elements.is_empty()
            && (job_sel.contains("/jobs/")
                || job_sel.contains("/startup-jobs/")
                || job_sel.contains("/role/"))
        {
            // Try more specific selector for job links using ^= (starts with) instead of *= (contains)
            if let Ok(link_sel) =
                Selector::parse("a[href^='/jobs/'], a[href^='/startup-jobs/'], a[href^='/role/']")
            {
                let simple_links: Vec<_> = document.select(&link_sel).collect();
                println!(
                    "   🔍 Debug: Found {} links with simpler selector a[href^='/jobs/']",
                    simple_links.len()
                );
                if !simple_links.is_empty() {
                    // Use the simpler selector's results
                    return Ok(parse_job_links_from_elements(&simple_links, &document)?);
                }
            }
        }

        for element in job_elements {
            // Try to find title/link first
            let mut title = String::new();
            let mut url = String::new();
            let mut company = String::new();
            let mut location = String::new();

            // Special handling for Wellfound structure when element is a job link
            if element.value().name() == "a" {
                // Extract title from link text
                title = element.text().collect::<String>().trim().to_string();

                // Get URL from href
                if let Some(href) = element.value().attr("href") {
                    url = if href.starts_with("http") {
                        href.to_string()
                    } else {
                        format!("https://wellfound.com{}", href)
                    };
                }

                // Wellfound structure: job link is in div.mb-1, company is in next sibling div.text-sm > span
                // The link structure is: <div class="mb-1"><a>Title</a></div><div class="text-sm"><span>Company • </span><span>Location • Salary</span></div>
                // We need to find the sibling div.text-sm in the same parent container
                // Since we can't easily traverse siblings with scraper, find all text-sm divs and match by proximity
                let text_sm_selector = Selector::parse("div.text-sm, div[class*='text-sm']").ok();
                if let Some(ref text_sm_sel) = text_sm_selector {
                    // Find all text-sm divs and check if they're near our link
                    let all_text_sm: Vec<_> = document.select(text_sm_sel).collect();
                    for text_div in all_text_sm {
                        // Company is usually in the first span before " • "
                        let full_text = text_div.text().collect::<String>();
                        if full_text.contains(" • ") {
                            // This looks like the right div - parse company and location
                            if let Some(bullet_pos) = full_text.find(" • ") {
                                let company_part = full_text[..bullet_pos].trim();
                                // Company is in first span before bullet
                                if !company_part.is_empty() {
                                    company = company_part.to_string();

                                    // Location/salary is in the rest (after first " • ")
                                    // " • " is 5 bytes: space (1) + bullet '•' (3) + space (1)
                                    let after_bullet = &full_text[bullet_pos + 5..];
                                    if let Some(second_bullet) = after_bullet.find(" • ") {
                                        // Extract location (part after first bullet, before second bullet)
                                        let location_part = after_bullet[..second_bullet].trim();
                                        if !location_part.is_empty() {
                                            location = location_part.to_string();
                                        }
                                    }
                                }
                                break; // Found it, stop searching
                            }
                        }
                    }
                }
            } else {
                // Original logic for non-link elements
                // Try title selector
                if let Some(title_elem) = element.select(&title_selector).next() {
                    title = title_elem.text().collect::<String>().trim().to_string();
                    // Get URL from title element if it's a link
                    if let Some(href) = title_elem.value().attr("href") {
                        url = if href.starts_with("http") {
                            href.to_string()
                        } else {
                            format!("https://wellfound.com{}", href)
                        };
                    }
                }

                // If title is still empty, try finding any link in the element
                if title.is_empty() {
                    if let Some(link_elem) = element.select(&Selector::parse("a").unwrap()).next() {
                        title = link_elem.text().collect::<String>().trim().to_string();
                        if let Some(href) = link_elem.value().attr("href") {
                            url = if href.starts_with("http") {
                                href.to_string()
                            } else {
                                format!("https://wellfound.com{}", href)
                            };
                        }
                    }
                }

                // Try company selector
                if let Some(company_elem) = element.select(&company_selector).next() {
                    company = company_elem.text().collect::<String>().trim().to_string();
                }

                // Try location selector
                if let Some(location_elem) = element.select(&location_selector).next() {
                    location = location_elem.text().collect::<String>().trim().to_string();
                }
            }

            // Skip if no title found
            if title.is_empty() || title.len() < 3 {
                continue;
            }

            // Filter out category/listing pages - these aren't actual job postings
            let title_lower = title.to_lowercase();
            if title_lower.contains("view all")
                || title_lower.contains("jobs at")
                || title_lower.contains("jobs in")
                || title_lower.starts_with("remote ") && title_lower.contains(" jobs")
                || title_lower.ends_with(" jobs")
            {
                continue; // Skip category/listing pages
            }

            // Clean up company (remove "• " if present)
            company = company.trim().trim_end_matches(" •").trim().to_string();

            // If company still empty, try finding it nearby
            if company.is_empty() {
                // Look for company in parent or siblings
                if let Ok(parent_sel) = Selector::parse("div, span") {
                    for sibling in element.select(&parent_sel).take(10) {
                        let text = sibling.text().collect::<String>().trim().to_string();
                        // Heuristic: company names are usually shorter and don't contain common job words
                        if !text.is_empty()
                            && text.len() < 50
                            && !text.to_lowercase().contains("remote")
                            && !text.to_lowercase().contains("full-time")
                            && !text.to_lowercase().contains("contract")
                            && !text.to_lowercase().contains("engineer")
                            && !text.contains(" • ")
                        {
                            company = text;
                            break;
                        }
                    }
                }
            }

            // Default company if still empty
            if company.is_empty() {
                company = "Unknown Company".to_string();
            }

            // Get URL if not found yet
            if url.is_empty() {
                if let Some(link_elem) = element
                    .select(
                        &Selector::parse(
                            "a[href*='/jobs/'], a[href*='/startup-jobs/'], a[href*='/role/']",
                        )
                        .unwrap(),
                    )
                    .next()
                {
                    if let Some(href) = link_elem.value().attr("href") {
                        url = if href.starts_with("http") {
                            href.to_string()
                        } else {
                            format!("https://wellfound.com{}", href)
                        };
                    }
                }
            }

            // Filter out category/listing page URLs - these aren't actual job postings
            if !url.is_empty() {
                let url_lower = url.to_lowercase();
                // Skip URLs that are category/listing pages
                if url_lower.contains("/role/l/")  // Category pages like /role/l/software-engineer/san-francisco
                    || url_lower.contains("/jobs?")  // Search/listing pages
                    || url_lower.contains("/startup-jobs?")  // Search pages
                    || url_lower.ends_with("/jobs")  // Category pages
                    || url_lower.ends_with("/startup-jobs")
                // Category pages
                {
                    continue; // Skip this - it's not an actual job posting
                }
            }

            // Default URL if still empty - but only if we have a valid job
            if url.is_empty() {
                // Don't create a search URL - if we can't find the job URL, skip it
                continue;
            }

            // Clean up location (remove salary part if present)
            if location.contains("$") || location.contains("₹") {
                // Location might include salary, try to extract just location
                if let Some(salary_marker) = location.find("$").or_else(|| location.find("₹")) {
                    location = location[..salary_marker]
                        .trim()
                        .trim_end_matches(" •")
                        .trim()
                        .to_string();
                }
            }

            let job = Job {
                id: None,
                title,
                company,
                url,
                description: None,
                requirements: None,
                location: if location.is_empty() {
                    None
                } else {
                    Some(location)
                },
                salary: None,
                source: crate::scraper::source_normalizer::normalize_source_name("Wellfound"),
                status: crate::db::models::JobStatus::Saved,
                match_score: None,
                created_at: None,
                updated_at: None,
                        ..Default::default()
        };

            jobs.push(job);
        }

        if !jobs.is_empty() {
            println!("   ✅ Found {} jobs with selector: {}", jobs.len(), job_sel);
            break; // Found jobs with this selector pattern
        } else {
            println!("   ⚠️  No jobs found with selector: {}", job_sel);
        }
    }

    Ok(jobs)
}

/// Helper function to parse job links when found directly
fn parse_job_links_from_elements(
    link_elements: &[scraper::element_ref::ElementRef],
    document: &Html,
) -> Result<Vec<Job>> {
    let mut jobs = Vec::new();

    // Find all text-sm divs that contain company/location info
    let text_sm_selector = Selector::parse("div.text-sm, div[class*='text-sm']").ok();
    let all_text_sm: Vec<_> = text_sm_selector
        .as_ref()
        .map(|sel| document.select(sel).collect::<Vec<_>>())
        .unwrap_or_default();

    for (idx, link_elem) in link_elements.iter().enumerate() {
        let title = link_elem.text().collect::<String>().trim().to_string();
        if title.is_empty() || title.len() < 3 {
            continue;
        }

        // Filter out category/listing pages - these aren't actual job postings
        let title_lower = title.to_lowercase();
        if title_lower.contains("view all")
            || title_lower.contains("jobs at")
            || title_lower.contains("jobs in")
            || title_lower.starts_with("remote ") && title_lower.contains(" jobs")
            || title_lower.ends_with(" jobs")
        {
            continue; // Skip category/listing pages
        }

        let url = link_elem.value().attr("href").map(|href| {
            if href.starts_with("http") {
                href.to_string()
            } else {
                format!("https://wellfound.com{}", href)
            }
        });

        // Filter out category/listing page URLs
        if let Some(ref url_str) = url {
            let url_lower = url_str.to_lowercase();
            // Skip URLs that are category/listing pages
            if url_lower.contains("/role/l/")  // Category pages
                || url_lower.contains("/jobs?")  // Search/listing pages
                || url_lower.contains("/startup-jobs?")  // Search pages
                || url_lower.ends_with("/jobs")  // Category pages
                || url_lower.ends_with("/startup-jobs")
            // Category pages
            {
                continue; // Skip this - it's not an actual job posting
            }
        }

        // If no valid URL found, skip this job
        let url = match url {
            Some(u) if !u.is_empty() => u,
            _ => continue, // Skip jobs without valid URLs
        };

        // Try to find corresponding company/location from nearby text-sm divs
        // The structure is: <div class="mb-1"><a>Title</a></div><div class="text-sm"><span>Company • </span><span>Location</span></div>
        let mut company = String::new();
        let mut location = String::new();

        // Try to find the text-sm div that follows this link
        // Since we can't easily traverse siblings, match by proximity (use index)
        if idx < all_text_sm.len() {
            let text_div = &all_text_sm[idx];
            let full_text = text_div.text().collect::<String>();
            if full_text.contains(" • ") {
                if let Some(bullet_pos) = full_text.find(" • ") {
                    company = full_text[..bullet_pos].trim().to_string();

                    // Location is after first bullet, before second bullet (if exists)
                    // " • " is 5 bytes: space (1) + bullet '•' (3) + space (1)
                    let after_bullet = &full_text[bullet_pos + 5..];
                    if let Some(second_bullet) = after_bullet.find(" • ") {
                        location = after_bullet[..second_bullet].trim().to_string();
                    } else {
                        // Just take what's after the bullet (may include salary, but that's ok)
                        location = after_bullet.trim().to_string();
                    }
                }
            }
        }

        // Clean up company
        company = company.trim().trim_end_matches(" •").trim().to_string();
        if company.is_empty() {
            company = "Unknown Company".to_string();
        }

        // Clean up location (remove salary part if present)
        if location.contains("$") || location.contains("₹") {
            if let Some(salary_marker) = location.find("$").or_else(|| location.find("₹")) {
                location = location[..salary_marker]
                    .trim()
                    .trim_end_matches(" •")
                    .trim()
                    .to_string();
            }
        }

        jobs.push(Job {
            id: None,
            title,
            company,
            url,
            description: None,
            requirements: None,
            location: if location.is_empty() {
                None
            } else {
                Some(location)
            },
            salary: None,
            source: "Wellfound".to_string(),
            status: crate::db::models::JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        });
    }

    Ok(jobs)
}

impl JobScraper for WellfoundScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &config::ScraperConfig::default())
    }

    fn scrape_with_config(
        &self,
        query: &str,
        scraper_config: &config::ScraperConfig,
    ) -> Result<Vec<Job>> {
        let url = format!(
            "https://wellfound.com/jobs?query={}",
            urlencoding::encode(query)
        );

        // Try Firecrawl first if available
        if scraper_config.use_firecrawl {
            if let Some(api_key) = &scraper_config.firecrawl_api_key {
                match self.scrape_with_firecrawl(&url, api_key, scraper_config) {
                    Ok(jobs) if !jobs.is_empty() => {
                        println!(
                            "Wellfound: Successfully scraped {} jobs using Firecrawl",
                            jobs.len()
                        );
                        return Ok(jobs);
                    }
                    Ok(_) => {
                        eprintln!("Wellfound: Firecrawl returned no jobs, falling back to browser automation");
                    }
                    Err(e) => {
                        eprintln!(
                            "Wellfound: Firecrawl failed: {}, falling back to browser automation",
                            e
                        );
                    }
                }
            }
        }

        // Try browser automation (crawl4ai, Playwright, or Chromium) if available
        if scraper_config.use_browser_automation {
            use crate::scraper::browser::BrowserScraper;

            // Try crawl4ai first (no API key needed, AI-powered)
            if BrowserScraper::is_crawl4ai_available() {
                println!("🌐 Wellfound: Using crawl4ai (no API key required)...");
                match BrowserScraper::with_crawl4ai()
                    .with_timeout(scraper_config.timeout_secs)
                    .scrape(&url)
                {
                    Ok(html) => {
                        println!("   crawl4ai returned {} bytes of HTML", html.len());
                        match parse_wellfound_html(&html) {
                            Ok(jobs) if !jobs.is_empty() => {
                                println!(
                                    "✅ Wellfound: Successfully scraped {} jobs using crawl4ai",
                                    jobs.len()
                                );
                                return Ok(jobs);
                            }
                            Ok(_) => {
                                eprintln!("⚠️  Wellfound: crawl4ai returned HTML but no jobs found, trying other methods");
                            }
                            Err(e) => {
                                eprintln!("⚠️  Wellfound: Failed to parse crawl4ai HTML: {}, trying other methods", e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!(
                            "⚠️  Wellfound: crawl4ai failed: {}, trying Playwright/Chrome",
                            e
                        );
                    }
                }
            }

            // Fallback to Playwright or Chromium
            if BrowserScraper::is_playwright_available() || BrowserScraper::is_chromium_available()
            {
                println!("🌐 Wellfound: Using browser automation (Playwright/Chrome)...");
                let html = if BrowserScraper::is_playwright_available() {
                    println!("   Using Playwright for better stealth...");
                    build_browser(scraper_config).scrape(&url)?
                } else {
                    println!("   Using headless Chrome...");
                    build_browser(scraper_config).scrape(&url)?
                };
                println!(
                    "   Browser automation returned {} bytes of HTML",
                    html.len()
                );

                // Check if HTML is suspiciously small - might need to retry with longer wait
                if html.len() < 1000 {
                    eprintln!("⚠️  Wellfound: HTML too small ({} bytes) - likely Cloudflare challenge or blocked", html.len());
                    // Return empty instead of trying to parse
                    return Ok(Vec::new());
                }

                match parse_wellfound_html(&html) {
                    Ok(jobs) if !jobs.is_empty() => {
                        println!(
                            "✅ Wellfound: Successfully scraped {} jobs using browser automation",
                            jobs.len()
                        );
                        return Ok(jobs);
                    }
                    Ok(_) => {
                        eprintln!("⚠️  Wellfound: Browser automation returned HTML but no jobs found (HTML size: {} bytes)", html.len());
                    }
                    Err(e) => {
                        eprintln!("⚠️  Wellfound: Failed to parse browser HTML: {}", e);
                    }
                }
            }
        }

        // Fallback to direct HTTP scraping with retry
        match retry_with_backoff(
            || {
                let client = Client::builder()
                    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .timeout(Duration::from_secs(scraper_config.timeout_secs))
                    .build()?;

                let target_url = wrap_with_proxy(&url, scraper_config);
                let mut request = client.get(&target_url);
                if let Some(cookie_header) = &scraper_config.wellfound_cookie {
                    request = request.header(header::COOKIE, cookie_header);
                }

                let response = request
                    .send()
                    .context("Failed to send request to Wellfound")?
                    .text()
                    .context("Failed to read response from Wellfound")?;

                // Check if HTML is too small before parsing
                if response.len() < 1000 {
                    return Err(anyhow::anyhow!(
                        "HTML too small ({} bytes) - likely blocked",
                        response.len()
                    ));
                }

                parse_wellfound_html(&response)
            },
            scraper_config.retry_attempts,
            scraper_config.retry_delay_secs,
        ) {
            Ok(jobs) if !jobs.is_empty() => Ok(jobs),
            Ok(_) => {
                // HTTP succeeded but no jobs found - try browser automation if available
                if !scraper_config.use_browser_automation {
                    use crate::scraper::browser::BrowserScraper;
                    if BrowserScraper::is_playwright_available()
                        || BrowserScraper::is_chromium_available()
                    {
                        println!(
                            "🌐 Wellfound: HTTP returned no jobs, trying browser automation..."
                        );
                        let html = if BrowserScraper::is_playwright_available() {
                            build_browser(scraper_config).scrape(&url)?
                        } else {
                            build_browser(scraper_config).scrape(&url)?
                        };

                        if html.len() >= 1000 {
                            parse_wellfound_html(&html)
                        } else {
                            Ok(Vec::new())
                        }
                    } else {
                        Ok(Vec::new())
                    }
                } else {
                    Ok(Vec::new())
                }
            }
            Err(e) => {
                // HTTP failed - try browser automation as last resort if not already tried
                if !scraper_config.use_browser_automation {
                    use crate::scraper::browser::BrowserScraper;
                    if BrowserScraper::is_playwright_available()
                        || BrowserScraper::is_chromium_available()
                    {
                        println!("🌐 Wellfound: HTTP failed ({}), trying browser automation as fallback...", e);
                        let html = if BrowserScraper::is_playwright_available() {
                            build_browser(scraper_config).scrape(&url)?
                        } else {
                            build_browser(scraper_config).scrape(&url)?
                        };

                        if html.len() >= 1000 {
                            parse_wellfound_html(&html)
                        } else {
                            Err(anyhow::anyhow!(
                                "Browser automation also returned small HTML ({} bytes)",
                                html.len()
                            ))
                        }
                    } else {
                        Err(e)
                    }
                } else {
                    Err(e)
                }
            }
        }
    }
}

impl WellfoundScraper {
    fn scrape_with_firecrawl(
        &self,
        url: &str,
        api_key: &str,
        scraper_config: &config::ScraperConfig,
    ) -> Result<Vec<Job>> {
        let firecrawl_client = crate::scraper::firecrawl::FirecrawlClient::new(api_key.to_string());

        let html = retry_with_backoff(
            || {
                firecrawl_client
                    .scrape_html(url)
                    .context("Firecrawl failed to scrape Wellfound")
            },
            scraper_config.retry_attempts,
            scraper_config.retry_delay_secs,
        )?;

        parse_wellfound_html(&html)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wellfound_scraper() {
        // Test the HTML parsing logic directly
        use scraper::{Html, Selector};

        let html_content = include_str!("../../test/fixtures/wellfound_search.html");
        let document = Html::parse_document(html_content);

        let job_selector = Selector::parse("div.job-listing").unwrap();
        let title_selector = Selector::parse("h3.job-title").unwrap();
        let company_selector = Selector::parse("div.company-name").unwrap();

        println!("Testing Wellfound HTML parsing...");
        println!("HTML length: {}", html_content.len());
        println!(
            "Found {} job elements",
            document.select(&job_selector).count()
        );
        println!(
            "Found {} title elements",
            document.select(&title_selector).count()
        );
        println!(
            "Found {} company elements",
            document.select(&company_selector).count()
        );

        // Test parsing one job element
        let mut jobs = Vec::new();
        for element in document.select(&job_selector) {
            let title_elem = element.select(&title_selector).next();
            let company_elem = element.select(&company_selector).next();

            if let (Some(title_elem), Some(company_elem)) = (title_elem, company_elem) {
                let title = title_elem.text().collect::<String>().trim().to_string();
                let company = company_elem.text().collect::<String>().trim().to_string();

                println!("Parsed job: {} at {}", title, company);
                jobs.push(title);
            }
        }

        assert!(
            !jobs.is_empty(),
            "Should find at least one job in test fixture"
        );
        assert_eq!(jobs[0], "Frontend Developer");
    }
}

use crate::db::models::Job;
use crate::scraper::{JobScraper, config, browser};
use anyhow::{Result, Context};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::time::Duration;
use std::thread;

pub struct LinkedInScraper;

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
                    eprintln!("LinkedIn scrape attempt {} failed, retrying in {}s...", attempt, delay);
                    thread::sleep(Duration::from_secs(delay));
                }
            }
        }
    }
    Err(last_error.unwrap())
}

fn parse_linkedin_html(html: &str) -> Result<Vec<Job>> {
    let document = Html::parse_document(html);
    
    // Try multiple selector patterns (LinkedIn changes their HTML structure frequently)
    let selectors = [
        ("div.base-card", "h3.base-search-card__title", "h4.base-search-card__subtitle", "span.job-search-card__location"),
        ("li.jobs-search-results__list-item", "h3.base-search-card__title", "h4.base-search-card__subtitle", "span.job-search-card__location"),
        ("div.job-result-card", "h3.job-result-card__title", "h4.job-result-card__subtitle", "span.job-result-card__location"),
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
        
        for element in document.select(&job_selector) {
            if let (Some(title_elem), Some(company_elem)) = (
                element.select(&title_selector).next(),
                element.select(&company_selector).next(),
            ) {
                let title = title_elem.text().collect::<String>().trim().to_string();
                if title.is_empty() {
                    continue;
                }
                
                let url = element
                    .select(&Selector::parse("a").unwrap())
                    .next()
                    .and_then(|a| a.value().attr("href"))
                    .map(|href| {
                        if href.starts_with("http") {
                            href.to_string()
                        } else {
                            format!("https://www.linkedin.com{}", href)
                        }
                    })
                    .unwrap_or_default();
                    
                let company = company_elem.text().collect::<String>().trim().to_string();
                
                let location = element
                    .select(&location_selector)
                    .next()
                    .map(|e| e.text().collect::<String>().trim().to_string())
                    .unwrap_or_default();
                
                let job_url = if url.is_empty() { 
                    format!("https://www.linkedin.com/jobs/search/?keywords={}", urlencoding::encode(&title))
                } else { 
                    url 
                };
                
                let job = Job {
                    id: None,
                    title,
                    company,
                    url: job_url,
                    description: None,
                    requirements: None,
                    location: if location.is_empty() { None } else { Some(location) },
                    salary: None,
                    source: "LinkedIn".to_string(),
                    status: crate::db::models::JobStatus::Saved,
                    match_score: None,
                    created_at: None,
                    updated_at: None,
                };
                
                jobs.push(job);
            }
        }
        
        if !jobs.is_empty() {
            break; // Found jobs with this selector pattern
        }
    }
    
    Ok(jobs)
}

impl JobScraper for LinkedInScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &config::ScraperConfig::default())
    }
    
    fn scrape_with_config(&self, query: &str, scraper_config: &config::ScraperConfig) -> Result<Vec<Job>> {
        // ⚠️ WARNING: LinkedIn scraping is high-risk and disabled by default.
        // LinkedIn actively detects and bans automated scraping, which can result in:
        // - Account bans (permanent)
        // - IP blocking
        // - Legal issues (violates ToS)
        // Recommendation: Use hh.kz and Wellfound instead, or enable only with
        // browser automation, 30+ second delays, and very infrequent scraping.
        if !scraper_config.linkedin_enabled {
            eprintln!("⚠️  LinkedIn scraping is disabled by default due to high risk of account/IP banning.");
            eprintln!("   To enable, set linkedin_enabled=true in scraper config.");
            return Ok(vec![]); // Return empty results instead of failing
        }

        let url = format!(
            "https://www.linkedin.com/jobs/search/?keywords={}&location=Worldwide&sortBy=DD",
            urlencoding::encode(query)
        );

        // Add conservative delay for LinkedIn (mimics human behavior)
        let delay = {
            use rand::Rng;
            let mut rng = rand::thread_rng();
            rng.gen_range(scraper_config.linkedin_min_delay_secs..=scraper_config.linkedin_max_delay_secs)
        };
        eprintln!("⏳ Waiting {} seconds before LinkedIn request (anti-detection)...", delay);
        thread::sleep(Duration::from_secs(delay));
        
        // Try browser automation first (Playwright/Chrome) - most reliable
        if scraper_config.use_browser_automation {
            if browser::BrowserScraper::is_playwright_available() || browser::BrowserScraper::is_chromium_available() {
                match self.scrape_with_browser(&url, scraper_config) {
                    Ok(jobs) if !jobs.is_empty() => {
                        println!("LinkedIn: Successfully scraped {} jobs using browser automation", jobs.len());
                        return Ok(jobs);
                    }
                    Ok(_) => {
                        eprintln!("LinkedIn: Browser automation returned no jobs, falling back...");
                    }
                    Err(e) => {
                        eprintln!("LinkedIn: Browser automation failed: {}, falling back...", e);
                    }
                }
            }
        }
        
        // Try Firecrawl if available
        if scraper_config.use_firecrawl {
            if let Some(api_key) = &scraper_config.firecrawl_api_key {
                match self.scrape_with_firecrawl(&url, api_key, scraper_config) {
                    Ok(jobs) if !jobs.is_empty() => {
                        println!("LinkedIn: Successfully scraped {} jobs using Firecrawl", jobs.len());
                        return Ok(jobs);
                    }
                    Ok(_) => {
                        eprintln!("LinkedIn: Firecrawl returned no jobs, falling back to direct scraping");
                    }
                    Err(e) => {
                        eprintln!("LinkedIn: Firecrawl failed: {}, falling back to direct scraping", e);
                    }
                }
            }
        }
        
        // ⚠️ Direct scraping is very risky for LinkedIn - likely to fail or get blocked
        eprintln!("⚠️  WARNING: Using direct HTTP scraping for LinkedIn - this is highly likely to fail or trigger anti-bot measures!");
        
        // Fallback to direct scraping with retry (but this will likely fail)
        retry_with_backoff(
            || {
                let client = Client::builder()
                    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .timeout(Duration::from_secs(scraper_config.timeout_secs))
                    .build()?;
                
                let response = client
                    .get(&url)
                    .send()
                    .context("Failed to send request to LinkedIn - likely blocked or requires authentication")?
                    .text()
                    .context("Failed to read response from LinkedIn")?;
                
                parse_linkedin_html(&response)
            },
            scraper_config.retry_attempts,
            scraper_config.retry_delay_secs,
        )
    }
}

impl LinkedInScraper {
    fn scrape_with_browser(&self, url: &str, scraper_config: &config::ScraperConfig) -> Result<Vec<Job>> {
        let browser_scraper = crate::scraper::browser::BrowserScraper::new()
            .with_timeout(scraper_config.timeout_secs);
        
        let html = browser_scraper.scrape_with_delays(
            url,
            scraper_config.linkedin_min_delay_secs,
            scraper_config.linkedin_max_delay_secs,
        )
        .context("Browser automation failed to scrape LinkedIn")?;
        
        parse_linkedin_html(&html)
    }

    fn scrape_with_firecrawl(&self, url: &str, api_key: &str, scraper_config: &config::ScraperConfig) -> Result<Vec<Job>> {
        let firecrawl_client = crate::scraper::firecrawl::FirecrawlClient::new(api_key.to_string());
        
        let html = retry_with_backoff(
            || {
                firecrawl_client.scrape_html(url)
                    .context("Firecrawl failed to scrape LinkedIn")
            },
            scraper_config.retry_attempts,
            scraper_config.retry_delay_secs,
        )?;
        
        parse_linkedin_html(&html)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_linkedin_scraper() {
        // Test the HTML parsing logic directly
        use scraper::{Html, Selector};

        let html_content = include_str!("../../test/fixtures/linkedin_search.html");
        let document = Html::parse_document(html_content);

        let job_selector = Selector::parse("div.base-card").unwrap();
        let title_selector = Selector::parse("h3.base-search-card__title").unwrap();
        let company_selector = Selector::parse("h4.base-search-card__subtitle").unwrap();

        println!("Testing LinkedIn HTML parsing...");
        println!("HTML length: {}", html_content.len());
        println!("Found {} job elements", document.select(&job_selector).count());
        println!("Found {} title elements", document.select(&title_selector).count());
        println!("Found {} company elements", document.select(&company_selector).count());

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

        assert!(!jobs.is_empty(), "Should find at least one job in test fixture");
        assert_eq!(jobs[0], "Frontend Developer");
    }
}

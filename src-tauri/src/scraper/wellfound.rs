use crate::db::models::Job;
use crate::scraper::{JobScraper, config};
use anyhow::{Result, Context};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::time::Duration;
use std::thread;

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
                    eprintln!("Wellfound scrape attempt {} failed, retrying in {}s...", attempt, delay);
                    thread::sleep(Duration::from_secs(delay));
                }
            }
        }
    }
    Err(last_error.unwrap())
}

fn parse_wellfound_html(html: &str) -> Result<Vec<Job>> {
    let document = Html::parse_document(html);
    
    // Try multiple selector patterns (Wellfound/AngelList structure)
    let selectors = [
        ("div.job-listing", "h3.job-title", "div.company-name", "div.job-location"),
        ("div[data-test='JobListing']", "h3", "div[data-test='CompanyName']", "div[data-test='JobLocation']"),
        ("li[data-test='JobCard']", "h3", "div", "span"),
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
                            format!("https://wellfound.com{}", href)
                        }
                    })
                    .unwrap_or_else(|| format!("https://wellfound.com/jobs?query={}", urlencoding::encode(&title)));
                
                let company = company_elem.text().collect::<String>().trim().to_string();
                
                let location = element
                    .select(&location_selector)
                    .next()
                    .map(|e| e.text().collect::<String>().trim().to_string())
                    .unwrap_or_default();
                
                let job = Job {
                    id: None,
                    title,
                    company,
                    url,
                    description: None,
                    requirements: None,
                    location: if location.is_empty() { None } else { Some(location) },
                    salary: None,
                    source: "Wellfound".to_string(),
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

impl JobScraper for WellfoundScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &config::ScraperConfig::default())
    }
    
    fn scrape_with_config(&self, query: &str, scraper_config: &config::ScraperConfig) -> Result<Vec<Job>> {
        let url = format!("https://wellfound.com/jobs?query={}", urlencoding::encode(query));
        
        // Try Firecrawl first if available
        if scraper_config.use_firecrawl {
            if let Some(api_key) = &scraper_config.firecrawl_api_key {
                match self.scrape_with_firecrawl(&url, api_key, scraper_config) {
                    Ok(jobs) if !jobs.is_empty() => {
                        println!("Wellfound: Successfully scraped {} jobs using Firecrawl", jobs.len());
                        return Ok(jobs);
                    }
                    Ok(_) => {
                        eprintln!("Wellfound: Firecrawl returned no jobs, falling back to direct scraping");
                    }
                    Err(e) => {
                        eprintln!("Wellfound: Firecrawl failed: {}, falling back to direct scraping", e);
                    }
                }
            }
        }
        
        // Fallback to direct scraping with retry
        retry_with_backoff(
            || {
                let client = Client::builder()
                    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .timeout(Duration::from_secs(scraper_config.timeout_secs))
                    .build()?;
                
                let response = client
                    .get(&url)
                    .send()
                    .context("Failed to send request to Wellfound")?
                    .text()
                    .context("Failed to read response from Wellfound")?;
                
                parse_wellfound_html(&response)
            },
            scraper_config.retry_attempts,
            scraper_config.retry_delay_secs,
        )
    }
}

impl WellfoundScraper {
    fn scrape_with_firecrawl(&self, url: &str, api_key: &str, scraper_config: &config::ScraperConfig) -> Result<Vec<Job>> {
        let firecrawl_client = crate::scraper::firecrawl::FirecrawlClient::new(api_key.to_string());
        
        let html = retry_with_backoff(
            || {
                firecrawl_client.scrape_html(url)
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

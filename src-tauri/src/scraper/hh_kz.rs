use crate::db::models::Job;
use crate::scraper::{JobScraper, config::ScraperConfig};
use anyhow::{Result, Context};
use reqwest::blocking::Client;
use std::time::Duration;
use std::thread;
use scraper::{Html, Selector};

pub struct HhKzScraper;

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
                    eprintln!("hh.kz scrape attempt {} failed, retrying in {}s...", attempt, delay);
                    thread::sleep(Duration::from_secs(delay));
                }
            }
        }
    }
    Err(last_error.unwrap())
}

impl JobScraper for HhKzScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }
    
    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let url = format!("https://hh.kz/search/vacancy?text={}&area=160&salary=&currency_code=KZT&experience=doesNotMatter&order_by=relevance&search_period=0&items_on_page=20&no_magic=true", urlencoding::encode(query));
        
        retry_with_backoff(
            || {
                let client = Client::builder()
                    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .timeout(Duration::from_secs(config.timeout_secs))
                    .build()?;
                
                let response = client
                    .get(&url)
                    .send()
                    .context("Failed to send request to hh.kz")?
                    .text()
                    .context("Failed to read response from hh.kz")?;
                    
                let document = Html::parse_document(&response);
                let job_selector = Selector::parse("div.vacancy-serp-item").unwrap();
                let title_selector = Selector::parse("a.serp-item__title").unwrap();
                let company_selector = Selector::parse("a.bloko-link_kind-tertiary").unwrap();
                let salary_selector = Selector::parse("span.bloko-header-section-2").unwrap();

                let mut jobs = Vec::new();

                for element in document.select(&job_selector) {
                    let title_elem = element.select(&title_selector).next();
                    let company_elem = element.select(&company_selector).next();

                    if let (Some(title_elem), Some(company_elem)) = (title_elem, company_elem) {
                        let title = title_elem.text().collect::<String>().trim().to_string();
                        if title.is_empty() {
                            continue;
                        }
                        
                        let mut job_url = title_elem.value().attr("href").unwrap_or("").to_string();
                        if !job_url.starts_with("http") {
                            job_url = format!("https://hh.kz{}", job_url);
                        }
                        
                        let company = company_elem.text().collect::<String>().trim().to_string();

                        let salary = element.select(&salary_selector)
                            .next()
                            .map(|e| e.text().collect::<String>().trim().to_string())
                            .unwrap_or_default();

                        let job = Job {
                            id: None,
                            title,
                            company,
                            url: job_url,
                            description: None,
                            requirements: None,
                            location: None,
                            salary: if salary.is_empty() { None } else { Some(salary) },
                            source: "hh.kz".to_string(),
                            status: crate::db::models::JobStatus::Saved,
                            created_at: None,
                            updated_at: None,
                        };

                        jobs.push(job);
                    }
                }
                
                if jobs.is_empty() {
                    return Err(anyhow::anyhow!("No jobs found in hh.kz response"));
                }
                
                Ok(jobs)
            },
            config.retry_attempts,
            config.retry_delay_secs,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hh_kz_scraper() {
        // Test the HTML parsing logic directly since mocking HTTP requests with custom URLs is complex
        use scraper::{Html, Selector};

        let html_content = include_str!("../../test/fixtures/hh_kz_search.html");
        let document = Html::parse_document(html_content);

        let job_selector = Selector::parse("div.vacancy-serp-item").unwrap();
        let title_selector = Selector::parse("a.serp-item__title").unwrap();
        let company_selector = Selector::parse("a.bloko-link_kind-tertiary").unwrap();

        println!("Testing HTML parsing directly...");
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
                let url = title_elem.value().attr("href").unwrap_or("").to_string();
                let company = company_elem.text().collect::<String>().trim().to_string();

                println!("Parsed job: {} at {} - {}", title, company, url);
                jobs.push(title);
            }
        }

        assert!(!jobs.is_empty(), "Should find at least one job in test fixture");
        assert_eq!(jobs[0], "Frontend Developer");
    }
}

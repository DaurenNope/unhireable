use crate::db::models::Job;
use anyhow::Result;
use std::time::Duration;
use std::thread;

pub mod browser;
pub mod config;
pub mod firecrawl;
pub mod hh_kz;
pub mod linkedin;
pub mod wellfound;

pub trait JobScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>>;
    fn scrape_with_config(&self, query: &str, _config: &config::ScraperConfig) -> Result<Vec<Job>> {
        // Default implementation falls back to regular scrape
        self.scrape(query)
    }
}

pub struct ScraperManager {
    config: config::ScraperConfig,
}

impl Default for ScraperManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ScraperManager {
    pub fn new() -> Self {
        Self {
            config: config::ScraperConfig::default(),
        }
    }

    pub fn with_config(config: config::ScraperConfig) -> Self {
        Self { config }
    }

    pub fn set_firecrawl_key(&mut self, api_key: String) {
        self.config.firecrawl_api_key = Some(api_key.clone());
        self.config.use_firecrawl = true;
    }

    pub fn scrape_all(&self, query: &str) -> Result<Vec<Job>> {
        let mut all_jobs = Vec::new();
        let mut errors = Vec::new();

        // Scrape from all sources with rate limiting and error handling
        // Scrape hh.kz
        match hh_kz::HhKzScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!("Successfully scraped {} jobs from hh.kz", jobs.len());
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_secs(1));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from hh.kz: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // Scrape LinkedIn (only if enabled - disabled by default due to high risk)
        if self.config.linkedin_enabled {
            match linkedin::LinkedInScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("Successfully scraped {} jobs from LinkedIn", jobs.len());
                    all_jobs.append(&mut jobs);
                    // Longer delay after LinkedIn to avoid detection
                    thread::sleep(Duration::from_secs(5));
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from LinkedIn: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        } else {
            eprintln!("LinkedIn scraping is disabled (high risk of banning). Enable in config if needed.");
        }

        // Scrape Wellfound
        match wellfound::WellfoundScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!("Successfully scraped {} jobs from Wellfound", jobs.len());
                all_jobs.append(&mut jobs);
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Wellfound: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // If no jobs were found and there were errors, return an error
        if all_jobs.is_empty() && !errors.is_empty() {
            return Err(anyhow::anyhow!(
                "Scraping failed for all sources:\n{}",
                errors.join("\n")
            ));
        }

        // If some jobs were found, return them even if some sources failed
        if !all_jobs.is_empty() {
            Ok(all_jobs)
        } else {
            Err(anyhow::anyhow!(
                "No jobs found. This could mean:\n- No jobs match your query\n- All scrapers failed\n- Website structure changed"
            ))
        }
    }

    pub fn scrape_selected(&self, sources: &[String], query: &str) -> Result<Vec<Job>> {
        let mut all_jobs = Vec::new();
        let mut errors = Vec::new();

        let wants = |name: &str| sources.is_empty() || sources.iter().any(|s| s.eq_ignore_ascii_case(name));
        let should_scrape_all = sources.is_empty();

        println!("Scraping selected sources: {:?}, query: '{}'", sources, query);

        // Scrape hh.kz
        if wants("hhkz") || wants("hh.kz") {
            println!("Attempting to scrape hh.kz...");
            match hh_kz::HhKzScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("Successfully scraped {} jobs from hh.kz", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_secs(1));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from hh.kz: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape LinkedIn (only if enabled and requested)
        if wants("linkedin") {
            if self.config.linkedin_enabled {
                println!("Attempting to scrape LinkedIn...");
                match linkedin::LinkedInScraper.scrape_with_config(query, &self.config) {
                    Ok(mut jobs) => {
                        println!("Successfully scraped {} jobs from LinkedIn", jobs.len());
                        all_jobs.append(&mut jobs);
                        // Longer delay after LinkedIn to avoid detection
                        thread::sleep(Duration::from_secs(5));
                    }
                    Err(e) => {
                        let error_msg = format!("Failed to scrape from LinkedIn: {}", e);
                        eprintln!("{}", error_msg);
                        errors.push(error_msg);
                    }
                }
            } else {
                let error_msg = "LinkedIn scraping is disabled (high risk of banning). Enable in config if needed.";
                eprintln!("{}", error_msg);
                errors.push(error_msg.to_string());
            }
        }

        // Scrape Wellfound
        if wants("wellfound") {
            println!("Attempting to scrape Wellfound...");
            match wellfound::WellfoundScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("Successfully scraped {} jobs from Wellfound", jobs.len());
                    all_jobs.append(&mut jobs);
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Wellfound: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        println!("Total jobs scraped: {}, Errors: {}", all_jobs.len(), errors.len());

        // If no jobs were found and there were errors, return an error
        if all_jobs.is_empty() && !errors.is_empty() {
            return Err(anyhow::anyhow!(
                "Scraping failed for all selected sources:\n{}",
                errors.join("\n")
            ));
        }

        // If some jobs were found, return them even if some sources failed
        if !all_jobs.is_empty() {
            Ok(all_jobs)
        } else {
            let error_details = if errors.is_empty() {
                "None".to_string()
            } else {
                errors.join("\n")
            };
            Err(anyhow::anyhow!(
                "No jobs found. This could mean:\n- No jobs match your query '{}'\n- All scrapers failed\n- Website structure changed\n\nErrors: {}",
                query,
                error_details
            ))
        }
    }
}



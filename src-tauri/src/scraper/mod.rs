use crate::db::models::Job;
use crate::scraper::error_handling::{log_scraper_error, log_scraper_success};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use std::thread;
use std::time::Duration;

pub mod adzuna;
pub mod arbeitnow;
pub mod browser;
pub mod config;
pub mod dice;
pub mod error_handling;
pub mod findwork;
pub mod firecrawl;
pub mod glassdoor;
pub mod greenhouse_board;
pub mod hh_kz;
pub mod himalayas;
pub mod indeed;
pub mod job_enricher;
pub mod jobicy;
pub mod jooble;
pub mod lever_greenhouse;
pub mod linkedin;
pub mod remote_co;
pub mod remote_ok;
pub mod remotive;
pub mod source_normalizer;
pub mod stack_overflow;
pub mod themuse;
pub mod wellfound;
pub mod work_at_startup;
pub mod wwr;
pub mod ziprecruiter;

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
    fn should_enrich(job: &Job) -> bool {
        // Indeed blocks detail pages behind Cloudflare. We already keep the snippet,
        // so skip the expensive enrichment attempts to avoid repeated failures.
        if job.source.eq_ignore_ascii_case("indeed") {
            return false;
        }

        job.description
            .as_ref()
            .map(|d| d.trim().is_empty() || d.len() < 50)
            .unwrap_or(true)
    }

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
        self.ensure_network_ready()
            .context("Network connectivity check failed before scraping")?;

        let mut all_jobs = Vec::new();
        let mut errors = Vec::new();

        // Scrape from all sources with rate limiting and error handling
        // Scrape RemoteOK
        match remote_ok::RemoteOkScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                log_scraper_success("RemoteOK", jobs.len());
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                log_scraper_error("RemoteOK", &e, true);
                // Record metrics: scraper errors
                errors.push(format!("RemoteOK: {}", e));
            }
        }

        // Scrape hh.kz
        match hh_kz::HhKzScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!("Successfully scraped {} jobs from hh.kz", jobs.len());
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_secs(1));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from hh.kz: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape LinkedIn (only if enabled - disabled by default due to high risk)
        if self.config.linkedin_enabled {
            match linkedin::LinkedInScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("Successfully scraped {} jobs from LinkedIn", jobs.len());
                    // Record metrics: jobs found
                    all_jobs.append(&mut jobs);
                    // Longer delay after LinkedIn to avoid detection
                    thread::sleep(Duration::from_secs(5));
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from LinkedIn: {}", e);
                    eprintln!("{}", error_msg);
                    // Record metrics: scraper errors
                    errors.push(error_msg);
                }
            }
        } else {
            eprintln!(
                "LinkedIn scraping is disabled (high risk of banning). Enable in config if needed."
            );
        }

        // Scrape Indeed (enable browser automation if available for 403 bypass)
        let mut indeed_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            indeed_config.use_browser_automation = true;
        }
        match indeed::IndeedScraper.scrape_with_config(query, &indeed_config) {
            Ok(mut jobs) => {
                println!("✅ Successfully scraped {} jobs from Indeed", jobs.len());
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Indeed: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape Wellfound (enable browser automation if available)
        let mut wellfound_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            wellfound_config.use_browser_automation = true;
        }
        match wellfound::WellfoundScraper.scrape_with_config(query, &wellfound_config) {
            Ok(mut jobs) => {
                println!("✅ Successfully scraped {} jobs from Wellfound", jobs.len());
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Wellfound: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape Remotive
        match remotive::RemotiveScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!("Successfully scraped {} jobs from Remotive", jobs.len());
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Remotive: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape Greenhouse
        match greenhouse_board::GreenhouseBoardScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!("Successfully scraped {} jobs from Greenhouse", jobs.len());
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Greenhouse: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape WorkAtAStartup
        match work_at_startup::WorkAtStartupScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!(
                    "Successfully scraped {} jobs from WorkAtAStartup",
                    jobs.len()
                );
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from WorkAtAStartup: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape WeWorkRemotely
        match wwr::WwrScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!(
                    "Successfully scraped {} jobs from WeWorkRemotely",
                    jobs.len()
                );
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from WeWorkRemotely: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape Remote.co
        match remote_co::RemoteCoScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!("Successfully scraped {} jobs from Remote.co", jobs.len());
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Remote.co: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape Glassdoor (enable browser automation if available)
        let mut glassdoor_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            glassdoor_config.use_browser_automation = true;
        }
        match glassdoor::GlassdoorScraper.scrape_with_config(query, &glassdoor_config) {
            Ok(mut jobs) => {
                println!("✅ Successfully scraped {} jobs from Glassdoor", jobs.len());
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Glassdoor: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // Scrape ZipRecruiter (enable browser automation if available)
        let mut ziprecruiter_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            ziprecruiter_config.use_browser_automation = true;
        }
        match ziprecruiter::ZipRecruiterScraper.scrape_with_config(query, &ziprecruiter_config) {
            Ok(mut jobs) => {
                println!(
                    "✅ Successfully scraped {} jobs from ZipRecruiter",
                    jobs.len()
                );
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from ZipRecruiter: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // Scrape Stack Overflow (enable browser automation if available)
        let mut stackoverflow_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            stackoverflow_config.use_browser_automation = true;
        }
        match stack_overflow::StackOverflowScraper.scrape_with_config(query, &stackoverflow_config)
        {
            Ok(mut jobs) => {
                println!(
                    "✅ Successfully scraped {} jobs from Stack Overflow",
                    jobs.len()
                );
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Stack Overflow: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape Dice (enable browser automation if available)
        let mut dice_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            dice_config.use_browser_automation = true;
        }
        match dice::DiceScraper.scrape_with_config(query, &dice_config) {
            Ok(mut jobs) => {
                println!("✅ Successfully scraped {} jobs from Dice", jobs.len());
                // Record metrics: jobs found
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Dice: {}", e);
                eprintln!("{}", error_msg);
                // Record metrics: scraper errors
                errors.push(error_msg);
            }
        }

        // Scrape WeWorkRemotely (enable browser automation for blocked sites)
        let mut wwr_config = self.config.clone();
        // Auto-enable browser automation if available (for bypassing 403 blocks)
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            wwr_config.use_browser_automation = true;
        }
        match wwr::WwrScraper.scrape_with_config(query, &wwr_config) {
            Ok(mut jobs) => {
                println!(
                    "✅ Successfully scraped {} jobs from WeWorkRemotely",
                    jobs.len()
                );
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from WeWorkRemotely: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // Scrape Remote.co (enable browser automation if available)
        let mut remote_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            remote_config.use_browser_automation = true;
        }
        match remote_co::RemoteCoScraper.scrape_with_config(query, &remote_config) {
            Ok(mut jobs) => {
                println!("✅ Successfully scraped {} jobs from Remote.co", jobs.len());
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Remote.co: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // Scrape Work at a Startup (Y Combinator)
        match work_at_startup::WorkAtStartupScraper.scrape_with_config(query, &self.config) {
            Ok(mut jobs) => {
                println!(
                    "Successfully scraped {} jobs from Work at a Startup",
                    jobs.len()
                );
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Work at a Startup: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // Scrape Glassdoor (enable browser automation if available)
        let mut glassdoor_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            glassdoor_config.use_browser_automation = true;
        }
        match glassdoor::GlassdoorScraper.scrape_with_config(query, &glassdoor_config) {
            Ok(mut jobs) => {
                println!("✅ Successfully scraped {} jobs from Glassdoor", jobs.len());
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from Glassdoor: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // Scrape ZipRecruiter (enable browser automation if available)
        let mut ziprecruiter_config = self.config.clone();
        if crate::scraper::browser::BrowserScraper::is_crawl4ai_available()
            || crate::scraper::browser::BrowserScraper::is_playwright_available()
            || crate::scraper::browser::BrowserScraper::is_chromium_available()
        {
            ziprecruiter_config.use_browser_automation = true;
        }
        match ziprecruiter::ZipRecruiterScraper.scrape_with_config(query, &ziprecruiter_config) {
            Ok(mut jobs) => {
                println!(
                    "✅ Successfully scraped {} jobs from ZipRecruiter",
                    jobs.len()
                );
                all_jobs.append(&mut jobs);
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                let error_msg = format!("Failed to scrape from ZipRecruiter: {}", e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
            }
        }

        // Filter out completely empty jobs (no description, no requirements, no useful info)
        let initial_count = all_jobs.len();
        all_jobs.retain(|job| {
            // Keep jobs that have at least some useful content
            let has_description = job
                .description
                .as_ref()
                .map(|d| !d.trim().is_empty() && d.len() > 20)
                .unwrap_or(false);
            let has_requirements = job
                .requirements
                .as_ref()
                .map(|r| !r.trim().is_empty() && r.len() > 20)
                .unwrap_or(false);
            let has_location = job
                .location
                .as_ref()
                .map(|l| !l.trim().is_empty())
                .unwrap_or(false);

            // Keep if has description, requirements, or at least location + valid URL
            has_description || has_requirements || (has_location && !job.url.is_empty())
        });

        let filtered_count = initial_count - all_jobs.len();
        if filtered_count > 0 {
            log::warn!(
                "Filtered out {} empty jobs (no description/requirements)",
                filtered_count
            );
        }

        // Auto-enrich jobs if enabled and they're missing descriptions
        if self.config.auto_enrich {
            let job_indices: Vec<usize> = all_jobs
                .iter()
                .enumerate()
                .filter(|(_, job)| Self::should_enrich(job))
                .map(|(idx, _)| idx)
                .collect();

            let jobs_to_enrich_count = job_indices.len();

            if jobs_to_enrich_count > 0 {
                log::info!(
                    "Auto-enriching {} jobs missing descriptions...",
                    jobs_to_enrich_count
                );
                let mut enriched_count = 0;
                for idx in job_indices {
                    if let Some(job) = all_jobs.get_mut(idx) {
                        // Rate limit enrichment to avoid overwhelming servers
                        thread::sleep(Duration::from_millis(500));
                        let had_description_before = job
                            .description
                            .as_ref()
                            .map(|d| !d.trim().is_empty() && d.len() > 50)
                            .unwrap_or(false);

                        if let Err(e) = job_enricher::JobEnricher::enrich_job(job) {
                            log::warn!(
                                "Failed to enrich job {} at {}: {}",
                                job.title,
                                job.company,
                                e
                            );
                        } else {
                            // Check if description was actually extracted
                            let has_description_after = job
                                .description
                                .as_ref()
                                .map(|d| !d.trim().is_empty() && d.len() > 50)
                                .unwrap_or(false);

                            if has_description_after && !had_description_before {
                                enriched_count += 1;
                            } else if !has_description_after {
                                log::warn!("Enrichment succeeded but no description extracted for {} at {}", 
                                    job.title, job.company);
                            }
                        }
                    }
                }
                log::info!(
                    "Successfully enriched {}/{} jobs",
                    enriched_count,
                    jobs_to_enrich_count
                );
            }
        }

        // If some jobs were found, return them even if some sources failed
        if !all_jobs.is_empty() {
            if !errors.is_empty() {
                println!(
                    "⚠️  Some sources failed, but {} jobs were found from successful sources",
                    all_jobs.len()
                );
            }
            Ok(all_jobs)
        } else {
            // If no jobs found, log warnings but don't fail completely
            // This is a valid state - no jobs match the query
            if !errors.is_empty() {
                eprintln!(
                    "⚠️  No jobs found. Some sources had errors:\n{}",
                    errors.join("\n")
                );
            } else {
                println!("ℹ️  No jobs found matching query '{}'", query);
            }
            // Return empty list instead of error - this is a valid state
            Ok(Vec::new())
        }
    }

    fn ensure_network_ready(&self) -> Result<()> {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .context("Failed to build HTTP client for connectivity check")?;

        let test_urls = [
            "https://www.gstatic.com/generate_204",
            "https://example.com",
            "https://httpbin.org/get",
        ];

        let mut last_error: Option<anyhow::Error> = None;
        for url in &test_urls {
            match client.get(*url).send() {
                Ok(resp) if resp.status().is_success() => {
                    return Ok(());
                }
                Ok(resp) => {
                    last_error = Some(anyhow::anyhow!(
                        "{} responded with unexpected status {}",
                        url,
                        resp.status()
                    ));
                }
                Err(err) => {
                    last_error = Some(err.into());
                }
            }
        }

        Err(last_error
            .unwrap_or_else(|| anyhow::anyhow!("Unable to reach connectivity-check endpoints")))
    }

    pub fn scrape_selected(&self, sources: &[String], query: &str) -> Result<Vec<Job>> {
        let mut all_jobs = Vec::new();
        let mut errors = Vec::new();

        let wants =
            |name: &str| sources.is_empty() || sources.iter().any(|s| s.eq_ignore_ascii_case(name));
        let should_scrape_all = sources.is_empty();

        println!(
            "Scraping selected sources: {:?}, query: '{}'",
            sources, query
        );

        // Scrape RemoteOK
        if wants("remoteok") || wants("remote_ok") || wants("remoteok.com") {
            println!("Attempting to scrape RemoteOK...");
            match remote_ok::RemoteOkScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("Successfully scraped {} jobs from RemoteOK", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from RemoteOK: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

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

        // Scrape Indeed
        if wants("indeed") || wants("indeed.com") {
            println!("Attempting to scrape Indeed...");
            match indeed::IndeedScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("✅ Successfully scraped {} jobs from Indeed", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("⚠️ Failed to scrape indeed: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
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

        // Scrape WeWorkRemotely (enable browser automation for blocked sites)
        if wants("weworkremotely") || wants("wwr") || wants("weworkremotely.com") {
            println!("Attempting to scrape WeWorkRemotely...");
            let mut wwr_config = self.config.clone();
            // Auto-enable browser automation if available (for bypassing 403 blocks)
            if crate::scraper::browser::BrowserScraper::is_playwright_available()
                || crate::scraper::browser::BrowserScraper::is_chromium_available()
            {
                wwr_config.use_browser_automation = true;
            }
            match wwr::WwrScraper.scrape_with_config(query, &wwr_config) {
                Ok(mut jobs) => {
                    println!(
                        "Successfully scraped {} jobs from WeWorkRemotely",
                        jobs.len()
                    );
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from WeWorkRemotely: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Remotive
        if wants("remotive") || wants("remotive.com") {
            println!("Attempting to scrape Remotive...");
            match remotive::RemotiveScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("Successfully scraped {} jobs from Remotive", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Remotive: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Remote.co (enable browser automation for blocked sites)
        if wants("remoteco") || wants("remote.co") || wants("remote_co") {
            println!("Attempting to scrape Remote.co...");
            let mut remote_co_config = self.config.clone();
            // Auto-enable browser automation if available (for bypassing connection resets)
            if crate::scraper::browser::BrowserScraper::is_playwright_available()
                || crate::scraper::browser::BrowserScraper::is_chromium_available()
            {
                remote_co_config.use_browser_automation = true;
            }
            match remote_co::RemoteCoScraper.scrape_with_config(query, &remote_co_config) {
                Ok(mut jobs) => {
                    println!("Successfully scraped {} jobs from Remote.co", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Remote.co: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Work at a Startup (Y Combinator)
        if wants("workatastartup")
            || wants("work at a startup")
            || wants("ycombinator")
            || wants("yc")
            || wants("workatastartup.com")
        {
            println!("Attempting to scrape Work at a Startup...");
            match work_at_startup::WorkAtStartupScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!(
                        "Successfully scraped {} jobs from Work at a Startup",
                        jobs.len()
                    );
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Work at a Startup: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Glassdoor
        if wants("glassdoor") || wants("glassdoor.com") {
            println!("Attempting to scrape Glassdoor...");
            let mut glassdoor_config = self.config.clone();
            if crate::scraper::browser::BrowserScraper::is_playwright_available()
                || crate::scraper::browser::BrowserScraper::is_chromium_available()
            {
                glassdoor_config.use_browser_automation = true;
            }
            match glassdoor::GlassdoorScraper.scrape_with_config(query, &glassdoor_config) {
                Ok(mut jobs) => {
                    println!("✅ Successfully scraped {} jobs from Glassdoor", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Glassdoor: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape ZipRecruiter
        if wants("ziprecruiter") || wants("ziprecruiter.com") {
            println!("Attempting to scrape ZipRecruiter...");
            let mut ziprecruiter_config = self.config.clone();
            if crate::scraper::browser::BrowserScraper::is_playwright_available()
                || crate::scraper::browser::BrowserScraper::is_chromium_available()
            {
                ziprecruiter_config.use_browser_automation = true;
            }
            match ziprecruiter::ZipRecruiterScraper.scrape_with_config(query, &ziprecruiter_config)
            {
                Ok(mut jobs) => {
                    println!(
                        "✅ Successfully scraped {} jobs from ZipRecruiter",
                        jobs.len()
                    );
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from ZipRecruiter: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Stack Overflow Jobs
        if wants("stackoverflow") || wants("stack overflow") || wants("so") {
            println!("Attempting to scrape Stack Overflow Jobs...");
            let mut stackoverflow_config = self.config.clone();
            if crate::scraper::browser::BrowserScraper::is_playwright_available()
                || crate::scraper::browser::BrowserScraper::is_chromium_available()
            {
                stackoverflow_config.use_browser_automation = true;
            }
            match stack_overflow::StackOverflowScraper
                .scrape_with_config(query, &stackoverflow_config)
            {
                Ok(mut jobs) => {
                    println!(
                        "✅ Successfully scraped {} jobs from Stack Overflow",
                        jobs.len()
                    );
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Stack Overflow: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Dice
        if wants("dice") || wants("dice.com") {
            println!("Attempting to scrape Dice...");
            let mut dice_config = self.config.clone();
            if crate::scraper::browser::BrowserScraper::is_playwright_available()
                || crate::scraper::browser::BrowserScraper::is_chromium_available()
            {
                dice_config.use_browser_automation = true;
            }
            match dice::DiceScraper.scrape_with_config(query, &dice_config) {
                Ok(mut jobs) => {
                    println!("✅ Successfully scraped {} jobs from Dice", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Dice: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape The Muse (free API, no auth required)
        if wants("themuse") || wants("muse") || wants("themuse.com") {
            println!("Attempting to scrape The Muse...");
            match themuse::TheMuseScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("✅ Successfully scraped {} jobs from The Muse", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from The Muse: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Arbeitnow (free API, EU/remote focus)
        if wants("arbeitnow") || wants("arbeitnow.com") {
            println!("Attempting to scrape Arbeitnow...");
            match arbeitnow::ArbeitnowScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    println!("✅ Successfully scraped {} jobs from Arbeitnow", jobs.len());
                    all_jobs.append(&mut jobs);
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Arbeitnow: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Adzuna (requires API key)
        if wants("adzuna") || wants("adzuna.com") {
            println!("Attempting to scrape Adzuna...");
            match adzuna::AdzunaScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    if !jobs.is_empty() {
                        println!("✅ Successfully scraped {} jobs from Adzuna", jobs.len());
                        all_jobs.append(&mut jobs);
                    }
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Adzuna: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Jooble (requires API key)
        if wants("jooble") || wants("jooble.org") {
            println!("Attempting to scrape Jooble...");
            match jooble::JoobleScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    if !jobs.is_empty() {
                        println!("✅ Successfully scraped {} jobs from Jooble", jobs.len());
                        all_jobs.append(&mut jobs);
                    }
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Jooble: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Jobicy (free API, remote jobs)
        if wants("jobicy") || wants("jobicy.com") {
            println!("Attempting to scrape Jobicy...");
            match jobicy::JobicyScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    if !jobs.is_empty() {
                        println!("✅ Successfully scraped {} jobs from Jobicy", jobs.len());
                        all_jobs.append(&mut jobs);
                    }
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Jobicy: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Findwork (tech jobs API)
        if wants("findwork") || wants("findwork.dev") {
            println!("Attempting to scrape Findwork...");
            match findwork::FindworkScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    if !jobs.is_empty() {
                        println!("✅ Successfully scraped {} jobs from Findwork", jobs.len());
                        all_jobs.append(&mut jobs);
                    }
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Findwork: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        // Scrape Himalayas (quality remote jobs)
        if wants("himalayas") || wants("himalayas.app") {
            println!("Attempting to scrape Himalayas...");
            match himalayas::HimalayasScraper.scrape_with_config(query, &self.config) {
                Ok(mut jobs) => {
                    if !jobs.is_empty() {
                        println!("✅ Successfully scraped {} jobs from Himalayas", jobs.len());
                        all_jobs.append(&mut jobs);
                    }
                    if !should_scrape_all {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to scrape from Himalayas: {}", e);
                    eprintln!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        println!(
            "Total jobs scraped: {}, Errors: {}",
            all_jobs.len(),
            errors.len()
        );

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

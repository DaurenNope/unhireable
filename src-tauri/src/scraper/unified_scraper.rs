//! Unified Config-Driven Scraper
//! Loads site configurations from TOML and applies CSS selectors dynamically.

use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;

/// Site configuration loaded from TOML
#[derive(Debug, Clone, Deserialize)]
pub struct SiteConfig {
    pub name: String,
    #[serde(rename = "type")]
    pub site_type: String,
    pub base_url: String,
    pub search_path: String,
    #[serde(default)]
    pub search_query_path: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    pub job_selector: String,
    pub title_selector: String,
    pub company_selector: String,
    pub url_selector: String,
    #[serde(default)]
    pub location_selector: Option<String>,
    #[serde(default)]
    pub salary_selector: Option<String>,
    #[serde(default)]
    pub default_location: Option<String>,
    #[serde(default)]
    pub default_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SiteConfigFile {
    sites: Vec<SiteConfig>,
}

/// Global cache for site configs
static SITE_CONFIGS: OnceLock<HashMap<String, SiteConfig>> = OnceLock::new();

/// Load site configs from embedded TOML
fn load_site_configs() -> HashMap<String, SiteConfig> {
    let toml_content = include_str!("site_configs.toml");

    match toml::from_str::<SiteConfigFile>(toml_content) {
        Ok(config_file) => {
            let mut map = HashMap::new();
            for site in config_file.sites {
                map.insert(site.name.clone(), site);
            }
            println!("✅ Loaded {} site configurations", map.len());
            map
        }
        Err(e) => {
            eprintln!("❌ Failed to parse site_configs.toml: {}", e);
            HashMap::new()
        }
    }
}

/// Get cached site configs
pub fn get_site_configs() -> &'static HashMap<String, SiteConfig> {
    SITE_CONFIGS.get_or_init(load_site_configs)
}

/// Check if a site is supported by the unified scraper
pub fn is_unified_site(name: &str) -> bool {
    get_site_configs().contains_key(name)
}

/// Get list of all unified scraper site names
pub fn get_unified_site_names() -> Vec<String> {
    get_site_configs().keys().cloned().collect()
}

/// Unified HTML Scraper
pub struct UnifiedHtmlScraper {
    config: SiteConfig,
}

impl UnifiedHtmlScraper {
    pub fn new(site_name: &str) -> Option<Self> {
        get_site_configs().get(site_name).map(|config| Self {
            config: config.clone(),
        })
    }

    fn build_url(&self, query: &str) -> String {
        if query.trim().is_empty() {
            format!("{}{}", self.config.base_url, self.config.search_path)
        } else if let Some(query_path) = &self.config.search_query_path {
            let path = query_path.replace("{query}", &urlencoding::encode(query.trim()));
            format!("{}{}", self.config.base_url, path)
        } else {
            format!("{}{}", self.config.base_url, self.config.search_path)
        }
    }

    fn parse_jobs(&self, html: &str) -> Vec<Job> {
        let document = Html::parse_document(html);
        let mut jobs = Vec::new();

        let job_sel = match Selector::parse(&self.config.job_selector) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("❌ Invalid job_selector for {}: {:?}", self.config.name, e);
                return jobs;
            }
        };

        let title_sel = Selector::parse(&self.config.title_selector).ok();
        let company_sel = Selector::parse(&self.config.company_selector).ok();
        let url_sel = Selector::parse(&self.config.url_selector).ok();
        let location_sel = self
            .config
            .location_selector
            .as_ref()
            .and_then(|s| Selector::parse(s).ok());
        let salary_sel = self
            .config
            .salary_selector
            .as_ref()
            .and_then(|s| Selector::parse(s).ok());

        for job_element in document.select(&job_sel) {
            // Extract title
            let title = title_sel
                .as_ref()
                .and_then(|s| job_element.select(s).next())
                .map(|e| e.text().collect::<String>().trim().to_string())
                .filter(|s| !s.is_empty());

            // Extract company
            let company = company_sel
                .as_ref()
                .and_then(|s| job_element.select(s).next())
                .map(|e| e.text().collect::<String>().trim().to_string())
                .filter(|s| !s.is_empty());

            // Extract URL
            let url = url_sel
                .as_ref()
                .and_then(|s| job_element.select(s).next())
                .and_then(|e| e.value().attr("href"))
                .map(|href| {
                    if href.starts_with("http") {
                        href.to_string()
                    } else {
                        format!("{}{}", self.config.base_url, href)
                    }
                });

            // Extract location (optional)
            let location = location_sel
                .as_ref()
                .and_then(|s| job_element.select(s).next())
                .map(|e| e.text().collect::<String>().trim().to_string())
                .filter(|s| !s.is_empty())
                .or_else(|| self.config.default_location.clone());

            // Extract salary (optional)
            let salary = salary_sel
                .as_ref()
                .and_then(|s| job_element.select(s).next())
                .map(|e| e.text().collect::<String>().trim().to_string())
                .filter(|s| !s.is_empty());

            if let (Some(title), Some(company), Some(url)) = (title, company, url) {
                jobs.push(Job {
                    id: None,
                    title,
                    company,
                    url,
                    description: self.config.default_description.clone(),
                    requirements: None,
                    location,
                    salary,
                    source: self.config.name.clone(),
                    status: JobStatus::Saved,
                    match_score: None,
                    created_at: None,
                    updated_at: None,
                    ..Default::default()
                });
            }
        }

        jobs
    }
}

impl JobScraper for UnifiedHtmlScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let user_agent = self
            .config
            .user_agent
            .as_deref()
            .unwrap_or("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");

        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent(user_agent)
            .build()
            .context("Failed to build HTTP client")?;

        let url = self.build_url(query);
        println!("🌐 [{}] Fetching: {}", self.config.name, url);

        let response = client
            .get(&url)
            .send()
            .context(format!("Failed to fetch {}", self.config.name))?;

        // Check for anti-bot protection
        let status = response.status();
        if status.as_u16() == 403 || status.as_u16() == 503 {
            println!(
                "⚠️  [{}] Blocked ({}), may need browser/proxy",
                self.config.name, status
            );
            return Ok(Vec::new());
        }

        let html = response
            .text()
            .context(format!("Failed to get {} response text", self.config.name))?;

        let jobs = self.parse_jobs(&html);

        if jobs.is_empty() {
            println!(
                "⚠️  [{}] No jobs found for query '{}'",
                self.config.name, query
            );
        } else {
            println!("✅ [{}] Found {} jobs", self.config.name, jobs.len());
        }

        Ok(jobs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_configs() {
        let configs = get_site_configs();
        assert!(!configs.is_empty(), "Should load at least one config");
        assert!(
            configs.contains_key("web3career"),
            "Should have web3career config"
        );
    }

    #[test]
    fn test_unified_scraper_creation() {
        let scraper = UnifiedHtmlScraper::new("web3career");
        assert!(scraper.is_some(), "Should create scraper for web3career");

        let scraper = UnifiedHtmlScraper::new("nonexistent");
        assert!(scraper.is_none(), "Should return None for unknown site");
    }
}

use std::env;

#[derive(Debug, Clone)]
pub struct ScraperConfig {
    pub firecrawl_api_key: Option<String>,
    pub use_firecrawl: bool,
    pub use_browser_automation: bool, // Use Playwright/Chrome instead of Firecrawl
    pub retry_attempts: u32,
    pub retry_delay_secs: u64,
    pub retry_backoff_factor: f64, // exponential backoff factor, e.g., 2.0
    pub timeout_secs: u64,
    pub per_domain_min_delay_ms: u64, // courtesy delay between requests to same domain
    pub per_domain_max_delay_ms: u64,
    // LinkedIn-specific settings (very conservative)
    pub linkedin_enabled: bool,
    pub linkedin_min_delay_secs: u64, // Minimum delay between LinkedIn requests
    pub linkedin_max_delay_secs: u64, // Maximum delay (randomized)
    // Pagination settings
    pub max_pages: u32, // Maximum number of pages to scrape per source (0 = unlimited, default: 5)
    // Auto-enrichment settings
    pub auto_enrich: bool, // Automatically enrich jobs missing descriptions after scraping
    pub scraper_api_key: Option<String>, // Optional API key for third-party proxy (e.g. ScraperAPI)
    pub wellfound_cookie: Option<String>, // Optional cookie to bypass Wellfound protections
    pub indeed_cookie: Option<String>, // Optional cookie to bypass Indeed protections
    // API-based scraper credentials
    pub adzuna_app_id: Option<String>,  // Adzuna API app ID
    pub adzuna_api_key: Option<String>, // Adzuna API key
    pub adzuna_country: Option<String>, // Adzuna country code (us, gb, au, etc.)
    pub jooble_api_key: Option<String>, // Jooble API key
    pub findwork_api_key: Option<String>, // Findwork API key
}

impl Default for ScraperConfig {
    fn default() -> Self {
        Self {
            firecrawl_api_key: env::var("FIRECRAWL_API_KEY").ok(),
            use_firecrawl: env::var("FIRECRAWL_API_KEY").is_ok(),
            use_browser_automation: false, // Disabled by default, enable manually
            retry_attempts: 3,
            retry_delay_secs: 2,
            retry_backoff_factor: 2.0,
            timeout_secs: 30,
            // Browser automation uses longer timeout for heavy sites
            // (will be overridden by BrowserScraper for browser automation)
            per_domain_min_delay_ms: 600,
            per_domain_max_delay_ms: 1400,
            // LinkedIn is disabled by default - high risk of account/IP banning
            // LinkedIn actively detects scraping and can permanently ban accounts
            // Only enable if absolutely necessary, use browser automation, and set 30+ second delays
            linkedin_enabled: false,
            linkedin_min_delay_secs: 15, // Very conservative: 15-30 seconds (minimum)
            linkedin_max_delay_secs: 30,
            max_pages: 5, // Default: scrape 5 pages (typically 100-250 jobs depending on source)
            auto_enrich: true, // Enable auto-enrichment by default to get full job details
            scraper_api_key: env::var("SCRAPERAPI_KEY").ok(),
            wellfound_cookie: env::var("WELLFOUND_COOKIE").ok(),
            indeed_cookie: env::var("INDEED_COOKIE").ok(),
            // API-based scrapers
            adzuna_app_id: env::var("ADZUNA_APP_ID").ok(),
            adzuna_api_key: env::var("ADZUNA_API_KEY").ok(),
            adzuna_country: env::var("ADZUNA_COUNTRY").ok(),
            jooble_api_key: env::var("JOOBLE_API_KEY").ok(),
            findwork_api_key: env::var("FINDWORK_API_KEY").ok(),
        }
    }
}

impl ScraperConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_firecrawl_key(api_key: String) -> Self {
        Self {
            firecrawl_api_key: Some(api_key),
            use_firecrawl: true,
            ..Self::default()
        }
    }

    pub fn with_browser_automation(enabled: bool) -> Self {
        Self {
            use_browser_automation: enabled,
            ..Self::default()
        }
    }

    /// Enable browser automation if Playwright, Chrome, or crawl4ai is available
    pub fn with_auto_browser_automation() -> Self {
        use crate::scraper::browser::BrowserScraper;
        let enabled = BrowserScraper::is_playwright_available()
            || BrowserScraper::is_chromium_available()
            || BrowserScraper::is_crawl4ai_available();
        Self {
            use_browser_automation: enabled,
            ..Self::default()
        }
    }

    pub fn with_linkedin_enabled(enabled: bool) -> Self {
        Self {
            linkedin_enabled: enabled,
            ..Self::default()
        }
    }

    pub fn with_retry_attempts(attempts: u32) -> Self {
        Self {
            retry_attempts: attempts,
            ..Self::default()
        }
    }

    pub fn with_max_pages(max_pages: u32) -> Self {
        Self {
            max_pages,
            ..Self::default()
        }
    }

    pub fn with_auto_enrich(enabled: bool) -> Self {
        Self {
            auto_enrich: enabled,
            ..Self::default()
        }
    }
}

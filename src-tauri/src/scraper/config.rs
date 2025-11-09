use std::env;

#[derive(Debug, Clone)]
pub struct ScraperConfig {
    pub firecrawl_api_key: Option<String>,
    pub use_firecrawl: bool,
    pub use_browser_automation: bool, // Use Playwright/Chrome instead of Firecrawl
    pub retry_attempts: u32,
    pub retry_delay_secs: u64,
    pub timeout_secs: u64,
    // LinkedIn-specific settings (very conservative)
    pub linkedin_enabled: bool,
    pub linkedin_min_delay_secs: u64, // Minimum delay between LinkedIn requests
    pub linkedin_max_delay_secs: u64, // Maximum delay (randomized)
}

impl Default for ScraperConfig {
    fn default() -> Self {
        Self {
            firecrawl_api_key: env::var("FIRECRAWL_API_KEY").ok(),
            use_firecrawl: env::var("FIRECRAWL_API_KEY").is_ok(),
            use_browser_automation: false, // Disabled by default, enable manually
            retry_attempts: 3,
            retry_delay_secs: 2,
            timeout_secs: 30,
            // LinkedIn is disabled by default - high risk of account/IP banning
            // LinkedIn actively detects scraping and can permanently ban accounts
            // Only enable if absolutely necessary, use browser automation, and set 30+ second delays
            linkedin_enabled: false,
            linkedin_min_delay_secs: 15, // Very conservative: 15-30 seconds (minimum)
            linkedin_max_delay_secs: 30,
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
}


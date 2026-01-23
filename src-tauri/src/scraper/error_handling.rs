// Error handling utilities for scrapers
use crate::error::{Error, RetryConfig};
use log::{log, Level};

/// Scraper-specific error types
#[derive(Debug, Clone)]
pub enum ScraperError {
    Network(String),
    Timeout(String),
    RateLimit(String),
    CloudflareProtection(String),
    NotFound(String),
    ParseError(String),
    Blocked(String),
}

impl std::fmt::Display for ScraperError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ScraperError::Network(msg) => write!(f, "Network error: {}", msg),
            ScraperError::Timeout(msg) => write!(f, "Timeout: {}", msg),
            ScraperError::RateLimit(msg) => write!(f, "Rate limit: {}", msg),
            ScraperError::CloudflareProtection(msg) => write!(f, "Cloudflare protection: {}", msg),
            ScraperError::NotFound(msg) => write!(f, "Not found: {}", msg),
            ScraperError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            ScraperError::Blocked(msg) => write!(f, "Blocked: {}", msg),
        }
    }
}

impl std::error::Error for ScraperError {}

/// Convert scraper errors to application errors
impl From<ScraperError> for Error {
    fn from(err: ScraperError) -> Self {
        match err {
            ScraperError::Network(msg) => Error::Network(msg),
            ScraperError::Timeout(msg) => Error::Timeout(msg),
            ScraperError::RateLimit(msg) => Error::RateLimit(msg),
            ScraperError::CloudflareProtection(msg) => Error::Security(msg),
            ScraperError::NotFound(msg) => Error::NotFound(msg),
            ScraperError::ParseError(msg) => Error::Custom(format!("Parse error: {}", msg)),
            ScraperError::Blocked(msg) => Error::Security(msg),
        }
    }
}

/// Detect if HTML contains Cloudflare protection
pub fn is_cloudflare_protection(html: &str) -> bool {
    html.contains("Just a moment")
        || html.contains("Checking your browser")
        || html.contains("cf-browser-verification")
        || html.contains("cloudflare")
        || html.contains("cf-ray")
        || (html.len() < 1000 && html.contains("challenge"))
}

/// Detect if response indicates blocking (403, etc.)
pub fn is_blocked_response(status: u16, html: &str) -> bool {
    status == 403 || status == 429 || status == 503 || is_cloudflare_protection(html)
}

/// Handle HTTP errors with proper categorization
pub fn categorize_http_error(status: u16, url: &str, html: Option<&str>) -> ScraperError {
    let html_preview = html.map(|h| {
        if h.len() > 200 {
            format!("{}...", &h[..200])
        } else {
            h.to_string()
        }
    });

    match status {
        403 => {
            if let Some(ref html) = html_preview {
                if is_cloudflare_protection(html) {
                    ScraperError::CloudflareProtection(format!(
                        "Cloudflare protection detected for {}",
                        url
                    ))
                } else {
                    ScraperError::Blocked(format!("403 Forbidden for {}", url))
                }
            } else {
                ScraperError::Blocked(format!("403 Forbidden for {}", url))
            }
        }
        429 => ScraperError::RateLimit(format!("Rate limited for {}", url)),
        503 => ScraperError::Network(format!("Service unavailable (503) for {}", url)),
        404 => ScraperError::NotFound(format!("Page not found (404) for {}", url)),
        _ => ScraperError::Network(format!("HTTP {} error for {}", status, url)),
    }
}

/// Handle network/timeout errors
pub fn categorize_network_error(err: &anyhow::Error, url: &str) -> ScraperError {
    let err_msg = err.to_string().to_lowercase();

    if err_msg.contains("timeout")
        || err_msg.contains("timed out")
        || err_msg.contains("err_timed_out")
    {
        ScraperError::Timeout(format!("Request timeout for {}: {}", url, err))
    } else if err_msg.contains("connection")
        || err_msg.contains("network")
        || err_msg.contains("dns")
    {
        ScraperError::Network(format!("Network error for {}: {}", url, err))
    } else {
        ScraperError::Network(format!("Request failed for {}: {}", url, err))
    }
}

/// Log scraper attempt with structured logging
pub fn log_scraper_attempt(source: &str, query: &str, attempt: u32, max_attempts: u32) {
    log!(
        Level::Info,
        "Scraping {}: query='{}', attempt={}/{}",
        source,
        query,
        attempt,
        max_attempts
    );
}

/// Log scraper success
pub fn log_scraper_success(source: &str, job_count: usize) {
    log!(
        Level::Info,
        "✅ Successfully scraped {} jobs from {}",
        job_count,
        source
    );
}

/// Log scraper error with context
pub fn log_scraper_error(source: &str, error: &impl std::fmt::Display, retry: bool) {
    let level = if retry { Level::Warn } else { Level::Error };
    log!(level, "⚠️  Failed to scrape from {}: {}", source, error);
}

/// Retry configuration for scrapers
pub fn scraper_retry_config() -> RetryConfig {
    RetryConfig {
        max_retries: 3,
        initial_delay_ms: 1000,
        max_delay_ms: 10000,
        backoff_multiplier: 2.0,
    }
}

/// Retry configuration for browser automation (longer timeouts)
pub fn browser_retry_config() -> RetryConfig {
    RetryConfig {
        max_retries: 2,
        initial_delay_ms: 2000,
        max_delay_ms: 15000,
        backoff_multiplier: 2.0,
    }
}

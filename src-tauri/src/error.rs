use serde::{Deserialize, Serialize};
use std::fmt;
use std::io;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Error {
    Io(String),
    Database(String),
    Network(String),
    Validation(String),
    Security(String),
    NotFound(String),
    RateLimit(String),
    Timeout(String),
    Anyhow(String),
    Custom(String),
}

impl std::error::Error for Error {}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io(e) => write!(f, "I/O error: {}", e),
            Error::Database(e) => write!(f, "Database error: {}", e),
            Error::Network(e) => write!(f, "Network error: {}", e),
            Error::Validation(e) => write!(f, "Validation error: {}", e),
            Error::Security(e) => write!(f, "Security error: {}", e),
            Error::NotFound(e) => write!(f, "Not found: {}", e),
            Error::RateLimit(e) => write!(f, "Rate limit exceeded: {}", e),
            Error::Timeout(e) => write!(f, "Timeout: {}", e),
            Error::Anyhow(e) => write!(f, "Error: {}", e),
            Error::Custom(msg) => write!(f, "{}", msg),
        }
    }
}

impl From<io::Error> for Error {
    fn from(err: io::Error) -> Self {
        Error::Io(err.to_string())
    }
}

impl From<rusqlite::Error> for Error {
    fn from(err: rusqlite::Error) -> Self {
        Error::Database(err.to_string())
    }
}

impl From<anyhow::Error> for Error {
    fn from(err: anyhow::Error) -> Self {
        Error::Anyhow(err.to_string())
    }
}

impl From<String> for Error {
    fn from(err: String) -> Self {
        Error::Custom(err)
    }
}

impl From<&str> for Error {
    fn from(err: &str) -> Self {
        Error::Custom(err.to_string())
    }
}

impl From<reqwest::Error> for Error {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            Error::Timeout(err.to_string())
        } else {
            Error::Network(err.to_string())
        }
    }
}

impl From<url::ParseError> for Error {
    fn from(err: url::ParseError) -> Self {
        Error::Validation(format!("Invalid URL: {}", err))
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Error::Custom(format!("JSON error: {}", err))
    }
}

pub type Result<T> = std::result::Result<T, Error>;

// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay_ms: 100,
            max_delay_ms: 5000,
            backoff_multiplier: 2.0,
        }
    }
}

/// Retry a function with exponential backoff
pub async fn retry_with_backoff<F, T, E>(mut f: F, config: RetryConfig) -> std::result::Result<T, E>
where
    F: FnMut() -> std::pin::Pin<
        Box<dyn std::future::Future<Output = std::result::Result<T, E>> + Send>,
    >,
    E: std::fmt::Display,
{
    let mut delay = config.initial_delay_ms;

    for attempt in 0..=config.max_retries {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                if attempt == config.max_retries {
                    return Err(e);
                }
                log::warn!(
                    "Attempt {} failed: {}. Retrying in {}ms...",
                    attempt + 1,
                    e,
                    delay
                );
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                delay = (delay as f64 * config.backoff_multiplier) as u64;
                delay = delay.min(config.max_delay_ms);
            }
        }
    }

    unreachable!()
}

// Tauri 2.x automatically handles Result<T, E> where E: Display + Serialize
// No need for custom IpcResponse implementation

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Registry};
use tracing_subscriber::fmt;

pub fn init_logging() {
    // Initialize tracing with structured logging
    Registry::default()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"))
        )
        .with(
            fmt::layer()
                .with_target(false)
                .json()
        )
        .init();

    tracing::info!("Structured logging initialized");
}

pub fn init_console_logging() {
    // Initialize tracing with console-friendly output
    Registry::default()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"))
        )
        .with(
            fmt::layer()
                .with_target(true)
                .pretty()
        )
        .init();

    tracing::info!("Console logging initialized");
}

/// Secure logging helper - sanitizes sensitive data before logging
pub fn log_secure(level: tracing::Level, message: &str, data: Option<&str>) {
    let sanitized_data = data.map(|d| crate::security::SecureLogger::sanitize_for_logging(d));
    match level {
        tracing::Level::ERROR => {
            if let Some(ref data) = sanitized_data {
                tracing::error!("{}: {}", message, data);
            } else {
                tracing::error!("{}", message);
            }
        }
        tracing::Level::WARN => {
            if let Some(ref data) = sanitized_data {
                tracing::warn!("{}: {}", message, data);
            } else {
                tracing::warn!("{}", message);
            }
        }
        tracing::Level::INFO => {
            if let Some(ref data) = sanitized_data {
                tracing::info!("{}: {}", message, data);
            } else {
                tracing::info!("{}", message);
            }
        }
        tracing::Level::DEBUG => {
            if let Some(ref data) = sanitized_data {
                tracing::debug!("{}: {}", message, data);
            } else {
                tracing::debug!("{}", message);
            }
        }
        tracing::Level::TRACE => {
            if let Some(ref data) = sanitized_data {
                tracing::trace!("{}: {}", message, data);
            } else {
                tracing::trace!("{}", message);
            }
        }
    }
}

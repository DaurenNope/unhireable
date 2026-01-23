use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

/// Retry configuration for application automation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_attempts: u32,
    /// Initial delay in seconds before first retry
    pub initial_delay_secs: u64,
    /// Maximum delay in seconds (caps exponential backoff)
    pub max_delay_secs: u64,
    /// Exponential backoff multiplier
    pub backoff_multiplier: f64,
    /// Retryable error patterns (errors containing these strings will be retried)
    pub retryable_errors: Vec<String>,
    /// Non-retryable error patterns (errors containing these strings will not be retried)
    pub non_retryable_errors: Vec<String>,
    /// Whether to log retry attempts
    pub log_retries: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay_secs: 2,
            max_delay_secs: 60,
            backoff_multiplier: 2.0,
            retryable_errors: vec![
                "network".to_string(),
                "timeout".to_string(),
                "connection".to_string(),
                "temporary".to_string(),
                "rate limit".to_string(),
                "server error".to_string(),
                "503".to_string(),
                "502".to_string(),
                "504".to_string(),
                "429".to_string(),
            ],
            non_retryable_errors: vec![
                "authentication".to_string(),
                "unauthorized".to_string(),
                "forbidden".to_string(),
                "not found".to_string(),
                "invalid".to_string(),
                "validation".to_string(),
                "captcha".to_string(),
            ],
            log_retries: true,
        }
    }
}

/// Result of a retry operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryResult<T> {
    pub success: bool,
    pub result: Option<T>,
    pub attempts: u32,
    pub total_delay_secs: u64,
    pub errors: Vec<String>,
}

impl<T> RetryResult<T> {
    pub fn success(result: T, attempts: u32, total_delay_secs: u64) -> Self {
        Self {
            success: true,
            result: Some(result),
            attempts,
            total_delay_secs,
            errors: vec![],
        }
    }

    pub fn failure(attempts: u32, total_delay_secs: u64, errors: Vec<String>) -> Self {
        Self {
            success: false,
            result: None,
            attempts,
            total_delay_secs,
            errors,
        }
    }
}

/// Retry executor with exponential backoff
pub struct RetryExecutor {
    config: RetryConfig,
}

impl RetryExecutor {
    pub fn new() -> Self {
        Self {
            config: RetryConfig::default(),
        }
    }

    pub fn with_config(config: RetryConfig) -> Self {
        Self { config }
    }

    /// Execute a function with retry logic
    pub async fn execute<F, T>(&self, operation: F) -> RetryResult<T>
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T>> + Send>>,
    {
        let mut attempts = 0;
        let mut total_delay_secs = 0;
        let mut errors = Vec::new();
        let mut current_delay = self.config.initial_delay_secs;

        loop {
            attempts += 1;

            if self.config.log_retries && attempts > 1 {
                println!("🔄 Retry attempt {}/{}", attempts, self.config.max_attempts);
            }

            match operation().await {
                Ok(result) => {
                    if attempts > 1 && self.config.log_retries {
                        println!(
                            "✅ Operation succeeded after {} attempt(s) (total delay: {}s)",
                            attempts, total_delay_secs
                        );
                    }
                    return RetryResult::success(result, attempts, total_delay_secs);
                }
                Err(e) => {
                    let error_msg = e.to_string().to_lowercase();
                    errors.push(e.to_string());

                    // Check if error is non-retryable
                    if self
                        .config
                        .non_retryable_errors
                        .iter()
                        .any(|pattern| error_msg.contains(&pattern.to_lowercase()))
                    {
                        if self.config.log_retries {
                            println!(
                                "❌ Non-retryable error detected: {} (attempt {})",
                                error_msg, attempts
                            );
                        }
                        return RetryResult::failure(attempts, total_delay_secs, errors);
                    }

                    // Check if we've exhausted retry attempts
                    if attempts >= self.config.max_attempts {
                        if self.config.log_retries {
                            println!(
                                "❌ Max retry attempts ({}) reached. Last error: {}",
                                self.config.max_attempts, error_msg
                            );
                        }
                        return RetryResult::failure(attempts, total_delay_secs, errors);
                    }

                    // Check if error is retryable (if list is empty, all errors are retryable)
                    let is_retryable = self.config.retryable_errors.is_empty()
                        || self
                            .config
                            .retryable_errors
                            .iter()
                            .any(|pattern| error_msg.contains(&pattern.to_lowercase()));

                    if !is_retryable {
                        if self.config.log_retries {
                            println!(
                                "❌ Non-retryable error: {} (attempt {})",
                                error_msg, attempts
                            );
                        }
                        return RetryResult::failure(attempts, total_delay_secs, errors);
                    }

                    // Wait before retrying with exponential backoff
                    if self.config.log_retries {
                        println!(
                            "⏳ Waiting {}s before retry (exponential backoff)...",
                            current_delay
                        );
                    }

                    sleep(Duration::from_secs(current_delay)).await;
                    total_delay_secs += current_delay;

                    // Calculate next delay with exponential backoff
                    current_delay = (current_delay as f64 * self.config.backoff_multiplier) as u64;
                    current_delay = current_delay.min(self.config.max_delay_secs);
                }
            }
        }
    }

    /// Execute with custom error handler
    pub async fn execute_with_handler<F, T, E>(
        &self,
        operation: F,
        error_handler: impl Fn(&E) -> bool, // Returns true if error is retryable
    ) -> RetryResult<T>
    where
        F: Fn() -> std::pin::Pin<
            Box<dyn std::future::Future<Output = std::result::Result<T, E>> + Send>,
        >,
        E: std::fmt::Display,
    {
        let mut attempts = 0;
        let mut total_delay_secs = 0;
        let mut errors = Vec::new();
        let mut current_delay = self.config.initial_delay_secs;

        loop {
            attempts += 1;

            if self.config.log_retries && attempts > 1 {
                println!("🔄 Retry attempt {}/{}", attempts, self.config.max_attempts);
            }

            match operation().await {
                Ok(result) => {
                    if attempts > 1 && self.config.log_retries {
                        println!(
                            "✅ Operation succeeded after {} attempt(s) (total delay: {}s)",
                            attempts, total_delay_secs
                        );
                    }
                    return RetryResult::success(result, attempts, total_delay_secs);
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    errors.push(error_msg.clone());

                    if !error_handler(&e) {
                        if self.config.log_retries {
                            println!(
                                "❌ Non-retryable error detected (attempt {}): {}",
                                attempts, error_msg
                            );
                        }
                        return RetryResult::failure(attempts, total_delay_secs, errors);
                    }

                    if attempts >= self.config.max_attempts {
                        if self.config.log_retries {
                            println!(
                                "❌ Max retry attempts ({}) reached. Last error: {}",
                                self.config.max_attempts, error_msg
                            );
                        }
                        return RetryResult::failure(attempts, total_delay_secs, errors);
                    }

                    if self.config.log_retries {
                        println!(
                            "⏳ Waiting {}s before retry (exponential backoff)...",
                            current_delay
                        );
                    }

                    sleep(Duration::from_secs(current_delay)).await;
                    total_delay_secs += current_delay;

                    current_delay = (current_delay as f64 * self.config.backoff_multiplier) as u64;
                    current_delay = current_delay.min(self.config.max_delay_secs);
                }
            }
        }
    }
}

impl Default for RetryExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::rc::Rc;

    #[tokio::test]
    async fn test_retry_success_on_first_attempt() {
        let executor = RetryExecutor::new();
        let call_count = Rc::new(Cell::new(0));
        let call_count_clone = call_count.clone();

        let result: RetryResult<i32> = executor
            .execute(move || {
                call_count_clone.set(call_count_clone.get() + 1);
                Box::pin(async move { Ok(42) })
            })
            .await;

        assert!(result.success);
        assert_eq!(result.result, Some(42));
        assert_eq!(result.attempts, 1);
        assert_eq!(call_count.get(), 1);
    }

    #[tokio::test]
    async fn test_retry_success_after_retries() {
        let mut config = RetryConfig::default();
        config.max_attempts = 3;
        config.initial_delay_secs = 0; // Speed up tests
        config.log_retries = false;

        let executor = RetryExecutor::with_config(config);
        let call_count = Rc::new(Cell::new(0));
        let call_count_clone = call_count.clone();

        let result: RetryResult<i32> = executor
            .execute(move || {
                call_count_clone.set(call_count_clone.get() + 1);
                let current = call_count_clone.get();
                Box::pin(async move {
                    if current < 3 {
                        Err(anyhow::anyhow!("network error"))
                    } else {
                        Ok(42)
                    }
                })
            })
            .await;

        assert!(result.success);
        assert_eq!(result.result, Some(42));
        assert_eq!(result.attempts, 3);
        assert_eq!(call_count.get(), 3);
    }

    #[tokio::test]
    async fn test_retry_failure_on_max_attempts() {
        let mut config = RetryConfig::default();
        config.max_attempts = 2;
        config.initial_delay_secs = 0;
        config.log_retries = false;

        let executor = RetryExecutor::with_config(config);

        let result: RetryResult<i32> = executor
            .execute(|| Box::pin(async move { Err(anyhow::anyhow!("network error")) }))
            .await;

        assert!(!result.success);
        assert_eq!(result.attempts, 2);
        assert_eq!(result.errors.len(), 2);
    }

    #[tokio::test]
    async fn test_retry_non_retryable_error() {
        let mut config = RetryConfig::default();
        config.max_attempts = 5;
        config.initial_delay_secs = 0;
        config.log_retries = false;

        let executor = RetryExecutor::with_config(config);

        let result: RetryResult<i32> = executor
            .execute(|| Box::pin(async move { Err(anyhow::anyhow!("authentication error")) }))
            .await;

        assert!(!result.success);
        assert_eq!(result.attempts, 1); // Should stop immediately
    }
}

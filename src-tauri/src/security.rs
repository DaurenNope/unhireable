use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use regex::Regex;

// Rate limiting
pub struct RateLimiter {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    max_requests: usize,
    window_seconds: u64,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_seconds: u64) -> Self {
        RateLimiter {
            requests: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window_seconds,
        }
    }

    pub async fn check_rate_limit(&self, key: &str) -> Result<bool> {
        let mut requests = self.requests.lock().await;
        let now = Instant::now();
        let window = Duration::from_secs(self.window_seconds);

        // Clean up old requests
        let entry = requests.entry(key.to_string()).or_insert_with(Vec::new);
        entry.retain(|&time| now.duration_since(time) < window);

        // Check if limit exceeded
        if entry.len() >= self.max_requests {
            return Ok(false);
        }

        // Add current request
        entry.push(now);
        Ok(true)
    }

    pub async fn reset(&self, key: &str) {
        let mut requests = self.requests.lock().await;
        requests.remove(key);
    }
}

// Enhanced input validation
pub struct InputValidator;

impl InputValidator {
    /// Validate email address format
    pub fn validate_email(email: &str) -> bool {
        let email_regex = Regex::new(
            r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        ).unwrap();
        email_regex.is_match(email)
    }

    /// Validate URL format
    pub fn validate_url(url: &str) -> bool {
        url::Url::parse(url).is_ok()
    }

    /// Validate string length and content
    pub fn validate_string(input: &str, max_len: usize) -> Result<()> {
        if input.is_empty() {
            return Err(anyhow!("Input cannot be empty"));
        }
        if input.len() > max_len {
            return Err(anyhow!("Input exceeds maximum length of {}", max_len));
        }
        Ok(())
    }

    /// Sanitize input to prevent XSS and injection.
    /// `&` is replaced first so that subsequent substitutions are not double-escaped.
    pub fn sanitize_input(input: &str) -> String {
        input
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#x27;")
            .replace('\0', "")
    }

    /// Check for SQL injection patterns (defense in depth - queries should still use parameters)
    pub fn validate_sql_injection(input: &str) -> Result<()> {
        let dangerous_patterns = [
            "';", "--", "/*", "*/", "xp_", "sp_",
            "exec(", "execute(", "union select", "union all select",
            "drop table", "drop database", "delete from", "truncate table",
            "insert into", "update set", "alter table", "create table",
            "script>", "javascript:", "onerror=", "onload=",
        ];

        let lower_input = input.to_lowercase();
        for pattern in &dangerous_patterns {
            if lower_input.contains(pattern) {
                return Err(anyhow!("Potentially dangerous pattern detected: {}", pattern));
            }
        }
        Ok(())
    }

    /// Validate job title
    pub fn validate_job_title(title: &str) -> Result<()> {
        Self::validate_string(title, 200)?;
        Self::validate_sql_injection(title)?;
        Ok(())
    }

    /// Validate company name
    pub fn validate_company_name(company: &str) -> Result<()> {
        Self::validate_string(company, 200)?;
        Self::validate_sql_injection(company)?;
        Ok(())
    }

    /// Validate URL and check for dangerous protocols
    pub fn validate_safe_url(url: &str) -> Result<()> {
        let parsed = url::Url::parse(url)
            .map_err(|_| anyhow!("Invalid URL format"))?;
        
        // Only allow http/https protocols
        match parsed.scheme() {
            "http" | "https" => Ok(()),
            "javascript" | "data" | "file" => Err(anyhow!("Dangerous URL protocol not allowed")),
            _ => Err(anyhow!("Unsupported URL protocol")),
        }
    }

    /// Validate API key format
    pub fn validate_api_key(key: &str) -> Result<()> {
        if key.is_empty() {
            return Err(anyhow!("API key cannot be empty"));
        }
        if key.len() < 20 {
            return Err(anyhow!("API key appears to be too short"));
        }
        // Check for common placeholder patterns
        if key.contains("your") || key.contains("example") || key.contains("placeholder") {
            return Err(anyhow!("API key appears to be a placeholder"));
        }
        Ok(())
    }

    /// Validate file path to prevent path traversal
    pub fn validate_file_path(path: &str) -> Result<()> {
        // Check for path traversal patterns
        if path.contains("..") || path.contains("~") || path.starts_with("/") {
            return Err(anyhow!("Invalid file path: path traversal detected"));
        }
        // Check for dangerous characters
        if path.contains('\0') || path.contains('\n') || path.contains('\r') {
            return Err(anyhow!("Invalid file path: contains dangerous characters"));
        }
        Ok(())
    }
}

// Secrets management with proper encryption
pub struct SecretsManager {
    encryption_key: Vec<u8>,
}

impl SecretsManager {
    pub fn new(key: &[u8]) -> Self {
        SecretsManager {
            encryption_key: key.to_vec(),
        }
    }

    /// Encrypt data (currently using hashing - should be upgraded to proper encryption)
    /// Note: This is a placeholder. For production, use AES-256-GCM or similar
    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&self.encryption_key);
        hasher.update(plaintext.as_bytes());
        let hash = hasher.finalize();
        use base64::{Engine as _, engine::general_purpose};
        Ok(general_purpose::STANDARD.encode(&hash[..]))
    }

    /// Verify encrypted data
    pub fn verify(&self, plaintext: &str, hash: &str) -> Result<bool> {
        let computed = self.encrypt(plaintext)?;
        Ok(computed == hash)
    }

    /// Default instance for password hashing
    pub fn default() -> Self {
        // Use a default key derived from the application
        // In production, this should come from secure storage
        let default_key = b"unhireable-default-key-change-in-production";
        Self::new(default_key)
    }

    /// Hash a password for storage
    pub fn hash_password(&self, password: &str) -> Result<String> {
        use sha2::{Sha256, Digest};
        use rand::Rng;
        
        // Generate a random salt
        let salt: [u8; 16] = rand::thread_rng().gen();
        
        // Hash password with salt
        let mut hasher = Sha256::new();
        hasher.update(&salt);
        hasher.update(password.as_bytes());
        hasher.update(&self.encryption_key);
        let hash = hasher.finalize();
        
        // Combine salt and hash
        let mut combined = Vec::new();
        combined.extend_from_slice(&salt);
        combined.extend_from_slice(&hash[..]);
        
        use base64::{Engine as _, engine::general_purpose};
        Ok(general_purpose::STANDARD.encode(&combined))
    }

    /// Verify a password against a hash
    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        use base64::{Engine as _, engine::general_purpose};
        use sha2::{Sha256, Digest};
        
        let combined = general_purpose::STANDARD.decode(hash)?;
        if combined.len() < 16 {
            return Ok(false);
        }
        
        let salt = &combined[0..16];
        let stored_hash = &combined[16..];
        
        let mut hasher = Sha256::new();
        hasher.update(salt);
        hasher.update(password.as_bytes());
        hasher.update(&self.encryption_key);
        let computed_hash = hasher.finalize();
        
        Ok(&computed_hash[..] == stored_hash)
    }
}

// Secure logging utilities
pub struct SecureLogger;

impl SecureLogger {
    /// Sanitize data before logging to prevent sensitive information leakage
    pub fn sanitize_for_logging(data: &str) -> String {
        // Remove potential API keys (common patterns)
        let mut sanitized = data.to_string();
        
        // Replace common sensitive patterns
        // Note: This is a simplified approach - for production, consider using a proper regex library
        let sensitive_patterns = [
            "api_key", "apikey", "api-key", "token", "secret", "password"
        ];
        
        // Simple string-based redaction for common patterns
        let lower_data = data.to_lowercase();
        for pattern in &sensitive_patterns {
            if lower_data.contains(pattern) {
                // Try to find and redact the value after the pattern
                // This is a basic implementation - can be enhanced
                sanitized = sanitized.replace(
                    &format!("{}:", pattern),
                    &format!("{}: ***REDACTED***", pattern)
                );
                sanitized = sanitized.replace(
                    &format!("{}= ", pattern),
                    &format!("{}= ***REDACTED*** ", pattern)
                );
            }
        }
        
        // Redact OpenAI-style keys (sk-...)
        if lower_data.contains("sk-") {
            let re = Regex::new(r"sk-[a-zA-Z0-9]{32,}").unwrap();
            sanitized = re.replace_all(&sanitized, "sk-***REDACTED***").to_string();
        }
        
        // Replace email patterns (optional - may want to keep emails)
        // let email_pattern = Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap();
        // sanitized = email_pattern.replace_all(&sanitized, "***@***.***").to_string();
        
        sanitized
    }

    /// Check if string contains sensitive information
    pub fn contains_sensitive_data(data: &str) -> bool {
        let sensitive_patterns = [
            r"(?i)api[_-]?key",
            r"(?i)password",
            r"(?i)secret",
            r"(?i)token",
            r"(?i)credential",
            r"sk-[a-zA-Z0-9]{32,}",  // OpenAI key pattern
        ];
        
        for pattern in &sensitive_patterns {
            if Regex::new(pattern).unwrap().is_match(data) {
                return true;
            }
        }
        false
    }
}

// File validation
pub struct FileValidator;

impl FileValidator {
    /// Validate file type by extension
    pub fn validate_file_type(filename: &str, allowed_types: &[&str]) -> Result<()> {
        let ext = filename
            .rsplit('.')
            .next()
            .ok_or_else(|| anyhow!("No file extension found"))?;
        
        let ext_lower = ext.to_lowercase();
        if !allowed_types.iter().any(|&t| t.to_lowercase() == ext_lower) {
            return Err(anyhow!(
                "File type '{}' not allowed. Allowed types: {:?}",
                ext,
                allowed_types
            ));
        }
        Ok(())
    }

    /// Validate file size
    pub fn validate_file_size(size: u64, max_size_mb: u64) -> Result<()> {
        let max_size_bytes = max_size_mb * 1024 * 1024;
        if size > max_size_bytes {
            return Err(anyhow!(
                "File size {} MB exceeds maximum allowed size of {} MB",
                size / 1024 / 1024,
                max_size_mb
            ));
        }
        Ok(())
    }

    /// Validate file path
    pub fn validate_file_path(path: &str) -> Result<()> {
        InputValidator::validate_file_path(path)
    }
}

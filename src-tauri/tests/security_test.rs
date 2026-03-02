/// Security and credential vault tests.
///
/// Vault tests are marked `#[ignore]` because they require a real OS keychain
/// (not available in CI sandboxes). Run them locally with:
///
///   cargo test --test security_test -- --include-ignored
use unhireable_lib::security::{InputValidator, RateLimiter, SecureLogger};

// ── InputValidator ────────────────────────────────────────────────────────────

#[test]
fn test_validate_email_valid() {
    assert!(InputValidator::validate_email("user@example.com"));
    assert!(InputValidator::validate_email("user.name+tag@subdomain.example.co.uk"));
}

#[test]
fn test_validate_email_invalid() {
    assert!(!InputValidator::validate_email("not-an-email"));
    assert!(!InputValidator::validate_email("@example.com"));
    assert!(!InputValidator::validate_email("user@"));
    assert!(!InputValidator::validate_email(""));
}

#[test]
fn test_validate_url_valid() {
    assert!(InputValidator::validate_url("https://example.com"));
    assert!(InputValidator::validate_url("http://localhost:3000/path?q=1"));
}

#[test]
fn test_validate_url_invalid() {
    assert!(!InputValidator::validate_url("not a url"));
    assert!(!InputValidator::validate_url("ftp"));
}

#[test]
fn test_validate_safe_url_rejects_dangerous_protocols() {
    assert!(InputValidator::validate_safe_url("https://example.com").is_ok());
    assert!(InputValidator::validate_safe_url("http://example.com").is_ok());
    assert!(InputValidator::validate_safe_url("javascript:alert(1)").is_err());
    assert!(InputValidator::validate_safe_url("data:text/html,<h1>test</h1>").is_err());
    assert!(InputValidator::validate_safe_url("file:///etc/passwd").is_err());
}

#[test]
fn test_sanitize_input_escapes_html() {
    let input = r#"<script>alert("xss")</script>"#;
    let sanitized = InputValidator::sanitize_input(input);
    assert!(!sanitized.contains('<'));
    assert!(!sanitized.contains('>'));
    assert!(sanitized.contains("&lt;"));
    assert!(sanitized.contains("&gt;"));
}

#[test]
fn test_validate_sql_injection_blocks_dangerous_patterns() {
    assert!(InputValidator::validate_sql_injection("'; DROP TABLE users;--").is_err());
    assert!(InputValidator::validate_sql_injection("1 UNION SELECT * FROM credentials").is_err());
    assert!(InputValidator::validate_sql_injection("normal search query").is_ok());
    assert!(InputValidator::validate_sql_injection("Senior React Developer").is_ok());
}

#[test]
fn test_validate_file_path_blocks_traversal() {
    assert!(InputValidator::validate_file_path("../../../etc/passwd").is_err());
    assert!(InputValidator::validate_file_path("~/secret").is_err());
    assert!(InputValidator::validate_file_path("/absolute/path").is_err());
    assert!(InputValidator::validate_file_path("relative/path.pdf").is_ok());
}

#[test]
fn test_validate_api_key_rejects_placeholders() {
    assert!(InputValidator::validate_api_key("your-api-key-here").is_err());
    assert!(InputValidator::validate_api_key("sk-example-key").is_err());
    assert!(InputValidator::validate_api_key("").is_err());
    // Short keys
    assert!(InputValidator::validate_api_key("short").is_err());
    // A realistic-looking key
    assert!(InputValidator::validate_api_key("sk-proj-abcdefghijklmnopqrstuvwxyz12345").is_ok());
}

// ── SecureLogger ──────────────────────────────────────────────────────────────

#[test]
fn test_secure_logger_detects_sensitive_data() {
    assert!(SecureLogger::contains_sensitive_data("api_key=abc123"));
    assert!(SecureLogger::contains_sensitive_data("password: hunter2"));
    assert!(SecureLogger::contains_sensitive_data("sk-abcdefghijklmnopqrstuvwxyz123456"));
    assert!(!SecureLogger::contains_sensitive_data("normal log line"));
    assert!(!SecureLogger::contains_sensitive_data("job title: Senior Engineer"));
}

#[test]
fn test_secure_logger_redacts_openai_keys() {
    let log = "Using key sk-abcdefghijklmnopqrstuvwxyz123456 for request";
    let sanitized = SecureLogger::sanitize_for_logging(log);
    assert!(!sanitized.contains("sk-abcdefghijklmnopqrstuvwxyz123456"));
    assert!(sanitized.contains("REDACTED"));
}

// ── RateLimiter ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_rate_limiter_allows_within_limit() {
    let limiter = RateLimiter::new(5, 60);
    for _ in 0..5 {
        let allowed = limiter.check_rate_limit("test_key").await.unwrap();
        assert!(allowed, "Request within limit should be allowed");
    }
}

#[tokio::test]
async fn test_rate_limiter_blocks_over_limit() {
    let limiter = RateLimiter::new(3, 60);
    for _ in 0..3 {
        limiter.check_rate_limit("key").await.unwrap();
    }
    let blocked = limiter.check_rate_limit("key").await.unwrap();
    assert!(!blocked, "4th request should be blocked");
}

#[tokio::test]
async fn test_rate_limiter_separate_keys_are_independent() {
    let limiter = RateLimiter::new(1, 60);
    let first = limiter.check_rate_limit("key_a").await.unwrap();
    assert!(first);
    let second = limiter.check_rate_limit("key_a").await.unwrap();
    assert!(!second, "key_a should be blocked after 1 request");

    // key_b has its own counter
    let key_b = limiter.check_rate_limit("key_b").await.unwrap();
    assert!(key_b, "key_b should still be allowed");
}

#[tokio::test]
async fn test_rate_limiter_reset_clears_counter() {
    let limiter = RateLimiter::new(1, 60);
    limiter.check_rate_limit("reset_key").await.unwrap();
    let blocked = limiter.check_rate_limit("reset_key").await.unwrap();
    assert!(!blocked);

    limiter.reset("reset_key").await;
    let allowed_again = limiter.check_rate_limit("reset_key").await.unwrap();
    assert!(allowed_again, "After reset, requests should be allowed again");
}

// ── Vault (OS keychain) ───────────────────────────────────────────────────────
// These require a real keychain daemon and are skipped in CI.

#[test]
#[ignore = "requires OS keychain (run locally with --include-ignored)"]
fn test_vault_store_and_load() {
    let platform = "test-platform-vault";
    let secret = "super-secret-api-key-for-testing";

    unhireable_lib::vault::store(platform, "tokens", secret).expect("store should succeed");
    let loaded = unhireable_lib::vault::load(platform, "tokens")
        .expect("load should succeed")
        .expect("secret should be present");
    assert_eq!(loaded, secret);

    // Cleanup
    unhireable_lib::vault::delete(platform, "tokens").expect("delete should succeed");
}

#[test]
#[ignore = "requires OS keychain (run locally with --include-ignored)"]
fn test_vault_load_missing_returns_none() {
    let result = unhireable_lib::vault::load("nonexistent-platform-xyz", "tokens")
        .expect("load should not error for missing entry");
    assert!(result.is_none(), "Missing entry should return None");
}

#[test]
#[ignore = "requires OS keychain (run locally with --include-ignored)"]
fn test_vault_delete_all() {
    let platform = "test-platform-delete-all";
    unhireable_lib::vault::store(platform, "tokens", "tok").unwrap();
    unhireable_lib::vault::store(platform, "password", "pw").unwrap();
    unhireable_lib::vault::store(platform, "cookies", "ck").unwrap();

    unhireable_lib::vault::delete_all(platform).expect("delete_all should succeed");

    assert!(unhireable_lib::vault::load(platform, "tokens").unwrap().is_none());
    assert!(unhireable_lib::vault::load(platform, "password").unwrap().is_none());
    assert!(unhireable_lib::vault::load(platform, "cookies").unwrap().is_none());
}

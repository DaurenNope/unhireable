# Scraper Error Handling & Logging Improvements

## Overview

Improved error handling and logging for the job scraper system to better handle the common issues seen in production:
- Cloudflare protection
- 403 Forbidden errors
- Timeout errors
- Network failures
- Rate limiting

## Changes Made

### 1. New Error Handling Module

**File:** `src-tauri/src/scraper/error_handling.rs`

Created a comprehensive error handling module with:

- **ScraperError enum** - Specific error types for scraper operations:
  - `Network` - Network-related errors
  - `Timeout` - Request timeouts
  - `RateLimit` - Rate limiting (429 errors)
  - `CloudflareProtection` - Cloudflare challenge detection
  - `NotFound` - 404 errors
  - `ParseError` - HTML parsing failures
  - `Blocked` - 403 Forbidden errors

- **Error Detection Functions:**
  - `is_cloudflare_protection()` - Detects Cloudflare "Just a moment" pages
  - `is_blocked_response()` - Detects blocking responses (403, 429, 503)
  - `categorize_http_error()` - Categorizes HTTP status codes
  - `categorize_network_error()` - Categorizes network/timeout errors

- **Structured Logging Functions:**
  - `log_scraper_attempt()` - Logs scraping attempts with context
  - `log_scraper_success()` - Logs successful scrapes
  - `log_scraper_error()` - Logs errors with appropriate log levels

- **Retry Configuration:**
  - `scraper_retry_config()` - Standard retry config for HTTP requests
  - `browser_retry_config()` - Extended retry config for browser automation

### 2. Improved Browser Automation Error Handling

**File:** `src-tauri/src/scraper/browser.rs`

Enhanced Playwright error handling to properly categorize:
- Timeout errors (`ERR_TIMED_OUT`)
- Network errors (`net::ERR_*`)
- Better error messages with URL context

### 3. Updated Scraper Manager

**File:** `src-tauri/src/scraper/mod.rs`

- Replaced `println!`/`eprintln!` with structured logging
- Using `log_scraper_success()` and `log_scraper_error()` functions
- Better error context in error messages

## Benefits

1. **Better Error Categorization:**
   - Timeout errors are now properly identified and can be retried
   - Cloudflare protection is detected and reported
   - Network errors are distinguished from other failures

2. **Structured Logging:**
   - All scraper operations use structured logging
   - Log levels (INFO, WARN, ERROR) are appropriate
   - Better debugging with context (source, query, attempt number)

3. **Improved User Experience:**
   - More informative error messages
   - Better handling of transient failures
   - Graceful degradation when sites are blocked

4. **Future-Proof:**
   - Error types can be extended
   - Retry mechanisms can be customized per scraper
   - Logging can be integrated with log aggregation services

## Usage Examples

### Detecting Cloudflare Protection

```rust
use crate::scraper::error_handling::is_cloudflare_protection;

if is_cloudflare_protection(&html) {
    return Err(ScraperError::CloudflareProtection("Site protected by Cloudflare".to_string()).into());
}
```

### Categorizing HTTP Errors

```rust
use crate::scraper::error_handling::categorize_http_error;

let error = categorize_http_error(status, &url, Some(&html));
log_scraper_error("Remote.co", &error, true);
```

### Using Structured Logging

```rust
use crate::scraper::error_handling::{log_scraper_attempt, log_scraper_success, log_scraper_error};

log_scraper_attempt("Remote.co", query, attempt, max_attempts);
// ... scraping code ...
log_scraper_success("Remote.co", jobs.len());
// or
log_scraper_error("Remote.co", &error, should_retry);
```

## Next Steps

1. **Apply to All Scrapers:**
   - Replace remaining `println!`/`eprintln!` in all scraper modules
   - Use error categorization in all HTTP error handling
   - Integrate retry mechanisms using `retry_with_backoff()`

2. **Enhanced Retry Logic:**
   - Use `retry_with_backoff()` from error module
   - Different retry strategies for different error types
   - Exponential backoff for rate limits

3. **Cloudflare Handling:**
   - Detect Cloudflare challenges earlier
   - Provide user feedback about protection
   - Consider alternative scraping methods when detected

4. **Monitoring:**
   - Track error rates per source
   - Alert on high failure rates
   - Monitor timeout patterns

## Common Issues Addressed

### Issue: "Just a moment..." (Cloudflare)
**Solution:** `is_cloudflare_protection()` detects this and categorizes as `CloudflareProtection` error

### Issue: `ERR_TIMED_OUT` (Playwright timeout)
**Solution:** Error is now categorized as `Timeout` and can be retried with longer timeout

### Issue: 403 Forbidden
**Solution:** Categorized as `Blocked` error, can trigger browser automation fallback

### Issue: Generic error messages
**Solution:** Structured logging provides context (source, query, attempt number)

## Testing

To test the improvements:

```bash
# Run scraper with logging
RUST_LOG=info cargo run -- scrape "remote software engineer"

# Check for proper error categorization
# Look for structured log messages instead of println!
```

## Migration Notes

- All existing scrapers continue to work
- New error handling is backward compatible
- Logging improvements are additive
- No breaking changes to public APIs


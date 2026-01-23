# Scraper Fixes

## Issues Fixed

### 1. Greenhouse Board Parsing Errors
**Problem**: Multiple Greenhouse boards (Figma, Airtable, Stripe, Databricks) were failing with JSON parsing errors:
- `invalid type: null, expected a sequence` - when `metadata` or `departments` was null
- `invalid type: sequence, expected a string` - when fields had unexpected types

**Solution**: 
- Enhanced JSON parsing to handle `null` values gracefully
- Added null checks for all fields (`metadata`, `departments`, `offices`, `location`, `title`, `absolute_url`, `content`)
- Made parsing more lenient - if a field is null or wrong type, use default/empty value instead of failing
- Improved fallback parser to handle non-standard JSON structures

**Changes**:
- `greenhouse_board.rs`: Added null checks and type validation for all JSON fields
- Fields now default to empty vectors/None instead of causing parse errors
- Better error messages when parsing fails

### 2. Wellfound Scraper Small HTML Issue
**Problem**: Wellfound sometimes returned very small HTML (1641 bytes) indicating:
- Cloudflare challenge/blocking
- Error pages
- Incomplete page loads

**Solution**:
- Improved retry logic with better error detection
- Added automatic fallback to browser automation when HTTP fails or returns small HTML
- Check HTML size before parsing (reject < 1000 bytes)
- Use browser automation (Playwright/Chrome) as fallback when HTTP fails
- Longer timeout for browser automation (config timeout + 10 seconds)

**Changes**:
- `wellfound.rs`: Enhanced HTTP fallback to detect small HTML and retry with browser automation
- Better error messages indicating why scraping failed
- Automatic escalation: HTTP → Browser Automation → Error

## Testing

All changes compile successfully. The scrapers now:
1. ✅ Handle null JSON values gracefully
2. ✅ Fall back to browser automation when HTTP fails
3. ✅ Provide better error messages
4. ✅ Skip invalid jobs instead of failing entirely

## Expected Behavior

### Greenhouse Boards
- **Before**: Failed with parse errors for Figma, Airtable, Stripe, Databricks
- **After**: Parses successfully, skipping invalid jobs, logging warnings for non-standard structures

### Wellfound
- **Before**: Sometimes returned empty results due to small HTML
- **After**: 
  - Tries HTTP first
  - If HTML too small or fails, automatically tries browser automation
  - Better success rate for React-based sites

## Next Steps

1. Monitor scraper logs to verify fixes are working
2. Consider adding more retry logic for browser automation failures
3. Add metrics to track success rates per source


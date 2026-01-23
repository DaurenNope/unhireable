# Wellfound Scraper Fixes

## Problems Identified

1. **Category/Listing Pages Being Scraped**
   - Jobs like "View all engineering jobs at TULU"
   - Jobs like "Remote Software Engineer Jobs at TULU"
   - URLs like `/role/l/software-engineer/san-francisco` (category pages)
   - URLs like `/jobs?query=...` (search pages)

2. **Small HTML Responses**
   - Many pages returning ~1600 bytes (error/redirect pages)
   - React content not loading properly
   - Pages requiring authentication

3. **Low Enrichment Success Rate**
   - Only 27/127 jobs (21%) successfully enriched
   - Many jobs have invalid URLs (category pages)

## Fixes Applied

### 1. Filter Out Category/Listing Pages

**Title Filtering:**
- Skip titles containing "view all"
- Skip titles containing "jobs at" or "jobs in"
- Skip titles ending with " jobs"
- Skip titles starting with "remote " and containing " jobs"

**URL Filtering:**
- Skip URLs containing `/role/l/` (category pages)
- Skip URLs containing `/jobs?` (search pages)
- Skip URLs containing `/startup-jobs?` (search pages)
- Skip URLs ending with `/jobs` or `/startup-jobs` (category pages)
- Don't create default search URLs - skip jobs without valid URLs

### 2. Improved Enrichment Validation

**HTML Size Check:**
- Require HTML > 5000 bytes (was 1000)
- Small pages (< 5000 bytes) are likely error/redirect pages
- Don't try HTTP fallback for Wellfound (won't work for React sites)

**Better Error Handling:**
- Return errors instead of silently failing
- Log when pages are too small
- Don't count failed enrichments as successful

### 3. Longer Timeout for React Rendering

- Increased timeout from 30s to 45s
- Gives React more time to render content

## Expected Results

**Before:**
- 87 jobs scraped (many category pages)
- 27/127 enriched (21% success)
- Many "View all jobs" entries
- Many small HTML responses

**After:**
- Fewer jobs scraped (only real job postings)
- Higher enrichment success rate
- No category/listing pages
- Better description extraction

## Files Modified

1. `src-tauri/src/scraper/wellfound.rs` - Added title and URL filtering
2. `src-tauri/src/scraper/job_enricher.rs` - Improved validation and error handling

## Next Steps

1. Test scraping to verify category pages are filtered
2. Monitor enrichment success rate
3. Update selectors if Wellfound changes their structure
4. Consider adding more specific job URL patterns


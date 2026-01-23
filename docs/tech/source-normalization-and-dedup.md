# Source Normalization & Automatic Deduplication

## Issues Fixed

### 1. Source Name Inconsistency
**Problem**: Jobs had inconsistent source names:
- "RemoteOK" (16 jobs) vs "remoteok" (28 jobs)
- "Wellfound" vs "wellfound"
- Case sensitivity causing duplicate sources in statistics

**Solution**: 
- Created `source_normalizer` module to normalize all source names to lowercase
- Maps common variations (e.g., "RemoteOK", "remote_ok" → "remoteok")
- Applied normalization when saving jobs
- Migration (0010) to normalize existing jobs in database

### 2. Automatic Deduplication
**Problem**: Same job appears on multiple boards, creating duplicates

**Solution**:
- Automatic deduplication runs after scraping (if ≤100 new jobs)
- Uses 85% similarity threshold (title + company matching)
- Merges duplicates, keeping best information from all sources
- Updates primary job, deletes duplicates

## Implementation

### Source Normalization
- **Module**: `src-tauri/src/scraper/source_normalizer.rs`
- **Function**: `normalize_source_name()` - normalizes to lowercase and maps variations
- **Applied**: When creating jobs in scrapers, before saving to database

### Automatic Deduplication
- **Trigger**: After scraping, if ≤100 new jobs saved
- **Algorithm**: Fuzzy matching (85% similarity threshold)
- **Process**:
  1. Find duplicate groups
  2. Merge jobs (keep best description, requirements, salary, etc.)
  3. Update primary job
  4. Delete duplicates

### Migration
- **File**: `0010_normalize_source_names.sql`
- **Purpose**: Normalize existing source names in database
- **Auto-skip**: If source names already normalized

## Benefits

1. **Consistent Statistics**: Source counts are now accurate
2. **Cleaner Database**: No duplicate jobs from multiple sources
3. **Better Data**: Merged jobs have complete information
4. **Automatic**: Runs after every scrape (for reasonable job counts)

## Usage

### Manual Deduplication
```rust
// Find duplicates
let duplicates = find_duplicate_jobs(state, Some(0.85)).await?;

// Merge duplicates
for (primary_job, duplicate_ids) in duplicates {
    merge_duplicate_jobs(state, primary_job.id, duplicate_ids).await?;
}
```

### Normalize Source Names
Source names are automatically normalized when:
- Jobs are scraped
- Jobs are saved to database
- Migration runs on app startup

## Testing

All tests passing:
- ✅ Source normalization tests
- ✅ Deduplication tests (3/3)
- ✅ All compilation successful

## Next Steps

1. **Run migration**: Will normalize existing 776 jobs on next app start
2. **Test deduplication**: Run `find_duplicate_jobs` API to see duplicates
3. **Monitor**: Check logs for "Merged X duplicate job groups" after scraping


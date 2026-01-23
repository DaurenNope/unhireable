# What Are "Fake Jobs"?

## They're Not Actually Fake - They're Navigation Pages!

The term "fake jobs" is misleading. These aren't fraudulent postings - they're **navigation/category pages** that the scraper incorrectly treats as individual job postings.

## Examples from Your Logs

### ❌ Category/Listing Pages (NOT Real Jobs):

1. **"View all engineering jobs at TULU"**
   - This is a **link to browse all engineering jobs** at TULU
   - URL: `https://wellfound.com/company/tulu/jobs?department=engineering`
   - When clicked, shows a list of multiple jobs, not one specific job

2. **"Remote Software Engineer Jobs at TULU"**
   - This is a **category page** showing all remote software engineer jobs
   - URL: `https://wellfound.com/role/l/software-engineer/remote`
   - Shows multiple jobs, not a single job posting

3. **"Software Engineer Jobs in San Francisco at TULU"**
   - This is a **location-based category page**
   - URL: `https://wellfound.com/role/l/software-engineer/san-francisco`
   - Shows all software engineer jobs in SF, not one specific job

4. **"Solution Consultant - R&D at TULU"** (The one you complained about)
   - This **IS a real job** ✅
   - But it has no description because the scraper got the wrong URL or the page didn't load

## How to Tell the Difference

### Real Job Posting:
- ✅ Has a specific job title (e.g., "Senior Backend Engineer")
- ✅ URL like: `/jobs/123456` or `/startup-jobs/789012`
- ✅ Has a full job description when you visit the page
- ✅ Has requirements, responsibilities, etc.

### Category/Listing Page:
- ❌ Title like "View all [category] jobs"
- ❌ Title like "[Role] Jobs in [Location]"
- ❌ URL like `/role/l/software-engineer/san-francisco` (category page)
- ❌ URL like `/jobs?query=...` (search results page)
- ❌ URL like `/company/tulu/jobs` (company jobs listing)
- ❌ No description (because it's not a job, it's a listing page)

## Why This Happens

Wellfound's HTML structure includes:
1. **Actual job postings** - links to individual jobs
2. **Navigation links** - "View all jobs", "Browse by category", etc.
3. **Category pages** - "All software engineer jobs in SF"

The scraper was picking up ALL links, including navigation/category links, and treating them as jobs.

## The Fix

I added filters to skip:
- Titles containing "view all", "jobs at", "jobs in"
- Titles ending with " jobs"
- URLs containing `/role/l/` (category pages)
- URLs containing `/jobs?` (search pages)
- URLs ending with `/jobs` (listing pages)

Now the scraper only keeps **actual job postings** with real URLs to individual job pages.

## Result

**Before:**
- 87 jobs scraped (many were category pages)
- "View all engineering jobs" ❌
- "Remote Software Engineer Jobs" ❌
- "Solution Consultant - R&D" ✅ (but no description)

**After:**
- Fewer jobs scraped (only real postings)
- No category pages ✅
- Only actual job postings ✅
- Better chance of getting descriptions ✅

## The Real Problem

The "Solution Consultant - R&D" job you saw **IS a real job**, but:
1. It might have been scraped from a category page (wrong URL)
2. Or the enrichment failed because the page didn't load properly
3. Or Wellfound's selectors need updating

The fixes should help, but we may need to debug specific jobs that still fail.


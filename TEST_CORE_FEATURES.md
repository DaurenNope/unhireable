# Core Features Test Plan

## What Should Actually Work

1. **Jobs**
   - ✅ Scrape jobs (demo mode works)
   - ✅ View jobs in list
   - ✅ Filter and search jobs
   - ❓ Match scores (needs profile)

2. **Profile Management**
   - ✅ Create profile in Settings
   - ❌ Save to database (currently localStorage only)
   - ✅ Load profile
   - ❓ Use profile for matching

3. **Match Scores**
   - ❓ Calculate match scores
   - ❓ Display match scores
   - ❓ Filter by match score

4. **Applications**
   - ✅ Create application
   - ✅ View applications
   - ✅ Update application status
   - ✅ Delete application

5. **Documents**
   - ❓ Generate resume (needs OpenAI API key or fallback)
   - ❓ Generate cover letter (needs OpenAI API key or fallback)
   - ❓ Export to PDF

## Issues to Fix

1. Profile should be saved to database, not just localStorage
2. Match score calculation should work reliably
3. Document generation should work without API key (basic templates)
4. Better error messages and user feedback
5. Applications should work end-to-end


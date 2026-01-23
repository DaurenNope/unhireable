# Troubleshooting Guide

## App Won't Start

### Port 3003 Already in Use
```bash
# Kill process on port 3003
lsof -ti:3003 | xargs kill -9

# Or use the updated script (auto-kills port)
npm run tauri:dev
```

### Dependencies Not Installed
```bash
cd frontend
npm install
cd ..
npm run tauri:dev
```

### Rust Not Installed
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## App Starts But Features Don't Work

### 1. Jobs Not Showing

**Problem**: Click "Scrape Jobs" but nothing appears.

**Solution**:
- The default query is "demo" which should show 8 sample jobs
- Check browser console (F12) for errors
- Check Rust console for backend errors
- Try clicking "Scrape Jobs" again

**Verify**:
```bash
# Check if jobs are in database
# The database is at: ~/Library/Application Support/unhireable/jobhunter.db
```

### 2. Profile Not Saving

**Problem**: Save profile but it doesn't persist.

**Solution**:
- Check browser console for errors
- Verify database migration 0006 ran (user_profile table exists)
- Try saving again - it should save to database

**Verify**:
- Open Settings → Profile
- Fill in your info
- Click Save
- Refresh page - profile should still be there

### 3. Match Scores Not Calculating

**Problem**: Click "Calculate Match Scores" but nothing happens.

**Solution**:
- Make sure you have a profile (Settings → Profile)
- Make sure you have jobs (scrape jobs first)
- Check browser console for errors
- The calculation happens in background - wait a few seconds

### 4. Document Generation Not Working

**Problem**: Try to generate resume/cover letter but it fails.

**Solution**:
- Make sure you have a profile (Settings → Profile)
- Make sure you selected a job
- Document generation works WITHOUT OpenAI API key (uses basic templates)
- Check browser console for errors

### 5. Applications Not Creating

**Problem**: Try to create application but it doesn't save.

**Solution**:
- Make sure you selected a job first
- Check browser console for errors
- Try creating from Jobs page → click job → Create Application

## Common Errors

### "Database not initialized"
- The app should auto-initialize on startup
- Check Rust console for database errors
- Delete database and restart: `rm ~/Library/Application Support/unhireable/jobhunter.db`

### "Failed to load jobs"
- Check if database exists
- Check Rust console for errors
- Try scraping jobs again

### "Profile not found"
- Create a profile in Settings → Profile
- Save the profile
- Reload the page

## Debugging Steps

1. **Check Browser Console** (F12):
   - Look for JavaScript errors
   - Check Network tab for failed API calls
   - Check Console for error messages

2. **Check Rust Console**:
   - Look for backend errors
   - Check for database errors
   - Check for migration errors

3. **Verify Database**:
   ```bash
   # Find database location
   ls -la ~/Library/Application\ Support/unhireable/
   
   # Check if database exists
   file ~/Library/Application\ Support/unhireable/jobhunter.db
   ```

4. **Test API Calls**:
   - Open browser console
   - Try: `await window.__TAURI__.invoke('get_jobs')`
   - Should return array of jobs

5. **Check Logs**:
   - Rust console shows all backend logs
   - Browser console shows all frontend logs
   - Look for error messages

## Quick Fixes

### Reset Everything
```bash
# Delete database
rm ~/Library/Application\ Support/unhireable/jobhunter.db

# Restart app
npm run tauri:dev
```

### Clear Browser Cache
- Close app
- Clear browser cache
- Restart app

### Reinstall Dependencies
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..
npm run tauri:dev
```

## Still Not Working?

1. Check the Rust console for specific error messages
2. Check the browser console (F12) for JavaScript errors
3. Verify all migrations ran successfully
4. Try the test script: `./test_app.sh`
5. Check if the database file exists and is accessible

## Expected Behavior

### First Time Setup:
1. App starts → Shows onboarding
2. Click "Scrape Jobs" → Shows 8 demo jobs
3. Go to Settings → Profile → Add your info → Save
4. Go to Jobs → Click "Calculate Match Scores" → See scores appear
5. Click a job → Generate Documents tab → Generate resume/cover letter

### Normal Usage:
1. Jobs page shows all jobs
2. Can filter by status, search by keyword
3. Can calculate match scores
4. Can create applications
5. Can generate documents

If any of these don't work, check the troubleshooting steps above.











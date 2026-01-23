# Complete Workflow Test Guide

This guide will help you test the complete Unhireable workflow from start to finish.

## Prerequisites Check

Before testing, ensure you have:
1. ✅ Rust installed (`rustc --version`)
2. ✅ Node.js v18+ installed (`node --version`)
3. ✅ Tauri CLI installed (`npm list -g @tauri-apps/cli`)
4. ✅ Frontend dependencies installed (`cd frontend && npm install`)
5. ✅ Playwright installed (optional, for browser automation): `npm install -g playwright && playwright install chromium`

## Test Workflow Steps

### Step 1: Start the Application

```bash
# From the root directory
npm run dev:tauri
```

This will:
- Start the frontend dev server on port 3003
- Compile the Rust backend
- Launch the Tauri desktop app

**Expected Result**: Desktop app window opens with the Dashboard.

### Step 2: First-Run Flow (Profile Setup)

**What to Test:**
1. On first launch, if no profile exists, you should be redirected to Settings → Profile
2. Fill in your profile:
   - Personal Info (name, email, phone, location)
   - Skills (add relevant skills)
   - Experience (add work experience)
   - Education (add education)
3. Click "Save Profile"

**Expected Result:**
- Profile is saved to database
- You're redirected back to Dashboard
- Auto-scraping should start (check console/logs)
- Jobs should be scraped and match scores calculated

### Step 3: Verify Auto-Scraping & Matching

**What to Test:**
1. Check the Dashboard for scraped jobs
2. Verify jobs have match scores
3. Check the "Jobs" page to see all scraped jobs
4. Verify source distribution (RemoteOK, WeWorkRemotely, etc.)

**Expected Result:**
- Jobs appear in the database
- Match scores are calculated (0-100%)
- Jobs are sorted by match score in "Today's Targets"

### Step 4: Manual Scraping

**What to Test:**
1. Go to Dashboard
2. Enter a search query (e.g., "react developer")
3. Select scraping sources (RemoteOK, WeWorkRemotely, etc.)
4. Click "Scrape Jobs"

**Expected Result:**
- Jobs are scraped from selected sources
- New jobs appear in the database
- Match scores are updated
- Source distribution is shown

### Step 5: View Job Details

**What to Test:**
1. Click on a job from the Dashboard or Jobs page
2. View job details:
   - Title, company, location
   - Description
   - Match score
   - Source

**Expected Result:**
- Job details page loads
- All job information is displayed
- Match score is shown

### Step 6: Generate Documents (Test Mode)

**What to Test:**
1. Go to a job detail page
2. Click on "Documents" tab
3. Generate Resume:
   - Click "Generate Resume"
   - Select template (if available)
   - Enable "Improve with AI" (optional)
   - Click "Generate"
4. Generate Cover Letter:
   - Click "Generate Cover Letter"
   - Select template (if available)
   - Enable "Improve with AI" (optional)
   - Click "Generate"
5. Export to PDF:
   - Click "Export to PDF" for resume
   - Click "Export to PDF" for cover letter

**Expected Result:**
- Documents are generated successfully
- PDFs are exported to the app data directory
- Documents are displayed in the UI

### Step 7: Test Application Process (Test Mode)

**Before Testing:**
1. Enable Test Mode in Settings → Applications:
   - Set "Test Mode" to enabled
   - Set "Test Application Endpoint" to `https://httpbin.org/post`

**What to Test:**
1. Go to Dashboard
2. Find a job with high match score
3. Click "Apply" button
4. Select application mode:
   - **Manual**: Form filled, but you review before submitting
   - **Semi-Auto**: Form filled and submitted automatically
   - **YOLO**: Fully automated (use with caution)

**Expected Result:**
- Documents are generated automatically (if enabled)
- Browser automation opens the job URL (or test endpoint)
- Form fields are filled with your profile data
- Application is submitted to test endpoint (not real job)
- Application record is created in database
- Activity is logged

### Step 8: Track Applications

**What to Test:**
1. Go to Applications page
2. View your applications:
   - Status (Preparing, Submitted, Interview Scheduled, etc.)
   - Applied date
   - Notes
3. Update application status
4. Add interviews
5. Add contacts

**Expected Result:**
- Applications are listed
- Status can be updated
- Interviews can be scheduled
- Contacts can be added

### Step 9: Test Email Notifications (Test Mode)

**Before Testing:**
1. Go to Settings → Email Notifications
2. Configure SMTP settings (or use test mode)
3. Enable "Test Mode" in Settings → Applications
4. Set "Test Email Endpoint" to `https://httpbin.org/post`

**What to Test:**
1. Test email connection:
   - Enter SMTP settings
   - Click "Test Connection"
2. Send test email:
   - Enter test email address (or test endpoint)
   - Click "Send Test Email"
   - Enable "Test Mode"
   - Click "Send"

**Expected Result:**
- Email connection test succeeds (or fails with clear error)
- Test email is sent to test endpoint (not real email)
- Response is displayed in the UI

### Step 10: Test Scheduler

**What to Test:**
1. Go to Settings → Scheduler
2. Configure scheduler:
   - Enable scheduler
   - Set schedule (e.g., "0 9 * * *" for daily at 9 AM)
   - Set query (e.g., "developer")
   - Select sources
   - Set minimum match score
3. Click "Save Configuration"
4. Click "Start Scheduler"

**Expected Result:**
- Scheduler configuration is saved
- Scheduler status shows "Running" (green badge)
- Scheduler will run at the scheduled time
- Jobs are scraped automatically
- Match scores are calculated

### Step 11: Verify Status Chips

**What to Test:**
1. Go to Settings
2. Check status chips on tabs:
   - **Email Notifications**: Green when enabled, gray when disabled
   - **Scheduler**: Green (pulsing) when running, yellow when enabled but stopped, gray when disabled

**Expected Result:**
- Status chips reflect current state
- Chips update automatically when settings change

### Step 12: Test Dashboard Features

**What to Test:**
1. View Dashboard:
   - Run Panel (Applications, Interviews, Jobs, Streak)
   - Today's Targets (top 3 matched jobs)
   - Recent Applications
   - Upcoming Interviews
   - Application Status Charts
   - Activity Feed
2. Interact with dashboard:
   - Click "Tailor" to generate documents
   - Click "Apply" to apply to jobs
   - Click "View Jobs" to see all jobs
   - Click "Scrape Jobs" to scrape new jobs

**Expected Result:**
- Dashboard displays all statistics
- All interactive elements work
- Data is updated in real-time

## Troubleshooting

### Application Won't Start
- Check if port 3003 is available: `lsof -i :3003`
- Kill any processes using the port: `lsof -ti:3003 | xargs kill -9`
- Check Rust compilation errors: `cd src-tauri && cargo check`

### Scraping Fails
- Check internet connection
- Verify scraping sources are accessible
- Check browser automation is installed (for blocked sites)
- Check console logs for errors

### Documents Won't Generate
- Verify user profile is set up
- Check OpenAI API key is configured (if using AI)
- Check console logs for errors

### Applications Won't Submit
- Verify Playwright is installed: `playwright --version`
- Check test mode is enabled (for testing)
- Verify browser automation is working
- Check console logs for errors

### Email Won't Send
- Verify SMTP settings are correct
- Test connection first
- Check test mode is enabled (for testing)
- Verify test endpoint is accessible

## Test Mode Checklist

When testing, use test mode to avoid real submissions:

- ✅ **Test Mode Enabled**: Settings → Applications → Test Mode
- ✅ **Test Application Endpoint**: `https://httpbin.org/post`
- ✅ **Test Email Endpoint**: `https://httpbin.org/post`
- ✅ **Test Mode Warning**: Check that test mode warnings appear

## Success Criteria

The workflow is successful if:
1. ✅ App starts without errors
2. ✅ Profile can be created and saved
3. ✅ Jobs can be scraped from multiple sources
4. ✅ Match scores are calculated correctly
5. ✅ Documents can be generated and exported
6. ✅ Applications can be submitted (in test mode)
7. ✅ Applications are tracked in the database
8. ✅ Email notifications work (in test mode)
9. ✅ Scheduler can be configured and started
10. ✅ Status chips reflect current state
11. ✅ Dashboard displays all data correctly

## Next Steps

After successful testing:
1. Disable test mode for real use
2. Configure real SMTP settings
3. Set up real application endpoints
4. Start using the app for real job applications!

---

**Happy Testing! 🚀**


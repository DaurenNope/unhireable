# 🧪 Testing Guide: Saved Searches, Notifications & UI Improvements

## Quick Test Checklist

### 1. ✅ Saved Searches Functionality

**Test Steps:**
1. Open the app
2. Navigate to **Settings → Saved Searches**
3. Click **"Create Saved Search"**
4. Fill in:
   - Name: "Test React Jobs"
   - Query: "react developer"
   - Sources: Select "Remotive" and "RemoteOK"
   - Alert Frequency: **"Hourly"** (for faster testing)
   - Min Match Score: 60
   - Enable: ON
5. Click **"Create"**
6. Click **"Run Now"** on the created search
7. Verify:
   - ✅ Search executes successfully
   - ✅ Jobs are found and displayed
   - ✅ Jobs are saved to database
   - ✅ "Last run" timestamp updates

**Expected Result:** Search runs, finds jobs, saves them, and updates last_run_at.

---

### 2. ✅ Scheduler Integration

**Test Steps:**
1. Create a saved search with **"Hourly"** frequency
2. Navigate to **Settings → Scheduler**
3. Enable the scheduler (toggle ON)
4. Click **"Start"** button
5. Check the scheduler status:
   - Should show "Running"
   - Should show saved searches stats (Total, Enabled, Due for run)
6. Wait for scheduler to run (or manually trigger by restarting)
7. Check console logs for:
   - `🔍 Running X saved searches`
   - `📋 Running saved search: 'Test React Jobs'`
   - `✅ Scraped X jobs`

**Expected Result:** Scheduler automatically runs saved searches that are due based on their alert frequency.

**Note:** For hourly searches, they'll run if `last_run_at` is NULL or was more than 1 hour ago.

---

### 3. ✅ Desktop Notifications

**Test Steps:**
1. Ensure desktop notifications are enabled:
   - **Settings → Email Notifications → Desktop Notifications** (toggle ON)
2. Create a saved search
3. Run it manually or wait for scheduler
4. If new jobs are found, verify:
   - ✅ Desktop notification appears
   - ✅ Notification shows: "New jobs found: [Search Name]"
   - ✅ Notification body shows: "Found X new matching jobs"
5. Click notification (if clickable)
6. Verify app opens and shows new jobs

**Expected Result:** Desktop notifications appear when new jobs are found from saved searches.

**Troubleshooting:**
- Check system notification permissions
- On macOS: System Settings → Notifications → [App Name]
- On Linux: Check notification daemon is running
- On Windows: Check notification settings

---

### 4. ✅ UI Improvements & Animations

#### Dashboard
**Test Steps:**
1. Navigate to **Dashboard**
2. Verify:
   - ✅ Smooth fade-in animation on page load
   - ✅ Progress bar animation for remote vs onsite
   - ✅ Hover effects on cards (shadow, scale)
   - ✅ Button hover effects (scale animation)
   - ✅ Loading skeletons match content structure
3. Click **"Scrape fresh jobs"**
4. Verify:
   - ✅ Button shows spinner while scraping
   - ✅ Smooth transitions

**Expected Result:** Dashboard has smooth animations, hover effects, and proper loading states.

#### Jobs Explorer
**Test Steps:**
1. Navigate to **Jobs Explorer**
2. Verify:
   - ✅ Job cards have hover effects (lift, shadow, border)
   - ✅ Staggered fade-in animations for job listings
   - ✅ Button hover effects with scale
   - ✅ Loading skeletons for job cards
3. Filter and sort jobs
4. Verify smooth transitions

**Expected Result:** Jobs page has polished animations and interactions.

#### Saved Searches
**Test Steps:**
1. Navigate to **Settings → Saved Searches**
2. Verify:
   - ✅ Active badge has pulse animation
   - ✅ Cards have hover effects
   - ✅ Button hover states
   - ✅ Smooth transitions on all interactions

**Expected Result:** Saved searches UI is polished with visual feedback.

---

### 5. ✅ Skill Extraction Improvements

**Test Steps:**
1. Scrape some jobs with various technologies
2. Check extracted skills in job descriptions
3. Verify:
   - ✅ Skills like "React", "TypeScript", "Node.js" are recognized
   - ✅ Synonyms are normalized (e.g., "reactjs" → "react")
   - ✅ Generic terms like "api" are filtered out
   - ✅ Match scores are calculated based on skills

**Expected Result:** Skill extraction is more accurate with 280+ canonical skills and better normalization.

---

## Manual Testing Commands

### Test Saved Search Creation (via Tauri CLI)
```bash
# This would require implementing a CLI command
# For now, use the UI
```

### Check Database for Saved Searches
```bash
cd src-tauri
sqlite3 ~/Library/Application\ Support/com.unhireable.app/jobhunter.db "SELECT * FROM saved_searches;"
```

### Check Scheduler Logs
Look for these log messages in the console:
- `🕐 Scheduled job scraping started at [timestamp]`
- `🔍 Running X saved searches`
- `📋 Running saved search: '[name]'`
- `🔔 Notification: Found X new jobs for search '[name]'`

---

## Automated Test Scenarios

### Scenario 1: Create and Run Saved Search
1. Create saved search via UI
2. Verify it appears in the list
3. Click "Run Now"
4. Verify jobs are found
5. Verify jobs are saved to database
6. Verify last_run_at is updated

### Scenario 2: Scheduler Auto-Run
1. Create saved search with "hourly" frequency
2. Set last_run_at to 2 hours ago (via database)
3. Start scheduler
4. Wait for scheduler loop
5. Verify search runs automatically
6. Verify last_run_at is updated to now

### Scenario 3: Notification on New Jobs
1. Create saved search
2. Run it and find new jobs
3. Verify desktop notification appears
4. Verify notification content is correct
5. Verify queries are invalidated (jobs refresh)

---

## Known Issues & Limitations

1. **Scheduler Interval**: Currently uses a simple interval-based approach. For true cron support, would need `tokio-cron-scheduler`.

2. **Notification Permissions**: First-time users may need to grant notification permissions manually.

3. **Quiet Hours**: Currently saved in localStorage but not enforced in scheduler. Would need to check time before sending notifications.

4. **Notification Frequency Limits**: Max notifications per hour setting is saved but not enforced yet.

---

## Success Criteria

✅ **Saved Searches Work:**
- Can create, edit, delete saved searches
- Searches run successfully
- Jobs are found and saved
- last_run_at updates correctly

✅ **Scheduler Works:**
- Scheduler runs saved searches automatically
- Respects alert_frequency (hourly/daily/weekly)
- Only runs enabled searches
- Updates last_run_at after running

✅ **Notifications Work:**
- Desktop notifications appear when new jobs found
- Notification content is accurate
- Frontend receives events and invalidates queries

✅ **UI Improvements:**
- Smooth animations on all pages
- Proper loading states
- Hover effects work
- No visual glitches

---

## Next Steps for Production

1. Add quiet hours enforcement in scheduler
2. Add notification frequency limiting
3. Add error handling for notification failures
4. Add retry logic for failed searches
5. Add logging/monitoring for scheduler activity
6. Add user feedback for scheduler status


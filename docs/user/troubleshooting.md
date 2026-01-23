# Troubleshooting Guide

Common issues and solutions for Unhireable.

## Installation Issues

### App Won't Launch

**Symptoms:**
- App doesn't start
- Crashes immediately
- Shows error message

**Solutions:**
1. **Check system requirements:**
   - macOS 10.13+ / Windows 10+ / Linux (recent distro)
   - Sufficient disk space (500MB+)
   - Memory available (2GB+)

2. **Check permissions:**
   - macOS: System Preferences → Security & Privacy → Allow app
   - Windows: Run as administrator if needed
   - Linux: Check file permissions

3. **Reinstall:**
   - Uninstall completely
   - Download latest version
   - Install fresh

4. **Check logs:**
   - macOS: `~/Library/Logs/Unhireable/`
   - Windows: `%APPDATA%\Unhireable\logs\`
   - Linux: `~/.local/share/Unhireable/logs/`

---

## Database Issues

### "Database not initialized" Error

**Symptoms:**
- Error message on startup
- Cannot save data
- Features not working

**Solutions:**
1. **Check database file:**
   - Location: App data directory
   - Permissions: Read/write access required
   - Disk space: Ensure sufficient space

2. **Reset database:**
   - Close app
   - Delete database file (backup first!)
   - Restart app (creates new database)

3. **Check app data directory:**
   - macOS: `~/Library/Application Support/Unhireable/`
   - Windows: `%APPDATA%\Unhireable\`
   - Linux: `~/.local/share/Unhireable/`

---

## Job Scraping Issues

### No Jobs Found

**Symptoms:**
- Scraping completes but no jobs
- "0 jobs found" message

**Solutions:**
1. **Check search query:**
   - Try broader terms
   - Check spelling
   - Use different keywords

2. **Check sources:**
   - Some sources may be unavailable
   - Try different sources
   - Check source status

3. **Check network:**
   - Internet connection active
   - No firewall blocking
   - VPN may interfere

4. **Check scraper configuration:**
   - Go to Settings → Scraper Config
   - Verify delays are reasonable
   - Check rate limits

---

### Scraping Takes Too Long

**Symptoms:**
- Scraping never completes
- Very slow progress

**Solutions:**
1. **Reduce sources:**
   - Select fewer sources
   - Focus on reliable sources

2. **Increase delays:**
   - Some sources need longer delays
   - Go to Settings → Scraper Config
   - Increase delay between requests

3. **Check network speed:**
   - Slow internet = slow scraping
   - Consider better connection

---

### LinkedIn Scraping Blocked

**Symptoms:**
- LinkedIn scraping fails
- Account/IP blocked message

**Solutions:**
1. **LinkedIn is high-risk:**
   - Disable LinkedIn scraping
   - Use other sources instead
   - LinkedIn may ban accounts/IPs

2. **If you must use LinkedIn:**
   - Use very long delays (30+ seconds)
   - Limit to few searches per day
   - Use different IP/VPN
   - Accept risk of account ban

3. **Best practice:**
   - Use LinkedIn manually
   - Use other sources for automation

---

## Document Generation Issues

### Documents Not Generating

**Symptoms:**
- Generation fails
- Error message appears
- No output

**Solutions:**
1. **Check profile:**
   - Profile must be complete
   - Go to Settings → Profile
   - Fill in required fields

2. **Check job data:**
   - Job must have description
   - Verify job is saved
   - Try different job

3. **Check AI API (if using):**
   - API key configured correctly
   - API quota not exceeded
   - Service is available
   - Try without AI improvement

4. **Check templates:**
   - Template exists
   - Template is valid
   - Try different template

---

### Poor Document Quality

**Symptoms:**
- Generated documents are generic
   - Don't match job requirements
   - Missing information

**Solutions:**
1. **Improve profile:**
   - Add more skills
   - Detailed experience descriptions
   - More projects

2. **Use AI improvement:**
   - Enable "Improve with AI"
   - Requires API key
   - Better customization

3. **Customize manually:**
   - Always review generated documents
   - Add job-specific details
   - Tailor to job requirements

4. **Try different templates:**
   - Some templates work better
   - Match template to job type

---

## Matching Issues

### Low Match Scores

**Symptoms:**
- All jobs have low scores
- No good matches

**Solutions:**
1. **Improve profile:**
   - Add more skills
   - Update experience
   - Add relevant projects

2. **Check job requirements:**
   - Jobs may be too specific
   - Try broader search
   - Look for entry-level positions

3. **Adjust expectations:**
   - 60%+ is still good
   - Focus on skills match
   - Consider location flexibility

---

### Match Scores Not Calculating

**Symptoms:**
- Scores stay at 0
- Calculation fails

**Solutions:**
1. **Check profile:**
   - Profile must exist
   - Must have skills
   - Go to Settings → Profile

2. **Check jobs:**
   - Jobs must have descriptions
   - Requirements must be present
   - Try different jobs

3. **Restart calculation:**
   - Click "Calculate Match Scores" again
   - Wait for completion
   - Check for errors

---

## Automation Issues

### Auto-Apply Fails

**Symptoms:**
- Automation doesn't work
- Forms not filled
- Errors during automation

**Solutions:**
1. **Check browser automation:**
   - Chrome/Chromium installed
   - Browser automation enabled
   - Check automation logs

2. **Check ATS support:**
   - ATS may not be supported
   - Use "Get ATS Suggestions" first
   - Try manual application

3. **Use dry-run:**
   - Test with dry-run mode
   - Verify form detection
   - Check for errors

4. **Check form structure:**
   - Some forms are complex
   - May need manual intervention
   - CAPTCHA may block automation

---

## Email Notification Issues

### Emails Not Sending

**Symptoms:**
- No emails received
- "Failed to send" error

**Solutions:**
1. **Check SMTP configuration:**
   - Settings → Email Notifications
   - Verify all fields correct
   - Test connection

2. **Check credentials:**
   - Gmail: Use app-specific password
   - Outlook: Use app password
   - Custom: Verify server details

3. **Check spam folder:**
   - Emails may be filtered
   - Check spam/junk folder
   - Whitelist sender

4. **Check firewall:**
   - SMTP ports may be blocked
   - Allow ports 25, 465, 587
   - Check network settings

---

## Performance Issues

### App is Slow

**Symptoms:**
- Slow response times
- UI freezes
- High CPU/memory usage

**Solutions:**
1. **Check database size:**
   - Large database = slower
   - Archive old data
   - Clean up unused jobs

2. **Reduce concurrent operations:**
   - Don't scrape multiple sources simultaneously
   - Wait for one operation to complete
   - Close unused features

3. **Check system resources:**
   - Close other applications
   - Free up memory
   - Check disk space

4. **Restart app:**
   - Sometimes helps
   - Clears memory
   - Resets state

---

## Data Issues

### Data Not Saving

**Symptoms:**
- Changes not persisted
- Data lost on restart

**Solutions:**
1. **Check database:**
   - Database file writable
   - Sufficient disk space
   - No permission issues

2. **Check for errors:**
   - Look for error messages
   - Check logs
   - Verify operation completed

3. **Save explicitly:**
   - Click Save button
   - Wait for confirmation
   - Don't close immediately

---

### Data Corrupted

**Symptoms:**
- App crashes
- Data appears corrupted
- Errors reading data

**Solutions:**
1. **Backup data:**
   - Export important data
   - Save profile
   - Export documents

2. **Reset database:**
   - Close app
   - Backup database file
   - Delete database
   - Restart app

3. **Restore from backup:**
   - If you have backup
   - Replace database file
   - Restart app

---

## Still Having Issues?

1. **Check logs:**
   - Application logs contain detailed errors
   - Look for error messages
   - Note error codes

2. **Report issue:**
   - Include error messages
   - Describe steps to reproduce
   - Include system information
   - GitHub Issues or support email

3. **Check documentation:**
   - Review feature guides
   - Check FAQ
   - Search known issues

---

**Need more help?** Contact support or check the FAQ.









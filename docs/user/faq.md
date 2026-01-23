# Frequently Asked Questions (FAQ)

Common questions about Unhireable.

## General Questions

### What is Unhireable?

Unhireable is a desktop application that automates job searching, application tracking, and document generation. It helps you find jobs, generate tailored resumes and cover letters, and track your applications all in one place.

### Is Unhireable free?

Yes, Unhireable is open-source and free to use. Some AI features may require API keys from third-party providers (OpenAI, Anthropic, etc.), which may have their own pricing.

### What platforms does Unhireable support?

Unhireable runs on:
- **macOS** 10.13 or later
- **Windows** 10 or later
- **Linux** (most modern distributions)

### Is my data secure?

Yes! Your data is stored locally on your computer. Credentials are encrypted with your master password. No data is sent to external servers except:
- Job scraping (to job boards)
- AI API calls (if enabled, to your configured provider)
- Email notifications (to your SMTP server)

---

## Job Scraping

### Which job sources are supported?

Unhireable supports 15+ job sources including:
- LinkedIn (use with caution)
- Wellfound (formerly AngelList)
- hh.kz
- RemoteOK
- Remotive
- Greenhouse Board
- Work at Startup
- And more...

### Is LinkedIn scraping safe?

LinkedIn scraping is **high-risk**. LinkedIn actively blocks scrapers and may ban accounts or IP addresses. We recommend:
- Using LinkedIn manually
- Using other sources for automation
- If you must scrape LinkedIn, use very long delays (30+ seconds) and accept the risk

### How often should I scrape jobs?

It depends on your needs:
- **Daily**: For active job searching
- **Weekly**: For casual browsing
- **On-demand**: When you need fresh results

Use the background scheduler to automate scraping.

### Can I scrape jobs from multiple sources at once?

Yes! Select multiple sources when scraping. Note that scraping from many sources simultaneously may take longer.

---

## Job Matching

### How are match scores calculated?

Match scores (0-100%) are based on:
- **Skills Match** (40%): Required skills vs. your skills
- **Experience Level** (30%): Years of experience match
- **Location** (15%): Remote/local compatibility
- **Job Title** (15%): Semantic title matching

### What's a good match score?

- **80-100%**: Excellent match, highly recommended
- **60-79%**: Good match, strong fit
- **40-59%**: Fair match, consider applying
- **<40%**: Weak match, may not be suitable

Focus on jobs with 70%+ match scores for best results.

### Why are all my match scores low?

Possible reasons:
- Profile is incomplete or outdated
- Jobs require very specific skills you don't have
- Search query is too narrow

**Solutions:**
- Update your profile with more skills and experience
- Try broader search terms
- Look for entry-level or general positions

### Can I filter jobs by match score?

Yes! After calculating match scores, use the filter dropdown to show only jobs above a certain score threshold.

---

## Document Generation

### Do I need an AI API key?

No, but it helps! Document generation works without AI, but AI improvement provides:
- Better customization to job requirements
- More natural language
- Better keyword optimization

### Which AI providers are supported?

- OpenAI (GPT-3.5, GPT-4)
- Anthropic (Claude)
- And more (check Settings → Credentials)

### How do I get an OpenAI API key?

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to API Keys section
4. Create a new key
5. Copy and paste into Unhireable Settings → Credentials

**Note:** OpenAI charges per API call. Check their pricing.

### Can I customize generated documents?

Yes! Always review and customize generated documents:
- Add job-specific details
- Adjust tone and style
- Add personal touches
- Remove irrelevant sections

### What document formats are supported?

- **Markdown** (default, editable)
- **PDF** (via export)
- **DOCX** (Word format)
- **Email version** (plain text)

### How many resume templates are available?

5+ professional templates:
- Modern
- Classic
- Executive
- Technical
- Creative

---

## Application Tracking

### How do I track an application?

1. Find a job
2. Click **Apply**
3. Fill in application details:
   - Application date
   - Documents used
   - Notes
4. Set status (Pending, Applied, etc.)
5. Save

### What application statuses are available?

- **Pending**: Application submitted, waiting
- **Applied**: Application confirmed
- **Interviewing**: Interview scheduled/in progress
- **Offer**: Job offer received
- **Rejected**: Application rejected
- **Withdrawn**: Application withdrawn

### Can I add interviews to applications?

Yes! For each application:
1. Go to Applications page
2. Select application
3. Click **Add Interview**
4. Enter interview details
5. Save

### How do I track contacts?

Contacts are automatically extracted from job descriptions, or you can add them manually:
1. Go to Applications
2. Select application
3. Click **Add Contact**
4. Enter contact information

---

## Automation

### What is browser automation?

Browser automation automatically fills out job application forms using a headless browser (Chrome/Chromium).

### Which ATS systems are supported?

20+ ATS systems including:
- Greenhouse
- Lever
- Workday
- Workable
- LinkedIn Easy Apply
- And more...

### Is automation safe?

Automation is generally safe, but:
- **Always test first**: Use dry-run mode
- **Some forms may fail**: Complex forms may need manual intervention
- **CAPTCHA blocks**: Forms with CAPTCHA cannot be automated
- **Rate limits**: Don't apply to too many jobs too quickly

### How do I test automation?

1. Select a job
2. Click **Auto-Apply**
3. Enable **Dry-Run Mode**
4. Start automation
5. Review what would be filled
6. If successful, disable dry-run and run for real

### Can automation handle file uploads?

Yes! Automation can upload:
- Resume files (PDF, DOCX)
- Cover letter files
- Other required documents

---

## Notifications

### How do I set up email notifications?

1. Go to **Settings** → **Email Notifications**
2. Configure SMTP settings:
   - **Gmail**: Use app-specific password
   - **Outlook**: Use app password
   - **Custom**: Enter SMTP server details
3. Test connection
4. Enable notification types

### What email providers are supported?

- Gmail
- Outlook/Hotmail
- Any SMTP-compatible email provider

### How do I get a Gmail app-specific password?

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification (must be enabled)
3. App passwords
4. Generate password for "Mail"
5. Use this password in Unhireable

### Can I get desktop notifications?

Yes! Desktop notifications are available for:
- New job matches
- New jobs found
- Application status changes
- Application success

Grant permission when prompted, or enable in Settings → Notifications.

---

## Profile & Settings

### How important is my profile?

Very important! Your profile powers:
- Job matching (better profile = better matches)
- Document generation (more details = better documents)
- Recommendations (personalized suggestions)

Keep your profile complete and up-to-date.

### What information should I include in my profile?

Include everything relevant:
- **Skills**: All technical and soft skills
- **Experience**: Detailed work history with descriptions
- **Education**: Degrees, certifications
- **Projects**: Notable projects with technologies used
- **Links**: LinkedIn, GitHub, portfolio

### How do I update my profile?

1. Go to **Settings** → **Profile**
2. Edit any section
3. Click **Save Profile**

### Are my credentials secure?

Yes! Credentials are:
- Encrypted with your master password
- Stored locally on your computer
- Never transmitted (except to configured services)
- Protected by master password

---

## Technical Questions

### Where is my data stored?

Data is stored locally:
- **macOS**: `~/Library/Application Support/Unhireable/`
- **Windows**: `%APPDATA%\Unhireable\`
- **Linux**: `~/.local/share/Unhireable/`

### Can I backup my data?

Yes! You can:
- Export your profile
- Export documents
- Copy the database file (backup first!)
- Export applications data

### Can I use Unhireable offline?

Partially. You can:
- View saved jobs
- Generate documents (without AI)
- Track applications
- View profile

You cannot:
- Scrape new jobs
- Use AI features
- Send emails
- Get recommendations

### How do I update Unhireable?

1. Download latest release from GitHub
2. Install over existing installation
3. Your data is preserved

Or use auto-update if configured.

---

## Troubleshooting

### App won't start

See [Troubleshooting Guide](./troubleshooting.md) for detailed solutions.

Common fixes:
- Check system requirements
- Check permissions
- Reinstall app
- Check logs

### Jobs not scraping

Common causes:
- Network issues
- Source unavailable
- Rate limits
- Firewall blocking

See [Troubleshooting Guide](./troubleshooting.md) for solutions.

### Documents not generating

Common causes:
- Incomplete profile
- Missing job data
- AI API issues (if using)
- Template errors

See [Troubleshooting Guide](./troubleshooting.md) for solutions.

---

## Best Practices

### How do I get the best results?

1. **Complete profile**: Fill in all sections thoroughly
2. **Update regularly**: Keep profile current
3. **Use match scores**: Focus on 70%+ matches
4. **Customize documents**: Always review and tailor
5. **Track everything**: Log all applications
6. **Use saved searches**: Automate job discovery
7. **Enable notifications**: Never miss opportunities

### How often should I update my profile?

Update your profile:
- When you learn new skills
- After completing projects
- When changing jobs
- When getting certifications
- At least quarterly

### Should I apply to all high-scoring jobs?

Not necessarily. Consider:
- Job location and commute
- Company culture fit
- Salary expectations
- Growth opportunities
- Your career goals

Use match scores as a guide, not the only factor.

---

## Support

### Where can I get help?

- **Documentation**: Check user guides
- **Troubleshooting**: See troubleshooting guide
- **GitHub Issues**: Report bugs or ask questions
- **Community**: Join discussions

### How do I report a bug?

1. Go to GitHub Issues
2. Include:
   - Description of the issue
   - Steps to reproduce
   - Error messages
   - System information
   - Screenshots (if applicable)

### Can I request a feature?

Yes! Feature requests are welcome:
- GitHub Issues
- Community discussions
- Pull requests (if you want to implement it)

---

**Have more questions?** Check the documentation or ask in GitHub Issues!









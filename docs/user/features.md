# Features Guide

Complete guide to all features in Unhireable.

## Job Discovery

### Job Scraping

Scrape jobs from multiple sources:
- **LinkedIn** (use with caution - rate limits)
- **Wellfound** (formerly AngelList)
- **hh.kz** (Kazakhstan job board)
- **RemoteOK**
- **Remotive**
- **Greenhouse Board**
- **Work at Startup**
- **Weworkremotely**
- **Remote.co**
- **Glassdoor**
- **ZipRecruiter**
- **Stack Overflow**
- **Dice**
- **Indeed**

**How to use:**
1. Go to **Jobs** page
2. Enter search query
3. Select sources
4. Click **Scrape Jobs**

### Saved Searches

Save search queries for automatic execution:

1. Go to **Settings** → **Saved Searches**
2. Click **Create Search**
3. Configure:
   - Search query
   - Sources
   - Schedule (daily, weekly, etc.)
   - Match score threshold
4. Enable **Auto-scrape**

Saved searches run automatically and notify you of new matches.

---

## Job Matching

### Match Score Calculation

Unhireable calculates match scores (0-100%) based on:
- **Skills Match** (40%): Required skills vs. your skills
- **Experience Level** (30%): Years of experience match
- **Location** (15%): Remote/local match
- **Job Title** (15%): Semantic title matching

### Match Quality Categories

- **Excellent** (80-100%): Perfect match, highly recommended
- **Good** (60-79%): Strong match, good fit
- **Fair** (40-59%): Moderate match, consider applying
- **Poor** (<40%): Weak match, may not be suitable

### Using Match Scores

1. After scraping, click **Calculate Match Scores**
2. Filter by quality using the dropdown
3. Sort by score to see best matches first
4. Focus on jobs with 70%+ match scores

---

## Document Generation

### Resume Generation

Generate tailored resumes for specific jobs:

1. Select a job
2. Click **Generate Resume**
3. Choose template:
   - **Modern**: Clean, contemporary design
   - **Classic**: Traditional format
   - **Executive**: For senior roles
   - **Technical**: For tech roles
   - **Creative**: For design/creative roles
4. Enable **AI Improvement** for enhanced content
5. Review and customize

**Templates:** 5+ professional templates available

### Cover Letter Generation

Generate personalized cover letters:

1. Select a job
2. Click **Generate Cover Letter**
3. Choose style:
   - **Professional**: Formal, business-like
   - **Casual**: Friendly, approachable
   - **Formal**: Very formal, traditional
   - **Friendly**: Warm, personable
   - **Concise**: Brief, to the point
4. Enable **AI Improvement** for better content
5. Customize as needed

### Document Export

Export documents in multiple formats:
- **Markdown** (default)
- **PDF** (via Export button)
- **DOCX** (Word format)
- **Email version** (plain text)

---

## Application Tracking

### Creating Applications

Track your job applications:

1. From a job page, click **Apply**
2. Fill in application details:
   - Application date
   - Resume used
   - Cover letter used
   - Notes
3. Set initial status (Pending, Applied, etc.)
4. Click **Save**

### Application Statuses

- **Pending**: Application submitted, waiting for response
- **Applied**: Application confirmed
- **Interviewing**: Interview scheduled/in progress
- **Offer**: Job offer received
- **Rejected**: Application rejected
- **Withdrawn**: Application withdrawn

### Tracking Interviews

Add interview records:

1. Go to **Applications** page
2. Select an application
3. Click **Add Interview**
4. Enter:
   - Interview date/time
   - Interview type (phone, video, onsite)
   - Interviewer name
   - Notes
5. Save

### Contact Management

Track contacts from applications:

1. Contacts are automatically extracted from job descriptions
2. Or manually add contacts:
   - Go to **Applications** → Select application
   - Click **Add Contact**
   - Enter contact information

---

## Automation

### Browser Automation

Automatically fill out job application forms:

1. Select jobs to apply to
2. Click **Auto-Apply**
3. Configure:
   - Resume file path
   - Cover letter file path
   - Dry-run mode (test without submitting)
4. Start automation

**Supported ATS Systems:**
- Greenhouse
- Lever
- Workday
- Workable
- LinkedIn Easy Apply
- And 20+ more

**Note:** Always test with dry-run first!

### ATS Detection

Get suggestions for ATS optimization:

1. Paste job URL
2. Click **Get ATS Suggestions**
3. Review:
   - Detected ATS system
   - Automation support level
   - Tips and best practices
   - Known quirks

---

## Notifications

### Email Notifications

Receive email alerts for:
- **Job Matches**: High-scoring job matches
- **New Jobs**: Daily summaries of new postings
- **Application Updates**: Status changes

**Setup:**
1. Go to **Settings** → **Email Notifications**
2. Configure SMTP settings
3. Enable notification types
4. Test connection

### Desktop Notifications

Get desktop notifications for:
- New job matches
- New jobs found
- Application status changes
- Application success

**Setup:**
1. Grant notification permissions when prompted
2. Or go to **Settings** → **Notifications**
3. Enable desktop notifications

---

## Background Scheduler

Automate job scraping:

1. Go to **Settings** → **Scheduler**
2. Configure:
   - **Schedule**: Daily, weekly, or custom
   - **Time**: When to run
   - **Query**: Search query
   - **Sources**: Which sources to scrape
   - **Match Threshold**: Minimum match score
3. Click **Start Scheduler**

The scheduler runs in the background and notifies you of new matches.

---

## Analytics & Insights

### Dashboard

View your application statistics:
- Total jobs found
- Applications submitted
- Match score distribution
- Application status breakdown
- Activity timeline

### Market Insights

Get market trends and insights:
- Popular skills in your field
- Salary trends
- Job market activity
- Industry insights

### Recommendations

Get personalized job recommendations:
- Based on your profile
- Based on your behavior (saves, applications)
- Similar to jobs you've viewed
- Trending jobs in your field

---

## Profile Management

### User Profile

Your profile powers job matching and document generation:

**Sections:**
- **Personal Info**: Contact information, links
- **Summary**: Professional summary
- **Skills**: Technical and soft skills
- **Experience**: Work history
- **Education**: Educational background
- **Projects**: Notable projects

**Tips:**
- Keep profile up-to-date
- Include all relevant skills
- Add detailed experience descriptions
- Update regularly

### Credential Management

Securely store API keys and credentials:
- AI provider keys (OpenAI, Anthropic, etc.)
- Email credentials
- Platform credentials

**Security:**
- Credentials are encrypted
- Master password required
- Never shared or transmitted

---

## Advanced Features

### Resume Analysis

Analyze existing resumes:
1. Go to **Resume Analyzer** page
2. Upload resume (PDF or DOCX)
3. Get analysis:
   - Extracted skills
   - Experience summary
   - Education details
   - Suggestions for improvement

### Document Version Control

Track document versions:
1. After generating a document
2. Click **Create Version**
3. Add notes
4. View version history
5. Restore previous versions

### Multi-Language Support

Translate documents:
1. Generate a document
2. Click **Translate**
3. Select target language
4. Get translated version

### Bulk Operations

Generate multiple documents at once:
1. Select multiple jobs
2. Click **Bulk Generate**
3. Choose document type
4. Generate all at once

---

## Tips & Best Practices

1. **Keep profile updated**: Better profile = better matches
2. **Use match scores**: Focus on 70%+ matches
3. **Customize documents**: Always review and customize generated documents
4. **Test automation**: Use dry-run mode before real applications
5. **Track everything**: Log all applications and interviews
6. **Use saved searches**: Automate job discovery
7. **Enable notifications**: Never miss a good opportunity
8. **Review analytics**: Understand your application patterns

---

**Happy job hunting!** 🎯









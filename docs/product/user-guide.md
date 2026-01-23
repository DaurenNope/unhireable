# 🚀 Unhireable - User Guide

## Welcome to Unhireable!

Unhireable is your **Neural Career System** - an AI-powered job search automation tool that helps you find, evaluate, and apply for jobs with minimal effort.

## 📋 How It Works

### Step 1: Create Your Profile
1. Go to **Settings → Profile**
2. Add your:
   - Personal information (name, email, phone)
   - Professional summary
   - Skills (technical and soft skills)
   - Work experience
   - Education
   - Projects
3. Click **Save Profile**

**Why?** Your profile enables AI-powered job matching and personalized resume generation.

### Step 2: Find Jobs
1. Go to **Jobs** page
2. Click **"Scrape Jobs"** button
3. Enter a search query (e.g., "Frontend Developer", "Python Developer")
4. Select job sources:
   - **hh.kz** - Kazakhstan job board
   - **Wellfound** - Startup jobs
   - **LinkedIn** - Professional network (use with caution)
5. Jobs will be automatically saved to your database

**Alternative:** You can also manually add jobs by clicking **"Add Job"**.

### Step 3: Calculate Match Scores
1. Once you have jobs, go to **Jobs** page
2. Click **"Calculate Match Scores"** button
3. AI will analyze each job against your profile
4. Jobs will be scored from 0-100% with quality indicators:
   - **Excellent** (80-100%) - Great match!
   - **Good** (60-79%) - Good fit
   - **Fair** (40-59%) - Consider applying
   - **Poor** (0-39%) - May not be a good fit

**Tip:** Filter jobs by match score to focus on the best opportunities.

### Step 4: Generate Documents
1. Click on a job to view details
2. Go to **"Generate Documents"** tab
3. Select document type:
   - **Resume** - Tailored to the job
   - **Cover Letter** - Personalized for the role
   - **Email** - Ready-to-send application email
4. Choose a template
5. Toggle **"AI Improvement"** for enhanced content
6. Click **"Generate"**
7. Preview and export to PDF

### Step 5: Create Applications
1. Go to **Applications** page
2. Click **"New Application"**
3. Select a job or enter details manually
4. Fill in application details:
   - Application date
   - Status (Preparing, Submitted, Interviewing, etc.)
   - Notes
5. Upload documents (resume, cover letter)
6. Track interview schedules and responses

### Step 6: Track Progress
1. View your **Dashboard** for:
   - Total applications
   - Upcoming interviews
   - Offers received
   - Application statistics
   - Activity feed
2. Monitor application status
3. Schedule interviews
4. Track responses

## 🎯 Key Features

### Job Scraping
- **Multiple Sources**: hh.kz, Wellfound, LinkedIn
- **Automatic Deduplication**: No duplicate jobs
- **Background Scheduler**: Automatically scrape jobs at scheduled intervals

### AI-Powered Matching
- **Skills Analysis**: Matches your skills with job requirements
- **Experience Level**: Compares your experience with job requirements
- **Location Matching**: Supports remote work matching
- **Match Score**: 0-100% score with quality indicators

### Document Generation
- **Tailored Resumes**: Customized for each job
- **Cover Letters**: Personalized application letters
- **Email Templates**: Ready-to-send application emails
- **Multiple Templates**: Choose from various resume/cover letter templates
- **PDF Export**: Export documents as PDF files

### Application Tracking
- **Status Management**: Track application progress
- **Interview Scheduling**: Manage interview dates and times
- **Document Management**: Store resumes and cover letters
- **Activity Feed**: See all application updates
- **Email Integration**: Send and track application emails

### Email Notifications
- **Job Match Alerts**: Get notified when high-scoring jobs are found
- **New Job Summaries**: Daily summaries of new job postings
- **Application Updates**: Notifications for application status changes

### Background Scheduler
- **Automated Scraping**: Schedule automatic job scraping
- **Custom Intervals**: Set scraping frequency
- **Source Selection**: Choose which sources to scrape
- **Match Score Filter**: Only notify for jobs above a certain score

## 🔧 Configuration

### Scraper Settings
1. Go to **Settings → Scraper Config**
2. Configure:
   - **Firecrawl API Key** (optional) - For enhanced scraping
   - **Browser Automation** - Enable Playwright/Chrome
   - **Rate Limiting** - Set delays between requests
   - **LinkedIn Settings** - Configure LinkedIn scraping (use with caution)

### Credentials
1. Go to **Settings → Credentials**
2. Add API keys:
   - **Firecrawl API Key** - For job scraping
   - **OpenAI API Key** - For AI-powered features
3. Manage platform login credentials

### Email Notifications
1. Go to **Settings → Email Notifications**
2. Configure SMTP settings:
   - **SMTP Server** - Gmail, Outlook, or custom
   - **Port** - SMTP port (587 for TLS, 465 for SSL)
   - **Username** - Your email address
   - **Password** - Your email password or app password
   - **From Email** - Sender email address
   - **From Name** - Sender name (default: "Unhireable")
   - **Use TLS/SSL** - Enable encryption
3. Test connection before enabling

### Scheduler
1. Go to **Settings → Scheduler**
2. Configure:
   - **Enabled** - Enable/disable scheduler
   - **Schedule** - Set scraping frequency (e.g., "daily at 9 AM")
   - **Query** - Default search query
   - **Sources** - Select job sources
   - **Min Match Score** - Only notify for jobs above this score
   - **Send Notifications** - Enable email notifications
3. Click **"Start Scheduler"** to begin automated scraping

## 💡 Tips & Best Practices

1. **Complete Your Profile First**: The more detailed your profile, the better the job matching
2. **Use Match Scores**: Focus on jobs with high match scores (80%+) for better success rates
3. **Generate Tailored Documents**: Always generate customized resumes and cover letters for each job
4. **Track Everything**: Keep all applications and documents in one place
5. **Set Up Scheduler**: Automate job scraping to save time
6. **Enable Notifications**: Get notified about new job matches and updates
7. **Regular Updates**: Update your profile as you gain new skills and experience

## 🆘 Troubleshooting

### Jobs Not Appearing
- Check if scraping completed successfully
- Verify job sources are enabled
- Check browser console for errors
- Try manually adding a job to test

### Match Scores Not Calculating
- Ensure your profile is complete
- Check if user profile exists in Settings → Profile
- Verify API keys are configured (if using AI features)

### Documents Not Generating
- Check if user profile is complete
- Verify OpenAI API key is configured (for AI features)
- Check browser console for errors
- Try generating without AI improvement first

### Email Notifications Not Working
- Verify SMTP settings are correct
- Test email connection in Settings → Email Notifications
- Check if scheduler is enabled and running
- Verify email credentials are correct

## 📚 Next Steps

1. **Complete Your Profile** - Add all your skills and experience
2. **Scrape Jobs** - Find jobs from multiple sources
3. **Calculate Matches** - See which jobs fit your profile
4. **Generate Documents** - Create tailored resumes and cover letters
5. **Create Applications** - Track your job applications
6. **Set Up Scheduler** - Automate job scraping
7. **Enable Notifications** - Get notified about new opportunities

## 🎉 You're All Set!

Start by creating your profile and scraping your first jobs. Good luck with your job search! 🚀

---

**Unhireable** - Neural Career System. Stop being data. Start being human.


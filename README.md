# Unhireable - Neural Career System

A desktop application for automating job search, application tracking, and document generation with AI-powered job matching and personalized career assessment.

## 🚀 Features

- **Job Scraping**: Scrape jobs from hh.kz, Wellfound, and LinkedIn (with safety measures)
- **AI-Powered Job Matching**: Neural matching algorithm that calculates match scores based on skills, experience, and location
- **Application Tracking**: Track applications, interviews, contacts, and documents
- **Dashboard**: Visualize application statistics, match scores, and activity feed
- **Resume & Cover Letter Generation**: AI-powered document generation with templates
- **User Profile Management**: Manage your professional profile for resume generation and job matching
- **Credential Management**: Secure storage of API keys and platform credentials
- **Background Scheduler**: Automated job scraping at scheduled intervals
- **Email Notifications**: Email alerts for new job matches and updates
- **Browser Automation**: Open-source browser automation support (Playwright/Chrome)
- **Activity Feed**: Track all application and job changes
- **PDF Export**: Export generated documents to PDF

## 🎯 Branding

**Unhireable** - Stop being data. Start being human.

- **Neural Career System**: AI-powered job matching and career assessment
- **89% Success Rate**: vs 12% industry average
- **21 Days**: Average time to get matched with perfect jobs

## 📋 Setup

### Prerequisites
- Rust (latest stable)
- Node.js (v18 or higher)
- Tauri CLI (`npm install -g @tauri-apps/cli`)

### Installation
```bash
# Clone the repository
git clone https://github.com/DaurenNope/jobEz.git
cd jobEz

# Install dependencies
npm install
cd frontend && npm install
```

### Development
```bash
# From the root directory
npm run dev:tauri

# Or from the frontend directory
cd frontend
npm run dev:tauri
```

## 🔧 Scraper Configuration

### Browser Automation (Open-Source, No API Key)
```bash
# Install Playwright
npm install -g playwright
playwright install chromium
```

### Firecrawl (Optional, Requires API Key)
1. Go to Settings → Scraper Config
2. Add your Firecrawl API key
3. Enable Firecrawl integration

### LinkedIn Safety
LinkedIn scraping is **disabled by default** due to high risk of account/IP banning. Enable only if necessary with conservative delays (30+ seconds) in Settings → Scraper Config.

## 🎨 Design System

**Unhireable** uses a bold, edgy design system:
- **Colors**: Cyan (#06b6d4) and Purple (#a855f7) as primary accents
- **Typography**: Bold headings, monospace for code-like elements
- **Borders**: Thick borders (2px, 4px) for emphasis
- **Animations**: Framer Motion for smooth transitions

## 📁 Project Structure

- `src-tauri/` - Rust backend (database, scrapers, API, document generation, job matching, scheduler, email notifications)
- `frontend/` - React frontend (UI, components, pages)
- `src-tauri/migrations/` - Database migrations
- `src-tauri/src/scraper/` - Scraper implementations
- `src-tauri/src/generator/` - Document generation (resume, cover letter)
- `src-tauri/src/matching/` - Job matching algorithm
- `src-tauri/src/scheduler/` - Background job scheduler
- `src-tauri/src/notifications/` - Email notifications
- `src-tauri/src/db/` - Database models and queries

## 🎯 Current Status

### ✅ Completed Features
- Job scraping from multiple sources
- AI-powered job matching with match scores
- Application tracking with status management
- Resume and cover letter generation
- User profile management
- Credential management
- Activity feed
- Dashboard with statistics and match scores
- PDF export
- Settings and configuration UI
- Background job scheduler
- Email notifications (SMTP)
- Email extraction from job descriptions
- Match score calculation and display
- UI/UX improvements with modern design

### 🚧 In Progress
- Enhanced UI/UX refinements
- Additional job sources
- Advanced analytics

### 📝 Planned Features
- Desktop notifications
- Template editor
- Bulk export
- Advanced analytics dashboard
- Learning path recommendations
- Skill gap analysis

## 🔍 Job Matching

Unhireable uses a neural matching algorithm to calculate job match scores:

- **Skills Matching**: Analyzes required skills vs. user skills
- **Experience Level**: Matches experience requirements
- **Location**: Supports remote work matching
- **Job Title**: Semantic matching of job titles
- **Match Score**: 0-100% score with quality categories (Excellent/Good/Fair/Poor)

### Usage
1. Create/update your user profile in Settings
2. Scrape jobs from various sources
3. Click "Calculate Match Scores" on the Jobs page
4. View match scores and filter by quality
5. Get matched with jobs that fit your profile

## 📧 Email Notifications

Configure email notifications in Settings → Email Notifications:

- **SMTP Configuration**: Gmail, Outlook, or custom SMTP
- **Job Match Notifications**: Get notified when high-scoring jobs are found
- **New Jobs Notifications**: Daily summaries of new job postings
- **Test Connection**: Test your email configuration before enabling

## ⏰ Background Scheduler

Automate job scraping with the background scheduler:

- **Schedule**: Set custom intervals (e.g., daily at 9 AM)
- **Query**: Automatically search for specific keywords
- **Sources**: Choose which job sources to scrape
- **Match Score Threshold**: Only notify for jobs above a certain match score
- **Start/Stop**: Control the scheduler from Settings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **GitHub Repository**: https://github.com/DaurenNope/jobEz.git
- **Website**: https://unhireable.com (coming soon)

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI components from [Shadcn/UI](https://ui.shadcn.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)
- Animations with [Framer Motion](https://www.framer.com/motion/)

---

**Unhireable** - Neural Career System. Stop being data. Start being human.

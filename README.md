# JobEz - Job Hunter Automation App

A desktop application for automating job search, application tracking, and document generation.

## 🚀 Features

- **Job Scraping**: Scrape jobs from hh.kz, Wellfound, and LinkedIn (with safety measures)
- **Application Tracking**: Track applications, interviews, contacts, and documents
- **Dashboard**: Visualize application statistics and activity feed
- **Resume & Cover Letter Generation**: AI-powered document generation with templates
- **User Profile Management**: Manage your professional profile for resume generation
- **Credential Management**: Secure storage of API keys and platform credentials
- **Browser Automation**: Open-source browser automation support (Playwright/Chrome)
- **Activity Feed**: Track all application and job changes
- **PDF Export**: Export generated documents to PDF

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

## 📁 Project Structure

- `src-tauri/` - Rust backend (database, scrapers, API, document generation)
- `frontend/` - React frontend (UI, components, pages)
- `src-tauri/migrations/` - Database migrations
- `src-tauri/src/scraper/` - Scraper implementations
- `src-tauri/src/generator/` - Document generation (resume, cover letter)
- `src-tauri/src/db/` - Database models and queries

## 🎯 Current Status

### ✅ Completed Features
- Job scraping from multiple sources
- Application tracking with status management
- Resume and cover letter generation
- User profile management
- Credential management
- Activity feed
- Dashboard with statistics
- PDF export
- Settings and configuration UI

### 🚧 In Progress
- Job display fixes (pagination improvements)
- Resume generation error handling
- UI/UX improvements

### 📝 Planned Features
- Email integration
- Desktop notifications
- Background job scraping
- Template editor
- Bulk export

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- **Repository**: https://github.com/DaurenNope/jobEz
- **MVP Plan**: See `MVP.md` for the assessment platform roadmap

## 📝 Notes

- Database is stored locally in `~/Library/Application Support/jobez/jobhunter.db` (macOS)
- User profiles are stored in browser localStorage (will be moved to database)
- API keys and credentials are stored securely in the database

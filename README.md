# JobEz - Job Hunter Automation App

A desktop application for automating job search, application tracking, and document generation.

## Features

- **Job Scraping**: Scrape jobs from hh.kz, Wellfound, and LinkedIn (with safety measures)
- **Application Tracking**: Track applications, interviews, contacts, and documents
- **Dashboard**: Visualize application statistics and activity feed
- **Browser Automation**: Open-source browser automation support (Playwright/Chrome)

## Setup

### Prerequisites
- Rust
- Node.js
- Tauri CLI

### Installation
```bash
npm install
cd frontend && npm install
```

### Development
```bash
npm run dev:tauri
```

## Scraper Configuration

### Browser Automation (Open-Source, No API Key)
```bash
# Install Playwright
npm install -g playwright
playwright install chromium
```

### Firecrawl (Optional, Requires API Key)
```bash
export FIRECRAWL_API_KEY=your_api_key
```

### LinkedIn Safety
LinkedIn scraping is **disabled by default** due to high risk of account/IP banning. Enable only if necessary with conservative delays (30+ seconds).

## Project Structure

- `src-tauri/` - Rust backend (database, scrapers, API)
- `frontend/` - React frontend (UI, components, pages)
- `src-tauri/migrations/` - Database migrations
- `src-tauri/src/scraper/` - Scraper implementations

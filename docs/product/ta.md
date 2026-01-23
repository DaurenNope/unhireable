🧠 Job Hunter MVP — Technical Assignment
📘 Overview

Purpose:
Build a personal Job Hunting Automation App that helps the user (you) find, evaluate, and apply for relevant jobs with minimal effort.

The app should:
- Discover jobs automatically from multiple sources (hh.kz, LinkedIn, Wellfound, etc.)
- Generate tailored resumes, cover letters, and greeting emails
- Track applications and responses automatically via email integration
- Offer a desktop UI for managing everything easily

This MVP will first be for personal use, with potential later transformation into a public job intelligence & coaching service.

🚀 MVP Goals

- Eliminate manual job hunting and hesitation.
- Build a centralized dashboard that automates finding, applying, and tracking.
- Keep it local and fast (using Tauri for desktop).
- Allow future scalability into a SaaS product.

🧩 Core Modules
1. Job Discovery / Scraper

Goal: Fetch structured job listings automatically.

Sources:
- hh.kz (API or Playwright)
- LinkedIn Jobs (via scraper or proxy API)
- Wellfound (API)
- Optional: RemoteOK, AngelList, Indeed

Input:
- Target roles
- Keywords
- Location / salary filters

Output:
```json
{
  "title": "Frontend Developer",
  "company": "Acme Inc",
  "url": "https://hh.kz/job/123",
  "description": "React, TypeScript, REST APIs",
  "requirements": ["React", "TypeScript"],
  "location": "Remote",
  "salary": "2500 USD",
  "source": "hh.kz"
}
```

Tech:
- Playwright or Puppeteer for scraping
- Scheduler for daily job refresh
- JSON/SQLite for job storage

2. Resume & Cover Letter Generator

Goal: Automatically tailor materials for each job.

Input:
- Job description
- Base CV(s) & templates
- Skills database

Process:
- Extract keywords from the job post
- Match to your CV's skills
- Rewrite or highlight relevant parts

Generate:
- Tailored resume (PDF/Markdown)
- Cover letter
- Greeting email

Output:
- /output/resume_<job_id>.pdf
- /output/cover_<job_id>.txt
- /output/email_<job_id>.txt

Tools:
- OpenAI API or local LLM (for tailoring)
- pdfkit / LaTeX / docx for generation
- Template-based structure in Markdown

3. Application Tracker

Goal: Track jobs, statuses, and communications.

Database schema:
```
Field           Type    Description
id              int     Job ID
company         text    Company name
title           text    Position
url             text    Job posting
source          text    hh.kz / LinkedIn / etc.
status          text    pending/applied/replied/interview/rejected
applied_on      date    Application date
response_date   date    Reply date
notes           text    Comments
```

Integrations:
- Gmail API or IMAP for auto-updates
- Manual edit through dashboard

4. Email Integration

Goal: Automate and track communications.

Features:
- Send generated emails automatically (optional toggle)
- Read incoming replies from companies
- Update job status automatically

Tech:
- Gmail API / IMAP
- OAuth2 for secure access
- Regex-based reply detection (e.g., "We received your application...")

5. Dashboard UI (Tauri Frontend)

Goal: Provide a native desktop interface.

Tech stack:
- Tauri (Rust backend + React/Vite frontend)
- SQLite for local DB
- Framer Motion + TailwindCSS for animations
- Shadcn/UI components for clean design

🧱 UI Layout
1. Dashboard (Main Page)

Shows all active applications.

| Job            | Company   | Match % | Status  | Source  | Date    | Actions |
|----------------|-----------|---------|---------|---------|---------|---------|
| Frontend Dev   | Acme Inc  | 87%     | Applied | hh.kz   | Nov 5   | [Edit] [View] |

Actions:
- Edit job
- Generate resume
- Mark applied/interview/rejected

2. Job Finder

Fetch new listings manually or auto-refresh.

Features:
- Input search criteria (keywords, salary, remote)
- View new matches
- Click to generate application materials

3. Application Generator

Preview, customize, and export documents.

Features:
- Side-by-side preview (Cover Letter / Resume)
- Regenerate with GPT
- Download PDFs or send via email
- Save generated content to database

4. Settings

Profile management and integrations.

Tabs:
- Personal Info (name, summary, skills)
- Upload CV templates
- Email setup (OAuth)
- Keywords & job preferences
- File paths (output folder, templates)

5. Notifications

- Daily job match alerts
- Email response notifications
- "New jobs found" banner

🧠 Architecture
```
tauri-job-hunter/
├── src-tauri/           # Rust backend for filesystem, APIs
│   ├── main.rs
│   ├── email/
│   ├── db/
│   └── scraper/
├── src/                 # Frontend (React/Vite)
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   └── styles/
├── data/
│   ├── jobs.sqlite
│   ├── resumes/
│   ├── templates/
│   └── output/
└── README.md
```

🔧 Backend Integration (Python Service)

Tauri can communicate with a Python microservice for AI operations:

| Endpoint | Description |
|----------|-------------|
| /generate_resume | Create custom resume |
| /generate_cover | Create cover letter |
| /scrape_jobs | Fetch new listings |
| /apply_email | Send email (optional) |

This backend can run locally via FastAPI, connected through Tauri commands.

📊 Data Flow

1. User enters preferences in UI → stored in SQLite.
2. Scraper runs → saves structured jobs to DB.
3. User selects job → backend generates tailored resume/letter.
4. Resume + letter saved to /output.
5. Email integration sends or tracks responses.
6. Dashboard updates statuses automatically.

⚙️ Tools & Dependencies

| Category | Tools |
|----------|-------|
| Frontend | React, Tailwind, Shadcn/UI, Tauri |
| Backend | Python (FastAPI), Playwright, OpenAI API |
| Database | SQLite |
| Email | Gmail API (OAuth2) |
| File Handling | pdfkit, docx, or LaTeX |
| State Mgmt | Zustand or React Query |
| Build/Deploy | Vite + Cargo (Rust) |

🧭 MVP Development Roadmap

| Phase | Deliverable | Description |
|-------|-------------|-------------|
| 1 | Local job scraper | Scrape hh.kz + LinkedIn |
| 2 | Resume generator | Generate PDFs & letters |
| 3 | Tracker DB | Store applications & statuses |
| 4 | UI Dashboard | Basic Tauri desktop app |
| 5 | Email integration | Send + read responses |
| 6 | Notifications | Local alerts for new jobs |

🔒 Security

- Store credentials encrypted locally (tauri-plugin-store-secure)
- OAuth2 tokens refreshed automatically
- Sensitive data never leaves local environment

🧭 Future Expansions

- Skill gap analysis (job link → missing skills + learning plan)
- Telegram bot for alerts
- AI mock interviewer module
- Browser extension for 1-click job parsing
- Cloud sync (Supabase)
- Multi-user SaaS version

📅 Expected Timeline

| Week | Task |
|------|------|
| 1 | Set up Tauri + SQLite + job scraper |
| 2 | Build resume generator module |
| 3 | Create Tracker + basic UI |
| 4 | Add email integration |
| 5 | Implement notifications + polishing |
| 6 | Refactor + prepare for service version |

✅ Deliverables

- Functional desktop app (Tauri)
- Database with stored job data
- Resume/Cover generation scripts
- Email integration with tracking

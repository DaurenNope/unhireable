# Unhireable — Architecture Reference

> This document is the single source of truth for how the system works.
> Update it when you change anything structural.

---

## What the App Actually Does

Unhireable is a **desktop-first automated job hunting app**. Given your profile once,
it finds jobs, generates tailored documents, and applies — with varying degrees of
human oversight (Manual / Semi-Auto / Autopilot).

```
User Profile
    │
    ▼
[Job Discovery] ──► [Matching & Filtering] ──► [Document Generation] ──► [Application Submission]
    │                       │                           │                          │
20+ scrapers           Pure Rust scoring          Handlebars templates       headless_chrome
                       (no AI required)           + optional AI improve      + ATS form detection
                                                                                   │
                                                                          [Email Monitoring]
                                                                           IMAP + regex classifier
```

---

## Process Boundaries

| Layer | Technology | Port / Path |
|-------|------------|-------------|
| Desktop app UI | React 18 + Vite + TailwindCSS | Tauri window |
| Backend (IPC) | Rust + Tauri commands | `tauri://` IPC |
| REST API (for extension) | Rust + Axum | `localhost:3030` |
| Chrome Extension | Manifest V3 JS | Browser context |
| Local Database | SQLite via rusqlite | `{app_data}/jobhunter.db` |
| Credentials store | OS Keychain via `keyring` crate | System keychain |
| Vite dev server | Vite 5 | `localhost:3003` (dev only, NOT the REST API) |

**Critical:** Port `3030` = Axum REST API (always).
Port `3003` = Vite dev server (dev mode only, not accessible from extension in production).
The extension must ALWAYS talk to `3030`.

---

## Module Map

### Rust (`src-tauri/src/`)

```
lib.rs                  AppState, startup wiring, auto-apply pipeline
│
├── scraper/            20+ job source scrapers + ScraperManager
│   ├── mod.rs          JobScraper trait + ScraperManager orchestrator
│   ├── linkedin.rs     LinkedIn scraper
│   ├── greenhouse_board.rs
│   ├── ... (18 more)
│   ├── job_enricher.rs Fetches full descriptions for sparse results
│   └── firecrawl.rs    JS-heavy sites via Firecrawl API (optional key)
│
├── scraper_queue.rs    Background ScraperQueueWorker (runs in tokio::spawn)
│
├── matching/           Pure Rust job-to-profile matching (NO AI required)
│   ├── job_matcher.rs  Weighted scoring: 50% skills / 25% exp / 15% location / 10% title
│   └── skills_analyzer.rs  Keyword extraction + normalization
│
├── filtering/          Post-match filtering by user preferences
│   ├── smart_filter.rs Remote-only, location, title keywords, salary, company blocklist
│   └── questionnaire.rs  FilterCriteria struct
│
├── generator/          Document generation
│   ├── ai_integration.rs   SINGLE AI entrypoint. Picks provider: Mistral → Gemini → OpenAI
│   ├── resume.rs       ResumeGenerator: templates + optional AI improvement
│   ├── cover_letter.rs CoverLetterGenerator
│   ├── templates.rs    Handlebars engine, 5 resume + 5 cover letter templates
│   ├── ats_optimizer.rs  Keyword injection to pass ATS scanners
│   ├── quality_scorer.rs  Score output documents
│   ├── pdf_export.rs / docx_export.rs
│   └── version_control.rs  Document versioning
│
├── applicator/         Browser automation for actual form submission
│   ├── mod.rs          JobApplicator + ApplicationConfig
│   ├── form_filler.rs  headless_chrome driver. Fills ATS forms. AUTO_SUBMIT=false by default.
│   ├── ats_detector.rs Detects 40+ ATS systems by URL pattern
│   ├── apply_mode.rs   Manual / SemiAuto / Autopilot modes
│   ├── reliability.rs  Safety tiers: which ATS systems are safe to auto-submit
│   ├── verification.rs  Checks if submission succeeded
│   ├── retry.rs        Retry logic with backoff
│   └── workflow.rs     Orchestrates the full apply workflow steps
│
├── automation/         The full pipeline orchestrator
│   ├── orchestrator.rs AutomationOrchestrator: Discovery → Match → Filter → Generate → Apply
│   ├── autopilot.rs    AutoPilot: scheduler + safety limits + activity log
│   ├── scheduler.rs    Cron-style scheduling
│   ├── email_monitor.rs  IMAP + regex email classifier (interview / rejection / offer / etc.)
│   ├── follow_up.rs    Automated follow-up emails
│   ├── pipeline.rs     PipelineResult, stage tracking
│   └── apply_queue.rs  Priority queue for pending applications
│
├── db/
│   ├── models.rs       Job, Application, Contact, Interview, Credential, SavedSearch, etc.
│   └── queries.rs      All SQL via trait impls on MutexGuard<Connection>
│
├── commands/           Tauri IPC command handlers (called from React)
│   ├── jobs.rs         scrape_jobs, get_jobs, save_job, etc.
│   ├── documents.rs    generate_resume, generate_cover_letter, list_ai_providers
│   ├── automation.rs   start_autopilot, stop_autopilot, run_automation_pipeline
│   ├── matching.rs     match_jobs, get_match_score
│   ├── user.rs         get_profile, save_profile, credential management (OS keychain)
│   └── ...
│
├── web_server.rs       Axum REST API (port 3030). Same data as Tauri commands.
│                       Routes: /api/health, /api/profile, /api/jobs, /api/applications,
│                               /api/answers/cache, /api/apply/auto
│
├── security.rs         InputValidator, RateLimiter, SecureLogger
├── vault.rs            OS keychain wrapper (store/load/delete credentials)
├── deduplication/      Fuzzy job deduplication (Levenshtein distance)
├── recommendations/    Job recommendation engine
├── insights/           Analytics and insights
└── notifications/      Desktop notifications
```

### React Frontend (`frontend/src/`)

```
pages/
├── dashboard.tsx       Stats overview, recent activity
├── jobs.tsx            Job list, search, saved searches, scheduler
├── job-details.tsx     Single job view + AI enrichment + apply button
├── applications.tsx    Application tracker with status pipeline
├── application-details.tsx
├── autopilot.tsx       Autopilot controls, mode selector, live stats
├── settings.tsx        Profile, credentials (Mistral/Gemini/OpenAI), preferences
└── auth.tsx            Initial setup / onboarding

api/
├── client.ts           Main API client — routes to Tauri IPC or REST fallback
├── rest.ts             Direct REST calls to localhost:3030
└── mock.ts             Mock data for dev/testing without backend

components/
├── document-generator.tsx   Resume/cover letter generation UI
├── application-launchpad.tsx  Launch an application from a job
├── ats-suggestions.tsx      ATS optimization suggestions
└── ...
```

### Chrome Extension (`chrome-extension/`)

```
manifest.json               MV3 config. Permissions: activeTab, storage, alarms, scripting
background.js               Service worker. Handles messages between popup and content scripts.
popup.html / popup.js       Extension popup UI. Profile loader, stats, controls.
content-scripts/
├── linkedin.js             LinkedIn scanner + Easy Apply automation
├── smart-answers.js        Answer cache + Gemini fallback for unknown form fields
├── universal-filler.js     ATS form filler for non-LinkedIn sites
└── logger.js               Structured logging for extension context
```

---

## AI Integration

**Single path:** `AIIntegration` in `generator/ai_integration.rs`

Priority order (first key that exists wins):
1. `MISTRAL_API_KEY` → `https://api.mistral.ai/v1` (OpenAI-compatible)
2. `GEMINI_API_KEY` → `https://generativelanguage.googleapis.com/v1beta/openai` (OpenAI-compatible)
3. `OPENAI_API_KEY` or `AI_API_KEY` → `https://api.openai.com/v1`
4. No key → `basic_job_analysis()` (pure keyword extraction, no network call)

**AI is optional everywhere.** Every feature that uses AI has a non-AI fallback.

Keys are stored in the OS keychain via `vault.rs`. The UI Settings page
(Settings → API Keys) shows Mistral and Gemini first.

**Chrome extension** uses Gemini directly (stored in `chrome.storage.local`) for
unknown form field answers only. This is a separate key from the desktop app.

---

## Data Flow: Auto-Apply Pipeline

```
1. User triggers "Run Now" or scheduler fires
       ▼
2. run_pipeline(profile) in AutomationOrchestrator
       ▼
3. Stage: Discovery
   ScraperManager.scrape_all(query) → Vec<Job>
   ScraperQueueWorker deduplicates and saves to DB
       ▼
4. Stage: Matching
   JobMatcher.calculate_match(job, profile) → score 0-100
   Only jobs above threshold (default 60%) proceed
       ▼
5. Stage: Filtering
   SmartFilter.filter_jobs() — remote-only, location, salary, company blocklist
       ▼
6. Stage: Document Generation
   ResumeGenerator.generate_resume(profile, job) → GeneratedDocument
   CoverLetterGenerator.generate_cover_letter() → GeneratedDocument
   Saved to temp files + DB
       ▼
7. Stage: Application
   JobApplicator.apply_to_job(job, config)
   → AtsDetector.detect_ats(url) → AtsType
   → FormFiller.fill_and_submit(url, profile, resume, cover_letter)
   → Browser opens, fields filled, submit if auto_submit=true
       ▼
8. Stage: Tracking
   Application record saved to DB with status
   EmailMonitor watches inbox for responses
```

---

## Known Limitations (be honest)

| Feature | Status | Notes |
|---------|--------|-------|
| Job scraping | **Works** | 20+ sources, deduplication, enrichment |
| Job matching | **Works** | Pure Rust, no AI needed |
| Smart filtering | **Works** | Remote, location, salary, blocklist |
| Resume generation (no AI) | **Works** | 5 templates via Handlebars |
| Resume generation (with AI) | **Works** | Requires Mistral or Gemini key |
| Cover letter generation | **Works** | Same as resume |
| ATS form detection | **Works** | 40+ systems detected by URL |
| ATS form filling (Manual mode) | **Works** | Opens browser, fills, user submits |
| ATS form filling (Auto mode) | **Partial** | Requires Chrome binary on PATH. Fails silently if missing. |
| LinkedIn Easy Apply (extension) | **Works** | Full automation via content script |
| Autopilot scheduler | **Wired** | Commands exist and are registered. Runtime behavior needs E2E test. |
| Email monitoring | **Built** | Requires IMAP credentials — no UI to configure them yet |
| Follow-up emails | **Built** | Requires email credentials — same gap as above |
| Playwright fallback | **Stub only** | Enum variant exists, no implementation |
| Answer cache sync (extension ↔ app) | **Works** | Via `POST /api/answers/cache` on port 3030 |

---

## What to Apply From the Reference Repos

### From [vibe-check](https://github.com/fabriziosalmi/vibe-check)
**What it is:** Static analysis CI gate with 300+ rules.
**What to take:** The *mindset*, not the tool. Before shipping any feature:
- Is there a test for it?
- Does it fail gracefully, or does it panic/silently return wrong data?
- Is there dead code that implies a broken contract?

Apply by running `cargo test` and `npx vitest run` before every commit. Add to git hooks.

### From [ralph](https://github.com/snarktank/ralph)
**What it is:** Autonomous loop: one small PRD item per AI session until all pass.
**What to take:** The task decomposition principle.
- Each task must be completable in one session with a clear pass/fail check
- Memory lives in git history + `docs/` — not in the assistant's head
- Never work on "add authentication" — work on "add the IMAP credential form to Settings and persist it"

Use the `docs/tickets/` folder. Write a ticket, implement it, close it.

### From [brutal-coding-tool](https://github.com/fabriziosalmi/brutal-coding-tool) / [claude-code-brutal-edition](https://github.com/fabriziosalmi/claude-code-brutal-edition)
**What it is:** Audit tool + enforced engineering standards.
**What to take:** Zero tolerance for:
- Silent failures (every error must surface to the user)
- Dead feature stubs (email monitoring with no way to configure email is dead)
- Parallel implementations (two AI systems — now fixed)

### From [synapseed](https://github.com/fabriziosalmi/synapseed)
**What it is:** Rust MCP server that gives AI assistants structural understanding of a codebase.
**What to take:** The architecture pattern — a clean module per concern, each with a single
responsibility. Synapseed has 16 focused crates. Unhireable has many bloated modules.
Consider extracting `scraper`, `matching`, and `generator` as proper crate boundaries
if the codebase grows further.

---

## Next Concrete Steps (in priority order)

1. **Email credentials UI** — Add IMAP config to Settings so `EmailMonitor` can actually run
2. **Chrome binary detection** — On startup, check if Chrome exists. Show a clear error if missing before the user tries to auto-apply.
3. **End-to-end autopilot test** — Write one integration test: seed a job → run pipeline → verify application record created
4. **Playwright implementation** — Replace the stub with real Playwright via `node_modules` bundled with the app, or remove the option entirely
5. **Answer cache → AI proxy** — Route the extension's Gemini calls through `POST /api/answers/ai` on port 3030, keeping the key server-side

---

*Last updated: $(date)*

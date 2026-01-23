# Module Documentation

Detailed documentation for each module in the Unhireable application.

## Backend Modules

### `applicator/` - Application Automation

**Purpose:** Automate job application processes using browser automation.

**Key Files:**
- `workflow.rs` - Workflow orchestration and step execution
- `ats_detector.rs` - Detect ATS (Applicant Tracking System) type
- `form_filler.rs` - Automatically fill application forms
- `retry.rs` - Retry logic with exponential backoff
- `verification.rs` - Verify application submission

**Key Types:**
- `WorkflowOrchestrator` - Executes multi-step workflows
- `WorkflowStep` - Single step in a workflow
- `AtsDetector` - Detects ATS systems
- `RetryExecutor` - Handles retries

**Dependencies:**
- `headless_chrome` - Browser automation
- `tokio` - Async runtime

---

### `cache/` - Caching System

**Purpose:** In-memory caching for performance optimization.

**Key Types:**
- `Cache<K, V>` - Generic cache with TTL support

**Features:**
- TTL-based expiration
- Thread-safe (Arc + Mutex)
- Async operations

---

### `db/` - Database Layer

**Purpose:** Database abstraction and data persistence.

**Key Files:**
- `models.rs` - Data models (Job, Application, Contact, etc.)
- `queries.rs` - Query traits and implementations
- `mod.rs` - Database connection and migrations
- `postgres.rs` - PostgreSQL support (optional)

**Key Types:**
- `Database` - SQLite database wrapper
- `Job`, `Application`, `Contact`, `Interview`, `Document` - Data models
- Query traits: `JobQueries`, `ApplicationQueries`, etc.

**Features:**
- SQLite (default) and PostgreSQL (optional) support
- Migration system
- Type-safe queries

---

### `events/` - Event System

**Purpose:** Event-driven architecture for loose coupling.

**Key Types:**
- `EventBus` - Central event bus
- `Event` - Event structure
- `EventHandler` - Event handler function type

**Event Types:**
- `job.created`, `job.updated`, `job.deleted`
- `application.created`, `application.updated`
- `document.generated`
- `scraper.completed`
- And more...

---

### `generator/` - Document Generation

**Purpose:** Generate tailored resumes and cover letters.

**Key Files:**
- `resume.rs` - Resume generation
- `cover_letter.rs` - Cover letter generation
- `ai_integration.rs` - AI API integration
- `templates.rs` - Template management
- `pdf_export.rs` - PDF export
- `docx_export.rs` - DOCX export
- `ats_optimizer.rs` - ATS optimization
- `quality_scorer.rs` - Document quality scoring

**Key Types:**
- `ResumeGenerator` - Resume generation engine
- `CoverLetterGenerator` - Cover letter generation engine
- `GeneratedDocument` - Generated document structure
- `UserProfile` - User profile data

**Features:**
- Multiple templates
- AI-powered enhancement
- ATS optimization
- Quality scoring
- Multi-format export

---

### `matching/` - Job Matching

**Purpose:** Calculate job match scores based on user profile.

**Key Files:**
- `job_matcher.rs` - Main matching logic
- `skills_analyzer.rs` - Skills extraction and matching

**Key Types:**
- `JobMatcher` - Matching engine
- `JobMatchResult` - Match result with score and details
- `MatchWeights` - Configurable match weights

**Algorithm:**
- Skills Match (40%)
- Experience Match (30%)
- Location Match (15%)
- Title Match (15%)

---

### `scraper/` - Job Scraping

**Purpose:** Scrape jobs from multiple sources.

**Key Files:**
- `mod.rs` - Scraper manager and base traits
- `browser.rs` - Browser automation
- `config.rs` - Scraper configuration
- Individual source scrapers (linkedin.rs, wellfound.rs, etc.)

**Key Types:**
- `ScraperManager` - Manages multiple scrapers
- `JobScraper` - Trait for scrapers
- `ScraperConfig` - Configuration

**Supported Sources:**
- LinkedIn (high-risk, disabled by default)
- Wellfound
- hh.kz
- RemoteOK
- Remotive
- And 10+ more...

---

### `intelligence/` - AI Intelligence

**Purpose:** AI-powered job analysis and recommendations.

**Key Files:**
- `client.rs` - Intelligence API client
- `event_handler.rs` - Event-driven intelligence
- `models.rs` - Intelligence data models

**Features:**
- Job analysis
- Skill gap analysis
- Career path recommendations
- Market trends
- Application success prediction

---

### `recommendations/` - Job Recommendations

**Purpose:** Personalized job recommendations.

**Key Files:**
- `engine.rs` - Recommendation engine
- `behavior_tracker.rs` - User behavior tracking
- `similarity.rs` - Job similarity calculation

**Features:**
- Behavior-based recommendations
- Similarity-based recommendations
- Trending jobs
- Caching for performance

---

### `notifications/` - Notifications

**Purpose:** Email and desktop notifications.

**Key Files:**
- `email.rs` - Email sending
- `desktop.rs` - Desktop notifications
- `gmail.rs` - Gmail integration
- `email_extractor.rs` - Extract emails from jobs

**Features:**
- SMTP email support
- Desktop notifications
- Email templates
- Gmail OAuth (optional)

---

### `scheduler/` - Background Scheduler

**Purpose:** Schedule and run background jobs.

**Key Files:**
- `job_scheduler.rs` - Job scheduler implementation

**Features:**
- Scheduled job scraping
- Configurable intervals
- Start/stop control

---

### `metrics/` - Metrics & Monitoring

**Purpose:** Prometheus metrics for monitoring.

**Key Metrics:**
- Document generation metrics
- Scraper metrics
- Matching metrics
- API call metrics
- Cache metrics

---

## Frontend Modules

### `pages/` - Page Components

**Purpose:** Main application pages.

**Pages:**
- `dashboard.tsx` - Main dashboard with statistics
- `jobs.tsx` - Job listing and management
- `applications.tsx` - Application tracking
- `settings.tsx` - Settings and configuration
- `job-details.tsx` - Individual job view
- `application-details.tsx` - Application details view

---

### `components/` - Reusable Components

**Purpose:** Reusable UI components.

**Categories:**
- `ui/` - Shadcn/UI base components
- `dashboard/` - Dashboard-specific components
- Error handling components
- Loading state components
- Navigation components

---

### `api/` - API Client

**Purpose:** Tauri command invocation.

**Files:**
- `client.ts` - Main API client with error handling
- `mock.ts` - Mock data for development

**Features:**
- Type-safe command invocation
- Error handling
- Mock fallback for web preview

---

### `hooks/` - React Hooks

**Purpose:** Reusable React hooks.

**Hooks:**
- `use-online.ts` - Online/offline detection
- `use-retry.ts` - Retry mechanism
- `useApi.ts` - API data fetching

---

### `utils/` - Utilities

**Purpose:** Utility functions.

**Files:**
- `errors.ts` - Error handling utilities
- `utils.ts` - General utilities

---

## Module Dependencies

### Backend Dependency Graph

```
lib.rs (Commands)
    ├─ db/ (Database)
    ├─ scraper/ (Job Scraping)
    ├─ generator/ (Document Generation)
    │   └─ ai_integration.rs (AI APIs)
    ├─ matching/ (Job Matching)
    ├─ applicator/ (Automation)
    │   └─ workflow.rs (Browser Automation)
    ├─ events/ (Event Bus)
    ├─ cache/ (Caching)
    ├─ metrics/ (Monitoring)
    ├─ notifications/ (Notifications)
    ├─ intelligence/ (AI Intelligence)
    └─ recommendations/ (Recommendations)
```

### Frontend Dependency Graph

```
App.tsx
    ├─ pages/ (Routes)
    │   ├─ dashboard.tsx
    │   ├─ jobs.tsx
    │   └─ applications.tsx
    ├─ components/ (UI Components)
    │   ├─ ui/ (Base Components)
    │   └─ error-boundary.tsx
    ├─ api/ (API Client)
    ├─ hooks/ (React Hooks)
    └─ utils/ (Utilities)
```

---

## Module Communication

### Backend Communication

- **Commands** → **Modules**: Direct function calls
- **Modules** → **EventBus**: Publish events
- **EventHandlers** → **Modules**: Subscribe to events
- **Modules** → **Database**: Via query traits

### Frontend-Backend Communication

- **Frontend** → **Backend**: Tauri commands (`invoke`)
- **Backend** → **Frontend**: Events (`listen`)

---

**Last Updated:** 2024









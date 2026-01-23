# Architecture Overview

This document describes the overall architecture of the Unhireable application.

## System Architecture

Unhireable is built as a **desktop application** using:
- **Tauri** - Rust backend + web frontend framework
- **React + TypeScript** - Frontend UI
- **SQLite** - Local database
- **Rust** - Backend logic and business rules

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Pages   │  │Components│  │  Hooks   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│         │             │             │                   │
│         └─────────────┼─────────────┘                   │
│                      │                                  │
│              Tauri Commands (IPC)                       │
└──────────────────────┼──────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────┐
│              Backend (Rust)                              │
│  ┌──────────────────────────────────────────┐           │
│  │         Tauri Command Handlers            │           │
│  │         (92 commands in lib.rs)           │           │
│  └──────────────────────────────────────────┘           │
│                      │                                   │
│  ┌───────────────────┼───────────────────┐             │
│  │  Business Logic Modules                 │             │
│  │  • Scraper      • Generator             │             │
│  │  • Matching     • Applicator            │             │
│  │  • Intelligence • Recommendations      │             │
│  └───────────────────┼───────────────────┘             │
│                      │                                   │
│  ┌───────────────────┼───────────────────┐             │
│  │  Infrastructure Modules                 │             │
│  │  • Database      • Cache                │             │
│  │  • Events        • Metrics              │             │
│  │  • Notifications • Security             │             │
│  └───────────────────┼───────────────────┘             │
│                      │                                   │
│              SQLite Database                             │
└───────────────────────────────────────────────────────────┘
```

## Data Flow

### Job Scraping Flow

```
User Input (Query)
    ↓
ScraperManager
    ↓
Source Scrapers (LinkedIn, Wellfound, etc.)
    ↓
Job Enricher (Normalize, Deduplicate)
    ↓
Database (Save Jobs)
    ↓
EventBus (Publish JOB_CREATED)
    ↓
Intelligence Agent (Auto-match, Analyze)
    ↓
Frontend (Display Jobs)
```

### Document Generation Flow

```
User Request (Job + Profile)
    ↓
Document Generator
    ↓
Template Engine (Handlebars)
    ↓
AI Integration (Optional Enhancement)
    ↓
ATS Optimizer (Optimize for ATS)
    ↓
Quality Scorer (Score Document)
    ↓
Export (PDF/DOCX/Markdown)
    ↓
Database (Save Document)
    ↓
EventBus (Publish DOCUMENT_GENERATED)
    ↓
Frontend (Display Document)
```

### Job Matching Flow

```
Job + User Profile
    ↓
JobMatcher
    ↓
Skills Analyzer (Extract Skills)
    ↓
Match Calculator
    ├─ Skills Match (40%)
    ├─ Experience Match (30%)
    ├─ Location Match (15%)
    └─ Title Match (15%)
    ↓
Match Result (Score + Details)
    ↓
Database (Update Job Match Score)
    ↓
EventBus (Publish MATCH_CALCULATED)
    ↓
Frontend (Display Match Score)
```

## Module Structure

### Backend Modules (`src-tauri/src/`)

#### Core Modules

- **`lib.rs`** - Main entry point, Tauri command handlers (92 commands)
- **`main.rs`** - Application initialization
- **`error.rs`** - Error types and handling
- **`db/`** - Database layer
  - `models.rs` - Data models
  - `queries.rs` - Database queries (traits)
  - `mod.rs` - Database connection and migrations
  - `postgres.rs` - PostgreSQL support (optional)

#### Business Logic Modules

- **`scraper/`** - Job scraping
  - `mod.rs` - Scraper manager and base traits
  - `browser.rs` - Browser automation
  - `config.rs` - Scraper configuration
  - Individual source scrapers (linkedin.rs, wellfound.rs, etc.)
  
- **`generator/`** - Document generation
  - `resume.rs` - Resume generation
  - `cover_letter.rs` - Cover letter generation
  - `ai_integration.rs` - AI API integration
  - `templates.rs` - Template management
  - `pdf_export.rs`, `docx_export.rs` - Export formats
  
- **`matching/`** - Job matching
  - `job_matcher.rs` - Main matching logic
  - `skills_analyzer.rs` - Skills extraction and matching
  
- **`applicator/`** - Application automation
  - `workflow.rs` - Workflow orchestration
  - `ats_detector.rs` - ATS system detection
  - `form_filler.rs` - Form automation
  - `retry.rs` - Retry logic

#### Infrastructure Modules

- **`events.rs`** - Event bus (pub/sub)
- **`cache.rs`** - In-memory caching
- **`metrics.rs`** - Prometheus metrics
- **`notifications/`** - Email and desktop notifications
- **`scheduler/`** - Background job scheduler
- **`security.rs`** - Security utilities
- **`session.rs`** - Session management

#### Intelligence Modules

- **`intelligence/`** - AI-powered features
  - `client.rs` - Intelligence API client
  - `event_handler.rs` - Event-driven intelligence
  - `models.rs` - Intelligence data models

- **`recommendations/`** - Job recommendations
  - `engine.rs` - Recommendation engine
  - `behavior_tracker.rs` - User behavior tracking
  - `similarity.rs` - Job similarity calculation

- **`insights/`** - Market insights
  - `mod.rs` - Insights generation

#### Utility Modules

- **`deduplication/`** - Job deduplication
- **`filtering/`** - Job filtering
- **`resume_analyzer/`** - Resume analysis
- **`persona/`** - Test personas
- **`queue.rs`** - Job queue
- **`flow_engine.rs`** - Workflow engine

### Frontend Modules (`frontend/src/`)

#### Core Structure

- **`App.tsx`** - Main application component
- **`main.tsx`** - Application entry point

#### Pages (`pages/`)

- `dashboard.tsx` - Main dashboard
- `jobs.tsx` - Job listing and management
- `applications.tsx` - Application tracking
- `settings.tsx` - Settings and configuration
- `job-details.tsx` - Individual job view
- `application-details.tsx` - Application details

#### Components (`components/`)

- `ui/` - Shadcn/UI components
- `dashboard/` - Dashboard-specific components
- `error-boundary.tsx` - Error handling
- `error-display.tsx` - Error display
- `offline-banner.tsx` - Offline detection
- `loading-states.tsx` - Loading indicators

#### API (`api/`)

- `client.ts` - Tauri API client
- `mock.ts` - Mock data for development

#### Utilities (`utils/`)

- `errors.ts` - Error handling utilities
- `utils.ts` - General utilities

#### Hooks (`hooks/`)

- `use-online.ts` - Online/offline detection
- `use-retry.ts` - Retry mechanism
- `useApi.ts` - API hook

## Technology Stack

### Backend

- **Rust** - Systems programming language
- **Tauri** - Desktop app framework
- **SQLite** - Local database (via `rusqlite`)
- **Tokio** - Async runtime
- **Serde** - Serialization
- **Headless Chrome** - Browser automation
- **Prometheus** - Metrics
- **Handlebars** - Template engine

### Frontend

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Shadcn/UI** - Component library
- **React Router** - Routing
- **React Query** - Data fetching
- **Framer Motion** - Animations

## Design Patterns

### Event-Driven Architecture

- **EventBus** - Central event system
- **Event Handlers** - React to events (Intelligence, Document Generation)
- **Pub/Sub** - Loose coupling between modules

### Repository Pattern

- **Query Traits** - Database abstraction (`JobQueries`, `ApplicationQueries`, etc.)
- **Models** - Data structures
- **Queries** - Database operations

### Strategy Pattern

- **Scrapers** - Different strategies for each source
- **AI Providers** - Pluggable AI providers
- **Templates** - Different template strategies

### Retry Pattern

- **RetryExecutor** - Exponential backoff retry
- **Error Classification** - Retryable vs. non-retryable errors

## Data Storage

### Database Schema

- **jobs** - Job listings
- **applications** - Job applications
- **contacts** - Contact information
- **interviews** - Interview records
- **documents** - Generated documents
- **activities** - Activity log
- **credentials** - Encrypted credentials
- **user_profile** - User profile data
- **job_snapshots** - Job change tracking
- **saved_searches** - Saved search queries
- **behavior_tracking** - User behavior data
- **user_auth** - Authentication data

### File Storage

- **Documents** - Generated resumes/cover letters
- **Templates** - Document templates
- **Logs** - Application logs
- **Cache** - Temporary cache files

## Security

### Data Protection

- **Encryption** - Credentials encrypted with master password
- **Local Storage** - All data stored locally
- **No Cloud Sync** - Data never leaves your computer (except API calls)

### Authentication

- **Master Password** - Single password for app access
- **Session Management** - Secure session handling
- **Credential Storage** - Encrypted credential storage

## Performance

### Caching

- **In-Memory Cache** - Fast access to frequently used data
- **TTL-based Expiration** - Automatic cache invalidation
- **Cache Keys** - Structured cache key naming

### Optimization

- **Async Operations** - Non-blocking I/O
- **Batch Operations** - Bulk processing
- **Lazy Loading** - Load data on demand
- **Pagination** - Efficient data loading

## Testing

### Test Structure

- **Unit Tests** - Module-level tests (`#[cfg(test)]`)
- **Integration Tests** - Cross-module tests (`tests/integration/`)
- **E2E Tests** - End-to-end workflows (`tests/e2e/`)

### Test Coverage

- **Target**: 60%+ coverage for critical modules
- **Focus**: Business logic, error handling, data validation

## Deployment

### Build Process

1. **Frontend Build** - Vite builds React app
2. **Backend Build** - Cargo builds Rust binary
3. **Tauri Bundle** - Creates platform-specific installer

### Distribution

- **macOS** - DMG installer
- **Windows** - MSI installer
- **Linux** - AppImage

---

**Last Updated:** 2024









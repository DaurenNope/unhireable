# Unhireable Architecture

## Overview

Unhireable is a **hybrid job application system** combining the best of Career-Ops (deep evaluation) with browser automation (execution).

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    SCANNER      │ ──► │   EVALUATOR     │ ──► │    DASHBOARD    │
│   (Node.js)     │     │   (Node.js)     │     │   (HTML/JS)     │
│                 │     │   Any AI        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                       │
                                                       │ Export JSON
                                                       ▼
                                              ┌─────────────────┐
                                              │    EXTENSION    │
                                              │   (Chrome)      │
                                              │   Auto-Apply    │
                                              └─────────────────┘
```

## Components

### 1. Scanner (`/scanner/`)

**Purpose:** Find jobs from multiple sources

**Technology:** Node.js + Playwright

**Features:**
- LinkedIn job search (configurable keywords, filters)
- Company career pages (45+ pre-configured companies)
- Outputs structured JSON
- Deduplication by company+title

**Usage:**
```bash
cd scanner
npm install
npm run scan -- --source=linkedin --limit=50
```

**Output:** `data/jobs_raw.json`

### 2. Evaluator (`/evaluator/`)

**Purpose:** Score jobs against your CV using AI

**Technology:** Node.js + Any AI Provider

**Features:**
- A-F scoring system (Career-Ops style)
- Multi-provider support: OpenAI, Anthropic, Ollama (local)
- Generates tailored CV highlights
- Interview prep suggestions (STAR stories)
- Filters by minimum score

**Usage:**
```bash
cd evaluator
npm install
# Edit data/config.yml with your API key and CV
npm run evaluate
```

**Configuration:** `data/config.yml`
```yaml
ai:
  provider: openai  # or anthropic, ollama
  api_key: sk-...
  model: gpt-4o-mini

cv:
  name: Your Name
  title: Senior Engineer
  skills: [React, Node.js, Python]
  experience_years: 5
  salary_target: { min: 150000, max: 200000 }

evaluation:
  min_score: 3.0  # Only keep jobs scoring 3.0+
```

**Output:** `data/jobs_evaluated.json`

### 3. Dashboard (`/dashboard/`)

**Purpose:** Review evaluated jobs and queue for application

**Technology:** Static HTML/JS (no server needed)

**Features:**
- Import evaluated jobs JSON
- Filter by score, recommendation
- Review detailed A-F scoring breakdown
- Add jobs to application queue
- Export queue JSON for extension

**Usage:**
```bash
# Open directly in browser
open dashboard/index.html

# Or serve locally
npx serve dashboard
```

**Output:** Downloads `unhireable-queue-YYYY-MM-DD.json`

### 4. Chrome Extension (`/chrome-extension/`)

**Purpose:** Auto-fill and submit applications

**Technology:** Chrome Extension Manifest V3

**Features:**
- Import queue JSON from dashboard
- One-click apply to all queued jobs
- Auto-fills LinkedIn Easy Apply forms
- Uses tailored answers from evaluator
- Tracks application status
- Human-like delays to avoid detection

**Usage:**
1. Load extension in Chrome developer mode
2. Click extension icon
3. Import queue JSON
4. Click "Apply to All Jobs"

## Data Flow

```
1. Scanner → data/jobs_raw.json
   { jobs: [{ title, company, location, url, source }] }

2. Evaluator → data/jobs_evaluated.json
   {
     evaluated_at: "...",
     jobs: [{
       ...job,
       score: 4.2,
       recommendation: "APPLY",
       blocks: { A, B, C, D },
       cv_highlights: ["skill1", "skill2"],
       interview_prep: ["STAR story 1"],
       tailored_summary: "..."
     }]
   }

3. Dashboard → unhireable-queue-2024-01-01.json
   { jobs: [{ title, company, url, score, ... }] }

4. Extension → Chrome Storage
   jobQueue: [{ status: "pending"|"applied"|"failed", ... }]
```

## Scoring System (A-F Blocks)

Based on Career-Ops methodology:

- **Block A: Role Fit** (1-5)
  - Title matches target roles
  - Seniority appropriate
  - Domain expertise

- **Block B: Skills Match** (1-5)
  - Required vs candidate skills
  - Missing critical skills
  - Transferable experience

- **Block C: Logistics** (1-5)
  - Location/remote compatibility
  - Salary range acceptable
  - No red-flag keywords

- **Block D: Company Quality** (1-5)
  - Company reputation
  - Role clarity in JD
  - Growth potential

**Overall Score:** 1.0 - 5.0 (average of blocks)

**Recommendations:**
- `APPLY` (4.0+): Strong match, apply immediately
- `CONSIDER` (3.0-4.0): Good match, review details
- `SKIP` (<3.0): Poor match, don't apply

## AI Provider Support

| Provider | Setup | Cost | Speed |
|----------|-------|------|-------|
| OpenAI | API key | Pay per use | Fast |
| Anthropic | API key | Pay per use | Fast |
| Ollama | Local install | Free | Slower |

**Local LLM (Ollama):**
```bash
# Install Ollama
brew install ollama

# Pull a model
ollama pull llama2

# Configure evaluator
ai:
  provider: ollama
  model: llama2
  base_url: http://localhost:11434
```

## Security & Stealth

- No cloud storage (all data local)
- Human-like delays (5-10s between applications)
- No aggressive DOM scanning
- User controls all decisions
- Review before applying

## Extending the System

### Add New Company
Edit `/scanner/src/index.js`:
```javascript
const companies = [
  ...existing,
  { name: 'NewCompany', url: 'https://newco.com/careers', ats: 'greenhouse' }
];
```

### Custom Scoring Weights
Edit `/evaluator/src/index.js` prompt to adjust criteria.

### Add New ATS Support
Edit `/chrome-extension/content-scripts/linkedin.js` form selectors.

## Future Enhancements

- [ ] CV PDF generation (HTML → PDF)
- [ ] Interview scheduling tracking
- [ ] Email integration (apply via email)
- [ ] Mobile app (React Native)
- [ ] More ATS platforms (Workday, Taleo, etc.)

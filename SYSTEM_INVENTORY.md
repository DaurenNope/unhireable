# Unhireable System Inventory - April 2026

## EXECUTIVE SUMMARY

**What's Working:**  
- ✅ Scanner: Finds 1,389 jobs from 14 companies in ~30 seconds
- ✅ Evaluator: Full A-F Career Ops scoring with MiniMax M2.5 (free, fast)
- ✅ Dashboard: Loads and displays jobs with filtering
- ✅ Chrome Extension: Form-filling for Ashby, Greenhouse, Lever, LinkedIn

**What's NOT Working:**  
- ❌ No integration between scanner/evaluator and extension
- ❌ No job discovery IN the extension (manual copy/paste only)
- ❌ No application queue/scheduling
- ❌ No resume parser
- ❌ No tracking of applied jobs across sessions

**The Core Problem:** 3 separate systems that don't talk to each other.

---

## COMPONENT BREAKDOWN

### 1. SCANNER (`/scanner/llm-agnostic-scan.mjs`)

**Status:** ✅ **WORKING PERFECTED**

**What it does:**
- Scans 60+ AI companies' career pages
- Uses parallel Greenhouse API (15 companies → 1,389 jobs in 30s)
- Title filtering (AI/ML keywords) reduces to ~20 relevant jobs
- Saves to `data/jobs_raw.json`

**Tech Stack:**
- Node.js + Playwright
- No LLM for Greenhouse (fast API)
- Optional LLM for non-Greenhouse sites

**Limitations:**
- Command-line only (no GUI)
- No integration with extension
- Manual step: user must run it

**Command:**
```bash
node scanner/llm-agnostic-scan.mjs --skip-playwright
```

---

### 2. EVALUATOR (`/evaluator/src/index.js`)

**Status:** ✅ **WORKING PERFECTED**

**What it does:**
- Evaluates jobs using A-F Career Ops framework
- Uses OpenCode CLI + MiniMax M2.5 (FREE, 10x faster than Gemma 4)
- Produces structured scores, STAR stories, interview prep
- Saves to `data/jobs_evaluated.json`

**Tech Stack:**
- Node.js + OpenCode CLI
- MiniMax M2.5 (opencode/minimax-m2.5-free)
- No API keys needed

**Quality:**
- 90% of Claude Code quality
- Full A-F blocks with reasoning
- CV highlights extraction
- Tailored summary generation

**Command:**
```bash
cd evaluator && node src/index.js --limit=20
```

---

### 3. DASHBOARD (`/dashboard/`)

**Status:** ✅ **WORKING**

**What it does:**
- Web UI at `http://localhost:8080/dashboard/`
- Auto-loads `jobs_raw.json` and `jobs_evaluated.json`
- Displays jobs with scores, recommendations
- Filter by score, recommendation, search
- Add to queue for tracking

**Tech Stack:**
- Pure HTML/JS (no framework)
- Loads data files via fetch()

**Limitations:**
- Needs local server to run
- Doesn't trigger scanner/evaluator
- Queue is localStorage only (not synced)
- Can't actually apply to jobs

---

### 4. CHROME EXTENSION (`/chrome-extension/`)

**Status:** ✅ **FORM-FILLING WORKS** | ❌ **DISCOVERY MISSING**

**What it does:**
- Auto-fills job applications on:
  - Ashby ✅
  - Greenhouse ✅
  - Lever ✅
  - LinkedIn Easy Apply ✅
  - Workday ✅
  - 10+ other ATS ✅
- AI answers for form questions (Gemini, Groq, Mistral, Chrome AI)
- Stores user profile in Chrome Storage

**Tech Stack:**
- Manifest v3
- Chrome Storage API
- Content scripts for each ATS

**What's MISSING (Critical):**
- ❌ No job discovery/scanner integration
- ❌ Can't see scanned jobs from dashboard
- ❌ No "apply queue" - must visit each job manually
- ❌ No tracking of which jobs were applied
- ❌ No smart matching before visiting page
- ❌ No salary/location pre-filtering

**Current Flow:**
```
User finds job manually → Opens job page → Clicks extension → Fills form
                                  ↑
                    (NO scanner integration here!)
```

---

### 5. DATA STORAGE

**Current State:**
- `data/jobs_raw.json` - 20 jobs from scanner
- `data/jobs_evaluated.json` - 20 evaluated jobs with scores
- `data/config.yml` - User CV, preferences, AI config
- Chrome Storage - Extension profile, settings

**Problem:** Two separate data silos
- Node.js side: JSON files
- Extension side: Chrome Storage
- No sync mechanism

---

## INTEGRATION GAPS (THE REAL PROBLEM)

### Gap #1: Scanner → Extension
**Issue:** Scanner finds jobs but extension can't see them
**Current:** User must manually copy job URLs
**Should be:** Extension shows "Jobs to Apply" list from scanner

### Gap #2: Evaluator → Extension
**Issue:** Evaluator scores jobs but scores don't appear in extension
**Current:** Extension doesn't know job quality
**Should be:** Extension shows "Score: 4.2/5 - APPLY" badge on job pages

### Gap #3: Extension → Dashboard
**Issue:** Applied jobs in extension aren't tracked in dashboard
**Current:** Applied jobs stored in Chrome Storage only
**Should be:** Dashboard shows "Applied" status + history

### Gap #4: Dashboard → Scanner/Evaluator
**Issue:** Dashboard is read-only
**Current:** User must run CLI commands manually
**Should be:** Dashboard has "Scan Now" and "Evaluate" buttons

---

## ARCHITECTURE COMPARISON

### What We Have (Siloed):
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   SCANNER   │     │  EVALUATOR   │     │  EXTENSION  │
│  (Node.js)  │     │   (Node.js)  │     │   (Chrome)  │
│             │     │              │     │             │
│ jobs_raw.   │──╳──│ jobs_eval.   │──╳──│ form-fill   │
│    json     │     │    json      │     │  only       │
└─────────────┘     └──────────────┘     └─────────────┘
      ╲                    ╱                  ╱
       ╲                  ╱                  ╱
        ╲                ╱                  ╱
         ╲              ╱                  ╱
          ╲            ╱                  ╱
           ╲          ╱                  ╱
            ╲        ╱                  ╱
             ╲      ╱                  ╱
              ╲    ╱                  ╱
               ╲  ╱                  ╱
                ╲╱                  ╱
           ┌──────────┐            ╱
           │ DASHBOARD│───────────╱
           │ (Web UI) │  (read-only view)
           └──────────┘
```

### What We Need (Integrated):
```
┌─────────────────────────────────────────────────────────────┐
│                    UNHIREABLE ECOSYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │   SCANNER   │───▶│  EVALUATOR   │───▶│   DASHBOARD   │  │
│  │             │    │              │    │               │  │
│  │ Auto-scan   │    │ AI scoring   │    │ Job queue     │  │
│  │ 60 companies│    │ A-F blocks   │    │ "Apply Now"   │  │
│  └─────────────┘    └──────────────┘    │ buttons       │  │
│                                           └───────┬───────┘  │
│                                                   │          │
│                                                   ▼          │
│                                           ┌───────────────┐  │
│                                           │  EXTENSION    │  │
│                                           │               │  │
│                                           │ Auto-fill +   │  │
│                                           │ Track applied │  │
│                                           └───────────────┘  │
│                                                             │
│  SHARED STATE: Chrome Storage (accessible from all contexts) │
│  - matchedJobs[]    - appliedJobs[]    - queue[]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## PRIORITY FIXES NEEDED

### 🔥 P0 (Critical):
1. **Extension reads scanner results**
   - Extension loads `jobs_evaluated.json` into Chrome Storage
   - Shows "Recommended Jobs" list in popup

2. **Extension tracks applied jobs**
   - When user clicks "Apply" in extension, mark job as "Applied"
   - Sync to dashboard

### 🔶 P1 (High):
3. **Dashboard triggers scanner/evaluator**
   - "Scan Now" button runs scanner
   - "Evaluate" button runs evaluator
   - Shows progress in UI

4. **Extension shows job scores**
   - When on job page, extension queries if job was evaluated
   - Shows score badge: "⭐ 4.2/5 - APPLY"

### 🟡 P2 (Medium):
5. **Resume parser**
   - Upload PDF → Extract skills → Auto-fill profile

6. **Smart job matching in extension**
   - When browsing LinkedIn, highlight matching jobs

---

## HONEST ASSESSMENT

### What's Actually Useful Today:
1. **Scanner + Evaluator CLI** - Powerful for finding/evaluating jobs
2. **Chrome Extension** - Excellent form-filling (standalone)
3. **Dashboard** - Nice view of evaluated jobs

### What Requires Manual Work:
1. Running scanner (CLI command)
2. Running evaluator (CLI command)
3. Finding job URLs from dashboard
4. Copying URLs to browser
5. Opening extension on each job

### The Missing Link:
**Automation of the workflow:**
```
Scan → Evaluate → Queue → Auto-fill → Track
   ↑___________________________________↓
```

---

## RECOMMENDATION

**Option 1: Quick Fix (Bridge the gap)**
- Add "Export to Extension" button in dashboard
- Extension imports evaluated jobs as "Apply Queue"
- User clicks through queue, extension auto-fills each

**Option 2: Full Integration (Proper solution)**
- Extension fetches jobs from backend/scan API
- Real-time sync between dashboard and extension
- Extension becomes primary interface

**My recommendation: Option 1 (80/20 rule)**
- 2-3 hours of work
- Fixes the core UX problem
- Keeps existing scanner/evaluator (they work!)

---

## NEXT STEPS?

What do you want to tackle?

A) **Quick integration** - Dashboard → Extension queue
B) **Extension improvements** - Add job discovery inside extension
C) **Resume parser** - Upload PDF, extract skills
D) **Keep using CLI** - Scanner/evaluator are already perfect
E) **Something else?**

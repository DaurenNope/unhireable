# Unhireable Development TODO

## 🚧 IN PROGRESS - Integration Features

### Phase 1: Complete The Glue (Priority: 🔥 HIGH)

- [x] **A. Auto-detect job page scores** 
  - Extension detects when user visits evaluated job URL
  - Shows score badge in popup: "⭐ 4.0/5 - APPLY"
  - File: `chrome-extension/content-scripts/job-detector.js`
  - Storage: Read `matchedJobs` from Chrome Storage, match by URL

- [x] **B. One-click apply from dashboard** ✅ DONE
  - [x] "⚡ Apply Now" button in dashboard (only for APPLY recommendations)
  - [x] Opens job URL in new tab
  - [x] Stores pending application in localStorage
  - [x] Extension background checks tab updates for pending apps
  - [x] Auto-triggers form filling when page loads
  - [x] Content script handles checkPendingApplication messages
  - Files: `dashboard/app.js`, `background.js`, `job-score-detector.js`

- [x] **C. Track applied status** ✅ DONE
  - [x] "✅ Mark as Applied" button appears after form fill
  - [x] Button hidden until form is successfully filled
  - [x] markCurrentJobAsApplied() function
    - [x] Gets current tab URL
    - [x] Finds job in matchedJobs by URL
    - [x] Adds to appliedJobs with timestamp
    - [x] Updates job status in matchedJobs
    - [x] Updates UI (hides button, shows success)
    - [x] Refreshes stats and queue summary
  - [x] Dashboard filters updated:
    - [x] "APPLIED" option in Status dropdown
    - [x] "SKIP" option in Status dropdown
    - [x] "Show Applied" checkbox filter
    - [x] Shows count badge for applied jobs
  - Files: `popup.html`, `popup.js`, `index.html`, `chrome-extension/background.js`, `dashboard/app.js`
  - Add "Applied" filter to dashboard

- [x] **D. Full auto-pipeline button** ✅ DONE
  - [x] "▶ Run Full Pipeline" button in dashboard header (purple gradient)
  - [x] Real-time progress panel with 4 steps:
    - 🔍 Scan (10-25%)
    - ⚖️ Evaluate (30-60%)
    - 📥 Import (65-80%)
    - 📊 Load (85-100%)
  - [x] Each step shows: emoji icon, status text (pending/running/complete)
  - [x] Animated progress bar (gradient purple)
  - [x] Live log with timestamps
  - [x] Stop button to abort pipeline
  - [x] Success/error states with toast notifications
  - Files: `index.html`, `app.js`

### Phase 1 Summary - COMPLETE ✅
**The Glue** is now fully operational:
1. **Auto-detect scores** - Badge appears on evaluated job pages
2. **One-click apply** - Dashboard → Extension auto-fill flow
3. **Track applied** - Mark as applied, filter by status
4. **Full pipeline** - One button runs entire workflow

**Next: Phase 2 - Core Features**, new API endpoint or script runner
  - Requires: Backend or script execution capability

---

## 📋 MISSING FROM ORIGINAL CAREER-OPS

### Phase 2: Core Features (Priority: 🔥 HIGH)

- [ ] **1. PDF CV Generator (`modes/pdf.md`)**
  - **What:** Auto-generates tailored CV for each job
  - **Features:**
    - [ ] Extract 15-20 keywords from JD
    - [ ] Detect language → adapt CV language
    - [ ] Detect location → letter (US) vs A4 (rest of world)
    - [ ] Rewrite Professional Summary with JD keywords
    - [ ] Reorder experience bullets by JD relevance
    - [ ] Select top 3-4 most relevant projects
    - [ ] Build competency grid from JD requirements
    - [ ] Generate ATS-optimized HTML → PDF
    - [ ] Canva CV integration (optional)
  - **Files:** `tools/pdf-generator/`
  - **Dependencies:** Playwright for PDF generation, HTML templating
  - **Why:** Increases interview rate 3-5x
  - **Complexity:** High

- [ ] **2. Application Tracker (`modes/tracker.md`)**
  - **What:** Tracks ALL applications with states
  - **States:** `Evaluated` → `Applied` → `Responded` → `Contact` → `Interview` → `Offer/Rejected`
  - **Features:**
    - [ ] Markdown table: `data/applications.md`
    - [ ] Statistics dashboard:
      - [ ] Total applications
      - [ ] By state breakdown
      - [ ] Average score
      - [ ] % with PDF generated
      - [ ] % with report generated
    - [ ] Filter by state, company, date range
    - [ ] Export to CSV
  - **Files:** `tracker/tracker.mjs`, `data/applications.md`
  - **Complexity:** Low
  - **Depends on:** PDF generator for stats

- [ ] **3. Auto-Pipeline Mode (`modes/auto-pipeline.md`)**
  - **What:** One command does EVERYTHING
  - **Workflow:**
    1. [ ] Extract JD (from URL or text)
    2. [ ] Evaluate A-F (full scoring)
    3. [ ] Save report to `reports/`
    4. [ ] Generate tailored PDF CV
    5. [ ] Generate draft application answers (Section G)
    6. [ ] Update tracker
  - **Draft Application Answers (Section G):**
    - [ ] "Why are you interested in this role?"
    - [ ] "Why do you want to work at [Company]?"
    - [ ] "Tell us about a relevant project"
    - [ ] "What makes you a good fit?"
    - [ ] Tone: "I'm choosing you" (confident, selective)
    - [ ] Specific proof points from evaluation
  - **Files:** `evaluator/src/auto-pipeline.mjs`
  - **Complexity:** High (chains all other modes)
  - **Depends on:** PDF generator, tracker

### Phase 3: Application Automation (Priority: 🔶 MEDIUM)

- [ ] **4. Apply Mode - Live Assistant (`modes/apply.md`)**
  - **What:** Real-time help ON application page
  - **Workflow:**
    1. [ ] Detect job from Chrome tab (screenshot/URL)
    2. [ ] Match against existing reports
    3. [ ] If mismatch → warn user
    4. [ ] Analyze ALL form questions
    5. [ ] Generate personalized answers for each field
    6. [ ] Present copy-paste format
    7. [ ] Post-apply: Update tracker status
  - **Files:** `chrome-extension/content-scripts/apply-mode.js`
  - **Complexity:** Medium (Playwright screenshot + question detection)
  - **Note:** Extension already has smart answers, but not job-specific from evaluation

- [ ] **5. Contacto - LinkedIn Power Move (`modes/contacto.md`)**
  - **What:** After applying, find + message contacts
  - **Targets:**
    - [ ] Hiring manager
    - [ ] Recruiter
    - [ ] 2-3 peers with similar roles
  - **Message format (300 chars max):**
    - [ ] Frase 1: Hook (something specific about company)
    - [ ] Frase 2: Proof (quantified achievement)
    - [ ] Frase 3: Ask (15-min chat)
  - **Files:** `tools/linkedin-outreach/contacto.mjs`
  - **Complexity:** Low (WebSearch + prompt generation)
  - **Depends on:** WebSearch API

### Phase 4: Interview Prep & Research (Priority: 🟡 LOWER)

- [ ] **6. Deep Research Mode (`modes/deep.md`)**
  - **What:** Generates structured research prompt
  - **6 Research Axes:**
    1. [ ] AI Strategy (stack, blog, papers)
    2. [ ] Recent moves (hiring, funding, launches)
    3. [ ] Engineering culture (deploys, remote policy)
    4. [ ] Probable challenges (scaling, migrations)
    5. [ ] Competitors (moat, positioning)
    6. [ ] Candidate angle (unique value)
  - **Files:** `tools/deep-research/deep.mjs`
  - **Complexity:** Low (prompt template)
  - **Output:** Research prompt for Perplexity/Claude

- [ ] **7. Story Bank (`interview-prep/story-bank.md`)**
  - **What:** Accumulates STAR+R stories
  - **Format:** Situation, Task, Action, Result, Reflection
  - **Features:**
    - [ ] Tag by skills demonstrated
    - [ ] Reuse across evaluations
    - [ ] Search by keyword
    - [ ] Export for interview prep
  - **Files:** `interview-prep/story-bank.mjs`
  - **Complexity:** Low (append to file)
  - **Integration:** Evaluator extracts STAR stories → Story Bank

- [ ] **8. Interview Prep Framework**
  - **What:** Structured interview preparation
  - **Features:**
    - [ ] STAR story selection based on job requirements
    - [ ] Anticipated questions from JD
    - [ ] Company-specific talking points
    - [ ] Mock interview generator
  - **Files:** `interview-prep/`
  - **Complexity:** Medium
  - **Depends on:** Story Bank

### Phase 5: Scale & Polish (Priority: 🟢 LOW)

- [ ] **9. Batch Processing (`modes/batch.md`)**
  - **What:** Process multiple jobs in parallel
  - **Features:**
    - [ ] Pipeline inbox: `data/pipeline.md`
    - [ ] Parallel workers (5-10 concurrent)
    - [ ] Progress tracking
    - [ ] Error handling & retry
    - [ ] Resume capability
  - **Files:** `tools/batch-processor/`
  - **Complexity:** Medium (worker orchestration)

- [ ] **10. Deduplication Tracker (`dedup-tracker.mjs`)**
  - **What:** Prevents re-evaluating same job
  - **Features:**
    - [ ] Hash of URL + title
    - [ ] `data/scan-history.tsv` tracking
    - [ ] Warn if duplicate detected
  - **Files:** `scanner/dedup-tracker.mjs`
  - **Complexity:** Low
  - **Note:** Scanner already dedupes companies, but not job URLs

- [ ] **11. System Update Mechanism (`update-system.mjs`)**
  - **What:** Auto-updates system files
  - **Features:**
    - [ ] Check for updates: `node update-system.mjs check`
    - [ ] Git-based updates
    - [ ] Preserves user data
    - [ ] Rollback capability
  - **Files:** `scripts/update-system.mjs`
  - **Complexity:** Medium

- [ ] **12. Onboarding Flow**
  - **What:** First-run experience
  - **Steps:**
    1. [ ] Check if `cv.md` exists (create if missing)
    2. [ ] Check if `config/profile.yml` exists
    3. [ ] Check if `modes/_profile.md` exists
    4. [ ] Check if `portals.yml` exists
    5. [ ] Check if `data/applications.md` exists
    6. [ ] Get to know user (superpower, deal-breakers, best achievement)
  - **Files:** `scripts/onboarding.mjs`
  - **Complexity:** Medium (interactive wizard)

- [ ] **13. CV Sync Check (`cv-sync-check.mjs`)**
  - **What:** Verifies CV is up-to-date
  - **Features:**
    - [ ] Warn if evaluation references projects not in CV
    - [ ] Suggest CV updates
  - **Files:** `scripts/cv-sync-check.mjs`
  - **Complexity:** Low

- [ ] **14. Data Contract Enforcement**
  - **What:** Two-layer system
  - **User Layer:** Never auto-updated (CV, profile, reports, tracker)
  - **System Layer:** Auto-updatable (modes, scripts, templates)
  - **Rule:** User customizations go in `modes/_profile.md`
  - **Files:** Documentation in `DATA_CONTRACT.md`
  - **Complexity:** Process/documentation

- [ ] **15. Archetype System**
  - **What:** Predefined role archetypes
  - **Files:** `modes/_shared.md`
  - **Archetypes:**
    - [ ] AI/ML Engineer → Staff AI Engineer, Principal AI Engineer
    - [ ] Solutions Architect → Forward Deployed Engineer
    - [ ] Data Engineer → Staff Data Engineer
    - [ ] etc.
  - **Features:**
    - [ ] Archetype detection from job title
    - [ ] Archetype-specific evaluation criteria
    - [ ] Career path visualization
  - **Complexity:** Low (config file)

- [ ] **16. OpenCode Commands (Slash Commands)**
  - **What:** `.opencode/commands/` with markdown files
  - **Commands to port:**
    - [ ] `/career-ops` → evaluate
    - [ ] `/career-ops-pipeline` → batch process
    - [ ] `/career-ops-evaluate` → A-F scoring
    - [ ] `/career-ops-pdf` → generate CV
    - [ ] `/career-ops-contact` → LinkedIn outreach
    - [ ] `/career-ops-deep` → company research
    - [ ] `/career-ops-tracker` → view applications
    - [ ] `/career-ops-apply` → live application help
    - [ ] `/career-ops-scan` → scan portals
    - [ ] `/career-ops-batch` → batch processing
  - **Files:** `.opencode/commands/*.md`
  - **Complexity:** Low (markdown files)

---

## 📊 COMPLETION STATUS

### What We Have (Done ✅):
| # | Feature | Status |
|---|---------|--------|
| 1 | Scanner | ✅ Done |
| 2 | Evaluator A-F | ✅ Done |
| 3 | Dashboard | ✅ Done |
| 4 | Extension Form-Filling | ✅ Done |
| 5 | Extension Jobs Queue | ✅ Done |

### What's Missing (16 Major Features):
| Phase | Features | Priority |
|-------|----------|----------|
| Phase 1 | 4 Integration features | 🔥 HIGH |
| Phase 2 | PDF Gen, Tracker, Auto-Pipeline | 🔥 HIGH |
| Phase 3 | Apply Mode, LinkedIn Outreach | 🔶 MEDIUM |
| Phase 4 | Deep Research, Story Bank, Interview Prep | 🟡 LOWER |
| Phase 5 | 9 Polish features | 🟢 LOW |

**Total: 5/21 features complete (24%)**

---

## 🎯 RECOMMENDED PRIORITY ORDER

### This Week (High Impact):
1. ✅ ~~Scanner + Evaluator + Dashboard + Extension~~ DONE
2. 🔥 **A. Auto-detect job scores** (Extension improvement)
3. 🔥 **B. One-click apply** (Dashboard → Extension flow)
4. 🔥 **C. Track applied status** (Application tracking)

### Next Week (Core Career-Ops):
5. 🔥 **PDF CV Generator** (Biggest competitive advantage)
6. 🔥 **Application Tracker** (Foundation for everything)
7. 🔥 **Auto-Pipeline** (Chained workflow)

### Following Weeks:
8. 🔶 Apply Mode (Live assistant)
9. 🔶 LinkedIn Outreach
10. 🟡 Interview Prep features

---

## 📝 NOTES

### Files Referenced:
- Original Career-Ops: `/tools/career-ops-clone/`
- Scanner: `/scanner/llm-agnostic-scan.mjs`
- Evaluator: `/evaluator/src/index.js`
- Dashboard: `/dashboard/app.js`
- Extension: `/chrome-extension/popup.js`

### Data Flow:
```
Scanner → jobs_raw.json → Evaluator → jobs_evaluated.json → Import Script → Extension Storage → Dashboard
```

### Key Dependencies:
- Playwright (for PDF generation and screenshot)
- OpenCode CLI (for MiniMax M2.5 evaluations)
- Chrome Storage API (for extension data)

---

*Last Updated: April 10, 2026*

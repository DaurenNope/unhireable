# Frontend Experience Improvement Plan

**Status:** Draft for kickoff (Nov 2025)  
**Scope:** Cross-cutting UX/feature enhancements covering resume workflows, automation, and core CRM surfaces.

---

## 1. Goals
- Give users a guided, end-to-end funnel (profile → resumes → jobs → automation) with clear CTAs.
- Improve discoverability of high-value insights (match scores, ATS readiness, resume quality).
- Reduce friction in data entry by adding validation, helper copy, and smarter defaults.
- Increase transparency for long-running or automated tasks (status, logs, notifications).

---

## 2. Current Strengths (Baseline to Preserve)
- Resume Analyzer UI already offers a polished tabbed layout with alerts, toasts, and clear optional job context.
- Design system foundations (shadcn UI) exist across many components.
- Back-end capabilities (match scoring, generators, automation, ATS insights) are available for surfacing in the UI.

---

## 3. Primary Gaps & Initiatives

### 3.1 Navigation & Information Architecture
- Missing home dashboard or guided “next step” flow.
- No contextual links between modules (e.g., from a matched job to document generation).
- **Initiatives:** Build a Home screen with status cards (profile completeness, resumes analyzed, jobs matched, automation status). Add CTA banners and quick links from feature pages.

### 3.2 Data Input & Validation
- Forms lack consistent validation and inline help.
- Limited reuse of persona/profile data to prefill fields.
- **Initiatives:** Adopt React Hook Form + Zod schema validation, add helper text/tooltips, and introduce smart defaults/autofill from stored profile/persona data.

### 3.3 Document & Resume Experience
- No centralized document library; resume analyzer requires manual file paths outside Tauri.
- Analysis history and version comparisons unavailable.
- **Initiatives:** Create a Document Library view with upload (drag-and-drop), recent files, status badges, quick actions (Analyze, Export, Duplicate). Persist analysis snapshots per document and show deltas.

### 3.4 Job Discovery & Matching Visualization
- Match scores/ATS insights not prominent in job lists.
- Filtering/sorting by fit is absent.
- **Initiatives:** Decorate job cards with match % badges, ATS risk labels, and automation readiness. Add filters/sorts for high-fit jobs and quick actions (Generate tailored resume).

### 3.5 Automation Workflow UX
- Users can trigger automation but lack visibility into schedules, last run, or failures.
- Pre-run safety checks/guidance hidden in docs.
- **Initiatives:** Automation dashboard with per-workflow cards (status, next run, last result, logs). Add setup wizard confirming credentials, attachments, CAPTCHA needs. Provide inline warnings and dry-run previews.

### 3.6 Notifications & Activity History
- Toasts vanish; no persistent log or notification center.
- Hard to audit past analyses or automation attempts.
- **Initiatives:** Notification drawer + activity timeline (resume analyzed, job saved, automation run). Allow filtering by module and linking back to relevant items.

### 3.7 Accessibility, Responsiveness, and Theming
- Mixed component styles; unknown keyboard/ARIA coverage.
- Responsive layouts for dense tables/grids need review.
- **Initiatives:** Accessibility audit, ensure ARIA labels/focus states, and standardize spacing/typography. Add responsive breakpoints and consider dark/high-contrast themes.

### 3.8 Guidance & Dependency Awareness
- Prerequisite steps (OCR tools, credentials) not surfaced inline.
- Documentation siloed in markdown files.
- **Initiatives:** In-app checklist (Install dependencies, Add profile, Analyze resume, Configure automation). Add dependency detection (Poppler/Tesseract, Playwright) and contextual help links/tooltips in UI.

### 3.9 Performance Feedback for Long Tasks
- Large analyses lack progress indication; multi-task queue not visible.
- **Initiatives:** Task queue panel showing pending/running jobs with progress/ETA and cancel/retry controls. Enhanced status indicators for Resume Analyzer, scraping, and automation.

### 3.10 Future-Looking Enhancements
- Persona-driven playbooks (preset flows), collaboration hooks, multi-format inputs (docx/image), and quality scoring comparisons for documents.

---

## 4. Roadmap Phases

### Phase 1 — Foundations (2–3 sprints)
1. Implement Home dashboard with status cards + onboarding checklist.
2. Standardize form validation (React Hook Form + Zod) across high-traffic pages.
3. Add dependency detection messaging (OCR, automation tooling) in Resume Analyzer & Automation settings.
4. Begin accessibility cleanup (focus states, ARIA labels) and typography spacing pass.

### Phase 2 — Experience Upgrades (3–4 sprints)
1. Ship Document Library with drag-and-drop uploads, analysis history, quick actions.
2. Enhance Job list/details with match badges, ATS risk labels, and filters.
3. Build Automation dashboard (status cards, logs, safety wizard) + notification drawer.
4. Introduce task queue/progress UI for long-running operations.

### Phase 3 — Advanced Workflows (3+ sprints)
1. Persona-guided workflows linking profile → resume → match → apply.
2. Resume comparison & quality scoring overlays (diff vs. previous analysis, job-specific suggestions).
3. Collaboration/export enhancements (share analysis summaries, download data).
4. Explore docx/image ingestion by auto-converting to PDF via background service.

---

## 5. Success Metrics
- Time-to-first-successful-analysis (<3 minutes from install, with checklist guidance).
- % of jobs viewed with match/ATS badges visible.
- Automation transparency: users see last run status without checking logs.
- Reduction in support issues tied to missing dependencies or unknown states.
- Accessibility score (axe/Lighthouse) improvement to AA baseline.

---

## 6. Immediate Next Steps
1. Review plan with stakeholders; prioritize Phase 1 tickets.
2. Create design mocks for Home dashboard, Document Library, and Automation dashboard.
3. Align backend APIs (document history, automation status endpoints) with frontend needs.
4. Schedule dependency detection spike (Poppler/Tesseract/Playwright availability checks).

---

_Maintainer: Frontend/UX lead (TBD). Update this document as we close phases or add new UX findings._


# Current Phase

## Active Phase
**Phase 1 — Extension Foundation**

## Phase Goal
Make Unhireable a strong standalone browser product that gives real user value without requiring the desktop app.

## Core Outcome
A user should be able to:

1. install the extension
2. complete onboarding with just a resume or basic profile
3. land on a supported or likely job page
4. preview what can be filled
5. fill the application faster
6. save the job locally
7. track application activity locally

If the desktop app is running, sync should enhance the experience, but it must not be required.

---

## Why This Phase Exists

The project has been trying to do too much:
- scraping
- CRM
- document generation
- automation
- extension workflows
- autonomous pipelines

That created breadth without a dependable core.

This phase fixes that by establishing one strong loop:

**browse job → detect page → preview/fill → save/track → optionally sync**

---

## In Scope

### 1. Free AI tier
- Cloudflare Worker proxy
- Gemini Flash behind the proxy
- per-user rate limits
- cache-first behavior

### 2. Popup ATS detection
- expand detection beyond the current limited set
- surface all supported ATS systems already covered by the extension

### 3. Universal page scan
- scan unknown pages using `activeTab`
- detect likely job/application pages
- expose confidence to the user

### 4. Onboarding
- profile setup in popup
- resume upload or manual entry
- AI parsing path
- manual correction path

### 5. Preview fill
- show what will be filled before filling
- show confidence levels
- show unresolved fields

### 6. Gap report
- show what was filled
- show what was skipped
- show what still needs manual review

### 7. Local job and application tracking
- save jobs locally
- avoid duplicates
- create basic local application history

### 8. Optional desktop sync
- queue sync operations
- push to desktop when available
- never block core usage on sync

---

## Out of Scope

These are explicitly not core phase deliverables:

- mass scraping as primary user value
- autopilot scheduler
- IMAP/email monitoring UI
- full autonomous application pipeline
- employer marketplace features
- large cloud backend
- mandatory account system
- Playwright rework
- making the desktop app the required path

---

## Constraints

### Product constraints
- must feel simple to non-technical users
- must prioritize trust and clarity
- must not pretend certainty where there is none

### Technical constraints
- local-first by default
- extension works without desktop
- deterministic answers preferred over AI
- API spend must remain controlled

### Repo constraints
- no new root markdown files
- tickets stay under `docs/tickets/`
- process docs stay under `docs/process/project-control/`

---

## Definition of Done for This Phase

Phase 1 is done when all of the following are true:

### Onboarding
- first-time users can create a usable profile from popup
- resume parsing works or manual fallback works cleanly

### Detection
- popup recognizes all supported ATS platforms
- popup can scan likely job pages outside known ATS sites

### Fill flow
- preview mode exists
- confidence labels exist
- gap report exists
- fill works reliably on supported pages

### Local value
- save job works
- local application history exists
- duplicate handling exists

### AI
- free proxy tier works
- user-owned keys still work
- answer cache is used before model calls

### Architecture
- extension still works when desktop app is absent
- desktop sync is additive only

---

## Execution Order

1. repo hygiene
2. free AI proxy
3. popup ATS detection expansion
4. universal page scan
5. onboarding flow
6. preview fill and gap report
7. save jobs and local application tracking
8. desktop sync polish

---

## Current Working Principle

Do not add new product surfaces during this phase.

If something is interesting but not necessary for the extension foundation loop, it should be deferred and recorded rather than partially built.

---

## Current Status

**Phase status:** active  
**Blockers:** none recorded yet  
**Current top ticket:** E1 — Cloudflare Worker free AI tier
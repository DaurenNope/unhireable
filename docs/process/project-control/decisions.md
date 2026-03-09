# Strategic Decisions

This file records durable decisions that should not be re-litigated every session unless there is a strong reason.

---

## D-001 — Product direction is extension-first

**Decision:**  
The browser extension is the primary product surface.

**Why:**  
Users already browse jobs in the browser. The extension meets them where they are and provides immediate value without requiring them to change behavior.

**Implication:**  
The extension must provide standalone value even when the desktop app is not running.

**Status:** active

---

## D-002 — Desktop app is an optional power hub

**Decision:**  
The desktop app is not the core entry point. It is an optional local-first CRM, secure settings hub, and document workspace.

**Why:**  
Making the desktop app mandatory increases friction. The desktop app should enhance retention and depth, not block first value.

**Implication:**  
Any essential user flow must work without the desktop app running.

**Status:** active

---

## D-003 — Local-first is non-negotiable

**Decision:**  
The system is local-first by default.

**Why:**  
Users are sharing highly sensitive job search data: resumes, application history, personal details, and credentials. Local-first improves trust and avoids unnecessary infrastructure complexity.

**Implication:**  
Primary storage stays local:
- extension: `chrome.storage.local`
- desktop: SQLite + OS keychain

**Status:** active

---

## D-004 — Reliability and completeness beat feature breadth

**Decision:**  
The current priority is not building more features. It is making the existing core experience reliable and complete.

**Why:**  
The project has already drifted into trying to do too many things. A narrower, better product is more valuable than a broad product with half-working paths.

**Implication:**  
Phase work should be judged by whether the user can depend on it, not by whether it sounds ambitious.

**Status:** active

---

## D-005 — Human-in-the-loop first

**Decision:**  
Unhireable should help users move faster, not try to replace them immediately.

**Why:**  
Full autonomy sounds impressive but is brittle, hard to trust, and not yet the strongest wedge.

**Implication:**  
Current UX should emphasize:
- preview
- confidence
- user confirmation
- structured tracking

**Status:** active

---

## D-006 — Free AI tier uses Unhireable proxy

**Decision:**  
The default AI experience will use a lightweight Unhireable proxy backed by Gemini Flash.

**Why:**  
This gives users a zero-friction starting point without exposing a master API key in the extension.

**Implication:**  
The free tier must be:
- rate limited
- cache-first
- minimal in data sent
- replaceable by user-owned keys

**Status:** active

---

## D-007 — Power users may bring their own AI provider

**Decision:**  
Users can optionally use their own AI key or local model.

**Supported direction:**
- Groq
- Gemini
- Mistral
- local model

**Why:**  
This creates a clean upgrade path, reduces proxy cost, and supports advanced users.

**Status:** active

---

## D-008 — Scrapers are not the core experience right now

**Decision:**  
The project should stop centering mass scraping and autopilot behavior in the product narrative.

**Why:**  
The stronger near-term product is the extension + CRM loop, not a fragile autonomous pipeline.

**Implication:**  
Scraper-heavy and autopilot-heavy features are deprioritized.

**Status:** active

---

## D-009 — No new root markdown files

**Decision:**  
The repo structure rules remain in force.

**Why:**  
Top-level sprawl makes the repo harder to navigate and violates project guardrails.

**Implication:**  
Root control file is YAML. Operational docs live under `docs/process/project-control/`.

**Status:** active

---

## D-010 — Tickets are execution docs, not canonical truth

**Decision:**  
Tickets hold execution detail, but the canonical current truth is the root ledger plus current-phase file.

**Why:**  
Completed tickets become historical context and should not dominate future sessions.

**Implication:**  
When a ticket is completed, its outcome must be summarized upward into the ledger and change log.

**Status:** active
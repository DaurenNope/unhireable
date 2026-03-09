# Change Log

This file records meaningful project-level changes.

It should capture:
- major decisions
- important scope changes
- completed milestone-level work
- removals of previously active directions

It should **not** capture every small implementation detail or every commit.

Newest entries go at the top.

---

## 2026-03-09 — Repo hygiene and E1 prep

### Summary
Repo hygiene fixes, Tauri build fix, and E1 (free AI proxy) preparation completed.

### What changed
- **Rust**: Fixed `test_autonomous_loop_logic` (user_profile schema, heuristic promotion, flexible assertions)
- **Frontend**: Fixed lint errors in discovery.tsx, removed duplicate discovery.js
- **Brain**: Added heuristic-only promotion when score >= 80 (no AI key required)
- **Tauri build**: Unset CI env before build to avoid `--ci` invalid value error
- **Extension**: Added `https://*.workers.dev/*` host permission for proxy
- **Extension**: Made proxy URL configurable via `unhireableProxyUrl` in chrome.storage.local
- **Docs**: Added `docs/tech/unhireable-ai-proxy.md` deployment guide
- **Scripts**: Added `tools/scripts/deploy-ai-proxy.sh` for Worker deployment

### Verification
- Lint: pass
- Frontend tests: 32 passed
- Rust tests: 97 passed (lib) + 7 (web_server)
- Tauri build: success (Unhireable.app + .dmg)

---

## 2026-03-09 — Extension-first product direction established

### Summary
Unhireable was formally repositioned as an extension-first product.

### What changed
- The browser extension is now the primary product surface.
- The desktop app is now defined as an optional local-first CRM, document workspace, and secure settings hub.
- The product focus shifted away from trying to do everything at once.

### Why
The previous direction was too broad and created a pattern of feature sprawl:
- scraping
- automation
- CRM
- document generation
- extension workflows
- autonomous pipelines

This produced breadth without a fully dependable core loop.

### Product implication
The new core loop is:

browse job → detect page → preview/fill → save/track → optionally sync

---

## 2026-03-09 — Reliability and completeness set as top priorities

### Summary
The project priorities were narrowed to reliability and completeness.

### What changed
The product is no longer being judged by feature count or ambition.  
It is now being judged by whether the core experience works consistently and fully.

### Why
A smaller, stronger product is more valuable than a broad product with half-built paths.

### Product implication
New work should favor:
- fewer moving parts
- better defaults
- stronger user trust
- clearer outcomes
- fewer dead-end features

---

## 2026-03-09 — Free AI tier decided

### Summary
A free default AI tier was approved.

### What changed
The default AI experience will use:
- Unhireable proxy
- backed by Gemini Flash
- rate-limited per user
- cache-first by design

Users may still optionally bring their own:
- Groq key
- Gemini key
- Mistral key
- local model

### Why
This removes setup friction for non-technical users while preserving an upgrade path for power users.

### Product implication
The extension can deliver immediate value without forcing users to manage API keys during first-run onboarding.

---

## 2026-03-09 — Local-first policy reaffirmed

### Summary
Local-first architecture was reaffirmed as a core product rule.

### What changed
Primary storage remains local:
- extension → `chrome.storage.local`
- desktop → SQLite + OS keychain

### Why
Job search data is sensitive. Local-first improves trust and avoids unnecessary infrastructure complexity.

### Product implication
The extension must work meaningfully even when the desktop app is not running.

---

## 2026-03-09 — Operating control system introduced

### Summary
A lightweight project control system was introduced.

### What changed
The repo now has a structured operating model centered around:
- `project-ledger.yaml`
- `docs/process/project-control/`
- `docs/tickets/`

### Why
This reduces:
- token waste
- strategic drift
- repeated decision-making
- confusion between current truth and old execution detail

### Product implication
Agents should read:
1. `project-ledger.yaml`
2. `current-phase.md`
3. `docs/tickets/README.md`
4. only the specific active ticket needed
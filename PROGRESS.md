# Unhireable System - Build Progress

**Status:** ✅ READY (waiting for LLM models to download)

---

## ✅ Completed

### Dashboard
- [x] Auto-loads jobs from `data/jobs_raw.json` and `data/jobs_evaluated.json`
- [x] Shows both pending (scanned) and evaluated jobs
- [x] Source badges: "Scanned" (blue) and "Evaluated" (purple)
- [x] Pending filter with checkbox
- [x] Score display with color coding
- [x] Queue management (add/remove)
- [x] Export functionality
- [x] Dark theme UI matching brand

### Scanner (LLM-Agnostic)
- [x] Supports multiple LLM providers: OpenAI, Anthropic, Gemini, Ollama, LM Studio
- [x] Greenhouse API direct integration
- [x] Playwright-based scraping
- [x] Title filtering with positive/negative keywords
- [x] 76 companies configured in portals.yml
- [x] Dry-run mode for testing (no LLM required)

### Evaluator
- [x] A-F block scoring system
- [x] Multi-provider LLM support
- [x] CV matching against job descriptions
- [x] Interview prep generation
- [x] Tailored summary per job
- [x] Export to jobs_evaluated.json

### Chrome Extension
- [x] Popup UI with profile management
- [x] Auto-fill for LinkedIn, Ashby, Greenhouse, Lever
- [x] Resume upload (PDF/DOCX parsing)
- [x] Job queue panel in popup
- [x] Dashboard quick-link
- [x] Application stats tracking
- [x] Autopilot mode for LinkedIn
- [x] Smart answers with LLM integration
- [x] Human-like behavior toggle

### Config
- [x] User profile: Dauren Nox, AI/ML Engineer & Blockchain Specialist
- [x] Skills: Python, JavaScript, ML, AI/LLM, Solidity, Web3
- [x] Target roles: AI Engineer, ML Engineer, Blockchain Developer
- [x] Title filters: AI/ML + Blockchain hybrid focus
- [x] LM Studio configured (localhost:1234)

### Scripts & Tools
- [x] `scripts/test-data-flow.js` - System validation
- [x] `scripts/dry-run-scan.mjs` - Test without LLM
- [x] `scripts/export-jobs.js` - Export to CSV/JSON/Markdown
- [x] `.windsurf/workflows/run-system.md` - Quick start guide

---

## ⏳ Waiting For

### LLM Models
- [ ] User downloading local LLM (Qwen or similar)
- [ ] LM Studio server running on localhost:1234
- [ ] Model loaded and ready

---

## 🎯 Ready to Run

Once LLM is ready, execute:

```bash
# 1. Test connection
curl http://localhost:1234/v1/models

# 2. Start dashboard
cd dashboard && python3 -m http.server 8080

# 3. Run scanner
node scanner/llm-agnostic-scan.mjs --limit=10

# 4. Run evaluator
cd evaluator && node src/index.js --limit=10

# 5. View results
open http://localhost:8080
```

---

## 📊 Current Data

- **jobs_raw.json:** 102 jobs (98 from Anthropic scan, 4 dry-run)
- **jobs_evaluated.json:** 1 job (placeholder)
- **Companies:** 76 enabled for scanning
- **Title filters:** 31 positive, 17 negative keywords

---

## 🔗 Quick Links

- **Dashboard:** http://localhost:8080
- **LM Studio:** http://localhost:1234/v1
- **Config:** `data/config.yml`
- **Portals:** `data/portals.yml`

---

Last updated: 2024 (waiting for models)

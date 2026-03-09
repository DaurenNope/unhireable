# LinkedIn Easy Apply — Testing Checklist

Use this checklist to verify the extension works reliably on LinkedIn Easy Apply before expanding to other ATS (Greenhouse, Ashby, Lever, etc.).

## Prerequisites

- [ ] Chrome extension loaded (`chrome://extensions` → Load unpacked → `chrome-extension/`)
- [ ] User profile set (popup → Edit profile or Load from backend)
- [ ] LLM for smart answers: Gemini/Groq/Mistral API key **or** Local (Ollama) with `OLLAMA_ORIGINS=*` if CORS errors
- [ ] On `https://www.linkedin.com/jobs/` with a search (e.g. "full stack engineer")

## Phase 1: Scan

- [ ] **Autopilot / Scan Only** — Click "Start Autopilot" or "Scan Only"
- [ ] Job cards are found (`[data-occludable-job-id]` or fallback)
- [ ] Match score calculated (remote-friendly, skills)
- [ ] Only Easy Apply jobs kept (external jobs filtered out)
- [ ] **Pagination** — If multiple pages, "Next" button is found and clicked
- [ ] Scan completes with "Found X Easy Apply jobs across Y pages"

## Phase 2: Apply (Single Job)

- [ ] **Test Apply This Job** — Open a job card, click "Test Apply This Job"
- [ ] Easy Apply button found and clicked
- [ ] Modal opens within 8 seconds
- [ ] Form fields serialized (name, email, phone, etc.)
- [ ] **Answers** — Pattern → cache → Gemini (in order)
- [ ] Fields filled without errors
- [ ] Next/Submit button found and clicked
- [ ] Multi-step flow completes (up to 6 steps)
- [ ] Success: "Applied to [Company]"

## Phase 3: Apply (Batch)

- [ ] **Apply to Matches** — After scan, click "Apply to X Matches"
- [ ] Jobs are applied in order (Easy Apply first)
- [ ] **Skip non-Easy Apply** — If detail page shows "Apply" not "Easy Apply", job is skipped
- [ ] Daily limit respected
- [ ] Progress saved (can resume after stop)
- [ ] Notification shows "Applied to [Company] (N/10)"

## Edge Cases

- [ ] **Already applied** — Job shows "Applied" badge → skipped
- [ ] **Stuck loop** — Same step 3x → force-click primary button, or dismiss with "needs manual"
- [ ] **Unknown field** — Modal appears, user can answer or skip
- [ ] **No profile** — Clear error "Load profile first"
- [ ] **Connection error** — "Refresh the LinkedIn page and try again"

## Known Limitations

- **External apply** — Jobs with "Apply on company site" are skipped (no new tab)
- **Pagination** — Full page reload would kill script; we use button click only
- **409 Conflict** — LinkedIn may return 409 on submit (already applied); not yet handled
- **Backend 500s** — If Tauri app not running, answer-cache/patterns API fails; extension uses local fallbacks
- **Local LLM CORS** — If using Ollama and seeing CORS errors, run `OLLAMA_ORIGINS="*" ollama serve` (or set env before starting Ollama)

## Quick Smoke Test

1. Load extension, set profile.
2. Go to LinkedIn Jobs, search "software engineer".
3. Click "Scan Only" → should find matches.
4. Click one job, click "Test Apply This Job" → should fill and submit.
5. If all pass → LinkedIn Easy Apply is ready for production use.

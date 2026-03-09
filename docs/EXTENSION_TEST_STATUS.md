# Extension Test Status

## Fixes Applied (this session)

1. **Notification overlay blocking clicks** — Added `pointer-events: none` to the "Ready! Click extension to start" notification so it doesn't intercept clicks on the page.

2. **Easy Apply button selector** — Added selectors that scope to the job details panel (`.job-details-jobs-unified-top-card`, `.jobs-unified-top-card`) so we click the correct Easy Apply button, not the filter or a hidden job card.

3. **testApplySingleWithProfile** — Added automation bridge action that accepts profile inline (no storage race).

4. **Combobox support** — Added serialization and fill logic for `[role="combobox"]` (LinkedIn Email dropdown). Clicks to open, finds matching `[role="option"]`, clicks it.

5. **Answer patterns (config + DB)** — Patterns live in `config/answer-patterns.json` (bundled fallback) and **user DB** (GET/PUT `/api/answer-patterns`). Users customize in Settings → Answer Patterns. Extension fetches from API first, falls back to bundled. No hardcoded patterns in code.

6. **Unknown-question handling** — When pattern/cache/LLM all fail:
   - **No fallbacks** — If no answer, we ask user. If user skips, field stays empty. No generic text.
   - **LLM** (smart-answers): Company-specific answers. Prompt forbids generic phrases ("I'm excited...", "skills align well"). Uses job description (800 chars) to tailor "why interested" etc.
   - **Ask user** (universal-filler): Modal → user provides answer (saved to cache) or skips (field empty).

## Automated Test

```bash
npm run test:extension
```

Launches Chrome with the extension, navigates to LinkedIn Jobs (Easy Apply). If not logged in, you have 60s to log in. Screenshots: `.test-modal-opened.png`, `.test-after-flow.png`.

## Manual Test

1. **Reload the extension** at `chrome://extensions` (click reload on Unhireable).

2. **Open LinkedIn Jobs** with Easy Apply filter, select a job.

3. **Trigger** via extension UI or DevTools:
   ```bash
   playwriter -s 1 -e 'await page.evaluate((p) => { window.postMessage({ type: "unhireable", action: "testApplySingleWithProfile", profile: p }, "*"); }, { personal_info: { name: "Test User", email: "test@example.com", phone: "+1 555-123-4567", location: "San Francisco, CA" }, skills: ["JavaScript", "React"], summary: "Test" }; await new Promise(r => setTimeout(r, 20000)); return "done"'
   ```

5. **Expected:** Modal opens → form fills → Next clicked → Submit → modal closes.

## Dev Mode (No Credentials)

When no API keys are set, the extension defaults to **Chrome AI (Gemini Nano)** — on-device, free, no setup. In the popup, choose "Chrome AI (Gemini Nano) — No setup, on-device" as the provider. Enable in `chrome://flags/#optimization-guide-on-device-model` if needed.

## Free AI Proxy (E1)

To use the default free AI tier (production):

1. Deploy the Worker (requires Cloudflare account + GEMINI_API_KEY):
   ```bash
   cd tools/cloudflare/unhireable-ai-proxy
   npm run kv:create          # Create KV namespace, update wrangler.toml with id
   npm run secret:gemini      # Set GEMINI_API_KEY
   npm run deploy             # Or: npm run deploy:ai-proxy from root
   ```
2. Set `unhireableProxyUrl` in chrome.storage.local to your Worker URL (e.g. `https://unhireable-ai-proxy.<subdomain>.workers.dev`), or update the default in smart-answers.js.

## Known Issues

- Playwriter MCP has 10s execution timeout; long waits must be chunked.
- User must reload extension after code changes.

## LinkedIn Logout / Session Issues

LinkedIn may log users out when it detects automation or extensions. To reduce detection:

- **Lazy injection**: The extension no longer auto-loads scripts on LinkedIn Jobs pages. Scripts are injected only when you click **Apply** or **Scout** in the popup. This reduces the extension's footprint.
- **Workarounds** if you still get logged out: use a separate Chrome profile for job hunting, or disable the extension when not actively applying.

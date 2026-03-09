# PinchTab Integration for External Apply

When applying to jobs that redirect to external ATS sites (Greenhouse, Lever, etc.), the extension can use [PinchTab](https://github.com/pinchtab/pinchtab) for more reliable form filling when the ATS URL is available upfront.

## How It Works

1. **URL extraction**: For external jobs, the extension tries to extract the ATS URL from the Apply button's `href` (when it's an `<a>` link).

2. **PinchTab path** (when URL is available):
   - Extension sends `POST http://localhost:3030/api/external-apply-pinchtab` with `{ ats_url, profile }`
   - Tauri app uses PinchTab to open the URL and fill common form fields (name, email, phone, location)
   - No tab detection or clicking in the user's browser

3. **Extension fallback** (when URL is not extractable):
   - Uses the standard flow: click Apply → wait for new tab or same-tab navigation → inject content script to fill form

## Setup

1. **Check status**: The Automation Health Check in Settings shows "PinchTab (external apply)" — green when PinchTab is running.

2. **Install PinchTab**:
   ```bash
   curl -fsSL https://pinchtab.com/install.sh | bash
   # or: npm install -g pinchtab
   ```

3. **Start PinchTab** (in a separate terminal):
   ```bash
   pinchtab
   ```
   Default port: 9867.

4. **Run the Unhireable app** so the REST API is available on port 3030.

5. **Use the extension** on LinkedIn — when you apply to an external job, it will try PinchTab first if the ATS URL can be extracted.

## Supported Form Fields

PinchTab auto-fills these fields when labels match (case-insensitive):

- **Name** (first, last, full)
- **Email**
- **Phone**
- **Location** (city, address)
- **LinkedIn URL**
- **GitHub URL**
- **Portfolio / Website**
- **Years of experience**

## When PinchTab Is Used

- The Apply button must be an `<a href="...">` with a non-LinkedIn URL
- The Unhireable app must be running (for the REST API)
- PinchTab must be running

If any of these conditions fail, the extension falls back to the standard tab-based flow.

## API Reference

**POST /api/external-apply-pinchtab**

Request body:
```json
{
  "ats_url": "https://boards.greenhouse.io/company/jobs/123",
  "profile": { "personal_info": { "name": "...", "email": "...", ... } }
}
```

If `profile` is omitted, the app loads the profile from the database.

Response:
```json
{
  "success": true,
  "used_pinchtab": true,
  "error": null
}
```

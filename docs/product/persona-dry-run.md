# Persona Dry-Run Harness

This guide explains how to spin up the built‑in "Atlas Ward" persona, seed their preferences, and run an automated dry run that submits to a safe test endpoint (`https://httpbin.org/post`).

## Quick Start

### Option 1: Using the UI (Recommended)

1. Open the app and navigate to **`/persona-test`** (or add it to your navigation)
2. Click **"List Personas"** to see available personas
3. Click **"Load"** next to a persona to install their profile and preferences
4. Click **"Run Dry-Run (Auto-Submit)"** to test the full automation flow

### Option 2: Using the Test Script

Run the automated test script:

```bash
./scripts/test-persona.sh
```

This script will:
- List available personas
- Load the Atlas persona
- Run a dry-run with auto-submit enabled
- Display results and next steps

### Option 3: Manual CLI Commands

#### 1. Load the Persona

```
pnpm tauri invoke load_test_persona
```

What it does:

- Saves Atlas's full profile into the local database.
- Writes reusable resume/cover-letter markdown files under `<app-data>/personas/atlas/`.
- Creates/updates the **Smart Filter** saved search with Atlas's questionnaire-style preferences (locations, skills, salary floor, etc.).

You can list available personas with:

```
pnpm tauri invoke list_personas_catalog
```

#### 2. Run the Smart Filter (optional UI step)

Open the desktop app → **Settings → Job Preferences**. You'll see Atlas's answers prefilled. Click **Run Smart Filter** to pull matching jobs using the saved-search configuration.

#### 3. Execute the Dry Run

```
pnpm tauri invoke persona_dry_run
```

This command:

1. Ensures the persona profile/preferences are installed.
2. Seeds a synthetic "test" job that points to `https://httpbin.org/post?persona=atlas`.
3. Calls the existing `apply_to_job` automation in **test mode**, uploading the persona's resume/cover letter and auto-submitting to the httpbin endpoint.
4. Stores a test application record plus a log entry so you can inspect the end-to-end flow without touching a real ATS.

Optional flags:

```
pnpm tauri invoke persona_dry_run --slug atlas --autoSubmit false
```

- `slug`: choose a different persona when more are added (default: "atlas").
- `autoSubmit`: set to `false` if you want the dry run to stop before auto-submission (application stays in "preparing" status).

## Artifacts & Logs

- Resume / cover letter paths are returned by both commands and live under `<app-data>/personas/<slug>/`.
- Dry-run output includes the httpbin response preview so you can confirm payload shape.
- Application + activity records are created in the local DB (status `submitted` when auto-submit=true, otherwise `preparing`).

Use this loop whenever you need to verify scraping + matching + auto-apply without risking a real application. Once you’re confident, swap the persona profile for a real one and disable test mode to apply for actual jobs.


# Quick Testing Guide

## App Status
✅ App is running and migrations are applied successfully!

## Testing Persona System

### Option 1: Using the UI
1. Open the app in your browser (usually `http://localhost:1420` or check terminal)
2. Navigate to `/persona-test` in the URL bar
3. Click **"List Personas"** to see available personas
4. Click **"Load"** next to "Atlas Ward" to install the persona
5. Click **"Run Dry-Run (Auto-Submit)"** to test the automation flow

### Option 2: Using the Test Script
```bash
./scripts/test-persona.sh
```

### Option 3: Manual CLI Commands
```bash
# List personas
pnpm tauri invoke list_personas_catalog

# Load Atlas persona
pnpm tauri invoke load_test_persona --slug atlas

# Run dry-run
pnpm tauri invoke persona_dry_run --slug atlas --autoSubmit true
```

## Testing ATS Suggestions

1. Navigate to any job in the app (Jobs page)
2. Click on a job to view details
3. **ATS Suggestions card** will appear automatically below the job header
4. The card shows:
   - Detected ATS type (if known)
   - Confidence level (High/Medium/Low)
   - Automation support (Full/Partial/Manual)
   - Helpful tips for applying
   - Known quirks/limitations

### Test with Different ATS Types

Try viewing jobs with URLs from:
- **Greenhouse**: `https://boards.greenhouse.io/...` or `https://*.greenhouse.io/...`
- **Lever**: `https://jobs.lever.co/...` or `https://*.lever.co/...`
- **Workday**: `https://*.workday.com/...` or `https://*.myworkdayjobs.com/...`
- **Workable**: `https://apply.workable.com/...` or `https://*.workable.com/...`
- **LinkedIn**: `https://www.linkedin.com/jobs/...`
- **Custom**: Any other URL will show "custom form" suggestions

## What to Check

### Persona System
- [ ] Persona list loads correctly
- [ ] Loading persona creates profile and saved search
- [ ] Dry-run creates test job and application
- [ ] Documents are generated in `<app-data>/personas/atlas/`

### ATS Suggestions
- [ ] ATS card appears on job details page
- [ ] Correct ATS type is detected
- [ ] Tips and quirks are relevant
- [ ] Automation support level is accurate
- [ ] UI is clear and readable

## Troubleshooting

If persona commands fail:
- Make sure the app is fully started (wait a few seconds after migrations)
- Check that database is initialized
- Verify app data directory exists

If ATS suggestions don't appear:
- Check browser console for errors
- Verify job has a URL
- Check network tab for API calls

## Next Steps

Once testing is complete:
1. Verify persona dry-run creates proper test applications
2. Check that ATS suggestions help users understand application forms
3. Consider adding more personas for different roles
4. Expand ATS detection to more systems if needed


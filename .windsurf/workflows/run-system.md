---
description: Start Unhireable System (Dashboard + Prepare for Scan)
---

# Start Unhireable System

This workflow starts the dashboard server and prepares the system for scanning.

## Prerequisites

1. **LM Studio** running with a loaded model at `localhost:1234`
2. **Config files** updated with your preferences

## Steps

### 1. Start Dashboard Server

```bash
cd /Users/mac/Documents/Development/unhireable/dashboard && python3 -m http.server 8080
```

// turbo - Wait 2 seconds for server to start

### 2. Verify Dashboard

Dashboard should be live at: http://localhost:8080

### 3. Test LM Studio Connection (when ready)

```bash
curl -s http://localhost:1234/v1/models | head -20
```

If you see model info, the LLM is ready!

### 4. Run Scanner (when LM Studio is running)

```bash
cd /Users/mac/Documents/Development/unhireable && node scanner/llm-agnostic-scan.mjs --limit=5
```

### 5. Evaluate Jobs (after scanning)

```bash
cd /Users/mac/Documents/Development/unhireable/evaluator && node src/index.js --limit=5
```

### 6. View Results

Refresh http://localhost:8080 to see evaluated jobs with scores.

## Quick Commands

| Command | Description |
|---------|-------------|
| `curl http://localhost:1234/v1/models` | Test LM Studio |
| `curl http://localhost:8080` | Test dashboard |
| `node scanner/llm-agnostic-scan.mjs --limit=3` | Quick scan |
| `node evaluator/src/index.js --limit=3` | Quick evaluate |

## Troubleshooting

**LM Studio not responding:**
- Check LM Studio is running with "Start Server" enabled
- Verify the model is fully loaded (not still downloading)

**Dashboard not loading:**
- Check port 8080 is not in use: `lsof -i :8080`
- Try different port: `python3 -m http.server 8081`

**Scanner fails:**
- Check `data/config.yml` has correct settings
- Verify `data/portals.yml` has companies enabled

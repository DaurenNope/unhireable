# Unhireable Usage Guide

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
# Scanner
cd scanner
npm install

# Evaluator
cd ../evaluator
npm install
```

### 2. Configure

```bash
cd ../evaluator
cp data/config.yml.example data/config.yml
# Edit data/config.yml with your API key and CV details
```

### 3. Find Jobs

```bash
cd ../scanner
npm run scan -- --limit=30
```

### 4. Evaluate Jobs

```bash
cd ../evaluator
npm run evaluate
```

### 5. Review & Queue

```bash
open ../dashboard/index.html
```

- Click "Load Evaluated Jobs"
- Review scores
- Click "Add to Queue" on good matches
- Click "Export Queue for Extension"

### 6. Apply

```bash
# Load extension in Chrome
# 1. chrome://extensions/ → Developer mode ON
# 2. Load unpacked → Select chrome-extension/ folder

# Click extension icon → Import Queue → Apply to All Jobs
```

---

## Detailed Workflow

### Daily Routine

**Morning (10 minutes):**
```bash
cd scanner
npm run scan -- --source=linkedin --keywords="senior,staff" --limit=50
```

**Midday (5 minutes):**
```bash
cd evaluator
npm run evaluate -- --limit=20
```

**Evening (20 minutes):**
```bash
# Open dashboard
open dashboard/index.html

# Review jobs, queue top 5-10
# Export queue
# Click "Apply to All Jobs" in extension
```

---

## Configuration Options

### Scanner Options

```bash
npm run scan -- \
  --source=all \          # linkedin, companies, or all
  --limit=100 \           # Max jobs to find
  --keywords="senior,staff,principal" \
  --headless             # Show browser window (debug)
```

### Evaluator Configuration

Edit `data/config.yml`:

```yaml
# AI Provider
ai:
  provider: openai        # openai, anthropic, ollama
  api_key: sk-...         # Your API key
  model: gpt-4o-mini      # gpt-4o-mini, claude-3-haiku, etc.

# Your Profile
cv:
  name: "John Doe"
  title: "Senior Software Engineer"
  summary: "10 years building scalable web applications..."
  skills:
    - React
    - Node.js
    - TypeScript
    - AWS
  experience_years: 10
  location: "Remote"
  salary_target:
    min: 180000
    max: 250000
    currency: "USD"

# Filters
preferences:
  remote_only: true
  avoid_keywords:
    - "Java"
    - "PHP"
    - "WordPress"
  target_roles:
    - "Senior Engineer"
    - "Staff Engineer"
    - "Tech Lead"

# Scoring
evaluation:
  min_score: 3.5          # Only keep jobs 3.5+
  blocks: ["A", "B", "C", "D"]
```

### Ollama (Free Local AI)

```bash
# Install
brew install ollama

# Pull model
ollama pull llama3.2

# Start server
ollama serve

# Configure evaluator
cat > data/config.yml << EOF
ai:
  provider: ollama
  model: llama3.2
  base_url: http://localhost:11434

cv:
  name: "Your Name"
  title: "Software Engineer"
  skills: ["Python", "React"]
  experience_years: 5
EOF
```

---

## Tips & Tricks

### Quality Over Quantity

Don't apply to everything. The system filters for you:

- **4.5+**: Strong match, definitely apply
- **4.0-4.5**: Good match, probably apply
- **3.0-4.0**: Maybe, review carefully
- **<3.0**: Skip, not worth your time

### Review Before Applying

The evaluator gives you:
- **CV Highlights**: Which skills to emphasize
- **Interview Prep**: STAR stories to prepare
- **Tailored Summary**: Custom summary for this job

Use these! They're gold.

### Tracking Applications

The extension tracks:
- Applied ✓
- Failed ✗
- Pending ○

Check the dashboard after applying to see your success rate.

### Avoid Rate Limits

The system adds 5-10 second delays between applications.
Don't change this - LinkedIn will block you.

### Customizing CV Highlights

The evaluator suggests which skills to emphasize per job.
You can customize the prompt in `evaluator/src/index.js`.

---

## Troubleshooting

### Scanner finds no jobs

- Check your internet connection
- LinkedIn may require login (scan in logged-in browser first)
- Try `npm run scan -- --no-headless` to see what's happening

### Evaluator API errors

- Check your API key in `config.yml`
- For OpenAI: Ensure you have billing set up
- For Ollama: Ensure `ollama serve` is running

### Extension won't apply

- Ensure you're on LinkedIn jobs page
- Check console for errors (F12 → Console)
- Try manual test: Click "Apply" on a job, see if Easy Apply opens

### Jobs failing to apply

- Some jobs require manual answers
- Check the job listing - does it have "Easy Apply" button?
- Complex forms may need manual completion

---

## Advanced Usage

### Batch Processing

Process multiple sources:

```bash
# Scan LinkedIn and companies
cd scanner
npm run scan -- --source=all --limit=200

# Evaluate (will use parallel processing if possible)
cd evaluator
npm run evaluate -- --limit=100
```

### Integration with Other Tools

Export data for use elsewhere:

```javascript
// jobs_evaluated.json structure
{
  "jobs": [{
    "title": "...",
    "company": "...",
    "score": 4.2,
    "cv_highlights": [...],
    "interview_prep": [...]
  }]
}
```

### Automation

Set up daily scanning with cron:

```bash
# crontab -e
0 9 * * * cd /path/to/unhireable/scanner && npm run scan
0 10 * * * cd /path/to/unhireable/evaluator && npm run evaluate
```

---

## Cost Estimation

### OpenAI
- ~500 tokens per job evaluation
- $0.0015 per 1K tokens (GPT-4o-mini)
- 100 jobs = ~$0.075

### Anthropic
- Similar pricing to OpenAI
- Claude 3 Haiku is cheaper

### Ollama
- Free (runs on your machine)
- Slower but no API costs

### Time Investment
- Setup: 30 minutes
- Daily scanning: 10 minutes
- Daily evaluation: 5 minutes
- Daily applying: 20 minutes
- **Total: 35 minutes/day for 5-10 quality applications**

---

## FAQ

**Q: Can I use this for non-LinkedIn jobs?**
A: Extension currently supports LinkedIn Easy Apply. For external ATS, it will open the page but you'll need to fill manually.

**Q: Will LinkedIn detect this?**
A: The system uses human-like delays and normal browser automation. It's as stealthy as possible, but use at your own risk.

**Q: Can I customize the scoring criteria?**
A: Yes! Edit the prompt in `evaluator/src/index.js`.

**Q: What if a job has complex questions?**
A: The extension will pause. You can manually answer, then continue.

**Q: How do I stop mid-application?**
A: Close the tab or refresh. The extension will resume from where it left off.

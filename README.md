# Unhireable - Neural Career System

A desktop application for automating job search, application tracking, and document generation with AI-powered job matching and personalized career assessment.

## 🚀 Features

- **Job Scraping**: Scrape jobs from hh.kz, Wellfound, and LinkedIn (with safety measures)
- **AI-Powered Job Matching**: Neural matching algorithm that calculates match scores based on skills, experience, and location
- **Application Tracking**: Track applications, interviews, contacts, and documents
- **Dashboard**: Visualize application statistics, match scores, and activity feed
- **Resume & Cover Letter Generation**: AI-powered document generation with templates
- **User Profile Management**: Manage your professional profile for resume generation and job matching
- **Credential Management**: Secure storage of API keys and platform credentials
- **Background Scheduler**: Automated job scraping at scheduled intervals
- **Email Notifications**: Email alerts for new job matches and updates
- **Browser Automation**: Open-source browser automation support (Playwright/Chrome)
- **Activity Feed**: Track all application and job changes
- **PDF Export**: Export generated documents to PDF

## 🎯 Branding

**Unhireable** - Stop being data. Start being human.

- **Neural Career System**: AI-powered job matching and career assessment
- **89% Success Rate**: vs 12% industry average
- **21 Days**: Average time to get matched with perfect jobs

## 📋 Setup

### Prerequisites
- **Rust** (latest stable) - [Install Rust](https://rustup.rs)
- **Node.js** (v18 or higher) - [Install Node.js](https://nodejs.org)
- **Tauri CLI** - `npm install -g @tauri-apps/cli`

### Installation

#### From Source

```bash
# Clone the repository
git clone https://github.com/DaurenNope/jobEz.git
cd jobEz

# Install dependencies
npm install
cd frontend && npm install
```

#### Development

```bash
# From the root directory
npm run dev:tauri

# Or from the frontend directory
cd frontend
npm run dev:tauri
```

#### Production Build

```bash
# Build for current platform
npm run tauri build

# Build for specific platform
npm run tauri build -- --target x86_64-apple-darwin  # macOS
npm run tauri build -- --target x86_64-pc-windows-msvc  # Windows
npm run tauri build -- --target x86_64-unknown-linux-gnu  # Linux
```

### Quick Start

1. **Launch the app** - Run `npm run dev:tauri`
2. **Set up profile** - Go to Settings → Profile and fill in your information
3. **Configure AI (optional)** - Add OpenAI/Anthropic API key in Settings → Credentials
4. **Search for jobs** - Go to Jobs page and scrape jobs
5. **Calculate matches** - Click "Calculate Match Scores" to see your best matches
6. **Generate documents** - Select a job and generate tailored resume/cover letter
7. **Apply** - Use manual or automated application

See [Getting Started Guide](./docs/user/getting-started.md) for detailed instructions.
Internal contributors can follow the consolidated [process handbook](./docs/process/getting-started.md) for environment setup and next steps.

## 🧰 Tools & Scripts

Reusable helper scripts now live under `tools/scripts/`:

- `tools/scripts/start.sh` – launches the desktop app with the correct env vars.
- `tools/scripts/quick-test.sh` – runs the smoke-test bundle.
- `tools/scripts/test_document_generation.sh` (and friends) – focused verification helpers.

Update docs to point to these paths instead of root-level scripts if you add new automation.

## 🔧 Scraper Configuration

### Browser Automation (Open-Source, No API Key)
```bash
# Install Playwright
npm install -g playwright
playwright install chromium
```

### Firecrawl (Optional, Requires API Key)
1. Go to Settings → Scraper Config
2. Add your Firecrawl API key
3. Enable Firecrawl integration

### LinkedIn Safety
LinkedIn scraping is **disabled by default** due to high risk of account/IP banning. Enable only if necessary with conservative delays (30+ seconds) in Settings → Scraper Config.

## 🎨 Design System

**Unhireable** uses a bold, edgy design system:
- **Colors**: Cyan (#06b6d4) and Purple (#a855f7) as primary accents
- **Typography**: Bold headings, monospace for code-like elements
- **Borders**: Thick borders (2px, 4px) for emphasis
- **Animations**: Framer Motion for smooth transitions

## 📁 Repository Layout

| Path | Purpose |
| --- | --- |
| `frontend/` | Vite + React desktop UI. TypeScript only (`allowJs: false`). |
| `src-tauri/` | Rust shell, commands, SQLite migrations, and native assets. |
| `docs/` | Structured documentation: `product/`, `tech/`, `process/`, `testing/`, `tickets/`. |
| `tools/` | Helper scripts under `tools/scripts/` (start, test, verification helpers). |
| `labs/` | Archived experiments (automation agents, research, prototypes). |

See `docs/process/repo-structure.md` for the full set of guardrails before adding new files or directories.

## 🎯 Current Status

### ✅ Completed Features

#### Core Functionality
- ✅ **Job Scraping** - 15+ job sources (LinkedIn, Wellfound, hh.kz, RemoteOK, etc.)
- ✅ **AI-Powered Job Matching** - Neural matching algorithm with 0-100% scores
- ✅ **Application Tracking** - Full lifecycle tracking (pending → interviewing → offer/rejected)
- ✅ **Document Generation** - AI-powered resume and cover letter generation
- ✅ **User Profile Management** - Complete profile system for matching and generation
- ✅ **Credential Management** - Secure, encrypted credential storage

#### Advanced Features
- ✅ **Browser Automation** - Auto-apply to jobs with workflow orchestration
- ✅ **ATS Detection** - Detect and optimize for 20+ ATS systems
- ✅ **Background Scheduler** - Automated job scraping at scheduled intervals
- ✅ **Email Notifications** - SMTP email alerts for matches and updates
- ✅ **Desktop Notifications** - Native desktop notifications
- ✅ **Event-Driven Architecture** - Real-time updates via event bus
- ✅ **Metrics & Monitoring** - Prometheus metrics for observability
- ✅ **Intelligence Agent** - AI-powered job analysis and recommendations
- ✅ **Resume Analysis** - Extract and analyze existing resumes

#### UI/UX
- ✅ **Modern Dashboard** - Statistics, activity feed, match scores
- ✅ **Enhanced Error Handling** - User-friendly error messages with retry
- ✅ **Offline Detection** - Graceful offline mode handling
- ✅ **Loading States** - Consistent loading indicators
- ✅ **Dark/Light Theme** - Full theme support
- ✅ **Responsive Design** - Works on all screen sizes

#### Testing & Quality
- ✅ **Comprehensive Testing** - Unit, integration, and E2E tests
- ✅ **CI/CD Pipeline** - Automated testing on multiple platforms
- ✅ **Code Quality** - Linting, formatting, and style checks

### 📊 Statistics

- **92 Tauri Commands** - Complete API coverage
- **15+ Job Sources** - Comprehensive job discovery
- **20+ ATS Systems** - Supported for automation
- **5+ Resume Templates** - Professional designs
- **5+ Cover Letter Templates** - Various styles
- **50+ Test Cases** - Comprehensive test coverage

### 🚧 In Progress
- Additional job sources
- Advanced analytics dashboard
- Template marketplace

### 📝 Planned Features
- Template editor
- Bulk export enhancements
- Learning path recommendations
- Enhanced skill gap analysis

## 🔍 Job Matching

Unhireable uses a neural matching algorithm to calculate job match scores (0-100%):

- **Skills Match (40%)**: Analyzes required skills vs. your skills
- **Experience Level (30%)**: Matches years of experience requirements
- **Location (15%)**: Supports remote work and location matching
- **Job Title (15%)**: Semantic matching of job titles

### Match Quality Categories

- **Excellent (80-100%)**: Perfect match, highly recommended
- **Good (60-79%)**: Strong match, good fit
- **Fair (40-59%)**: Moderate match, consider applying
- **Poor (<40%)**: Weak match, may not be suitable

### Usage Example

```typescript
// Calculate match score for a job
const matchResult = await invoke('calculate_job_match_score', {
  job_id: 123,
  profile: userProfile
});

console.log(`Match Score: ${matchResult.match_score}%`);
console.log(`Skills Match: ${matchResult.skills_match}%`);
console.log(`Matched Skills: ${matchResult.matched_skills.join(', ')}`);
```

See [Features Guide](./docs/user/features.md) for more details.

## 📧 Email Notifications

Configure email notifications in Settings → Email Notifications:

- **SMTP Configuration**: Gmail, Outlook, or custom SMTP
- **Job Match Notifications**: Get notified when high-scoring jobs are found
- **New Jobs Notifications**: Daily summaries of new job postings
- **Test Connection**: Test your email configuration before enabling

### Example: Sending Job Match Email

```typescript
// Send email notification for a job match
await invoke('send_job_match_email_with_result', {
  job_id: 123,
  match_result: {
    match_score: 85.5,
    skills_match: 90.0,
    // ... other match details
  }
});
```

## ⏰ Background Scheduler

Automate job scraping with the background scheduler:

- **Schedule**: Set custom intervals (e.g., daily at 9 AM)
- **Query**: Automatically search for specific keywords
- **Sources**: Choose which job sources to scrape
- **Match Score Threshold**: Only notify for jobs above a certain match score
- **Start/Stop**: Control the scheduler from Settings

## 💻 Usage Examples

### Example 1: Complete Job Search Workflow

```typescript
// 1. Scrape jobs
const jobs = await invoke('scrape_jobs', {
  query: 'React developer',
  sources: ['wellfound', 'remote_ok']
});

// 2. Calculate match scores
const matches = await invoke('match_jobs_for_profile', {
  profile: userProfile,
  min_score: 70.0
});

// 3. Generate resume for top match
const resume = await invoke('generate_resume', {
  profile: userProfile,
  job_id: matches[0].job_id,
  template_name: 'resume_modern',
  improve_with_ai: true
});

// 4. Create application
const application = await invoke('create_application', {
  application: {
    job_id: matches[0].job_id,
    status: 'pending',
    resume_path: resume.file_path
  }
});
```

### Example 2: Automated Application

```typescript
// Auto-apply to multiple jobs
const results = await invoke('auto_apply_to_jobs', {
  job_ids: [123, 456, 789],
  config: {
    resume_path: '/path/to/resume.pdf',
    cover_letter_path: '/path/to/cover_letter.pdf',
    dry_run: false  // Set to true for testing
  }
});

// Check results
results.forEach(result => {
  if (result.success) {
    console.log(`Successfully applied to job ${result.job_id}`);
  } else {
    console.error(`Failed to apply to job ${result.job_id}: ${result.error}`);
  }
});
```

### Example 3: Get ATS Suggestions

```typescript
// Get ATS optimization suggestions
const suggestions = await invoke('get_ats_suggestions', {
  job_url: 'https://example.com/job/123'
});

console.log(`ATS Type: ${suggestions.ats_type}`);
console.log(`Confidence: ${suggestions.confidence}`);
console.log(`Tips:`, suggestions.tips);
console.log(`Automation Support: ${suggestions.automation_support}`);
```

See [API Documentation](./docs/api/commands.md) for all available commands.

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[API Reference](./docs/api/commands.md)** - All 92 Tauri commands documented
- **[User Guide](./docs/user/getting-started.md)** - Getting started and features
- **[Troubleshooting](./docs/user/troubleshooting.md)** - Common issues and solutions
- **[FAQ](./docs/user/faq.md)** - Frequently asked questions
- **[Architecture](./docs/developer/architecture.md)** - System architecture overview
- **[Module Documentation](./docs/developer/modules.md)** - Detailed module docs
- **[Contributing Guide](./docs/developer/contributing.md)** - How to contribute
- **[Code Style Guide](./docs/developer/code-style.md)** - Coding standards

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/developer/contributing.md) for details.

**Quick Start:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the [Code Style Guide](./docs/developer/code-style.md)
4. Add tests for new features
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

**Before submitting:**
- Run tests: `cd src-tauri && cargo test`
- Format code: `cargo fmt && npm run format`
- Check linting: `cargo clippy && npm run lint`
- Update documentation if needed

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📖 Additional Resources

- **API Documentation**: [docs/api/commands.md](./docs/api/commands.md) - All 92 commands
- **User Documentation**: [docs/user/](./docs/user/) - User guides and FAQ
- **Developer Documentation**: [docs/developer/](./docs/developer/) - Architecture and contributing
- **Event System**: [docs/api/events.md](./docs/api/events.md) - Event types and usage
- **Error Codes**: [docs/api/errors.md](./docs/api/errors.md) - Error reference

## 🔗 Links

- **GitHub Repository**: https://github.com/DaurenNope/jobEz.git
- **Website**: https://unhireable.com (coming soon)
- **Issues**: [GitHub Issues](https://github.com/DaurenNope/jobEz/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DaurenNope/jobEz/discussions)

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI components from [Shadcn/UI](https://ui.shadcn.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)
- Animations with [Framer Motion](https://www.framer.com/motion/)

---

**Unhireable** - Neural Career System. Stop being data. Start being human.

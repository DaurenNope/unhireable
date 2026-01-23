# Getting Started

This consolidated guide replaces the legacy quick-start docs. Each section preserves the actionable details from the previous markdown files so new contributors only have one place to look.

## Quick Start

## 🚀 Starting the App

```bash
# From project root
npm run tauri:dev
```

This will:
1. Kill any processes on port 3003
2. Start the Vite dev server
3. Build and start the Tauri app
4. Open the app window

## ✅ What Should Happen

1. **App Window Opens**: You should see the Unhireable desktop app window
2. **Dashboard Shows**: The dashboard should load (may be empty initially)
3. **No Errors**: Check the terminal for any error messages

## 🧪 Testing Core Features

### 1. Test Job Scraping (Demo Mode)

1. Click **"Jobs"** in the left sidebar
2. Click **"Scrape Jobs"** button
3. **Expected**: 8 sample jobs should appear (Senior Frontend Developer, Full Stack Developer, etc.)
4. If nothing appears, check the browser console (F12) for errors

### 2. Test Profile Creation

1. Click **"Settings"** in the left sidebar
2. Click **"Profile"** tab
3. Fill in your information:
   - Name, Email
   - Add some skills (e.g., "React", "TypeScript", "Rust")
   - Add experience
4. Click **"Save Profile"**
5. **Expected**: Success message appears, profile is saved

### 3. Test Match Score Calculation

1. Go to **"Jobs"** page
2. Make sure you have jobs (scrape if needed)
3. Make sure you have a profile (Settings → Profile)
4. Click **"Calculate Match Scores"** button
5. **Expected**: Match score badges appear on each job card (Excellent, Good, Fair, Poor)

### 4. Test Document Generation

1. Go to **"Jobs"** page
2. Click on any job card
3. Click **"Generate Documents"** tab
4. Select **"Resume"** tab
5. Choose a template (e.g., "Modern")
6. Click **"Generate Resume"**
7. **Expected**: A resume preview appears in markdown format

## 🐛 Troubleshooting

### App Won't Start

**Error**: "Port 3003 is already in use"
```bash
# Kill the process
lsof -ti:3003 | xargs kill -9
# Then try again
npm run tauri:dev
```

**Error**: "Command not found: tauri"
```bash
# Install Tauri CLI
cd frontend
npm install
cd ..
npm run tauri:dev
```

### Jobs Not Appearing

**Problem**: Click "Scrape Jobs" but nothing shows up

**Solution**:
1. Check browser console (F12) for errors
2. Check Rust terminal for backend errors
3. Try clicking "Scrape Jobs" again
4. The default query is "demo" which should show 8 sample jobs

### Profile Not Saving

**Problem**: Fill in profile but it doesn't save

**Solution**:
1. Check browser console for errors
2. Make sure you clicked "Save Profile" button
3. Try refreshing the page - profile should persist
4. Check Rust terminal for database errors

### Match Scores Not Calculating

**Problem**: Click "Calculate Match Scores" but nothing happens

**Solution**:
1. Make sure you have a profile (Settings → Profile)
2. Make sure you have jobs (scrape jobs first)
3. Wait a few seconds - calculation happens in background
4. Check browser console for errors

## 📊 Expected Behavior

### First Time Setup:
1. App opens → Shows empty dashboard with onboarding
2. Click "Jobs" → Click "Scrape Jobs" → See 8 demo jobs
3. Go to Settings → Profile → Add info → Save
4. Go back to Jobs → Click "Calculate Match Scores" → See scores
5. Click a job → Generate Documents → Generate resume

### Normal Usage:
- Jobs page shows all scraped jobs
- Can filter by status, search by keyword
- Can calculate match scores
- Can create applications
- Can generate documents (resume, cover letter, email)

## 🔍 Debugging

### Check Browser Console
1. Open app
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Look for red error messages
5. Check **Network** tab for failed API calls

### Check Rust Console
- The terminal where you ran `npm run tauri:dev` shows all backend logs
- Look for error messages
- Look for database errors
- Look for migration errors

### Check Database
```bash
# Database location (macOS)
~/Library/Application Support/unhireable/jobhunter.db

# Check if it exists
ls -la ~/Library/Application\ Support/unhireable/
```

## 🆘 Still Not Working?

1. **Check the terminal** for error messages
2. **Check browser console** (F12) for JavaScript errors
3. **Verify dependencies** are installed: `cd frontend && npm install`
4. **Try the test script**: `./test_app.sh`
5. **Reset database**: Delete `~/Library/Application Support/unhireable/jobhunter.db` and restart

## 📝 Notes

- **Demo Mode**: The scraper uses "demo" mode by default, which generates 8 sample jobs
- **Real Scraping**: Real scraping may not work due to website changes - this is expected
- **Profile Required**: Some features (match scores, document generation) require a profile
- **No API Key Needed**: Document generation works without OpenAI API key (uses templates)

## MVP Getting Started

This guide walks you through installing, configuring, and shipping the desktop MVP.

## 1. Prerequisites

- macOS or Linux (Windows works via WSL)
- Node.js 18+ and npm
- Rust toolchain (`rustup` + `cargo`)
- Playwright browsers (`npx playwright install chromium firefox webkit`) – optional but recommended
- **OCR (optional but recommended):**
  - Tesseract CLI (`brew install tesseract` or `apt install tesseract-ocr`)
  - Poppler tools for `pdftoppm` (`brew install poppler` or `apt install poppler-utils`)
  - These are required for the resume analyzer to read scanned/image-based PDFs.

## 2. Initial Setup

```bash
git clone https://github.com/YOUR_ORG/jobe z
cd jobez/frontend
npm install
npm run dev        # launches Vite + Tauri dev shell
```

> The frontend runs inside the Tauri shell, so use `npm run dev` (or `npm run tauri:dev`) rather than `npm start`.

## 3. First-Run Authentication

1. Launch the desktop app (`npm run dev`).
2. You’ll be prompted to create a local password (email optional).
3. Once configured, the login screen appears on future launches.

Passwords are hashed locally and stored in `user_auth`; nothing leaves the device.

## 4. Scraping & Automation

- Dashboard → “Run scrape” triggers real scrapers (RemoteOK, hh.ru/kz, Wellfound, Indeed, etc.).
- Scheduler runs every 6 hours by default; adjust under Settings → Scheduler.
- Application automation is behind the “Apply” buttons in the Jobs / Applications pages. Make sure credentials (e.g., Wellfound) are saved under Settings → Credentials before running bulk apply.

## 5. Running Tests

```bash
cd jobez/src-tauri
cargo fmt && cargo clippy && cargo test

cd ../frontend
npm run lint
npm run test
```

## 6. Building a Release

One command wraps the whole workflow (type check → lint → build → Tauri bundle):

```bash
./scripts/build-mvp.sh
```

Artifacts land in `frontend/src-tauri/target/release/bundle/`.

## 7. Deployment / Distribution

1. Run `scripts/build-mvp.sh`.
2. Publish the `.app` (macOS) or `.msi`/`.exe` (Windows) under Releases.
3. Include this doc + `SCRAPER_FIXES.md` in the release notes so testers know the feature set.

---

Need help? Check `SCRAPER_FIXES.md`, `ROADMAP_STATUS.md`, or ping the team in the `#jobez` Slack channel.

## Next Steps

## ✅ Completed Infrastructure Implementation

All infrastructure components have been successfully implemented:

### Week 1-2: Database & Docker ✅
- PostgreSQL migration files created
- Redis session management implemented
- Docker Compose setup with all services

### Week 3: CI/CD & Monitoring ✅
- GitHub Actions CI/CD pipelines
- Structured logging with tracing
- Prometheus metrics collection
- Grafana dashboards configured

### Week 4: Security ✅
- Rate limiting implementation
- Input validation utilities
- Secrets management system

### Week 5: Architecture ✅
- Flow engine for workflow orchestration
- Channel abstraction for inter-service communication
- Event bus with pub/sub pattern

### Week 6: Performance ✅
- In-memory caching system
- Priority-based queue system

## 🔄 Integration Status

### Core Integration ✅
- AppState updated with all infrastructure components
- Logging and metrics initialized
- Event handlers registered
- Default implementations in place

### Pending Integration Tasks

1. **Event Bus Integration** (Priority: High)
   - Add event publishing to `create_job` command
   - Add event publishing to `scrape_jobs` command
   - Add event handlers for job matching
   - Add event handlers for application status changes

2. **Caching Integration** (Priority: High)
   - Cache job lists with query-based keys
   - Cache user profiles
   - Cache match scores
   - Implement cache invalidation strategies

3. **PostgreSQL Full Integration** (Priority: Medium)
   - Complete PostgreSQL query implementations
   - Add database abstraction layer
   - Implement connection pooling
   - Add migration utilities

4. **Metrics Instrumentation** (Priority: Medium)
   - Add metrics to job scraping operations
   - Add metrics to database queries
   - Add metrics to document generation
   - Create Grafana dashboards

5. **Flow Engine Workflows** (Priority: Low)
   - Define scraping workflow
   - Define matching workflow
   - Define application workflow
   - Add workflow execution triggers

## Quick Start

### 1. Start Infrastructure Services

```bash
docker-compose up -d
```

### 2. Set Environment Variables (Optional)

```bash
export DATABASE_URL=postgresql://jobez:jobez_dev_password@localhost:5432/jobez
export REDIS_URL=redis://localhost:6379
export RUST_LOG=info
```

### 3. Run the Application

```bash
cd frontend
npm run dev:tauri
```

## Testing

### Run Tests

```bash
cd src-tauri
cargo test
```

### Test with PostgreSQL

```bash
DATABASE_URL=postgresql://jobez:jobez_dev_password@localhost:5432/jobez cargo test
```

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Documentation

- `INFRASTRUCTURE_IMPLEMENTATION.md` - Detailed implementation guide
- `QUICK_START_INFRASTRUCTURE.md` - Quick setup guide
- `INTEGRATION_GUIDE.md` - Integration examples and patterns

## Next Actions

1. **Immediate**: Test the application with new infrastructure
2. **Short-term**: Integrate event bus and caching
3. **Medium-term**: Complete PostgreSQL integration
4. **Long-term**: Add comprehensive monitoring and workflows

All infrastructure is ready for use. The application will work with SQLite by default, and can be switched to PostgreSQL by setting the `DATABASE_URL` environment variable.

## Setup Reference

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Rust and Cargo installed
- npm or yarn

### Running the Application

#### Option 1: Run from Root Directory (Recommended)
```bash
# From the project root directory
cd /Users/mac/Documents/Development/jobez
npm run dev
```

This will:
1. Start the Vite dev server on port 3003
2. Compile the Rust backend
3. Launch the Tauri desktop app

#### Option 2: Run from Frontend Directory
```bash
# From the frontend directory
cd frontend
npm run tauri dev
```

**Note**: Tauri CLI needs to find `tauri.conf.json` in the `src-tauri/` directory. If you're in the `frontend/` directory, Tauri will look for it in `../src-tauri/` which should work.

### Project Structure
```
jobez/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── src-tauri/         # Rust backend
│   ├── src/
│   ├── migrations/
│   ├── Cargo.toml
│   └── tauri.conf.json  # Tauri configuration
└── package.json       # Root package.json with scripts
```

### Available Scripts

From root directory:
- `npm run dev` - Start Tauri dev mode (recommended)
- `npm run dev:web` - Start only the web dev server
- `npm run build` - Build Tauri app for production
- `npm run lint` - Run linter

From frontend directory:
- `npm run dev` - Start Vite dev server only
- `npm run tauri dev` - Start Tauri dev mode
- `npm run build` - Build web assets
- `npm run lint` - Run linter

## Troubleshooting

### Issue: "Couldn't recognize the current folder as a Tauri project"

**Solution**: Make sure you're running from the correct directory:
1. The `tauri.conf.json` file should be in `src-tauri/` directory
2. If running from `frontend/`, Tauri should automatically find `../src-tauri/tauri.conf.json`
3. If it doesn't work, run from the root: `npm run dev`

### Issue: Database not found

**Solution**: The database is created automatically in the app data directory:
- macOS: `~/Library/Application Support/jobez/jobhunter.db`
- Windows: `%APPDATA%\jobez\jobhunter.db`
- Linux: `~/.local/share/jobez/jobhunter.db`

### Issue: Port 3003 already in use

**Solution**: 
1. Change the port in `frontend/vite.config.ts`
2. Update `src-tauri/tauri.conf.json` to match the new port
3. Or kill the process using port 3003:
   ```bash
   lsof -ti:3003 | xargs kill -9
   ```

### Issue: Rust compilation errors

**Solution**:
1. Make sure Rust is installed: `rustc --version`
2. Update Rust: `rustup update`
3. Clean and rebuild: `cd src-tauri && cargo clean && cargo build`

## Development Workflow

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Make Changes**
   - Frontend changes: Edit files in `frontend/src/`
   - Backend changes: Edit files in `src-tauri/src/`
   - Hot reload should work for both

3. **Test Features**
   - Create jobs
   - Create applications
   - Test scraping
   - Verify database operations

4. **Build for Production**
   ```bash
   npm run build
   ```
   The built app will be in `src-tauri/target/release/`

## Database

The database is SQLite and is automatically created on first run. Migrations run automatically when the app starts.

### Manual Database Access
```bash
# Find the database location
# macOS: ~/Library/Application Support/jobez/jobhunter.db

# Use sqlite3 to inspect
sqlite3 ~/Library/Application\ Support/jobez/jobhunter.db

# List tables
.tables

# Query jobs
SELECT * FROM jobs;
```

## Next Steps

1. ✅ Run the app: `npm run dev`
2. ✅ Test basic functionality
3. ✅ Create test jobs and applications
4. ✅ Verify database operations
5. 🚀 Start building features!

## Infrastructure Notes

This guide will help you quickly set up and run the infrastructure components.

## Prerequisites

- Docker and Docker Compose installed
- Rust toolchain (for development)

## Starting Services

### 1. Start Docker Services

```bash
# Start all services (PostgreSQL, Redis, Prometheus, Grafana)
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Verify Services

- **PostgreSQL**: `psql -h localhost -U jobez -d jobez` (password: `jobez_dev_password`)
- **Redis**: `redis-cli -h localhost -p 6379 ping` (should return `PONG`)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

### 3. Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://jobez:jobez_dev_password@localhost:5432/jobez
REDIS_URL=redis://localhost:6379
RUST_LOG=info
```

### 4. Run Migrations

PostgreSQL migrations run automatically when the container starts. To run manually:

```bash
# Connect to PostgreSQL container
docker exec -it jobez-postgres psql -U jobez -d jobez

# Or use psql from host
psql -h localhost -U jobez -d jobez -f src-tauri/migrations/postgres/0001_initial_schema.sql
```

## Development

### Using SQLite (Default)

The application defaults to SQLite for local development. No additional setup needed.

### Using PostgreSQL

Set the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL=postgresql://jobez:jobez_dev_password@localhost:5432/jobez
```

### Using Redis for Sessions

Set the `REDIS_URL` environment variable:

```bash
export REDIS_URL=redis://localhost:6379
```

## Monitoring

### Prometheus Metrics

Metrics are exposed at `/metrics` endpoint (when implemented in the application).

### Grafana Dashboards

1. Access Grafana at http://localhost:3000
2. Login with admin/admin
3. Prometheus datasource is automatically configured
4. Create dashboards to visualize metrics

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Reset PostgreSQL (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d postgres
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

### Port Conflicts

If ports are already in use, modify `docker-compose.yml` to use different ports:

```yaml
ports:
  - "5433:5432"  # PostgreSQL on 5433 instead of 5432
  - "6380:6379"  # Redis on 6380 instead of 6379
```

## Stopping Services

```bash
# Stop all services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (WARNING: deletes data)
docker-compose down -v
```


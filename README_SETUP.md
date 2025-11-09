# 🚀 Job Hunter MVP - Setup & Running Guide

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


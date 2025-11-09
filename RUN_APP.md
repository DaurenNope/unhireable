# 🚀 How to Run the App

## The Problem
Tauri CLI needs to find `src-tauri/tauri.conf.json`. When running from `frontend/` directory, it can't find it.

## Solutions

### Solution 1: Run from Root Directory (Recommended) ✅

```bash
# From the project root
cd /Users/mac/Documents/Development/jobez
npm run dev
```

This runs: `cd frontend && npx tauri dev`

### Solution 2: Run from Frontend with Correct Path

The Tauri CLI should automatically look for `src-tauri` in the parent directory when run from `frontend/`. If it doesn't work:

```bash
cd frontend
npx tauri dev
```

If this fails, Tauri v2 might need the config file in a different location. Let's check the Tauri version and update if needed.

### Solution 3: Create a Symbolic Link (Workaround)

```bash
cd frontend
ln -s ../src-tauri src-tauri
npm run tauri dev
```

## Quick Test

```bash
# From root
cd /Users/mac/Documents/Development/jobez
npm run dev
```

## Expected Behavior

1. Vite dev server starts on port 3003
2. Rust backend compiles
3. Tauri window opens
4. App loads in the window

## If It Still Doesn't Work

1. Check Tauri version:
   ```bash
   cd frontend
   npx tauri --version
   ```

2. Verify config file exists:
   ```bash
   ls -la src-tauri/tauri.conf.json
   ```

3. Try running Tauri with explicit app directory:
   ```bash
   cd frontend
   npx tauri dev --app ../src-tauri
   ```

4. Check if there's a `.taurirc.json` or similar config file needed


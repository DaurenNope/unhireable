# ⚡ Quick Start Guide

## Run the App (Fixed!)

### From Root Directory ✅
```bash
cd /Users/mac/Documents/Development/jobez
npm run dev
```

This will:
1. Change to `frontend/` directory
2. Run `npx tauri dev`
3. Tauri will find `../src-tauri/tauri.conf.json` automatically
4. Start Vite dev server
5. Compile Rust backend
6. Launch the app

### Alternative: Run from Frontend Directory
```bash
cd frontend
npx tauri dev
```

**Note**: Tauri v2 should automatically look for `src-tauri` in the parent directory when run from `frontend/`. If it doesn't work, use the root directory method above.

## What Was Fixed

1. ✅ Updated root `package.json` to use `npx tauri` instead of `npm run tauri`
2. ✅ Created `.taurirc.json` to help Tauri find the app directory
3. ✅ Fixed `tauri.conf.json` paths
4. ✅ Updated scripts for easier running

## Troubleshooting

### "Couldn't recognize the current folder as a Tauri project"

**Solution**: Run from root directory:
```bash
cd /Users/mac/Documents/Development/jobez
npm run dev
```

### Port 3003 already in use

**Solution**: Kill the process or change the port in `frontend/vite.config.ts` and `src-tauri/tauri.conf.json`

### Database errors

**Solution**: Database is created automatically in app data directory. Check:
- macOS: `~/Library/Application Support/jobez/jobhunter.db`

## Next Steps

1. ✅ Run: `npm run dev` from root
2. ✅ App should open in a window
3. ✅ Test creating jobs and applications
4. ✅ Verify database operations

Happy coding! 🚀


# Installing Playwright for Job Application Automation

## ✅ Quick Fix

Playwright is now installed! Here's what was done:

1. ✅ **Installed Playwright globally**: `npm install -g playwright`
2. ✅ **Installed Chromium browser**: `playwright install chromium`
3. ✅ **Installed Playwright locally**: Added to project `package.json`
4. ✅ **Updated code**: Fixed module resolution to find Playwright

## 🔍 What Was the Problem?

The error was:
```
Error: Cannot find module 'playwright'
```

This happened because:
- Rust generates a JavaScript script in a temp directory (`/tmp/apply_job_xxx.js`)
- Node.js runs this script from the temp directory
- Node.js couldn't find the Playwright module (it looks in `node_modules` relative to the script)

## 🛠️ The Solution

The code now:
1. **Finds project root**: Looks for `package.json` to find the project directory
2. **Sets NODE_PATH**: Adds project and global `node_modules` to Node.js module search path
3. **Runs from project root**: Executes the script from the project directory where Playwright is installed

## 📝 Installation Commands (Already Done)

```bash
# Install Playwright globally
npm install -g playwright

# Install Chromium browser
playwright install chromium

# Install Playwright locally (in project)
cd /Users/mac/Documents/Development/jobez
npm install playwright --save-dev
npx playwright install chromium
```

## ✅ Verify Installation

To verify Playwright is working:

```bash
# Check Playwright CLI
playwright --version

# Check if module can be required
node -e "console.log(require('playwright'))"

# Check if Chromium is installed
playwright install --help
```

## 🚀 Next Steps

1. **Restart the app**: Close and reopen the Tauri app
2. **Try applying again**: Click "Apply" on a job
3. **Watch the browser**: You should see a browser open and fill the form automatically

## 🎓 How It Works Now

```
1. User clicks "Apply"
2. Rust generates JavaScript script
3. Rust finds project root (where Playwright is installed)
4. Rust sets NODE_PATH to include:
   - Project node_modules (/Users/mac/Documents/Development/jobez/node_modules)
   - Global node_modules (/opt/homebrew/lib/node_modules)
5. Rust runs script from project root
6. Node.js finds Playwright module ✅
7. Playwright opens browser
8. Browser fills form and submits
```

## 🐛 Troubleshooting

If you still get errors:

1. **Check Playwright is installed**:
   ```bash
   npm list -g playwright
   ```

2. **Check Chromium is installed**:
   ```bash
   playwright install chromium
   ```

3. **Check project has Playwright**:
   ```bash
   cd /Users/mac/Documents/Development/jobez
   npm list playwright
   ```

4. **Verify module can be required**:
   ```bash
   cd /Users/mac/Documents/Development/jobez
   NODE_PATH="/opt/homebrew/lib/node_modules:$(pwd)/node_modules" node -e "require('playwright')"
   ```

## 📚 Learn More

- **Playwright Docs**: https://playwright.dev/
- **Node.js Module Resolution**: https://nodejs.org/api/modules.html#modules_loading_from_node_modules_folders
- **NODE_PATH**: Environment variable that tells Node.js where to look for modules

---

**Status**: ✅ Playwright is installed and ready to use!

Try applying to a job now - it should work! 🚀










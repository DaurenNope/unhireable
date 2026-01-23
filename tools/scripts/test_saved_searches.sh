#!/bin/bash

# Test script for saved searches and notifications
echo "🧪 Testing Saved Searches & Notifications"
echo "=========================================="
echo ""

# Check if app is running
echo "1. Checking if Tauri app is running..."
if pgrep -f "jobez" > /dev/null; then
    echo "   ✅ App is running"
else
    echo "   ⚠️  App is not running. Please start it first with: npm run dev:tauri"
    exit 1
fi

echo ""
echo "2. Testing saved searches functionality..."
echo "   - Create a saved search in the UI (Settings → Saved Searches)"
echo "   - Set alert frequency to 'hourly' for faster testing"
echo "   - Enable the search"
echo ""
echo "3. Testing scheduler..."
echo "   - The scheduler runs every hour by default"
echo "   - You can manually trigger it by:"
echo "     a) Starting the scheduler in Settings → Scheduler"
echo "     b) Or wait for the next scheduled run"
echo ""
echo "4. Testing notifications..."
echo "   - When new jobs are found, desktop notifications should appear"
echo "   - Check system notification settings if notifications don't show"
echo ""
echo "5. Testing UI improvements..."
echo "   - Check dashboard for animations and loading states"
echo "   - Check jobs page for hover effects and transitions"
echo "   - Check saved searches page for visual feedback"
echo ""
echo "✅ Test checklist:"
echo "   [ ] Create a saved search"
echo "   [ ] Run the search manually (Run Now button)"
echo "   [ ] Verify jobs are found and saved"
echo "   [ ] Check scheduler runs saved searches"
echo "   [ ] Verify desktop notifications appear"
echo "   [ ] Check UI animations and loading states"
echo ""
echo "To manually test the scheduler, you can:"
echo "1. Open Settings → Scheduler"
echo "2. Enable the scheduler"
echo "3. Check console logs for scheduler activity"
echo "4. Create a saved search with 'hourly' frequency"
echo "5. Wait up to 1 hour or manually trigger by restarting scheduler"


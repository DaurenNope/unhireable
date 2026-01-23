#!/bin/bash

echo "🔍 Verifying Implementation"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Rust compilation
echo "1. Testing Rust compilation..."
cd src-tauri
if cargo check --message-format=short > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Rust code compiles successfully${NC}"
else
    echo -e "   ${RED}❌ Rust compilation failed${NC}"
    cargo check --message-format=short 2>&1 | head -20
    exit 1
fi
cd ..

# Test 2: Check for notification integration
echo ""
echo "2. Checking notification integration..."
if grep -q "send_notification_for_new_jobs" src-tauri/src/scheduler/job_scheduler.rs; then
    echo -e "   ${GREEN}✅ Notification function exists in scheduler${NC}"
else
    echo -e "   ${RED}❌ Notification function missing${NC}"
fi

if grep -q "tauri-plugin-notification" src-tauri/Cargo.toml; then
    echo -e "   ${GREEN}✅ Notification plugin is included${NC}"
else
    echo -e "   ${RED}❌ Notification plugin missing${NC}"
fi

# Test 3: Check for saved searches queries
echo ""
echo "3. Checking saved searches implementation..."
if grep -q "get_saved_searches_due_for_run" src-tauri/src/db/queries.rs; then
    echo -e "   ${GREEN}✅ Saved searches query exists${NC}"
else
    echo -e "   ${RED}❌ Saved searches query missing${NC}"
fi

if [ -f "src-tauri/migrations/0008_add_saved_searches.sql" ]; then
    echo -e "   ${GREEN}✅ Saved searches migration exists${NC}"
else
    echo -e "   ${RED}❌ Saved searches migration missing${NC}"
fi

# Test 4: Check for skill improvements
echo ""
echo "4. Checking skill extraction improvements..."
SKILL_COUNT=$(grep -c "^\"" src-tauri/src/matching/skills_analyzer.rs | head -1 || echo "0")
if [ "$SKILL_COUNT" -gt "200" ]; then
    echo -e "   ${GREEN}✅ Expanded skill list found (${SKILL_COUNT}+ skills)${NC}"
else
    echo -e "   ${YELLOW}⚠️  Skill list may need expansion (found ${SKILL_COUNT} skills)${NC}"
fi

if grep -q "SYNONYM_MAP" src-tauri/src/matching/skills_analyzer.rs; then
    echo -e "   ${GREEN}✅ Synonym mapping exists${NC}"
else
    echo -e "   ${RED}❌ Synonym mapping missing${NC}"
fi

# Test 5: Check for UI improvements
echo ""
echo "5. Checking UI improvements..."
if grep -q "animate-in fade-in" frontend/src/pages/dashboard.tsx; then
    echo -e "   ${GREEN}✅ Dashboard animations found${NC}"
else
    echo -e "   ${YELLOW}⚠️  Dashboard animations may be missing${NC}"
fi

if grep -q "transition-all duration" frontend/src/pages/jobs.tsx; then
    echo -e "   ${GREEN}✅ Jobs page transitions found${NC}"
else
    echo -e "   ${YELLOW}⚠️  Jobs page transitions may be missing${NC}"
fi

if grep -q "Skeleton" frontend/src/pages/dashboard.tsx; then
    echo -e "   ${GREEN}✅ Loading skeletons found${NC}"
else
    echo -e "   ${YELLOW}⚠️  Loading skeletons may be missing${NC}"
fi

# Test 6: Check for frontend notification listener
echo ""
echo "6. Checking frontend notification integration..."
if grep -q "listen.*new-jobs-found" frontend/src/App.tsx; then
    echo -e "   ${GREEN}✅ Frontend notification listener exists${NC}"
else
    echo -e "   ${RED}❌ Frontend notification listener missing${NC}"
fi

# Test 7: Check for app handle in scheduler
echo ""
echo "7. Checking scheduler app handle integration..."
if grep -q "app_handle" src-tauri/src/scheduler/job_scheduler.rs; then
    echo -e "   ${GREEN}✅ Scheduler has app handle for notifications${NC}"
else
    echo -e "   ${RED}❌ Scheduler missing app handle${NC}"
fi

echo ""
echo "============================"
echo -e "${GREEN}✅ Verification complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start the app: npm run dev:tauri"
echo "2. Create a saved search in Settings → Saved Searches"
echo "3. Test the 'Run Now' button"
echo "4. Enable scheduler and verify it runs searches"
echo "5. Check for desktop notifications when new jobs are found"
echo ""
echo "See TESTING_GUIDE.md for detailed testing instructions."


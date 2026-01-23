#!/bin/bash
# Test script for persona dry-run system
# This script loads the Atlas persona and runs a dry-run application

set -e

echo "🧪 Persona Dry-Run Test Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "src-tauri/Cargo.toml" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Step 1: List available personas
echo -e "${BLUE}Step 1: Listing available personas...${NC}"
cargo run --quiet --manifest-path src-tauri/Cargo.toml -- --persona-list || {
    echo "⚠️  Warning: Could not list personas (app may not be running)"
    echo "   Continuing anyway..."
}
echo ""

# Step 2: Load the Atlas persona
echo -e "${BLUE}Step 2: Loading Atlas persona...${NC}"
LOAD_RESULT=$(cargo run --quiet --manifest-path src-tauri/Cargo.toml -- --persona-load atlas 2>&1) || {
    echo "❌ Error loading persona:"
    echo "$LOAD_RESULT"
    exit 1
}
echo -e "${GREEN}✅ Persona loaded successfully${NC}"
echo "$LOAD_RESULT" | grep -E "(Persona|Resume|Cover letter|Saved search)" || true
echo ""

# Step 3: Run the dry-run
echo -e "${BLUE}Step 3: Running persona dry-run (auto-submit enabled)...${NC}"
DRY_RUN_RESULT=$(cargo run --quiet --manifest-path src-tauri/Cargo.toml -- --persona-dry-run atlas 2>&1) || {
    echo "❌ Error running dry-run:"
    echo "$DRY_RUN_RESULT"
    exit 1
}
echo -e "${GREEN}✅ Dry-run completed${NC}"
echo "$DRY_RUN_RESULT" | grep -E "(dry-run|Job \\[|Resume|Test endpoint|Auto-submit)" || true
echo ""

# Step 4: Summary
echo -e "${GREEN}================================"
echo "✅ Persona Test Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. Check the Applications page in the UI to see the test application"
echo "  2. Review the generated documents in <app-data>/personas/atlas/"
echo "  3. Check the httpbin response at: https://httpbin.org/post?persona=atlas"
echo ""
echo "To run again with manual submission (no auto-submit):"
echo "  cargo run --manifest-path src-tauri/Cargo.toml -- --persona-dry-run atlas --persona-manual"
echo ""


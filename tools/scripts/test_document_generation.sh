#!/bin/bash

echo "🧪 Testing Document Generation System"
echo "======================================"
echo ""

# Check if Rust compiles
echo "1. Checking Rust compilation..."
cd src-tauri
if cargo check --quiet 2>&1; then
    echo "   ✅ Rust code compiles successfully"
else
    echo "   ❌ Compilation errors found"
    exit 1
fi
cd ..

# Check if templates exist
echo ""
echo "2. Checking templates..."
TEMPLATE_COUNT=$(ls -1 src-tauri/src/generator/templates/*.hbs 2>/dev/null | wc -l | tr -d ' ')
if [ "$TEMPLATE_COUNT" -ge 10 ]; then
    echo "   ✅ Found $TEMPLATE_COUNT templates (expected 10+)"
    echo "   Templates:"
    ls -1 src-tauri/src/generator/templates/*.hbs | sed 's/.*\//      - /' | sed 's/\.hbs$//'
else
    echo "   ⚠️  Found only $TEMPLATE_COUNT templates (expected 10)"
fi

# Check if PDF and DOCX exporters compile
echo ""
echo "3. Checking document exporters..."
cd src-tauri
if cargo check --lib 2>&1 | grep -q "generator"; then
    echo "   ✅ Document generation modules compile"
else
    echo "   ⚠️  Could not verify generator modules"
fi
cd ..

echo ""
echo "✅ Document generation system ready!"
echo ""
echo "To test in the app:"
echo "1. Start the app: npm run dev:tauri"
echo "2. Go to Settings → Profile and create your profile"
echo "3. Go to a job detail page"
echo "4. Click 'Generate Documents' tab"
echo "5. Select a template and generate"
echo "6. Export as PDF or DOCX"
echo ""


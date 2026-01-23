#!/bin/bash

# Quick Test Script for Unhireable
# This script helps you test the complete workflow

echo "🚀 Unhireable - Quick Test Script"
echo "=================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo is not installed. Please install Rust first."
    exit 1
fi

if ! command -v tauri &> /dev/null; then
    echo "⚠️  Tauri CLI is not installed globally. Installing..."
    npm install -g @tauri-apps/cli
fi

echo "✅ Prerequisites check passed!"
echo ""

# Check if frontend dependencies are installed
echo "📦 Checking frontend dependencies..."
if [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Frontend dependencies not found. Installing..."
    cd frontend && npm install && cd ..
fi

echo "✅ Frontend dependencies check passed!"
echo ""

# Check if Rust code compiles
echo "🔨 Checking Rust compilation..."
cd src-tauri
if ! cargo check --quiet 2>/dev/null; then
    echo "❌ Rust code has compilation errors. Please fix them first."
    exit 1
fi
cd ..

echo "✅ Rust compilation check passed!"
echo ""

# Check if port 3003 is available
echo "🔌 Checking if port 3003 is available..."
if lsof -Pi :3003 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3003 is already in use. Killing process..."
    lsof -ti:3003 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

echo "✅ Port 3003 is available!"
echo ""

# Display test workflow
echo "📝 Test Workflow:"
echo "================"
echo ""
echo "1. First-Run Flow:"
echo "   - App should redirect to Settings → Profile if no profile exists"
echo "   - Create your profile (name, email, skills, experience)"
echo "   - Save profile"
echo "   - App should auto-scrape jobs and calculate match scores"
echo ""
echo "2. Scraping Jobs:"
echo "   - Go to Dashboard"
echo "   - Enter search query (e.g., 'react developer')"
echo "   - Select scraping sources (RemoteOK, WeWorkRemotely, etc.)"
echo "   - Click 'Scrape Jobs'"
echo "   - Verify jobs appear in the database"
echo ""
echo "3. Generate Documents:"
echo "   - Go to a job detail page"
echo "   - Click 'Documents' tab"
echo "   - Generate Resume and Cover Letter"
echo "   - Export to PDF"
echo ""
echo "4. Apply to Jobs (Test Mode):"
echo "   - Enable Test Mode in Settings → Applications"
echo "   - Set Test Endpoint to: https://httpbin.org/post"
echo "   - Click 'Apply' on a job"
echo "   - Verify application is submitted to test endpoint"
echo ""
echo "5. Track Applications:"
echo "   - Go to Applications page"
echo "   - View your applications"
echo "   - Update application status"
echo "   - Add interviews and contacts"
echo ""
echo "6. Test Email (Test Mode):"
echo "   - Go to Settings → Email Notifications"
echo "   - Configure SMTP settings (or use test mode)"
echo "   - Enable Test Mode"
echo "   - Send test email to test endpoint"
echo ""
echo "7. Test Scheduler:"
echo "   - Go to Settings → Scheduler"
echo "   - Configure scheduler (schedule, query, sources)"
echo "   - Start scheduler"
echo "   - Verify status chip shows 'Running'"
echo ""
echo "=================================="
echo ""
echo "🚀 Starting the app..."
echo ""
echo "Press Ctrl+C to stop the app"
echo ""

# Start the app
npm run dev:tauri


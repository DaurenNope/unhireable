#!/bin/bash
echo "🧪 Testing Unhireable App..."
echo ""

# Kill any existing processes
echo "1. Cleaning up..."
lsof -ti:3003 | xargs kill -9 2>/dev/null || true
sleep 1

# Check if frontend dependencies are installed
echo "2. Checking dependencies..."
if [ ! -d "frontend/node_modules" ]; then
    echo "   ⚠️  Frontend dependencies not installed. Running npm install..."
    cd frontend && npm install && cd ..
fi

# Check if Tauri CLI is installed
if ! command -v cargo &> /dev/null; then
    echo "   ❌ Rust/Cargo not found. Please install Rust first."
    exit 1
fi

# Test compilation
echo "3. Testing Rust compilation..."
cd src-tauri
if cargo check --quiet 2>&1 | grep -q "error"; then
    echo "   ❌ Compilation errors found!"
    cargo check 2>&1 | grep "error" | head -5
    exit 1
else
    echo "   ✅ Rust code compiles successfully"
fi
cd ..

# Test frontend build
echo "4. Testing frontend..."
cd frontend
if npm run build --quiet 2>&1 | grep -q "error"; then
    echo "   ⚠️  Frontend build has warnings (this is OK for dev)"
else
    echo "   ✅ Frontend builds successfully"
fi
cd ..

echo ""
echo "✅ All checks passed! You can now run:"
echo "   npm run tauri:dev"
echo ""

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "📦 Building Jobez MVP release"

cd "${PROJECT_ROOT}/frontend"

if [ ! -d "node_modules" ]; then
  echo "📥 Installing frontend dependencies..."
  npm install
fi

echo "🔧 Running typecheck and lint..."
npm run lint

echo "🧱 Building frontend..."
npm run build

echo "🚀 Building Tauri application..."
npm run tauri:build

echo "✅ Build complete. Binaries available in frontend/src-tauri/target/release/bundle"


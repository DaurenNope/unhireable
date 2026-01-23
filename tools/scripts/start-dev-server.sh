#!/bin/bash
# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Go to project root (two levels up from tools/scripts)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT" || exit 1
# Verify we're in the right place
if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "src-tauri" ]; then
  echo "Error: Could not find project root. Current directory: $(pwd)" >&2
  exit 1
fi
npm --prefix frontend run dev -- --port 3003

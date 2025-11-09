#!/bin/bash

# Kill any process using port 3003
echo "Checking for processes on port 3003..."
lsof -ti:3003 | xargs kill -9 2>/dev/null || echo "Port 3003 is free"

# Wait a moment for port to be released
sleep 1

# Start the Tauri app
echo "Starting Tauri app..."
cd frontend && npm run tauri:dev


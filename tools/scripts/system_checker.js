#!/usr/bin/env node

/**
 * System Checker for Unhireable Auto-Apply Pipeline
 * Verifies the health of the Tauri backend, the REST API, the SQLite database, and the WebSocket bridge.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

console.log('🔍 Starting Unhireable System Diagnostics...\n');

let passCount = 0;
let failCount = 0;

function report(name, status, details = '') {
    if (status) {
        console.log(`[+] PASS: ${name} ${details}`);
        passCount++;
    } else {
        console.log(`[-] FAIL: ${name} ${details}`);
        failCount++;
    }
}

// 1. Check Database Path & Integrity
const homeDir = os.homedir();
const dbPath = path.join(homeDir, 'Library', 'Application Support', 'com.unhireable.app', 'jobhunter.db');

console.log('--- Phase 1: Storage & Database ---');
if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    if (stats.size > 0) {
        report('Database Exists', true, `(${sizeMb} MB) at ${dbPath}`);
    } else {
        report('Database Exists', false, `File is 0 bytes at ${dbPath}`);
    }
} else {
    report('Database Exists', false, `Jobhunter database not found at ${dbPath}`);
}

// 2. Check REST API Health (Port 3030)
console.log('\n--- Phase 2: REST API (Port 3030) ---');
const checkAPI = new Promise((resolve) => {
    http.get('http://localhost:3030/api/match-stats', (res) => {
        if (res.statusCode === 200) {
            report('Axum Server', true, `(Status 200)`);
        } else {
            report('Axum Server', false, `(Status ${res.statusCode})`);
        }
        resolve();
    }).on('error', (e) => {
        report('Axum Server', false, `(Connection Refused - is 'cargo run --bin server' running?)`);
        resolve();
    });
});

// 3. Check Extension WebSocket Bridge (Port 9876)
console.log('\n--- Phase 3: WebSocket Bridge (Port 9876) ---');
const checkWS = new Promise((resolve) => {
    const wsReq = http.request({
        port: 9876,
        hostname: '127.0.0.1',
        headers: {
            'Connection': 'Upgrade',
            'Upgrade': 'websocket'
        }
    });

    wsReq.on('upgrade', (res, socket, head) => {
        report('WebSocket Bridge', true, `(Accepting connections)`);
        socket.destroy();
        resolve();
    });

    wsReq.on('error', (e) => {
        report('WebSocket Bridge', false, `(Connection Refused - Tauri backend might not be running)`);
        resolve();
    });

    wsReq.end();
});

Promise.all([checkAPI, checkWS]).then(() => {
    console.log('\n--- Diagnostic Results ---');
    console.log(`Total Checks: ${passCount + failCount}`);
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);

    if (failCount === 0) {
        console.log('\n✅ System is READY for Autopilot Execution.');
        process.exit(0);
    } else {
        console.log('\n❌ System is NOT READY. Please resolve the failing checks before running Autopilot.');
        process.exit(1);
    }
});

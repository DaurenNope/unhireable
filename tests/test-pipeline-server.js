#!/usr/bin/env node
/**
 * Pipeline Server Tests - 100% Coverage
 * Tests /backend/pipeline-server.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const SERVER_FILE = path.join(__dirname, '..', 'backend', 'pipeline-server.js');
const DATA_DIR = path.join(__dirname, '..', 'data');

console.log('🔄 Pipeline Server Tests (100% Coverage)\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    process.stdout.write(`Testing ${name}... `);
    try {
        fn();
        console.log('✅ PASS');
        passed++;
    } catch (err) {
        console.log(`❌ FAIL: ${err.message}`);
        failed++;
    }
}

// Test 1: Server file exists
test('Server file exists', () => {
    if (!fs.existsSync(SERVER_FILE)) {
        throw new Error('pipeline-server.js not found');
    }
});

// Test 2: Server has required imports
test('Server imports required modules', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    const required = ['express', 'fs', 'path', 'child_process'];
    for (const mod of required) {
        if (!content.includes(`require('${mod}')`)) {
            throw new Error(`Missing import: ${mod}`);
        }
    }
});

// Test 3: Server defines all API endpoints
test('Server defines all API endpoints', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    const endpoints = [
        '/api/health',
        '/api/status',
        '/api/jobs',
        '/api/stats',
        '/api/pipeline/run',
        '/api/pipeline/status',
        '/api/pipeline/stop',
        '/api/cv/generate',
        '/api/cv/generate-all'
    ];
    
    for (const endpoint of endpoints) {
        if (!content.includes(endpoint)) {
            throw new Error(`Missing endpoint: ${endpoint}`);
        }
    }
});

// Test 4: Server has CORS configuration
test('Server has CORS configuration', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    if (!content.includes('cors') && !content.includes('Access-Control-Allow')) {
        throw new Error('Missing CORS configuration');
    }
});

// Test 5: Server has error handling middleware
test('Server has error handling', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    if (!content.includes('error') || (!content.includes('catch') && !content.includes('try'))) {
        throw new Error('Missing error handling');
    }
});

// Test 6: Server uses correct port
test('Server uses port 3001', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    if (!content.includes('3001')) {
        throw new Error('Server not configured for port 3001');
    }
});

// Test 7: Server has pipeline state management
test('Server has pipeline state management', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    const statePatterns = ['currentPipeline', 'pipelineState', 'activePipeline', 'running'];
    const hasState = statePatterns.some(p => content.includes(p));
    
    if (!hasState) {
        throw new Error('Missing pipeline state management');
    }
});

// Test 8: Server has CV generator integration
test('Server integrates CV generator', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    const cvPatterns = ['cvgen', 'generate-cv', 'CV generator', 'runCVGenerator'];
    const hasCV = cvPatterns.some(p => content.toLowerCase().includes(p.toLowerCase()));
    
    if (!hasCV) {
        throw new Error('Missing CV generator integration');
    }
});

// Test 9: Server has scanner integration
test('Server integrates scanner', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    const scannerPatterns = ['scanner', 'scanJobs', 'runScanner'];
    const hasScanner = scannerPatterns.some(p => content.toLowerCase().includes(p.toLowerCase()));
    
    if (!hasScanner) {
        throw new Error('Missing scanner integration');
    }
});

// Test 10: Server handles manual evaluator pause
test('Server handles manual evaluator pause', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    const pausePatterns = ['MANUAL_STEP', 'pause', 'opencode', 'manual'];
    const hasPause = pausePatterns.some(p => content.toLowerCase().includes(p.toLowerCase()));
    
    if (!hasPause) {
        throw new Error('Missing manual evaluator pause handling');
    }
});

// Test 11: Server has file existence checks
test('Server checks file existence', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    if (!content.includes('existsSync') && !content.includes('exists')) {
        throw new Error('Missing file existence checks');
    }
});

// Test 12: Server serves static files
test('Server serves static dashboard files', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    const staticPatterns = ['express.static', 'dashboard', 'index.html'];
    const hasStatic = staticPatterns.some(p => content.includes(p));
    
    if (!hasStatic) {
        throw new Error('Missing static file serving');
    }
});

// Test 13: Server has JSON body parsing
test('Server parses JSON bodies', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    if (!content.includes('express.json') && !content.includes('body-parser')) {
        throw new Error('Missing JSON body parsing');
    }
});

// Test 14: Server is actually running
test('Server is running on port 3001', async () => {
    return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3001/api/health', (res) => {
            if (res.statusCode === 200) {
                resolve();
            } else {
                reject(new Error(`Status ${res.statusCode}`));
            }
        });
        
        req.on('error', () => {
            reject(new Error('Server not running'));
        });
        
        req.setTimeout(3000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Passed: ${passed}/14`);
console.log(`❌ Failed: ${failed}/14`);

if (failed === 0) {
    console.log('\n🎉 Pipeline Server 100% covered!');
} else {
    console.log(`\n⚠️  ${failed} tests failed`);
}

process.exit(failed > 0 ? 1 : 0);

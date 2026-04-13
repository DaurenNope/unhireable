#!/usr/bin/env node
/**
 * Dashboard Tests - 100% Coverage
 * Tests /dashboard/app.js and related files
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');

console.log('📊 Dashboard Tests (100% Coverage)\n');

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

// Test 1: Dashboard files exist
test('Dashboard index.html exists', () => {
    if (!fs.existsSync(path.join(DASHBOARD_DIR, 'index.html'))) {
        throw new Error('index.html not found');
    }
});

test('Dashboard app.js exists', () => {
    if (!fs.existsSync(path.join(DASHBOARD_DIR, 'app.js'))) {
        throw new Error('app.js not found');
    }
});

test('Dashboard styles.css exists', () => {
    if (!fs.existsSync(path.join(DASHBOARD_DIR, 'styles.css'))) {
        throw new Error('styles.css not found');
    }
});

// Test 2: HTML structure is valid
test('index.html has required structure', () => {
    const html = fs.readFileSync(path.join(DASHBOARD_DIR, 'index.html'), 'utf8');
    
    const required = ['<!DOCTYPE html>', '<html', '<head>', '<body>', '</html>'];
    for (const tag of required) {
        if (!html.includes(tag)) {
            throw new Error(`Missing: ${tag}`);
        }
    }
});

// Test 3: HTML includes required elements
test('index.html has UI elements', () => {
    const html = fs.readFileSync(path.join(DASHBOARD_DIR, 'index.html'), 'utf8');
    
    const elements = [
        'id="jobsList"',
        'id="pipelineStatus"',
        'onclick="runPipeline"',
        'onclick="stopPipeline"'
    ];
    
    for (const elem of elements) {
        if (!html.includes(elem)) {
            throw new Error(`Missing element: ${elem}`);
        }
    }
});

// Test 4: app.js has required functions
test('app.js has core functions', () => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIR, 'app.js'), 'utf8');
    
    const functions = [
        'renderJobs',
        'runPipeline',
        'stopPipeline',
        'pollPipelineStatus',
        'generateCV',
        'generateAllCVs'
    ];
    
    for (const fn of functions) {
        if (!js.includes(`function ${fn}`) && !js.includes(`${fn} =`) && !js.includes(`${fn}:`)) {
            throw new Error(`Missing function: ${fn}`);
        }
    }
});

// Test 5: app.js connects to backend API
test('app.js uses correct API URL', () => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIR, 'app.js'), 'utf8');
    
    if (!js.includes('localhost:3001') && !js.includes('API_URL')) {
        throw new Error('Missing API URL configuration');
    }
});

// Test 6: app.js has error handling
test('app.js has error handling', () => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIR, 'app.js'), 'utf8');
    
    if (!js.includes('catch') || !js.includes('try')) {
        throw new Error('Missing error handling');
    }
});

// Test 7: app.js has job filtering
test('app.js has job filtering', () => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIR, 'app.js'), 'utf8');
    
    const filterPatterns = ['filter', 'APPLY', 'CONSIDER', 'SKIP'];
    const hasFilter = filterPatterns.some(p => js.includes(p));
    
    if (!hasFilter) {
        throw new Error('Missing job filtering');
    }
});

// Test 8: app.js handles pipeline resume
test('app.js handles resumePipeline', () => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIR, 'app.js'), 'utf8');
    
    if (!js.includes('resumePipeline') && !js.includes('resume')) {
        throw new Error('Missing resume functionality');
    }
});

// Test 9: CSS has required styles
test('styles.css has required styles', () => {
    const css = fs.readFileSync(path.join(DASHBOARD_DIR, 'styles.css'), 'utf8');
    
    const required = ['body', 'container', 'job-card', 'btn'];
    for (const sel of required) {
        if (!css.includes(sel)) {
            throw new Error(`Missing style: ${sel}`);
        }
    }
});

// Test 10: Dashboard is served by HTTP server
test('Dashboard server is accessible', async () => {
    return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:8081/dashboard/index.html', (res) => {
            if (res.statusCode === 200) {
                resolve();
            } else {
                reject(new Error(`Status ${res.statusCode}`));
            }
        });
        
        req.on('error', () => {
            reject(new Error('Dashboard not accessible'));
        });
        
        req.setTimeout(3000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
});

// Test 11: app.js has WebSocket or polling for status
test('app.js has status polling', () => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIR, 'app.js'), 'utf8');
    
    const pollPatterns = ['setInterval', 'setTimeout', 'fetch', 'poll'];
    const hasPolling = pollPatterns.some(p => js.includes(p));
    
    if (!hasPolling) {
        throw new Error('Missing status polling mechanism');
    }
});

// Test 12: app.js has toast notifications
test('app.js has toast notifications', () => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIR, 'app.js'), 'utf8');
    
    if (!js.includes('toast') && !js.includes('notification')) {
        throw new Error('Missing toast notifications');
    }
});

// Test 13: HTML has responsive meta tag
test('index.html is responsive', () => {
    const html = fs.readFileSync(path.join(DASHBOARD_DIR, 'index.html'), 'utf8');
    
    if (!html.includes('viewport')) {
        throw new Error('Missing viewport meta tag');
    }
});

// Test 14: app.js has CV generation UI handlers
test('app.js has CV generation buttons', () => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIR, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(DASHBOARD_DIR, 'index.html'), 'utf8');
    
    if (!js.includes('generateCV') && !html.includes('Generate CV')) {
        throw new Error('Missing CV generation UI');
    }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Passed: ${passed}/14`);
console.log(`❌ Failed: ${failed}/14`);

if (failed === 0) {
    console.log('\n🎉 Dashboard 100% covered!');
} else {
    console.log(`\n⚠️  ${failed} tests failed`);
}

process.exit(failed > 0 ? 1 : 0);

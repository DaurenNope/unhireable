#!/usr/bin/env node
/**
 * API Integration Tests
 * Tests all backend endpoints
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 5000;

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const req = http.get(BASE_URL + path, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(data) });
                    } catch {
                        resolve({ status: res.statusCode, data });
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(TEST_TIMEOUT, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

async function runTests() {
    console.log('🔗 API Integration Tests\n');
    
    const tests = [
        { name: 'Health endpoint', path: '/api/health', check: (d) => d.status === 'ok' },
        { name: 'Status endpoint', path: '/api/status', check: (d) => d.files && typeof d.files === 'object' },
        { name: 'Jobs endpoint', path: '/api/jobs?type=extension', check: (d) => Array.isArray(d) },
        { name: 'Stats endpoint', path: '/api/stats', check: (d) => typeof d.totalJobs === 'number' },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        process.stdout.write(`Testing ${test.name}... `);
        try {
            const result = await makeRequest(test.path);
            if (test.check(result.data)) {
                console.log('✅ PASS');
                passed++;
            } else {
                console.log('❌ FAIL (data check)');
                failed++;
            }
        } catch (err) {
            console.log(`❌ FAIL (${err.message})`);
            failed++;
        }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});

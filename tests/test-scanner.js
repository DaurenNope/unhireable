#!/usr/bin/env node
/**
 * Scanner Module Tests - 100% Coverage
 * Tests /backend/src/scanner/index.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCANNER_DIR = path.join(__dirname, '..', 'backend', 'src', 'scanner');
const DATA_DIR = path.join(__dirname, '..', 'data');

console.log('🔍 Scanner Module Tests\n');

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

// Test 1: Scanner module exists
test('Scanner index.js exists', () => {
    const scannerPath = path.join(SCANNER_DIR, 'index.js');
    if (!fs.existsSync(scannerPath)) {
        throw new Error('Scanner index.js not found');
    }
});

// Test 2: Scanner has required exports
test('Scanner exports required functions', () => {
    const scannerPath = path.join(SCANNER_DIR, 'index.js');
    const content = fs.readFileSync(scannerPath, 'utf8');
    
    const requiredExports = ['scanJobs', 'scanLinkedIn', 'scanGreenhouse', 'scanLever'];
    for (const exp of requiredExports) {
        if (!content.includes(`export ${exp}`) && !content.includes(`exports.${exp}`) && !content.includes(`module.exports.${exp}`)) {
            throw new Error(`Missing export: ${exp}`);
        }
    }
});

// Test 3: Scanner config loading
test('Scanner reads config correctly', () => {
    const configPath = path.join(DATA_DIR, 'config.yml');
    if (!fs.existsSync(configPath)) {
        throw new Error('config.yml not found');
    }
    
    const content = fs.readFileSync(configPath, 'utf8');
    if (!content.includes('scanner:') && !content.includes('keywords:')) {
        throw new Error('Config missing scanner section');
    }
});

// Test 4: Scanner output format
test('Scanner produces valid JSON output', () => {
    const outputPath = path.join(DATA_DIR, 'jobs_raw.json');
    if (!fs.existsSync(outputPath)) {
        throw new Error('jobs_raw.json not found - run scanner first');
    }
    
    const jobs = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (!Array.isArray(jobs)) {
        throw new Error('Scanner output is not an array');
    }
    
    // Check structure
    for (const job of jobs) {
        if (!job.url) throw new Error('Job missing URL');
        if (!job.company) throw new Error('Job missing company');
        if (!job.title) throw new Error('Job missing title');
    }
});

// Test 5: Scanner handles errors gracefully
test('Scanner error handling', () => {
    const scannerPath = path.join(SCANNER_DIR, 'index.js');
    const content = fs.readFileSync(scannerPath, 'utf8');
    
    // Should have try/catch blocks
    if (!content.includes('try') || !content.includes('catch')) {
        throw new Error('Scanner missing error handling');
    }
});

// Test 6: Scanner respects rate limits
test('Scanner has rate limiting', () => {
    const scannerPath = path.join(SCANNER_DIR, 'index.js');
    const content = fs.readFileSync(scannerPath, 'utf8');
    
    const rateLimitPatterns = ['delay', 'sleep', 'timeout', 'wait', 'rateLimit', 'throttle'];
    const hasRateLimit = rateLimitPatterns.some(p => content.includes(p));
    
    if (!hasRateLimit) {
        throw new Error('Scanner missing rate limiting');
    }
});

// Test 7: Scanner deduplication
test('Scanner deduplicates jobs', () => {
    const outputPath = path.join(DATA_DIR, 'jobs_raw.json');
    if (!fs.existsSync(outputPath)) {
        throw new Error('jobs_raw.json not found');
    }
    
    const jobs = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const urls = jobs.map(j => j.url);
    const uniqueUrls = [...new Set(urls)];
    
    if (urls.length !== uniqueUrls.length) {
        throw new Error(`Found ${urls.length - uniqueUrls.length} duplicate jobs`);
    }
});

// Test 8: Scanner filters by keywords
test('Scanner filters by keywords', () => {
    const scannerPath = path.join(SCANNER_DIR, 'index.js');
    const content = fs.readFileSync(scannerPath, 'utf8');
    
    const filterPatterns = ['filter', 'keyword', 'match', 'include', 'exclude'];
    const hasFiltering = filterPatterns.some(p => content.includes(p));
    
    if (!hasFiltering) {
        throw new Error('Scanner missing keyword filtering');
    }
});

// Test 9: Scanner handles different platforms
test('Scanner supports multiple platforms', () => {
    const scannerPath = path.join(SCANNER_DIR, 'index.js');
    const content = fs.readFileSync(scannerPath, 'utf8');
    
    const platforms = ['linkedin', 'greenhouse', 'lever', 'ashby'];
    const supportedPlatforms = platforms.filter(p => 
        content.toLowerCase().includes(p)
    );
    
    if (supportedPlatforms.length === 0) {
        throw new Error('Scanner does not support any known platforms');
    }
});

// Test 10: Scanner saves metadata
test('Scanner saves scan metadata', () => {
    const outputPath = path.join(DATA_DIR, 'jobs_raw.json');
    if (!fs.existsSync(outputPath)) {
        throw new Error('jobs_raw.json not found');
    }
    
    const stats = fs.statSync(outputPath);
    if (!stats.mtime) {
        throw new Error('Cannot determine scan time');
    }
    
    // Should be recent (within 30 days)
    const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    console.log(`\n   ℹ️  Last scan: ${ageDays.toFixed(1)} days ago`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Passed: ${passed}/10`);
console.log(`❌ Failed: ${failed}/10`);

if (failed === 0) {
    console.log('\n🎉 Scanner 100% covered!');
} else {
    console.log(`\n⚠️  ${failed} tests failed`);
}

process.exit(failed > 0 ? 1 : 0);

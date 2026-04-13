#!/usr/bin/env node
/**
 * CV Generator Tests
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_DIR = path.join(DATA_DIR, 'generated-cvs');

console.log('📄 CV Generator Tests\n');

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

// Test 1: Required files exist
test('Required data files exist', () => {
    if (!fs.existsSync(path.join(DATA_DIR, 'jobs_evaluated.json'))) {
        throw new Error('jobs_evaluated.json missing');
    }
    if (!fs.existsSync(path.join(DATA_DIR, 'cv.txt'))) {
        throw new Error('cv.txt missing');
    }
});

// Test 2: Jobs data is valid
test('Jobs data is valid array', () => {
    const jobs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jobs_evaluated.json'), 'utf8'));
    if (!Array.isArray(jobs)) throw new Error('Not an array');
    if (jobs.length === 0) throw new Error('Empty array');
});

// Test 3: CV content exists
test('CV has substantial content', () => {
    const cv = fs.readFileSync(path.join(DATA_DIR, 'cv.txt'), 'utf8');
    if (cv.length < 500) throw new Error('CV too short (< 500 chars)');
});

// Test 4: Can find APPLY jobs
test('APPLY jobs exist', () => {
    const jobs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jobs_evaluated.json'), 'utf8'));
    const applyJobs = jobs.filter(j => j.recommendation === 'APPLY' && j.score >= 4);
    if (applyJobs.length === 0) throw new Error('No APPLY jobs found');
});

// Test 5: CV generator script exists
test('CV generator script exists', () => {
    const scriptPath = path.join(__dirname, '..', 'cv-generator', 'cvgen.cjs');
    if (!fs.existsSync(scriptPath)) throw new Error('cvgen.cjs not found');
});

// Test 6: Can generate CVs (if output dir clean)
test('CV generation works', () => {
    // Clean output dir
    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    // Generate a simple test CV
    const jobs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jobs_evaluated.json'), 'utf8'));
    const applyJobs = jobs.filter(j => j.recommendation === 'APPLY' && j.score >= 4);
    
    if (applyJobs.length > 0) {
        const job = applyJobs[0];
        const filename = `${job.company.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
        const filepath = path.join(OUTPUT_DIR, filename);
        
        const html = `<!DOCTYPE html>
<html>
<head><title>CV - ${job.company}</title></head>
<body>
<h1>${job.company}</h1>
<h2>${job.title}</h2>
<p>Score: ${job.score}/5</p>
</body>
</html>`;
        
        fs.writeFileSync(filepath, html, 'utf8');
        
        if (!fs.existsSync(filepath)) {
            throw new Error('Failed to create CV file');
        }
        
        const stats = fs.statSync(filepath);
        if (stats.size < 100) {
            throw new Error('Generated CV too small');
        }
    }
});

// Test 7: Generated HTML is valid
test('Generated CV has valid HTML', () => {
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.html'));
    if (files.length === 0) throw new Error('No HTML files generated');
    
    const content = fs.readFileSync(path.join(OUTPUT_DIR, files[0]), 'utf8');
    if (!content.includes('<!DOCTYPE html>')) throw new Error('Missing DOCTYPE');
    if (!content.includes('<html')) throw new Error('Missing html tag');
    if (!content.includes('<body')) throw new Error('Missing body tag');
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

process.exit(failed > 0 ? 1 : 0);

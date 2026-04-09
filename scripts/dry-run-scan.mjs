#!/usr/bin/env node
/**
 * Dry Run Scanner - Test pipeline without LLM
 * Simulates scanning by using mock data to verify data flow
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

console.log('🔍 DRY RUN SCANNER (No LLM Required)\n');

// Load config
const config = YAML.load(readFileSync(join(DATA_DIR, 'config.yml'), 'utf8'));
const portals = YAML.load(readFileSync(join(DATA_DIR, 'portals.yml'), 'utf8'));

console.log(`Profile: ${config.cv.name} - ${config.cv.title}`);
console.log(`Target roles: ${config.preferences.target_roles.join(', ')}\n`);

// Mock job data (simulating what LLM would extract)
const mockJobs = [
    {
        title: "Senior AI Engineer",
        company: "TechCorp",
        location: "Remote",
        description: "Looking for ML engineers with Python and TensorFlow experience. 5+ years required.",
        url: "https://example.com/job/1",
        source: "greenhouse"
    },
    {
        title: "Machine Learning Engineer",
        company: "AI Startup",
        location: "San Francisco, CA (Remote)",
        description: "Build LLM-powered applications. Experience with PyTorch, NLP, and model deployment.",
        url: "https://example.com/job/2",
        source: "lever"
    },
    {
        title: "Full Stack Developer",
        company: "WebAgency",
        location: "New York, NY",
        description: "PHP, WordPress, and Laravel development. On-site required.",
        url: "https://example.com/job/3",
        source: "ashby"
    },
    {
        title: "Blockchain Developer",
        company: "DeFi Protocol",
        location: "Remote",
        description: "Smart contract development in Solidity. Web3, Ethereum, DeFi experience needed.",
        url: "https://example.com/job/4",
        source: "greenhouse"
    },
    {
        title: "Data Scientist",
        company: "Analytics Co",
        location: "Remote (US)",
        description: "Statistical modeling, Python, SQL. ML background preferred.",
        url: "https://example.com/job/5",
        source: "linkedin"
    }
];

// Filter logic (same as real scanner)
const positiveKeywords = portals.title_filter.positive.map(k => k.toLowerCase());
const negativeKeywords = portals.title_filter.negative.map(k => k.toLowerCase());

console.log(`Filtering with ${positiveKeywords.length} positive keywords...\n`);

let passed = 0;
let filtered = 0;

const filteredJobs = mockJobs.filter(job => {
    const title = job.title.toLowerCase();
    const desc = (job.description || '').toLowerCase();
    const combined = `${title} ${desc}`;
    
    // Check positive
    const hasPositive = positiveKeywords.some(kw => combined.includes(kw.toLowerCase()));
    
    // Check negative
    const hasNegative = negativeKeywords.some(kw => combined.includes(kw.toLowerCase()));
    
    const matches = hasPositive && !hasNegative;
    
    if (matches) {
        passed++;
        console.log(`✅ PASS: ${job.title} @ ${job.company}`);
        if (hasPositive) {
            const matched = positiveKeywords.filter(kw => combined.includes(kw.toLowerCase()));
            console.log(`   Keywords: ${matched.join(', ')}`);
        }
    } else {
        filtered++;
        const reason = hasNegative ? 'negative keyword' : 'no positive match';
        console.log(`❌ FILTER: ${job.title} @ ${job.company} (${reason})`);
    }
    
    return matches;
});

console.log(`\n📊 Filter Results: ${passed} passed, ${filtered} filtered`);
console.log(`Match rate: ${((passed / mockJobs.length) * 100).toFixed(0)}%\n`);

// Save to jobs_raw.json (merge with existing)
const outputPath = join(DATA_DIR, 'jobs_raw.json');
let existing = { jobs: [], metadata: { last_scan: new Date().toISOString() } };

if (existsSync(outputPath)) {
    existing = JSON.parse(readFileSync(outputPath, 'utf8'));
}

// Add dry-run jobs with timestamp
const newJobs = filteredJobs.map(j => ({
    ...j,
    scraped_at: new Date().toISOString(),
    _dry_run: true
}));

// Merge (avoid duplicates by URL)
const urlSet = new Set(existing.jobs.map(j => j.url));
const uniqueNewJobs = newJobs.filter(j => !urlSet.has(j.url));

existing.jobs = [...existing.jobs, ...uniqueNewJobs];
existing.metadata = {
    ...existing.metadata,
    last_scan: new Date().toISOString(),
    total_jobs: existing.jobs.length,
    dry_run_added: uniqueNewJobs.length
};

writeFileSync(outputPath, JSON.stringify(existing, null, 2));

console.log(`💾 Saved ${uniqueNewJobs.length} dry-run jobs to jobs_raw.json`);
console.log(`Total jobs in file: ${existing.jobs.length}\n`);

// Show next steps
console.log('🎯 Next Steps:');
console.log('   1. Check dashboard: http://localhost:8080');
console.log('   2. Run real scan: node scanner/llm-agnostic-scan.mjs --limit=5');
console.log('   3. Run evaluator: cd evaluator && node src/index.js --limit=5');
console.log('\n✅ Dry run complete! Data flow verified.');

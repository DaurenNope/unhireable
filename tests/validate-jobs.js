#!/usr/bin/env node
/**
 * Job Data Validation Test
 * Validates that job objects have all required fields
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const jobsPath = path.join(DATA_DIR, 'jobs_evaluated.json');

console.log('Validating job data...\n');

// Load jobs
let jobs;
try {
    jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
} catch (err) {
    console.error('❌ Failed to load jobs:', err.message);
    process.exit(1);
}

if (!Array.isArray(jobs)) {
    console.error('❌ Jobs data is not an array');
    process.exit(1);
}

console.log(`📊 Total jobs: ${jobs.length}\n`);

const requiredFields = ['title', 'company', 'url', 'recommendation', 'score'];
const optionalFields = ['requiredSkills', 'cv_highlights', 'interview_prep', 'salary', 'location'];

let errors = 0;
let warnings = 0;

for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const prefix = `[${i + 1}/${jobs.length}] ${job.company || 'Unknown'}: `;
    
    // Check required fields
    for (const field of requiredFields) {
        if (!job[field]) {
            console.log(`❌ ${prefix} Missing required field: ${field}`);
            errors++;
        }
    }
    
    // Check recommendation is valid
    const validRecs = ['APPLY', 'CONSIDER', 'SKIP'];
    if (job.recommendation && !validRecs.includes(job.recommendation)) {
        console.log(`⚠️  ${prefix} Invalid recommendation: ${job.recommendation}`);
        warnings++;
    }
    
    // Check score is number 0-5
    if (typeof job.score !== 'number' || job.score < 0 || job.score > 5) {
        console.log(`⚠️  ${prefix} Invalid score: ${job.score}`);
        warnings++;
    }
}

// Summary by recommendation
const byRec = {};
for (const job of jobs) {
    const rec = job.recommendation || 'UNKNOWN';
    byRec[rec] = (byRec[rec] || 0) + 1;
}

console.log('\n📈 Summary by Recommendation:');
for (const [rec, count] of Object.entries(byRec)) {
    console.log(`   ${rec}: ${count}`);
}

// High-quality jobs (APPLY with score >= 4)
const applyJobs = jobs.filter(j => j.recommendation === 'APPLY' && j.score >= 4);
console.log(`\n🎯 High-quality APPLY jobs (score >= 4): ${applyJobs.length}`);
for (const job of applyJobs) {
    console.log(`   ✅ ${job.company}: ${job.title} (Score: ${job.score})`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (errors === 0) {
    console.log(`✅ All jobs valid (${warnings} warnings)`);
    process.exit(0);
} else {
    console.log(`❌ ${errors} errors, ${warnings} warnings`);
    process.exit(1);
}

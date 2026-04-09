#!/usr/bin/env node
/**
 * Export Jobs - Export evaluated jobs to various formats
 * CSV, JSON, or Markdown for tracking
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const format = process.argv[2] || 'csv';

console.log(`📤 Exporting jobs to ${format.toUpperCase()}\n`);

// Load evaluated jobs
const evalPath = join(DATA_DIR, 'jobs_evaluated.json');
if (!existsSync(evalPath)) {
    console.log('❌ No evaluated jobs found. Run evaluator first.');
    process.exit(1);
}

const data = JSON.parse(readFileSync(evalPath, 'utf8'));
const jobs = data.jobs || [];

if (jobs.length === 0) {
    console.log('❌ No jobs in evaluated file.');
    process.exit(1);
}

// Filter only good matches
const goodJobs = jobs.filter(j => j.score >= 3.5 || j.recommendation === 'APPLY');

console.log(`Found ${jobs.length} total jobs, ${goodJobs.length} good matches\n`);

// Export based on format
switch (format.toLowerCase()) {
    case 'csv':
        exportCSV(goodJobs);
        break;
    case 'json':
        exportJSON(goodJobs);
        break;
    case 'md':
    case 'markdown':
        exportMarkdown(goodJobs);
        break;
    default:
        console.log('Usage: node export-jobs.js [csv|json|md]');
        process.exit(1);
}

function exportCSV(jobs) {
    const headers = ['Company', 'Title', 'Location', 'Score', 'Recommendation', 'URL', 'Applied'];
    const rows = jobs.map(j => [
        j.company || '',
        j.title || '',
        j.location || '',
        j.score || '',
        j.recommendation || '',
        j.url || '',
        '' // Applied column for manual tracking
    ].map(v => `"${String(v).replace(/"/g, '""')}"`));
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const outputPath = join(DATA_DIR, 'jobs_export.csv');
    writeFileSync(outputPath, csv);
    
    console.log(`✅ Exported ${jobs.length} jobs to data/jobs_export.csv`);
    console.log('   Open in Excel/Sheets to track applications');
}

function exportJSON(jobs) {
    const output = {
        exported_at: new Date().toISOString(),
        total: jobs.length,
        jobs: jobs
    };
    const outputPath = join(DATA_DIR, 'jobs_export.json');
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`✅ Exported ${jobs.length} jobs to data/jobs_export.json`);
}

function exportMarkdown(jobs) {
    const sections = jobs.map(j => `
## ${j.title} @ ${j.company}

- **Score:** ${j.score}/5 ${j.recommendation === 'APPLY' ? '✅' : '⚠️'}
- **Location:** ${j.location || 'Not specified'}
- **URL:** ${j.url}

${j.summary || ''}

**Highlights:**
${(j.cv_highlights || []).map(h => `- ${h}`).join('\n') || '- None listed'}

**Interview Prep:**
${(j.interview_prep || []).map(p => `- ${p}`).join('\n') || '- None listed'}

---
`).join('\n');
    
    const md = `# Job Applications - ${new Date().toLocaleDateString()}

*${jobs.length} high-match positions found*

${sections}`;
    
    const outputPath = join(DATA_DIR, 'jobs_export.md');
    writeFileSync(outputPath, md);
    
    console.log(`✅ Exported ${jobs.length} jobs to data/jobs_export.md`);
    console.log('   View in any Markdown reader or VS Code preview');
}

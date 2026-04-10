#!/usr/bin/env node
/**
 * Import Scanner/Evaluator Data → Chrome Extension Storage
 * 
 * Usage:
 *   node import-to-extension.mjs              # Import evaluated jobs
 *   node import-to-extension.mjs --raw         # Import raw (unscored) jobs
 *   node import-to-extension.mjs --min-score 4  # Only high scores
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DATA_DIR = join(ROOT_DIR, 'data');

// Parse CLI args
const args = process.argv.slice(2);
const importRaw = args.includes('--raw');
const minScoreArg = args.find(a => a.startsWith('--min-score='));
const minScore = minScoreArg ? parseFloat(minScoreArg.split('=')[1]) : 0;

console.log('🔄 Importing jobs to extension format...\n');

// Load data files
let jobs = [];
let source = '';

try {
  if (importRaw) {
    // Import raw scanned jobs
    const rawData = JSON.parse(readFileSync(join(DATA_DIR, 'jobs_raw.json'), 'utf8'));
    jobs = (rawData.jobs || []).map(j => ({
      ...j,
      _evaluated: false,
      _source: 'scanned',
      recommendation: 'PENDING',
      score: null
    }));
    source = 'jobs_raw.json';
    console.log(`📥 Loaded ${jobs.length} raw jobs from scanner`);
  } else {
    // Import evaluated jobs
    const evalData = JSON.parse(readFileSync(join(DATA_DIR, 'jobs_evaluated.json'), 'utf8'));
    jobs = (evalData.jobs || []).map(j => ({
      ...j,
      _evaluated: true,
      _source: 'evaluated'
    }));
    source = 'jobs_evaluated.json';
    console.log(`📥 Loaded ${jobs.length} evaluated jobs`);
  }
} catch (e) {
  console.error('❌ Error loading data:', e.message);
  process.exit(1);
}

// Filter by minimum score
if (minScore > 0) {
  const beforeCount = jobs.length;
  jobs = jobs.filter(j => (j.score || 0) >= minScore);
  console.log(`🔍 Filtered to ${jobs.length}/${beforeCount} jobs with score >= ${minScore}`);
}

// Transform to extension format
const extensionJobs = jobs.map(job => ({
  id: job.id || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  url: job.url,
  title: job.title,
  company: job.company,
  location: job.location || 'Remote',
  department: job.department || '',
  description: job.description || '',
  
  // Evaluation data (if available)
  score: job.score || null,
  recommendation: job.recommendation || 'PENDING',
  blocks: job.blocks || null,
  summary: job.summary || '',
  cv_highlights: job.cv_highlights || [],
  interview_prep: job.interview_prep || [],
  tailored_summary: job.tailored_summary || '',
  
  // Metadata
  scannedAt: job.scanned_at || new Date().toISOString(),
  evaluatedAt: job.evaluated_at || null,
  source: job.source || 'unknown',
  aiProvider: job.ai_provider || null,
  aiModel: job.ai_model || null,
  
  // Extension tracking
  status: 'new', // new, queued, applied, rejected
  addedToQueueAt: null,
  appliedAt: null,
  notes: ''
}));

// Generate output for extension
const output = {
  importedAt: new Date().toISOString(),
  source: source,
  totalJobs: extensionJobs.length,
  byRecommendation: {
    APPLY: extensionJobs.filter(j => j.recommendation === 'APPLY').length,
    CONSIDER: extensionJobs.filter(j => j.recommendation === 'CONSIDER').length,
    SKIP: extensionJobs.filter(j => j.recommendation === 'SKIP').length,
    PENDING: extensionJobs.filter(j => j.recommendation === 'PENDING').length
  },
  byScore: {
    '4.0-5.0': extensionJobs.filter(j => j.score >= 4.0).length,
    '3.0-3.9': extensionJobs.filter(j => j.score >= 3.0 && j.score < 4.0).length,
    '2.0-2.9': extensionJobs.filter(j => j.score >= 2.0 && j.score < 3.0).length,
    '0-1.9': extensionJobs.filter(j => j.score < 2.0).length,
    'none': extensionJobs.filter(j => !j.score).length
  },
  jobs: extensionJobs
};

// Save to extension-compatible JSON
const outputPath = join(DATA_DIR, 'extension_jobs_import.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log('\n✅ Import complete!\n');
console.log(`📁 Saved to: ${outputPath}`);
console.log(`📊 Total jobs: ${output.totalJobs}`);
console.log('\n📈 By Recommendation:');
Object.entries(output.byRecommendation).forEach(([rec, count]) => {
  if (count > 0) console.log(`   ${rec}: ${count}`);
});
console.log('\n📊 By Score:');
Object.entries(output.byScore).forEach(([range, count]) => {
  if (count > 0) console.log(`   ${range}: ${count}`);
});

console.log('\n📝 Next steps:');
console.log('   1. Open Chrome Extension');
console.log('   2. Click "Import Jobs" to load these jobs');
console.log('   3. Review and add to your Apply Queue');

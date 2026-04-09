#!/usr/bin/env node

/**
 * Career Ops → Unhireable Integration Bridge
 * 
 * This script integrates the Career Ops engine into Unhireable:
 * 1. Sets up Career Ops configuration
 * 2. Runs Career Ops scan (using Claude Code subagent mode)
 * 3. Converts output to Unhireable format
 * 4. Runs Career Ops evaluation on results
 * 5. Makes everything available in the Unhireable dashboard
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAREER_OPS_DIR = join(__dirname, 'tools', 'career-ops-clone');
const DATA_DIR = join(__dirname, 'data');

console.log('🚀 Career Ops Integration for Unhireable\n');

// Step 1: Check Career Ops exists
if (!existsSync(CAREER_OPS_DIR)) {
  console.error('❌ Career Ops not found at tools/career-ops-clone/');
  console.log('Clone it first:');
  console.log('  git clone https://github.com/santifer/career-ops.git tools/career-ops-clone');
  process.exit(1);
}

console.log('✅ Career Ops found');

// Step 2: Setup configuration files
const requiredFiles = [
  { src: 'templates/portals.example.yml', dest: 'data/portals.yml' },
  { src: 'config/profile.example.yml', dest: 'config/profile.yml' },
];

console.log('\n📋 Setting up configuration...');

for (const { src, dest } of requiredFiles) {
  const srcPath = join(CAREER_OPS_DIR, src);
  const destPath = join(__dirname, dest);
  
  if (existsSync(srcPath) && !existsSync(destPath)) {
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
    console.log(`  Created: ${dest}`);
  } else if (existsSync(destPath)) {
    console.log(`  Exists: ${dest}`);
  } else {
    console.log(`  Missing source: ${src}`);
  }
}

// Step 3: Create Unhireable-compatible output bridge
console.log('\n🔧 Creating data bridge...');

const bridgeScript = `
/**
 * Data Bridge: Career Ops → Unhireable
 * Converts Career Ops tracker format to Unhireable jobs_evaluated.json
 */

const fs = require('fs');
const path = require('path');

const CAREER_OPS_DIR = path.join(__dirname, '..', '..', 'tools', 'career-ops-clone');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function convertTrackerToUnhireable() {
  // Read Career Ops pipeline/applications
  const pipelinePath = path.join(CAREER_OPS_DIR, 'data', 'pipeline.md');
  const applicationsPath = path.join(CAREER_OPS_DIR, 'data', 'applications.md');
  
  const jobs = [];
  
  if (fs.existsSync(pipelinePath)) {
    const pipeline = fs.readFileSync(pipelinePath, 'utf8');
    // Parse markdown table format
    const lines = pipeline.split('\\n').filter(l => l.includes('|') && !l.includes('---'));
    for (const line of lines.slice(1)) { // Skip header
      const cols = line.split('|').map(c => c.trim()).filter(c => c);
      if (cols.length >= 3) {
        jobs.push({
          title: cols[1] || 'Unknown',
          company: cols[0] || 'Unknown',
          location: 'Remote/Unknown',
          url: cols[2] || '',
          score: parseFloat(cols[3]) || 0,
          recommendation: cols[4] || 'CONSIDER',
          source: 'career-ops-pipeline'
        });
      }
    }
  }
  
  // Write in Unhireable format
  const output = {
    evaluated_at: new Date().toISOString(),
    ai_provider: 'career-ops',
    total_evaluated: jobs.length,
    good_matches: jobs.filter(j => j.score >= 3).length,
    jobs
  };
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'jobs_evaluated.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log('✅ Converted', jobs.length, 'jobs to Unhireable format');
}

convertTrackerToUnhireable();
`;

const bridgePath = join(CAREER_OPS_DIR, 'unhireable-bridge.js');
writeFileSync(bridgePath, bridgeScript);
console.log('  Created: unhireable-bridge.js');

// Step 4: Create convenience scripts
console.log('\n📝 Creating convenience scripts...');

const scanScript = `#!/bin/bash
cd "$(dirname "$0")/tools/career-ops-clone"
echo "Starting Career Ops scan..."
echo "Type in Claude: /career-ops scan"
claude
`;

const evaluateScript = `#!/bin/bash
cd "$(dirname "$0")/tools/career-ops-clone"
echo "Starting Career Ops evaluation..."
echo "Type in Claude: /career-ops oferta <URL>"
claude
`;

writeFileSync(join(__dirname, 'co-scan.sh'), scanScript);
writeFileSync(join(__dirname, 'co-evaluate.sh'), evaluateScript);
execSync(`chmod +x ${join(__dirname, 'co-scan.sh')} ${join(__dirname, 'co-evaluate.sh')}`);

console.log('  Created: co-scan.sh');
console.log('  Created: co-evaluate.sh');

// Step 5: Summary
console.log('\n✅ Integration Complete!\n');
console.log('Usage:');
console.log('  ./co-scan.sh       # Run Career Ops portal scanner');
console.log('  ./co-evaluate.sh   # Evaluate a job with Career Ops');
console.log('  node tools/career-ops-clone/unhireable-bridge.js  # Sync data to dashboard\n');

console.log('Next steps:');
console.log('  1. Edit data/portals.yml with your target companies');
console.log('  2. Run ./co-scan.sh and follow Claude instructions');
console.log('  3. Results will appear in your Unhireable dashboard\n');

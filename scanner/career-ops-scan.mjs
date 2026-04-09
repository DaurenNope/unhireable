#!/usr/bin/env node

/**
 * Career Ops Integration - Portal Scanner
 * 
 * This runs the Career Ops scan mode using the proper configuration
 * and outputs results compatible with Unhireable's data format.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'js-yaml';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// Load Career Ops portals.yml config
function loadPortalsConfig() {
  const portalsPath = join(DATA_DIR, 'portals.yml');
  if (!existsSync(portalsPath)) {
    console.error(chalk.red('portals.yml not found. Run: cp templates/portals.example.yml data/portals.yml'));
    process.exit(1);
  }
  return YAML.load(readFileSync(portalsPath, 'utf8'));
}

// Convert Career Ops format to Unhireable format
function convertToUnhireableFormat(careerOpsJobs) {
  return {
    scanned_at: new Date().toISOString(),
    source: 'career-ops-portal-scan',
    total_jobs: careerOpsJobs.length,
    jobs: careerOpsJobs.map(job => ({
      title: job.title,
      company: job.company,
      location: job.location || 'Remote/Unknown',
      url: job.url,
      source: job.portal || 'company-page',
      description: job.description || '',
      // Career Ops specific fields preserved
      _career_ops: {
        portal: job.portal,
        department: job.department,
        score_relevance: job.score_relevance || 0
      }
    }))
  };
}

// Main integration function
async function runCareerOpsScan(options = {}) {
  console.log(chalk.blue.bold('🔍 Career Ops Portal Scanner'));
  console.log(chalk.gray('Reading configuration from data/portals.yml...\n'));
  
  const config = loadPortalsConfig();
  const limit = options.limit || 50;
  
  // Get tracked companies (enabled only)
  const companies = (config.tracked_companies || [])
    .filter(c => c.enabled !== false)
    .slice(0, limit);
  
  console.log(chalk.yellow(`Found ${companies.length} configured companies`));
  console.log(chalk.gray('Companies: ' + companies.map(c => c.name).join(', ') + '\n'));
  
  // For now, output the companies we would scan
  // The actual scan requires Claude Code with browser tools
  const scanPlan = {
    plan: 'career-ops-scan',
    companies: companies.map(c => ({
      name: c.name,
      url: c.careers_url,
      method: c.api ? 'greenhouse-api' : (c.scan_method || 'playwright'),
      api_url: c.api || null
    })),
    title_filter: config.title_filter,
    search_queries: (config.search_queries || []).filter(q => q.enabled !== false)
  };
  
  console.log(chalk.blue('Scan Plan:'));
  console.log(JSON.stringify(scanPlan, null, 2));
  
  // Save scan plan for manual execution or Claude subagent
  const planPath = join(DATA_DIR, 'career-ops-scan-plan.json');
  writeFileSync(planPath, JSON.stringify(scanPlan, null, 2));
  console.log(chalk.green(`\n✅ Scan plan saved to: ${planPath}`));
  console.log(chalk.yellow('\nTo execute full scan with Career Ops:'));
  console.log(chalk.white('  cd tools/career-ops-clone && claude'));
  console.log(chalk.white('  Then type: /career-ops scan'));
  
  return scanPlan;
}

// CLI
const args = process.argv.slice(2);
const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1] || '50';

runCareerOpsScan({ limit: parseInt(limit) }).catch(console.error);

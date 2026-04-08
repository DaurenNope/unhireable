#!/usr/bin/env node

/**
 * Unhireable Scanner - Job Discovery Engine
 * 
 * Scans LinkedIn and company career pages to find job listings.
 * Outputs structured JSON for the evaluator to score.
 */

import { program } from 'commander';
import chalk from 'chalk';
import { chromium } from 'playwright';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

program
  .name('unhireable-scanner')
  .description('Scan job listings from LinkedIn and company career pages')
  .version('1.0.0')
  .option('-s, --source <type>', 'Scan source: linkedin, companies, or all', 'all')
  .option('-l, --limit <number>', 'Max jobs to scan', '100')
  .option('-k, --keywords <words>', 'Comma-separated keywords', 'senior,staff,principal,lead')
  .option('-o, --output <path>', 'Output file', join(DATA_DIR, 'jobs_raw.json'))
  .option('--headless', 'Run in headless mode', true)
  .option('--no-headless', 'Show browser window')
  .parse();

const options = program.opts();

console.log(chalk.blue.bold('🔍 Unhireable Scanner'));
console.log(chalk.gray(`Source: ${options.source} | Limit: ${options.limit}`));
console.log();

async function main() {
  const browser = await chromium.launch({ 
    headless: options.headless,
    slowMo: 100 // Human-like delays
  });

  const allJobs = [];

  try {
    if (options.source === 'all' || options.source === 'linkedin') {
      console.log(chalk.yellow('Scanning LinkedIn...'));
      const linkedinJobs = await scanLinkedIn(browser, options);
      allJobs.push(...linkedinJobs);
      console.log(chalk.green(`Found ${linkedinJobs.length} LinkedIn jobs`));
    }

    if (options.source === 'all' || options.source === 'companies') {
      console.log(chalk.yellow('Scanning company career pages...'));
      const companyJobs = await scanCompanyPages(browser, options);
      allJobs.push(...companyJobs);
      console.log(chalk.green(`Found ${companyJobs.length} company jobs`));
    }

    // Deduplicate by URL
    const uniqueJobs = deduplicateJobs(allJobs);
    
    // Save results
    const output = {
      scanned_at: new Date().toISOString(),
      total_jobs: uniqueJobs.length,
      jobs: uniqueJobs
    };

    writeFileSync(options.output, JSON.stringify(output, null, 2));
    
    console.log();
    console.log(chalk.green.bold(`✅ Scanned ${uniqueJobs.length} unique jobs`));
    console.log(chalk.gray(`Saved to: ${options.output}`));

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function scanLinkedIn(browser, options) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  const jobs = [];
  
  // Navigate to LinkedIn Jobs
  const keywords = options.keywords.split(',').join('%20');
  const url = `https://www.linkedin.com/jobs/search/?keywords=${keywords}&f_TPR=r86400&f_WT=2`;
  
  console.log(chalk.gray(`Navigating: ${url}`));
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for job listings to load
    await page.waitForSelector('.jobs-search__results-list, [data-job-id]', { timeout: 10000 });
    
    // Scroll to load more jobs
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000);
    }
    
    // Extract job listings
    const listings = await page.evaluate(() => {
      const jobs = [];
      const cards = document.querySelectorAll('.jobs-search-results__list-item, [data-job-id]');
      
      cards.forEach(card => {
        const titleEl = card.querySelector('.job-card-list__title, .base-search-card__title, a[href*="/jobs/view"]');
        const companyEl = card.querySelector('.job-card-container__company-name, .base-search-card__subtitle');
        const locationEl = card.querySelector('.job-card-container__metadata-item, .job-search-card__location');
        const linkEl = card.querySelector('a[href*="/jobs/view"]');
        
        if (titleEl && linkEl) {
          jobs.push({
            title: titleEl.textContent?.trim(),
            company: companyEl?.textContent?.trim() || 'Unknown',
            location: locationEl?.textContent?.trim() || 'Unknown',
            url: linkEl.href?.split('?')[0], // Clean URL
            source: 'linkedin'
          });
        }
      });
      
      return jobs;
    });
    
    jobs.push(...listings.slice(0, parseInt(options.limit) / 2));
    
  } catch (error) {
    console.log(chalk.yellow('LinkedIn scan warning:'), error.message);
  }
  
  await context.close();
  return jobs;
}

async function scanCompanyPages(browser, options) {
  const jobs = [];
  const keywords = options.keywords.split(',');
  
  // Company configs (simplified from Career-Ops)
  const companies = [
    { name: 'Stripe', url: 'https://stripe.com/jobs', ats: 'greenhouse' },
    { name: 'Anthropic', url: 'https://www.anthropic.com/careers', ats: 'ashby' },
    { name: 'OpenAI', url: 'https://openai.com/careers', ats: 'greenhouse' },
    { name: 'ElevenLabs', url: 'https://elevenlabs.io/careers', ats: 'greenhouse' },
    { name: 'Vercel', url: 'https://vercel.com/careers', ats: 'greenhouse' },
    { name: 'Linear', url: 'https://linear.app/careers', ats: 'ashby' },
    { name: 'Figma', url: 'https://www.figma.com/careers', ats: 'greenhouse' },
    { name: 'Notion', url: 'https://www.notion.so/careers', ats: 'greenhouse' },
    { name: 'Raycast', url: 'https://www.raycast.com/careers', ats: 'greenhouse' },
    { name: 'Supabase', url: 'https://supabase.com/careers', ats: 'greenhouse' },
  ];
  
  for (const company of companies.slice(0, 5)) { // Limit to 5 for MVP
    console.log(chalk.gray(`  Scanning ${company.name}...`));
    
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(company.url, { waitUntil: 'networkidle', timeout: 15000 });
      
      // Try to find job listings based on common patterns
      const listings = await page.evaluate((keywords) => {
        const jobs = [];
        
        // Common job card selectors
        const selectors = [
          '[data-testid="job-card"]',
          '.job-card',
          '.posting',
          '.career-job',
          '.opening',
          'a[href*="/jobs/"]',
          'a[href*="/careers/"]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          
          elements.forEach(el => {
            const text = el.textContent?.toLowerCase() || '';
            const hasKeyword = keywords.some(k => text.includes(k.toLowerCase()));
            
            if (hasKeyword && el.href) {
              jobs.push({
                title: el.textContent?.trim().substring(0, 100),
                company: document.title?.split('-')[0]?.trim() || 'Unknown',
                location: 'Remote/Unknown',
                url: el.href,
                source: 'company-page'
              });
            }
          });
        }
        
        return jobs;
      }, keywords);
      
      jobs.push(...listings.slice(0, 3)); // Max 3 per company
      
      await context.close();
    } catch (error) {
      console.log(chalk.yellow(`  ${company.name} failed:`, error.message));
    }
  }
  
  return jobs;
}

function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${job.company}-${job.title}`.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

main().catch(console.error);

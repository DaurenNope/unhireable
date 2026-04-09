#!/usr/bin/env node

/**
 * LLM-Agnostic Career Ops Scanner
 * 
 * REWRITTEN to work with ANY LLM - no Claude Code required
 * Uses Playwright directly for browser automation
 * Supports OpenAI, Anthropic, Gemini, Ollama for smart parsing
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'js-yaml';
import dotenv from 'dotenv';

// Load .env
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// LLM Configuration - works with ANY provider
const LLM_CONFIG = {
  provider: process.env.LLM_PROVIDER || 'gemini', // openai, anthropic, gemini, ollama
  api_key: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  model: process.env.LLM_MODEL || 'gemini-2.5-flash',
  base_url: process.env.OLLAMA_URL || 'http://localhost:11434'
};

// Call LLM API - universal interface
async function callLLM(prompt, systemPrompt = '') {
  const { provider, api_key, model, base_url } = LLM_CONFIG;
  
  switch (provider) {
    case 'openai':
      return await callOpenAI(prompt, systemPrompt, api_key, model);
    case 'anthropic':
      return await callAnthropic(prompt, systemPrompt, api_key, model);
    case 'gemini':
      return await callGemini(prompt, api_key, model);
    case 'ollama':
      return await callOllama(prompt, base_url, model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOpenAI(prompt, systemPrompt, apiKey, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });
  
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(prompt, systemPrompt, apiKey, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
  const data = await response.json();
  return data.content[0].text;
}

async function callGemini(prompt, apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4000 }
    })
  });
  
  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callOllama(prompt, baseUrl, model) {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      prompt: prompt,
      stream: false
    })
  });
  
  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return data.response;
}

// Greenhouse API - no LLM needed, direct REST API
async function scanGreenhouseAPI(companySlug) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.jobs.map(job => ({
      title: job.title,
      company: companySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      location: job.location?.name || 'Remote/Unknown',
      url: job.absolute_url,
      department: job.departments?.[0]?.name || '',
      source: 'greenhouse-api',
      description: job.content?.substring(0, 500) || ''
    }));
  } catch (e) {
    console.error(`  Greenhouse API failed for ${companySlug}:`, e.message);
    return [];
  }
}

// Playwright-based scraping with LLM extraction
async function scanWithPlaywright(company, config) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const jobs = [];
  
  try {
    const page = await context.newPage();
    console.log(`  Navigating: ${company.careers_url}`);
    
    await page.goto(company.careers_url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    
    // Get page content
    const content = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    
    // Use LLM to extract job listings
    const extractionPrompt = `
Extract all job listings from this career page content.

COMPANY: ${company.name}
PAGE TEXT:
${text.substring(0, 8000)}

Return ONLY a JSON array of jobs:
[
  {
    "title": "Job Title",
    "location": "Location or Remote",
    "department": "Department (if mentioned)",
    "url": "Full job URL or relative path"
  }
]

Rules:
- Only include real job listings, not navigation/menu items
- If URL is relative, prepend: ${new URL(company.careers_url).origin}
- Skip internships and junior roles (unless specified)
- Return empty array [] if no jobs found`;

    const llmResponse = await callLLM(extractionPrompt);
    
    // Parse JSON from LLM response
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const listings = JSON.parse(jsonMatch[0]);
      
      for (const job of listings) {
        jobs.push({
          title: job.title,
          company: company.name,
          location: job.location || 'Remote/Unknown',
          url: job.url?.startsWith('http') ? job.url : new URL(job.url, company.careers_url).href,
          department: job.department || '',
          source: 'playwright-llm',
          description: ''
        });
      }
    }
    
    console.log(`  Found ${jobs.length} jobs via LLM extraction`);
    
  } catch (e) {
    console.error(`  Error scanning ${company.name}:`, e.message);
  } finally {
    await browser.close();
  }
  
  return jobs;
}

// Filter jobs by title relevance
async function filterJobsByTitle(jobs, titleFilter, config) {
  const positive = titleFilter.positive || [];
  const negative = titleFilter.negative || [];
  
  // Quick keyword filtering first
  const keywordFiltered = jobs.filter(job => {
    const title = job.title.toLowerCase();
    const hasPositive = positive.some(p => title.includes(p.toLowerCase()));
    const hasNegative = negative.some(n => title.includes(n.toLowerCase()));
    return hasPositive && !hasNegative;
  });
  
  console.log(`  Keyword filtering: ${jobs.length} → ${keywordFiltered.length}`);
  
  // LLM-based relevance scoring for remaining
  if (config.use_llm_filter && keywordFiltered.length > 0) {
    const scored = [];
    
    for (const job of keywordFiltered.slice(0, config.max_llm_filter || 20)) {
      const prompt = `
Score this job's relevance for an experienced ${config.target_role || 'Software Engineer'}.

JOB: ${job.title} at ${job.company}
${job.description ? `DESCRIPTION: ${job.description.substring(0, 500)}` : ''}

Score 0-100 where:
- 80-100: Perfect match (senior level, relevant tech stack)
- 60-79: Good match (relevant but some gaps)
- 40-59: Okay match (stretch role)
- 0-39: Poor match (wrong level, wrong stack)

Return ONLY a number (0-100).`;

      try {
        const scoreText = await callLLM(prompt);
        const score = parseInt(scoreText.match(/\d+/)?.[0] || '50');
        
        if (score >= (config.min_relevance_score || 60)) {
          scored.push({ ...job, relevance_score: score });
        }
      } catch (e) {
        scored.push({ ...job, relevance_score: 50 }); // Default if LLM fails
      }
      
      // Rate limiting
      await sleep(1000);
    }
    
    return scored.sort((a, b) => b.relevance_score - a.relevance_score);
  }
  
  return keywordFiltered.map(j => ({ ...j, relevance_score: 50 }));
}

// Main scan function
async function runLLMAgnosticScan(options = {}) {
  console.log('\n🔍 LLM-Agnostic Career Ops Scanner\n');
  console.log(`Using LLM: ${LLM_CONFIG.provider} (${LLM_CONFIG.model})\n`);
  
  // Load config
  const portalsPath = join(DATA_DIR, 'portals.yml');
  if (!existsSync(portalsPath)) {
    console.error('portals.yml not found');
    process.exit(1);
  }
  
  const config = YAML.load(readFileSync(portalsPath, 'utf8'));
  const companies = (config.tracked_companies || [])
    .filter(c => c.enabled !== false)
    .slice(0, options.limit || 50);
  
  console.log(`Scanning ${companies.length} companies...\n`);
  
  const allJobs = [];
  
  for (const company of companies) {
    console.log(`${company.name}:`);
    let jobs = [];
    
    // Method 1: Greenhouse API (fastest, no browser)
    if (company.api) {
      const slug = company.api.match(/boards\/([^/]+)/)?.[1];
      if (slug) {
        jobs = await scanGreenhouseAPI(slug);
        console.log(`  Greenhouse API: ${jobs.length} jobs`);
      }
    }
    
    // Method 2: Playwright + LLM extraction
    if (jobs.length === 0 && company.careers_url) {
      jobs = await scanWithPlaywright(company, config);
    }
    
    allJobs.push(...jobs);
    
    // Rate limiting between companies
    await sleep(3000);
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total raw jobs: ${allJobs.length}`);
  
  // Filter by title
  console.log('\nFiltering by title relevance...');
  const filtered = await filterJobsByTitle(allJobs, config.title_filter, {
    use_llm_filter: options.smart_filter !== false,
    target_role: config.target_roles?.primary?.[0] || 'Software Engineer',
    max_llm_filter: 20,
    min_relevance_score: 60
  });
  
  console.log(`Filtered to: ${filtered.length} relevant jobs`);
  
  // Save results
  const output = {
    scanned_at: new Date().toISOString(),
    llm_provider: LLM_CONFIG.provider,
    llm_model: LLM_CONFIG.model,
    source: 'llm-agnostic-scanner',
    total_companies: companies.length,
    total_jobs: filtered.length,
    jobs: filtered
  };
  
  const outputPath = join(DATA_DIR, 'jobs_raw.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Saved to: ${outputPath}`);
  console.log(`\nNext: Run evaluator to score these jobs`);
  console.log(`  cd evaluator && node src/index.js`);
  
  return output;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// CLI
const args = process.argv.slice(2);
const options = {
  limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 50,
  smart_filter: !args.includes('--no-smart-filter')
};

runLLMAgnosticScan(options).catch(console.error);

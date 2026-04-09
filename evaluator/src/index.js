#!/usr/bin/env node

/**
 * Unhireable Evaluator - A-F Job Scoring
 * 
 * Evaluates scanned jobs against your CV using any AI provider.
 * Supports: OpenAI, Anthropic, Google, Ollama (local), or custom API.
 */

import { program } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'js-yaml';
import dotenv from 'dotenv';

// Load .env file
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const CONFIG_PATH = join(DATA_DIR, 'config.yml');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

program
  .name('unhireable-evaluator')
  .description('Evaluate job matches using AI')
  .version('1.0.0')
  .option('-i, --input <path>', 'Input jobs JSON', join(DATA_DIR, 'jobs_raw.json'))
  .option('-o, --output <path>', 'Output file', join(DATA_DIR, 'jobs_evaluated.json'))
  .option('-c, --config <path>', 'Config file', CONFIG_PATH)
  .option('--limit <number>', 'Max jobs to evaluate', '50')
  .parse();

const options = program.opts();

console.log(chalk.blue.bold('🎯 Unhireable Evaluator'));
console.log(chalk.gray(`Input: ${options.input}`));
console.log();

// Load or create config
function loadConfig() {
  if (!existsSync(options.config)) {
    const defaultConfig = {
      ai: {
        provider: 'openai', // openai, anthropic, google, ollama
        api_key: 'YOUR_API_KEY_HERE',
        model: 'gpt-4o-mini', // or claude-3-haiku, gemini-pro, etc.
        base_url: null // for Ollama: http://localhost:11434
      },
      cv: {
        name: 'Your Name',
        title: 'Senior Software Engineer',
        summary: 'Experienced full-stack developer...',
        skills: ['React', 'Node.js', 'Python', 'AWS'],
        experience_years: 5,
        location: 'Remote',
        salary_target: { min: 150000, max: 200000, currency: 'USD' }
      },
      preferences: {
        remote_only: true,
        avoid_keywords: ['Java', 'PHP', 'WordPress'],
        target_roles: ['Senior Engineer', 'Staff Engineer', 'Tech Lead']
      },
      evaluation: {
        min_score: 3.0, // Only keep jobs scoring 3.0+
        blocks: ['A', 'B', 'C', 'D', 'E'] // A-F, can reduce for speed
      }
    };
    
    writeFileSync(options.config, YAML.dump(defaultConfig));
    console.log(chalk.yellow('Created default config at:'), options.config);
    console.log(chalk.yellow('Please edit it with your API key and CV details'));
    process.exit(1);
  }
  
  const config = YAML.load(readFileSync(options.config, 'utf8'));
  
  // Load API keys from environment variables (override config file)
  if (process.env.GEMINI_API_KEY) {
    config.ai.api_key = process.env.GEMINI_API_KEY;
  }
  if (process.env.OPENAI_API_KEY) {
    config.ai.api_key = process.env.OPENAI_API_KEY;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    config.ai.api_key = process.env.ANTHROPIC_API_KEY;
  }
  
  return config;
}

async function evaluateJob(job, config) {
  const prompt = buildEvaluationPrompt(job, config);
  
  try {
    const response = await callAI(prompt, config.ai);
    const evaluation = parseAIResponse(response, job);
    return evaluation;
  } catch (error) {
    console.error(chalk.red(`Failed to evaluate ${job.title}:`, error.message));
    return {
      ...job,
      score: 0,
      recommendation: 'SKIP',
      error: error.message
    };
  }
}

function buildEvaluationPrompt(job, config) {
  return `Evaluate this job against the candidate's profile.

## JOB
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
URL: ${job.url}

## CANDIDATE PROFILE
Name: ${config.cv.name}
Title: ${config.cv.title}
Summary: ${config.cv.summary}
Skills: ${config.cv.skills.join(', ')}
Experience: ${config.cv.experience_years} years
Target Salary: $${config.cv.salary_target.min}-${config.cv.salary_target.max}
Location Preference: ${config.cv.location}

## PREFERENCES
Remote Only: ${config.preferences.remote_only}
Avoid: ${config.preferences.avoid_keywords.join(', ')}
Target Roles: ${config.preferences.target_roles.join(', ')}

## EVALUATION CRITERIA (Score 1.0-5.0)

**Block A: Role Fit (1-5)**
- Title matches target roles?
- Seniority appropriate?
- Domain expertise required?

**Block B: Skills Match (1-5)**
- Required skills vs candidate skills
- Missing critical skills?
- Transferable experience?

**Block C: Logistics (1-5)**
- Location/remote compatible?
- Salary range acceptable?
- No red-flag keywords?

**Block D: Company Quality (1-5)**
- Company reputation
- Role clarity in JD
- Growth potential

## OUTPUT FORMAT
Return ONLY valid JSON:
{
  "score": 4.2,
  "recommendation": "APPLY" | "CONSIDER" | "SKIP",
  "blocks": {
    "A": { "score": 4, "reason": "..." },
    "B": { "score": 4, "reason": "..." },
    "C": { "score": 5, "reason": "..." },
    "D": { "score": 4, "reason": "..." }
  },
  "summary": "One-line recommendation",
  "cv_highlights": ["skill1", "skill2"],
  "interview_prep": ["STAR story 1", "STAR story 2"],
  "tailored_summary": "2-sentence summary for this specific job"
}`;
}

async function callAI(prompt, aiConfig) {
  // Support multiple AI providers
  switch (aiConfig.provider) {
    case 'openai':
      return await callOpenAI(prompt, aiConfig);
    case 'anthropic':
      return await callAnthropic(prompt, aiConfig);
    case 'gemini':
    case 'google':
      return await callGemini(prompt, aiConfig);
    case 'ollama':
      return await callOllama(prompt, aiConfig);
    case 'lmstudio':
    case 'lm-studio':
      return await callLMStudio(prompt, aiConfig);
    default:
      throw new Error(`Unknown provider: ${aiConfig.provider}`);
  }
}

async function callOpenAI(prompt, config) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(prompt, config) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.api_key,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.content[0].text;
}

async function callGemini(prompt, config) {
  const apiKey = config.api_key;
  const model = config.model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callOllama(prompt, config) {
  const baseUrl = config.base_url || 'http://localhost:11434';
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'llama2',
      prompt: prompt,
      stream: false
    })
  });
  
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.response;
}

async function callLMStudio(prompt, config) {
  const baseUrl = config.base_url || 'http://localhost:1234/v1';
  
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.api_key || 'lm-studio'}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model || 'local',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LM Studio error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

function parseAIResponse(text, job) {
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }
  
  const parsed = JSON.parse(jsonMatch[0]);
  
  return {
    ...job,
    score: parsed.score,
    recommendation: parsed.recommendation,
    blocks: parsed.blocks,
    summary: parsed.summary,
    cv_highlights: parsed.cv_highlights,
    interview_prep: parsed.interview_prep,
    tailored_summary: parsed.tailored_summary,
    evaluated_at: new Date().toISOString()
  };
}

async function main() {
  const config = loadConfig();
  
  // Load scanned jobs
  if (!existsSync(options.input)) {
    console.error(chalk.red('No jobs file found. Run scanner first.'));
    process.exit(1);
  }
  
  const jobsData = JSON.parse(readFileSync(options.input, 'utf8'));
  const jobs = jobsData.jobs || [];
  
  console.log(chalk.blue(`Evaluating ${Math.min(jobs.length, options.limit)} jobs...`));
  console.log(chalk.gray(`AI Provider: ${config.ai.provider}`));
  console.log();
  
  const evaluated = [];
  const limit = Math.min(jobs.length, parseInt(options.limit));
  
  for (let i = 0; i < limit; i++) {
    const job = jobs[i];
    process.stdout.write(chalk.gray(`[${i + 1}/${limit}] ${job.title.substring(0, 40)}... `));
    
    const result = await evaluateJob(job, config);
    evaluated.push(result);
    
    const color = result.score >= 4 ? 'green' : result.score >= 3 ? 'yellow' : 'red';
    console.log(chalk[color](`Score: ${result.score} - ${result.recommendation}`));
    
    // Rate limit: 5 min delay between Gemini requests (1/5 RPM limit)
    if (config.ai.provider === 'gemini' && i < limit - 1) {
      console.log(chalk.gray('  ⏳ Waiting 5 min for rate limit...'));
      await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    }
  }
  
  // Filter to good matches only
  const goodMatches = evaluated.filter(j => j.score >= config.evaluation.min_score);
  
  const output = {
    evaluated_at: new Date().toISOString(),
    total_evaluated: evaluated.length,
    good_matches: goodMatches.length,
    ai_provider: config.ai.provider,
    jobs: evaluated.sort((a, b) => b.score - a.score)
  };
  
  writeFileSync(options.output, JSON.stringify(output, null, 2));
  
  console.log();
  console.log(chalk.green.bold(`✅ Evaluated ${evaluated.length} jobs`));
  console.log(chalk.green(`${goodMatches.length} good matches (score >= ${config.evaluation.min_score})`));
  console.log(chalk.gray(`Saved to: ${options.output}`));
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Direct LLM Evaluator
 * 
 * Evaluates jobs without OpenCode CLI - calls LLM APIs directly
 * Enables full automation of the pipeline
 * 
 * Usage: node evaluator/direct-evaluator.mjs [--model=groq|gemini|mistral]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');

// Default model
let MODEL = 'groq';

// Parse args
process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--model=')) {
        MODEL = arg.split('=')[1];
    }
});

// API Keys from environment
const API_KEYS = {
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    mistral: process.env.MISTRAL_API_KEY
};

console.log(`🚀 Direct LLM Evaluator (Model: ${MODEL})`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check for API key
if (!API_KEYS[MODEL]) {
    console.error(`❌ ${MODEL.toUpperCase()}_API_KEY not set in environment`);
    console.log('\nSet it with:');
    console.log(`export ${MODEL.toUpperCase()}_API_KEY="your-key-here"`);
    process.exit(1);
}

// Load jobs
const jobsPath = join(DATA_DIR, 'jobs_raw.json');
if (!existsSync(jobsPath)) {
    console.error('❌ jobs_raw.json not found. Run scanner first.');
    process.exit(1);
}

const jobs = JSON.parse(readFileSync(jobsPath, 'utf8'));
console.log(`📋 Loaded ${jobs.length} jobs from scanner`);

// Load CV
const cvPath = join(DATA_DIR, 'cv.txt');
if (!existsSync(cvPath)) {
    console.error('❌ cv.txt not found. Add your CV to data/cv.txt');
    process.exit(1);
}

const userCV = readFileSync(cvPath, 'utf8');
console.log('📄 Loaded CV');

// Load config for preferences
let userPreferences = {};
const configPath = join(DATA_DIR, 'config.yml');
if (existsSync(configPath)) {
    const configText = readFileSync(configPath, 'utf8');
    // Simple YAML parsing for preferences section
    const prefMatch = configText.match(/preferences:\n([\s\S]*?)(?:\n\w|$)/);
    if (prefMatch) {
        const lines = prefMatch[1].split('\n');
        lines.forEach(line => {
            const match = line.match(/\s+(\w+):\s*(.+)/);
            if (match) {
                userPreferences[match[1]] = match[2].replace(/"/g, '');
            }
        });
    }
}

console.log('⚙️  Loaded preferences:', Object.keys(userPreferences).join(', ') || 'none');
console.log('\n⏳ Starting evaluation...\n');

// Evaluation prompt template
function buildPrompt(job, cv, prefs) {
    return `You are an expert career coach evaluating job fit.

Evaluate this job against the candidate's profile and provide structured scoring.

## CANDIDATE PROFILE
${cv}

## PREFERENCES
${Object.entries(prefs).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- None specified'}

## JOB TO EVALUATE
**Title:** ${job.title}
**Company:** ${job.company}
**Location:** ${job.location || 'Not specified'}
**Description:**
${job.description?.substring(0, 1500) || 'No description'}

## EVALUATION INSTRUCTIONS
Score each category 1-5 and provide brief reasoning:

A. Role Fit - How well does the title/level match candidate's experience?
B. Skills Match - How well do required skills align with candidate's skills?
C. Logistics - Are location, visa, timing compatible with preferences?
D. Company Quality - Is this a good company (funding, reputation, growth)?

Overall Score: Average of A-D (round to 1 decimal)
Recommendation: APPLY (4.0+), CONSIDER (3.0-3.9), or SKIP (<3.0)

## OUTPUT FORMAT (JSON)
{
  "blocks": {
    "A": { "score": 1-5, "reason": "brief explanation" },
    "B": { "score": 1-5, "reason": "brief explanation" },
    "C": { "score": 1-5, "reason": "brief explanation" },
    "D": { "score": 1-5, "reason": "brief explanation" }
  },
  "score": 1.0-5.0,
  "recommendation": "APPLY|CONSIDER|SKIP",
  "summary": "2-3 sentence summary of fit",
  "cv_highlights": ["skill1", "skill2"],
  "interview_prep": ["STAR story suggestion 1", "STAR story suggestion 2"]
}

Respond with ONLY the JSON object, no other text.`;
}

// Call LLM API
async function callLLM(prompt) {
    switch (MODEL) {
        case 'groq':
            return callGroq(prompt);
        case 'gemini':
            return callGemini(prompt);
        case 'mistral':
            return callMistral(prompt);
        default:
            throw new Error(`Unknown model: ${MODEL}`);
    }
}

async function callGroq(prompt) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEYS.groq}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are a job evaluation expert. Respond only with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2000
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGemini(prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.gemini}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2000
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callMistral(prompt) {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEYS.mistral}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
                { role: 'system', content: 'You are a job evaluation expert. Respond only with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2000
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Mistral API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Parse JSON from LLM response
function parseEvaluation(text) {
    // Try to extract JSON from markdown code blocks or raw text
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || 
                      text.match(/```\n?([\s\S]*?)\n?```/) ||
                      text.match(/(\{[\s\S]*\})/);
    
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse JSON:', e);
            return null;
        }
    }
    return null;
}

// Evaluate all jobs
async function evaluateAll() {
    const evaluatedJobs = [];
    const errors = [];

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        console.log(`[${i + 1}/${jobs.length}] Evaluating: ${job.company} - ${job.title}`);

        try {
            const prompt = buildPrompt(job, userCV, userPreferences);
            const response = await callLLM(prompt);
            const evaluation = parseEvaluation(response);

            if (evaluation) {
                evaluatedJobs.push({
                    ...job,
                    ...evaluation,
                    _evaluated: true,
                    _evaluatedAt: new Date().toISOString(),
                    _evaluator: `direct-${MODEL}`
                });
                console.log(`  ✅ Score: ${evaluation.score}/5 - ${evaluation.recommendation}`);
            } else {
                throw new Error('Failed to parse evaluation');
            }

            // Rate limiting - wait between requests
            if (i < jobs.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }

        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            errors.push({ job: job.url, error: err.message });
            
            // Add job with error marker
            evaluatedJobs.push({
                ...job,
                _evaluated: false,
                _error: err.message,
                score: 0,
                recommendation: 'ERROR'
            });
        }
    }

    // Save results
    const outputPath = join(DATA_DIR, 'jobs_evaluated.json');
    writeFileSync(outputPath, JSON.stringify(evaluatedJobs, null, 2));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Evaluation Complete!');
    console.log(`📊 Total: ${evaluatedJobs.length} jobs`);
    console.log(`✓ Successful: ${evaluatedJobs.filter(j => j._evaluated).length}`);
    console.log(`✗ Errors: ${errors.length}`);
    console.log(`\n📁 Saved to: ${outputPath}`);
    
    // Summary by recommendation
    const byRec = {};
    evaluatedJobs.filter(j => j.recommendation).forEach(j => {
        byRec[j.recommendation] = (byRec[j.recommendation] || 0) + 1;
    });
    
    console.log('\n📈 Recommendations:');
    Object.entries(byRec).forEach(([rec, count]) => {
        console.log(`  ${rec}: ${count}`);
    });

    if (errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        errors.forEach(e => console.log(`  - ${e.job}: ${e.error}`));
        process.exit(1);
    }
}

// Run
evaluateAll().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});

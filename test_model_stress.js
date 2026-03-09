/**
 * Unhireable LLM Stress Test
 * Tests Qwen3.5 models on complex job application questions.
 * Uses the native Ollama /api/chat endpoint which is more reliable.
 */
const fs = require('fs');
const https = require('https');
const http = require('http');

const MODELS = ['qwen3.5:0.8b', 'qwen3.5:2b', 'qwen3.5:4b'];

const RESUME_CONTEXT = `
Experienced Full Stack Engineer with a strong track record of driving revenue growth.
- Led the launch of the AI Auto-Apply feature resulting in a 30% increase in user retention.
- Ran a growth experiment testing a free trial paywall that lifted conversion by 15%.
- Architected and deployed scalable backend microservices reducing API latency by 40%.
Skills: JavaScript, React, Rust, PostgreSQL, TypeScript, Node.js, AWS, Docker.
`;

const QUESTIONS = [
    { id: "impact", label: "Briefly describe a product or feature you've worked on that had a measurable business impact. What was your role?", type: "textarea" },
    { id: "growth", label: "Tell us about a growth experiment you participated in or led. What was the hypothesis, how was it tested, and what did you learn?", type: "textarea" },
    { id: "why_us", label: "Why does Articulate and our engineering culture stand out to you?", type: "textarea" },
    { id: "tech", label: "Which 3 technologies are you most proficient in and why?", type: "textarea" }
];

const SYSTEM_PROMPT = `You are a professional job application assistant filling out a job application on behalf of the candidate.
JOB: Software Engineer II at Articulate. Articulate makes software that helps organizations train their teams.
RESUME: ${RESUME_CONTEXT}

Respond ONLY with a valid JSON object mapping field IDs to string answers. No markdown, no explanation, no thinking tags.
Be specific and use the resume context. Reference projects and metrics. Connect experience to Articulate when answering "why_us".`;

const USER_PROMPT = `Fill these fields: ${JSON.stringify(QUESTIONS.map(q => ({ id: q.id, label: q.label })))}`;

function httpPost(url, body, timeoutMs) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || 11434,
            path: parsed.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };

        const req = http.request(options, (res) => {
            let chunks = '';
            res.on('data', (chunk) => chunks += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(chunks)); }
                catch (e) { reject(new Error(`JSON parse error: ${e.message} | Raw: ${chunks.substring(0, 200)}`)); }
            });
        });

        req.setTimeout(timeoutMs, () => {
            req.destroy();
            reject(new Error(`TIMED OUT after ${timeoutMs / 1000}s`));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function testModel(model) {
    const results = { model, durationSec: null, status: null, answers: null, error: null };

    // Warmup: get model into memory with a minimal prompt
    console.log(`   [Warmup: loading ${model} into memory... (up to 90s)]`);
    const warmupStart = Date.now();
    try {
        await httpPost('http://localhost:11434/api/generate', {
            model,
            prompt: 'Say "ready"',
            stream: false
        }, 90000);
        console.log(`   [Warm in ${((Date.now() - warmupStart) / 1000).toFixed(1)}s]`);
    } catch (e) {
        console.log(`   [Warmup timed out: ${e.message} — proceeding anyway]`);
    }

    // Main generation
    console.log(`   [Running main generation...]`);
    const start = Date.now();
    try {
        const data = await httpPost('http://localhost:11434/api/chat', {
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: USER_PROMPT }
            ],
            options: { num_ctx: 4096, num_predict: 1024, temperature: 0.3 },
            format: 'json',
            stream: false
        }, 120000); // 2 minute max

        results.durationSec = ((Date.now() - start) / 1000).toFixed(2);
        const raw = data?.message?.content || '';

        try {
            results.answers = JSON.parse(raw);
            results.status = 'SUCCESS';
            console.log(`   ✅ Done in ${results.durationSec}s`);
        } catch (e) {
            results.status = 'JSON_PARSE_ERROR';
            results.error = `Raw: ${raw.substring(0, 300)}`;
            console.log(`   ❌ JSON Error in ${results.durationSec}s`);
        }
    } catch (e) {
        results.durationSec = ((Date.now() - start) / 1000).toFixed(2);
        results.status = 'FETCH_ERROR';
        results.error = e.message;
        console.log(`   ❌ Error in ${results.durationSec}s: ${e.message}`);
    }
    return results;
}

function scoreAnswer(text) {
    if (!text || typeof text !== 'string') return 0;
    let score = 0;
    // Reward metrics and percentages
    if (/\d+%/.test(text)) score += 3;
    if (/\d/.test(text)) score += 1;
    // Reward length (2-3 sentences = good)
    const words = text.split(/\s+/).length;
    if (words >= 20) score += 2;
    if (words >= 40) score += 2;
    if (words >= 80) score -= 1; // too verbose
    // Penalize generic phrases
    if (/motivated professional|excited about this opportunity|align well|look forward/i.test(text)) score -= 3;
    // Reward specificity
    if (/rust|typescript|react|aws|postgres|docker|node/i.test(text)) score += 1;
    if (/auto-apply|articulate|retention|latency|paywall/i.test(text)) score += 2;
    return Math.max(0, score);
}

async function runAll() {
    console.log("=== UNHIREABLE LLM STRESS TEST ===");
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Models: ${MODELS.join(', ')}`);
    console.log(`Questions: ${QUESTIONS.length}\n`);

    const allResults = [];

    for (const model of MODELS) {
        console.log(`\n🚀 MODEL: ${model}`);
        const result = await testModel(model);
        allResults.push(result);
    }

    // Build report
    let md = "# Unhireable LLM Stress Test Results\n\n";
    md += `Tested: ${new Date().toISOString()}\n\n`;

    // Summary table
    md += "## Summary\n\n";
    md += "| Model | Status | Speed | Avg Quality Score |\n";
    md += "|-------|--------|-------|------------------|\n";

    for (const r of allResults) {
        let avgScore = 0;
        if (r.answers) {
            const scores = QUESTIONS.map(q => scoreAnswer(r.answers[q.id]));
            avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        }
        const status = r.status === 'SUCCESS' ? '✅' : '❌';
        md += `| \`${r.model}\` | ${status} ${r.status} | ${r.durationSec}s | ${avgScore}/9 |\n`;
    }

    md += "\n## Detailed Answers\n\n";

    for (const r of allResults) {
        md += `### \`${r.model}\` — ${r.durationSec}s\n\n`;
        if (r.status !== 'SUCCESS') {
            md += `**Error**: \`${r.error}\`\n\n`;
            continue;
        }
        for (const q of QUESTIONS) {
            const answer = r.answers?.[q.id] || '(no answer)';
            const score = scoreAnswer(answer);
            md += `**Q:** ${q.label}\n`;
            md += `**Score:** ${score}/9\n`;
            md += `**A:** ${answer}\n\n`;
        }
    }

    // Verdict
    md += "## Verdict\n\n";
    const successful = allResults.filter(r => r.status === 'SUCCESS');
    if (successful.length > 0) {
        const ranked = successful.sort((a, b) => {
            const scoreA = QUESTIONS.map(q => scoreAnswer(a.answers?.[q.id])).reduce((x, y) => x + y, 0);
            const scoreB = QUESTIONS.map(q => scoreAnswer(b.answers?.[q.id])).reduce((x, y) => x + y, 0);
            return scoreB - scoreA;
        });
        md += `🏆 **Best Quality**: \`${ranked[0].model}\`\n`;
        const fastest = successful.slice().sort((a, b) => parseFloat(a.durationSec) - parseFloat(b.durationSec));
        md += `⚡ **Fastest**: \`${fastest[0].model}\` (${fastest[0].durationSec}s)\n`;
        const vpsOptimal = successful.find(r => r.model.includes('2b') || r.model.includes('4b'));
        if (vpsOptimal) md += `🖥️ **Best VPS Value**: \`${vpsOptimal.model}\` (quality + RAM balance)\n`;
    }

    const outPath = '/Users/mac/.gemini/antigravity/brain/d1ff0b5c-2abd-4da7-afd8-378f853dfb13/model_comparison_results.md';
    fs.writeFileSync(outPath, md);
    console.log(`\n\n✅ Results saved to: ${outPath}`);

    // Print summary to console
    console.log("\n=== RESULTS SUMMARY ===");
    for (const r of allResults) {
        console.log(`${r.model}: ${r.status} in ${r.durationSec}s`);
        if (r.answers) {
            console.log(`  impact:  "${(r.answers.impact || '').substring(0, 80)}..."`);
        } else {
            console.log(`  Error: ${r.error?.substring(0, 100)}`);
        }
    }
}

runAll();

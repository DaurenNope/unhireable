const fs = require('fs');

async function testOllamaComparison(modelName) {
    const prompt = `
    SYSTEM: You are a professional job application assistant.
    JOB: Software Engineer II at Articulate
    RESUME: Experienced Full Stack Engineer with a strong track record of driving revenue growth and spearheading product launches at TechCorp and Startup Inc. Led the launch of the AI Auto-Apply feature resulting in a 30% increase in user retention. Ran a growth experiment testing a free trial paywall that lifted conversion by 15%. Skilled in JavaScript, React, Rust, PostgreSQL, TypeScript. 
    
    FIELDS TO FILL:
    [{"id":"impact","label":"Briefly describe a product or feature you've worked on that had a measurable business impact. What was your role?","type":"textarea"}]
    
    INSTEAD — Be specific:
    - For behavioral and technical questions: Answer substantively (2-3 sentences) using the provided experience, skills, and resume snippet. Do NOT leave these blank. Highlight relevant past projects and metrics from the candidate's profile.
    Respond ONLY with a JSON object mapping field IDs to answers. Every field listed MUST have a corresponding answer in the JSON output, even if it is a best effort. No markdown, no explanation.
    `;

    const body = {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        options: { num_ctx: 4096, num_predict: 2048 },
        temperature: 0.3,
        response_format: { type: 'json_object' }
    };

    console.log(`\\n========================================`);
    console.log(`Testing Model: ${modelName}`);
    console.log(`========================================\\n`);

    const startTime = Date.now();
    try {
        const resp = await fetch('http://localhost:11434/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const durationStr = ((Date.now() - startTime) / 1000).toFixed(2);

        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || data.error?.message || '';

        try {
            const parsed = JSON.parse(text);
            console.log(`✅ SUCCESS (${durationStr}s):`);
            console.dir(parsed, { depth: null, colors: true });
        } catch (e) {
            console.log(`❌ ERROR: Invalid JSON generated (${durationStr}s): ${e.message}`);
            console.log(`Raw output: ${text}`);
        }
    } catch (e) {
        console.log(`Fetch Error: ${e.message}`);
    }
}

(async () => {
    // We will test 2b first, then 4b
    await testOllamaComparison('qwen3.5:2b');
    await testOllamaComparison('qwen3.5:4b');
})();

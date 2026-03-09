const fs = require('fs');

async function testOllama(useNumCtx) {
    const prompt = `
    SYSTEM: You are a professional job application assistant.
    JOB: Software Engineer II at Articulate
    RESUME: Experienced Full Stack Engineer with a strong track record of driving revenue growth and spearheading product launches at TechCorp and Startup Inc. Led the launch of the AI Auto-Apply feature resulting in a 30% increase in user retention. Ran a growth experiment testing a free trial paywall that lifted conversion by 15%. Skilled in JavaScript, React, Rust, PostgreSQL, TypeScript. Note that this is a very long resume snippet to take up context window space. `.repeat(30) + `
    
    FIELDS TO FILL:
    [{"id":"impact","label":"Briefly describe a product or feature you've worked on that had a measurable business impact. What was your role?","type":"textarea"}]
    
    INSTEAD — Be specific:
    - For behavioral and technical questions: Answer substantively (2-3 sentences) using the provided experience, skills, and resume snippet. Do NOT leave these blank. Highlight relevant past projects and metrics from the candidate's profile.
    Respond ONLY with a JSON object mapping field IDs to answers. Every field listed MUST have a corresponding answer in the JSON output, even if it is a best effort. No markdown, no explanation.
    Example: {"impact": "At TechCorp, I led the launch of..."}
    `;

    const body = {
        model: 'qwen3.5:0.8b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
    };

    if (useNumCtx) {
        body.options = { num_ctx: 4096, num_predict: 2048 };
    }

    console.log(`Testing with num_ctx: ${useNumCtx}`);
    try {
        const resp = await fetch('http://localhost:11434/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || data.error?.message || '';
        console.log(`Response length: ${text.length}`);

        try {
            JSON.parse(text);
            console.log(`✅ SUCCESS: Valid JSON generated.`);
            console.log(text);
        } catch (e) {
            console.log(`❌ ERROR: Invalid JSON generated (Truncated): ${e.message}`);
            console.log(`Raw output: ${text}`);
        }
    } catch (e) {
        console.log(`Fetch Error: ${e.message}`);
    }
}

(async () => {
    console.log("--- TEST WITHOUT num_ctx (How it used to be) ---");
    await testOllama(false);
    console.log("\\n--- TEST WITH num_ctx (My Fix) ---");
    await testOllama(true);
})();

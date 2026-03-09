const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const extensionPath = path.resolve(__dirname, 'chrome-extension');
    const userDataDir = path.resolve(__dirname, 'playwright-test-dir');

    console.log("Launching Chromium with Unhireable extension...");
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`
        ]
    });

    let [backgroundWorker] = browser.serviceWorkers();
    if (!backgroundWorker) {
        backgroundWorker = await browser.waitForEvent('serviceworker');
    }

    console.log("Configuring Extension Storage for Local LLM (Ollama)...");
    await backgroundWorker.evaluate(async () => {
        await chrome.storage.local.set({
            activeLLM: 'local',
            llmLocalUrl: 'http://localhost:11434',
            llmLocalModel: 'qwen3.5:0.8b'
        });
        console.log("Storage configured.");
    });

    const page = await browser.newPage();

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Unhireable') || text.includes('UHLog') || text.includes('UH:warn') || msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${text}`);
        }
    });

    console.log("Navigating to boards.greenhouse.io...");
    await page.goto('https://boards.greenhouse.io/figma/jobs/5460515004', { waitUntil: 'load' }).catch(() => { });

    console.log("Injecting mock job application form...");
    await page.evaluate(() => {
        document.body.innerHTML = `
            <div style="padding: 50px; font-family: sans-serif;">
                <h2>Test Job Application</h2>
                <form id="test-form">
                    <fieldset class="form-section">
                        <label class="t-16">Briefly describe a product or feature you've worked on that had a measurable business impact. What was your role?</label>
                        <textarea id="impact" name="impact" rows="4" cols="50"></textarea>

                        <br><br>
                        <label class="t-16">Tell us about a growth experiment you participated in or led.</label>
                        <textarea id="growth" name="growth" rows="4" cols="50"></textarea>

                        <br><br>
                        <label class="t-16">Which 3 technologies are you most proficient in?</label>
                        <input type="text" id="tech" name="tech" size="50"/>
                    </fieldset>
                </form>
            </div>
        `;
    });

    console.log("Waiting for extension to initialize...");
    await page.waitForTimeout(3000);

    console.log("Sending fillForm command to content script via Background Worker...");
    const result = await backgroundWorker.evaluate(async () => {
        const profile = {
            personal_info: { name: 'Test Engineer', years_experience: '5' },
            summary: 'Experienced Full Stack Engineer with a strong track record of driving revenue growth and spearheading product launches at TechCorp and Startup Inc.',
            skills: { technical_skills: ['JavaScript', 'React', 'Rust', 'PostgreSQL', 'TypeScript'] },
            experience: [
                { company: 'TechCorp', position: 'Senior Engineer', description: ['Led the launch of the AI Auto-Apply feature resulting in a 30% increase in user retention.', 'Ran a growth experiment testing a free trial paywall that lifted conversion by 15%.'], technologies: ['React', 'Node'] }
            ]
        };
        const job = { title: 'Software Engineer II', company: 'Articulate' };

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return { error: "No active tab found!" };

        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'fillForm',
                profile: profile,
                job: job,
                autoSubmit: false
            }, (res) => {
                if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
                else resolve(res);
            });
        });
    });

    console.log("Extension response to fillForm trigger:", result);

    console.log("Waiting 20 seconds for LLM generation and form filling to finish...");
    await page.waitForTimeout(20000);

    const fields = await page.evaluate(() => {
        return {
            impact: document.getElementById('impact')?.value || '',
            growth: document.getElementById('growth')?.value || '',
            tech: document.getElementById('tech')?.value || ''
        };
    });

    console.log("\\n============= FORM VALUES AFTER FILL =============");
    console.log(JSON.stringify(fields, null, 2));
    console.log("==================================================\\n");

    await browser.close();
    console.log("Test Complete.");
})();

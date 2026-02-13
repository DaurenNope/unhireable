/**
 * Unhireable Auto-Apply - Content Script
 * Runs on job application pages to detect ATS and fill forms
 */

// Default profile - will be loaded from storage
let userProfile = {
    name: "Dauren Nurseitov",
    email: "dauren.nope@gmail.com",
    phone: "+1234567890",
    linkedin: "https://linkedin.com/in/dauren",
    github: "https://github.com/daurenm",
    portfolio: "",
    location: "Remote",
    skills: ["Python", "Solidity", "JavaScript", "TypeScript", "FastAPI"],
    experience_summary: "Founder at Rahmet Labs with experience in DeFi, blockchain, and full-stack development."
};

// ATS Detection
function detectATS() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    if (hostname.includes('ashbyhq.com')) return 'ashby';
    if (hostname.includes('greenhouse.io')) return 'greenhouse';
    if (hostname.includes('lever.co')) return 'lever';
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('workday.com')) return 'workday';

    return 'unknown';
}

// Human-like typing delay
function randomDelay(min = 30, max = 80) {
    return Math.floor(Math.random() * (max - min) + min);
}

// Wait for element to appear
async function waitForElement(selector, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el && el.offsetParent !== null) return el;
        await new Promise(r => setTimeout(r, 200));
    }
    return null;
}

// Wait for any of multiple selectors
async function waitForAnyElement(selectors, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.offsetParent !== null) return el;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    return null;
}

// Type text character by character
async function humanType(element, text) {
    element.focus();
    element.value = '';

    for (const char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, randomDelay()));
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Fill input by various selectors
async function fillField(selectors, value) {
    for (const selector of selectors) {
        try {
            const el = document.querySelector(selector);
            if (el && el.offsetParent !== null) {
                await humanType(el, value);
                console.log(`[Unhireable] Filled: ${selector}`);
                return true;
            }
        } catch (e) {
            console.log(`[Unhireable] Selector failed: ${selector}`);
        }
    }
    return false;
}

// Fill by label text
async function fillByLabel(labelText, value, isTextarea = false) {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
        if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
            const forId = label.getAttribute('for');
            if (forId) {
                const input = document.getElementById(forId);
                if (input) {
                    await humanType(input, value);
                    console.log(`[Unhireable] Filled by label "${labelText}"`);
                    return true;
                }
            }
        }
    }
    return false;
}

// Click button with human-like behavior
async function clickButton(element) {
    if (!element) return false;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));

    element.click();
    console.log(`[Unhireable] Clicked button: ${element.textContent?.trim()?.substring(0, 30) || 'unknown'}`);

    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
    return true;
}

// ATS-specific adapters
const atsAdapters = {
    ashby: async (profile) => {
        console.log('[Unhireable] Running Ashby adapter...');

        // Standard fields
        await fillField(['input[name="_systemfield_name"]'], profile.name);
        await fillField(['input[name="_systemfield_email"]'], profile.email);

        // Dynamic fields by label
        await fillByLabel('LinkedIn', profile.linkedin);
        await fillByLabel('GitHub', profile.github);
        await fillByLabel('phone', profile.phone);
        await fillByLabel('portfolio', profile.portfolio);
        await fillByLabel('website', profile.portfolio || profile.github);

        return { success: true, ats: 'ashby' };
    },

    greenhouse: async (profile) => {
        console.log('[Unhireable] Running Greenhouse adapter...');

        await fillField(['#first_name', 'input[name="first_name"]'], profile.name.split(' ')[0]);
        await fillField(['#last_name', 'input[name="last_name"]'], profile.name.split(' ').slice(1).join(' '));
        await fillField(['#email', 'input[name="email"]', 'input[type="email"]'], profile.email);
        await fillField(['#phone', 'input[name="phone"]', 'input[type="tel"]'], profile.phone);

        // LinkedIn/Website fields
        await fillByLabel('LinkedIn', profile.linkedin);
        await fillByLabel('GitHub', profile.github);
        await fillByLabel('Website', profile.portfolio || profile.github);

        return { success: true, ats: 'greenhouse' };
    },

    lever: async (profile) => {
        console.log('[Unhireable] Running Lever adapter...');

        await fillField(['input[name="name"]'], profile.name);
        await fillField(['input[name="email"]'], profile.email);
        await fillField(['input[name="phone"]'], profile.phone);
        await fillField(['input[name="urls[LinkedIn]"]', 'input[placeholder*="LinkedIn"]'], profile.linkedin);
        await fillField(['input[name="urls[GitHub]"]', 'input[placeholder*="GitHub"]'], profile.github);
        await fillField(['input[name="urls[Portfolio]"]', 'input[placeholder*="Portfolio"]'], profile.portfolio);

        return { success: true, ats: 'lever' };
    },

    linkedin: async (profile) => {
        console.log('[Unhireable] Running LinkedIn Easy Apply adapter...');

        // Step 1: Detect which type of Apply button we have
        const easyApplySelectors = [
            'button.jobs-apply-button',
            'button[aria-label*="Easy Apply"]',
            '.jobs-apply-button--top-card button',
            'button[data-job-id][data-tracking-control-name="public_jobs_apply_action_top_card"]', // Specific for top card
            'button.jobs-s-apply button',
            '.jobs-unified-top-card__content--two-pane button.jobs-apply-button'
        ];

        const externalApplySelectors = [
            'a.jobs-apply-button',
            'a[href*="apply"]',
            '.jobs-apply-button--top-card a',
            'a[aria-label*="Apply"]',
            'a[data-job-id][data-tracking-control-name="public_jobs_apply_action_top_card"]' // Specific for top card
        ];

        let easyApplyBtn = null;
        let externalApplyLink = null;

        // Check for Easy Apply button
        for (const selector of easyApplySelectors) {
            easyApplyBtn = document.querySelector(selector);
            if (easyApplyBtn && easyApplyBtn.textContent?.toLowerCase().includes('easy apply')) break;
            easyApplyBtn = null;
        }

        // Check for external apply link
        for (const selector of externalApplySelectors) {
            externalApplyLink = document.querySelector(selector);
            if (externalApplyLink && !externalApplyLink.textContent?.toLowerCase().includes('easy apply')) break;
            externalApplyLink = null;
        }

        // Also try finding buttons/links by text content
        if (!easyApplyBtn && !externalApplyLink) {
            const allClickables = document.querySelectorAll('button, a');
            for (const el of allClickables) {
                const text = el.textContent?.toLowerCase()?.trim() || '';
                if (text.includes('easy apply')) {
                    easyApplyBtn = el;
                    break;
                } else if (text === 'apply' || text.includes('apply on company')) {
                    externalApplyLink = el;
                }
            }
        }

        // Handle External Apply (opens company website)
        if (!easyApplyBtn && externalApplyLink) {
            console.log('[Unhireable] External application detected - will open company website');
            console.log('[Unhireable] The extension will auto-fill on the destination ATS page (Greenhouse/Lever/etc)');

            // Highlight the link so user knows what to click
            externalApplyLink.style.outline = '3px solid #667eea';
            externalApplyLink.style.boxShadow = '0 0 15px #667eea';

            return {
                success: true,
                ats: 'linkedin',
                message: '📤 External application - click the Apply button to open company website. Auto-fill will run on the ATS page.',
                isExternal: true
            };
        }

        if (!easyApplyBtn) {
            console.log('[Unhireable] No Apply button found');
            return { success: false, ats: 'linkedin', message: 'No Apply button found on this page' };
        }

        console.log('[Unhireable] Found Easy Apply button, clicking...');
        await clickButton(easyApplyBtn);

        // Step 2: Wait for modal to appear
        const modalSelectors = [
            '.jobs-easy-apply-modal',
            '.artdeco-modal',
            '[role="dialog"]',
            '.jobs-easy-apply-content'
        ];

        const modal = await waitForAnyElement(modalSelectors, 5000);
        if (!modal) {
            console.log('[Unhireable] Modal did not appear');
            return { success: false, ats: 'linkedin', message: 'Easy Apply modal did not open' };
        }

        console.log('[Unhireable] Modal opened, starting form navigation...');

        // Step 3: Loop through form steps
        let stepCount = 0;
        const maxSteps = 10;

        while (stepCount < maxSteps) {
            stepCount++;
            console.log(`[Unhireable] Processing step ${stepCount}...`);

            // Wait a bit for page to stabilize
            await new Promise(r => setTimeout(r, 800));

            // Fill any visible form fields in this step
            await fillLinkedInFormFields(profile);

            // Check for submit button (final step)
            const submitBtn = document.querySelector(
                'button[aria-label*="Submit application"], ' +
                'button[aria-label*="submit application"], ' +
                'button.artdeco-button--primary[type="submit"]'
            );

            // Also check by text
            let submitByText = null;
            const allButtons = document.querySelectorAll('.artdeco-modal button, [role="dialog"] button');
            for (const btn of allButtons) {
                const text = btn.textContent?.toLowerCase()?.trim() || '';
                if (text === 'submit application' || text === 'submit') {
                    submitByText = btn;
                    break;
                }
            }

            const finalSubmitBtn = submitBtn || submitByText;

            if (finalSubmitBtn && finalSubmitBtn.offsetParent !== null) {
                console.log('[Unhireable] Found Submit button - application ready!');

                // Highlight the submit button for user to see
                finalSubmitBtn.style.outline = '3px solid #00ff00';
                finalSubmitBtn.style.boxShadow = '0 0 10px #00ff00';

                return {
                    success: true,
                    ats: 'linkedin',
                    message: '✅ Ready to submit! Review and click Submit Application.',
                    readyToSubmit: true
                };
            }

            // Look for Next/Continue/Review button
            const nextSelectors = [
                'button[aria-label*="Continue"]',
                'button[aria-label*="Next"]',
                'button[aria-label*="Review"]',
                'button[data-easy-apply-next-button]'
            ];

            let nextBtn = null;
            for (const sel of nextSelectors) {
                nextBtn = document.querySelector(sel);
                if (nextBtn && nextBtn.offsetParent !== null) break;
            }

            // Also try finding by text
            if (!nextBtn) {
                for (const btn of allButtons) {
                    const text = btn.textContent?.toLowerCase()?.trim() || '';
                    if (text === 'next' || text === 'continue' || text === 'review') {
                        nextBtn = btn;
                        break;
                    }
                }
            }

            if (nextBtn && nextBtn.offsetParent !== null) {
                console.log(`[Unhireable] Clicking Next/Continue button...`);
                await clickButton(nextBtn);
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            // Check if modal was closed (application might have been submitted or dismissed)
            const currentModal = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal[role="dialog"]');
            if (!currentModal || currentModal.offsetParent === null) {
                console.log('[Unhireable] Modal closed');
                return { success: true, ats: 'linkedin', message: 'Modal closed - check if application was submitted' };
            }

            // No navigation button found - might be stuck
            console.log('[Unhireable] No navigation button found in this step');
            await new Promise(r => setTimeout(r, 500));
        }

        return {
            success: true,
            ats: 'linkedin',
            message: `Processed ${stepCount} steps. Please review and submit manually.`
        };
    },

    unknown: async (profile) => {
        console.log('[Unhireable] Unknown ATS - trying generic fill...');

        // Try common field patterns
        await fillField(['input[name*="name"]', 'input[id*="name"]'], profile.name);
        await fillField(['input[type="email"]', 'input[name*="email"]'], profile.email);
        await fillField(['input[type="tel"]', 'input[name*="phone"]'], profile.phone);

        return { success: true, ats: 'unknown' };
    }
};

// LinkedIn-specific form field helper
async function fillLinkedInFormFields(profile) {
    console.log('[Unhireable] Filling LinkedIn form fields...');

    // Phone number
    const phoneInputs = document.querySelectorAll('input[id*="phone"], input[name*="phone"], input[type="tel"]');
    for (const input of phoneInputs) {
        if (input.offsetParent !== null && !input.value) {
            await humanType(input, profile.phone);
            console.log('[Unhireable] Filled phone field');
        }
    }

    // Email (sometimes shown in Easy Apply)
    const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"]');
    for (const input of emailInputs) {
        if (input.offsetParent !== null && !input.value) {
            await humanType(input, profile.email);
            console.log('[Unhireable] Filled email field');
        }
    }

    // City/Location
    const locationInputs = document.querySelectorAll('input[id*="city"], input[name*="city"], input[id*="location"]');
    for (const input of locationInputs) {
        if (input.offsetParent !== null && !input.value) {
            await humanType(input, profile.location);
            console.log('[Unhireable] Filled location field');
        }
    }

    // Work authorization questions (usually dropdowns or radio)
    // These vary too much to automate reliably - log them for user attention
    const sponsorQuestions = document.querySelectorAll('[class*="sponsorship"], [id*="sponsorship"], [class*="authorization"]');
    if (sponsorQuestions.length > 0) {
        console.log('[Unhireable] ⚠️ Work authorization questions detected - please answer manually');
    }

    // Additional questions - fill textareas with experience summary
    const textareas = document.querySelectorAll('textarea:not([hidden])');
    for (const textarea of textareas) {
        if (textarea.offsetParent !== null && !textarea.value) {
            await humanType(textarea, profile.experience_summary);
            console.log('[Unhireable] Filled textarea with experience summary');
        }
    }
}

// Main auto-fill function
async function autoFill() {
    const ats = detectATS();
    console.log(`[Unhireable] Detected ATS: ${ats}`);

    // Load profile from storage
    try {
        const stored = await chrome.storage.local.get('userProfile');
        if (stored.userProfile) {
            userProfile = { ...userProfile, ...stored.userProfile };
        }
    } catch (e) {
        console.log('[Unhireable] Using default profile');
    }

    // Run appropriate adapter
    const adapter = atsAdapters[ats] || atsAdapters.unknown;
    const result = await adapter(userProfile);

    // Notify popup of result
    chrome.runtime.sendMessage({ type: 'FILL_COMPLETE', result });

    return result;
}

// Show floating indicator
function showIndicator() {
    const ats = detectATS();

    // Remove existing indicator if present
    const existing = document.getElementById('unhireable-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'unhireable-indicator';
    indicator.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      z-index: 999999;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.2s, box-shadow 0.2s;
    " 
    onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 25px rgba(102, 126, 234, 0.5)';" 
    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 20px rgba(102, 126, 234, 0.4)';">
      <span style="font-size: 18px;">🚀</span>
      <span><b>Unhireable</b> | ${ats.toUpperCase()} detected</span>
    </div>
  `;

    indicator.onclick = () => {
        console.log('[Unhireable] Indicator clicked, running auto-fill...');
        autoFill();
    };
    document.body.appendChild(indicator);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTO_FILL') {
        autoFill().then(result => sendResponse(result));
        return true; // async response
    }

    if (message.type === 'GET_ATS') {
        sendResponse({ ats: detectATS() });
    }

    if (message.type === 'UPDATE_PROFILE') {
        userProfile = { ...userProfile, ...message.profile };
        chrome.storage.local.set({ userProfile });
        sendResponse({ success: true });
    }
});

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showIndicator);
} else {
    showIndicator();
}

console.log('[Unhireable] Content script loaded');

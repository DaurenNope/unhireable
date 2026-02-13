// Unhireable Auto-Apply - Greenhouse ATS Adapter
// Enhanced with human-like behavior
// Uses shared smart-answers.js for cross-ATS answer caching

(function () {
    'use strict';

    // Shared smart answer system (loaded first via manifest)
    const SA = window.UnhireableAnswers;

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        fieldDelay: { min: 800, max: 2000 },
        typingDelay: { min: 40, max: 120 },
        typoChance: 0.08,
        scrollDelay: { min: 300, max: 700 },
        mouseDelay: { min: 100, max: 350 },
        focusDelay: { min: 200, max: 450 },
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const randomChar = () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];

    // ============================================
    // HUMAN SIMULATION
    // ============================================

    async function simulateMouseTo(element) {
        const rect = element.getBoundingClientRect();

        let cursor = document.getElementById('unhireable-cursor');
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.id = 'unhireable-cursor';
            cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        background: radial-gradient(circle, rgba(34,197,94,0.6) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
      `;
            document.body.appendChild(cursor);
        }

        cursor.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 20 - 10}px`;
        cursor.style.top = `${rect.top + rect.height / 2 + (Math.random() - 0.5) * 10 - 10}px`;
        cursor.style.opacity = '1';

        await sleep(randomDelay(CONFIG.mouseDelay.min, CONFIG.mouseDelay.max));
    }

    async function humanScroll(element) {
        const rect = element.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
            window.scrollBy({ top: rect.top - window.innerHeight / 2, behavior: 'smooth' });
            await sleep(randomDelay(CONFIG.scrollDelay.min, CONFIG.scrollDelay.max));
        }
    }

    async function humanType(element, text) {
        if (!text) return;

        await humanScroll(element);
        await simulateMouseTo(element);
        await sleep(randomDelay(CONFIG.focusDelay.min, CONFIG.focusDelay.max));

        element.focus();
        element.value = '';

        for (let i = 0; i < text.length; i++) {
            // 8% typo chance
            if (Math.random() < CONFIG.typoChance && i > 0) {
                element.value += randomChar();
                element.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(randomDelay(80, 150));
                await sleep(randomDelay(200, 500)); // Notice mistake
                element.value = element.value.slice(0, -1);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(randomDelay(60, 100));
            }

            element.value += text[i];
            element.dispatchEvent(new Event('input', { bubbles: true }));

            let delay = randomDelay(CONFIG.typingDelay.min, CONFIG.typingDelay.max);
            if (text[i] === ' ') delay *= 0.7;
            if (text[i].match(/[A-Z@.]/)) delay *= 1.2;
            await sleep(delay);

            if (Math.random() < 0.03) await sleep(randomDelay(300, 800));
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(randomDelay(100, 300));
        element.blur();
    }

    // ============================================
    // FIELD DETECTION
    // ============================================

    function findByIdOrName(pattern) {
        return document.querySelector(`input[id*="${pattern}"], input[name*="${pattern}"], textarea[id*="${pattern}"]`);
    }

    function findByLabel(labelText) {
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
            if (label.textContent?.toLowerCase().includes(labelText.toLowerCase())) {
                const forId = label.getAttribute('for');
                if (forId) return document.getElementById(forId);
                return label.querySelector('input, textarea, select');
            }
        }
        return null;
    }

    function findFileInput(type = 'resume') {
        const keywords = type === 'resume' ? ['resume', 'cv'] : ['cover', 'letter'];
        const fileInputs = document.querySelectorAll('input[type="file"]');
        for (const input of fileInputs) {
            const container = input.closest('div, section');
            const text = container?.textContent?.toLowerCase() || '';
            if (keywords.some(k => text.includes(k))) return input;
        }
        return fileInputs[0] || null;
    }

    async function selectDropdown(fieldName, value) {
        const select = findByLabel(fieldName) || findByIdOrName(fieldName);
        if (!select || select.tagName !== 'SELECT') return false;

        await humanScroll(select);
        await simulateMouseTo(select);
        await sleep(randomDelay(200, 400));

        const options = Array.from(select.options);
        const match = options.find(o => o.text.toLowerCase().includes(value.toLowerCase()));
        if (match) {
            select.value = match.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[Unhireable] Selected: ${fieldName} = ${match.text}`);
            return true;
        }
        return false;
    }

    async function selectRadio(containerLabel, optionValue) {
        const containers = document.querySelectorAll('fieldset, [role="radiogroup"], [class*="radio"]');
        for (const container of containers) {
            if (!container.textContent?.toLowerCase().includes(containerLabel.toLowerCase())) continue;
            const options = container.querySelectorAll('input[type="radio"]');
            for (const option of options) {
                const label = option.closest('label')?.textContent?.toLowerCase() || option.value?.toLowerCase();
                if (label?.includes(optionValue.toLowerCase())) {
                    await humanScroll(option);
                    await simulateMouseTo(option);
                    await sleep(randomDelay(200, 400));
                    option.click();
                    return true;
                }
            }
        }
        return false;
    }

    // ============================================
    // MAIN FORM FILL
    // ============================================

    async function fillGreenhouseForm(profile, options = {}) {
        console.log('[Unhireable] Starting Greenhouse fill...');

        const personal = profile.personal_info || {};
        const results = { success: [], failed: [], manual: [] };

        const nameParts = (personal.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Greenhouse uses specific IDs
        const fieldMappings = [
            { id: 'first_name', value: firstName },
            { id: 'last_name', value: lastName },
            { id: 'email', value: personal.email },
            { id: 'phone', value: personal.phone },
            { id: 'location', value: personal.location },
            { id: 'linkedin', value: personal.linkedin },
            { id: 'website', value: personal.portfolio },
        ];

        for (const field of fieldMappings) {
            if (!field.value) continue;
            const input = findByIdOrName(field.id) || findByLabel(field.id.replace('_', ' '));
            if (input) {
                await humanType(input, field.value);
                await SA.saveAnswerToCache(field.id, field.value, { fieldType: 'text', source: 'profile', confidence: 'high' });
                await sleep(randomDelay(CONFIG.fieldDelay.min, CONFIG.fieldDelay.max));
                results.success.push(field.id);
            } else {
                results.failed.push(field.id);
            }
        }

        // Dropdowns
        const countryVal = personal.country || 'United States';
        if (await selectDropdown('country', countryVal)) {
            await SA.saveAnswerToCache('country', countryVal, { fieldType: 'select', source: 'profile', confidence: 'high' });
        }
        await sleep(randomDelay(CONFIG.fieldDelay.min, CONFIG.fieldDelay.max));

        // Radio buttons — use smart answer system
        const radioContainers = document.querySelectorAll('fieldset, [role="radiogroup"], [class*="radio"]');
        for (const container of radioContainers) {
            const containerText = container.textContent?.trim() || '';
            if (!containerText || containerText.length > 500) continue;

            const legend = container.querySelector('legend, label, [class*="label"]');
            const question = legend?.textContent?.trim() || containerText.substring(0, 100);
            if (!question || question.length < 3) continue;

            const result = await SA.getSmartAnswer(question, 'radio', null, profile, null);
            if (result.answer) {
                const success = await selectRadio(question, result.answer.toLowerCase());
                if (success) {
                    await SA.saveAnswerToCache(question, result.answer, { fieldType: 'radio', source: result.source, confidence: 'high' });
                    results.success.push(question.substring(0, 40));
                }
            }
        }

        // Unknown text fields — use smart answers
        const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="radio"]):not([type="checkbox"]), textarea');
        for (const input of allInputs) {
            if (input.value && input.value.trim()) continue;

            const label = input.closest('label')?.textContent?.trim()
                || document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim()
                || input.placeholder || input.name || '';
            if (!label || label.length < 2) continue;
            if (fieldMappings.some(f => label.toLowerCase().includes(f.id.replace('_', ' ')))) continue;

            const result = await SA.getSmartAnswer(label, 'text', null, profile, null);
            if (result.answer) {
                await humanType(input, result.answer);
                await SA.saveAnswerToCache(label, result.answer, { fieldType: 'text', source: result.source, confidence: 'medium' });
                await sleep(randomDelay(CONFIG.fieldDelay.min, CONFIG.fieldDelay.max));
                results.success.push(`${label.substring(0, 30)} (smart)`);
            } else {
                await SA.logUnknownField(input, label, null);
            }
        }

        // File upload
        const resumeInput = findFileInput('resume');
        if (resumeInput) {
            const container = resumeInput.closest('div');
            if (container) container.style.outline = '3px solid #22c55e';
            results.manual.push('Resume upload');
        }

        // Cleanup
        const cursor = document.getElementById('unhireable-cursor');
        if (cursor) setTimeout(() => cursor.remove(), 500);

        console.log('[Unhireable] Greenhouse fill complete:', results);
        return { success: true, ...results };
    }

    async function submitForm() {
        const buttons = document.querySelectorAll('button[type="submit"], input[type="submit"], button');
        for (const btn of buttons) {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            if (text.includes('submit') || text.includes('apply')) {
                await humanScroll(btn);
                await simulateMouseTo(btn);
                await sleep(randomDelay(500, 1000));
                btn.click();
                return true;
            }
        }
        return false;
    }

    // ============================================
    // MESSAGE LISTENER
    // ============================================

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action !== 'fillForm') return;

        (async () => {
            try {
                const result = await fillGreenhouseForm(message.profile, { autoSubmit: message.autoSubmit });
                if (message.autoSubmit && result.success && result.manual.length === 0) {
                    await sleep(1500);
                    result.submitted = await submitForm();
                }
                sendResponse(result);
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true;
    });

    console.log('[Unhireable] Enhanced Greenhouse adapter loaded');

})();

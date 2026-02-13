// Unhireable Auto-Apply - Lever ATS Adapter
// Enhanced with human-like behavior
// Uses shared smart-answers.js for cross-ATS answer caching

(function () {
    'use strict';

    // Shared smart answer system (loaded first via manifest)
    const SA = window.UnhireableAnswers;

    const CONFIG = {
        fieldDelay: { min: 800, max: 2000 },
        typingDelay: { min: 40, max: 120 },
        typoChance: 0.08,
        scrollDelay: { min: 300, max: 700 },
        mouseDelay: { min: 100, max: 350 },
        focusDelay: { min: 200, max: 450 },
    };

    const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const randomChar = () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];

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
        background: radial-gradient(circle, rgba(245,158,11,0.6) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
      `;
            document.body.appendChild(cursor);
        }
        cursor.style.left = `${rect.left + rect.width / 2 - 10}px`;
        cursor.style.top = `${rect.top + rect.height / 2 - 10}px`;
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
            if (Math.random() < CONFIG.typoChance && i > 0) {
                element.value += randomChar();
                element.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(randomDelay(80, 150));
                await sleep(randomDelay(200, 500));
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
        element.blur();
    }

    function findByName(name) {
        return document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
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

    async function fillLeverForm(profile) {
        console.log('[Unhireable] Starting Lever fill...');

        const personal = profile.personal_info || {};
        const results = { success: [], failed: [], manual: [] };

        // Lever uses name attributes
        const fields = [
            { name: 'name', value: personal.name },
            { name: 'email', value: personal.email },
            { name: 'phone', value: personal.phone },
            { name: 'org', value: personal.current_company },
            { name: 'location', value: personal.location },
            { name: 'urls[LinkedIn]', value: personal.linkedin },
            { name: 'urls[Portfolio]', value: personal.portfolio },
            { name: 'urls[GitHub]', value: personal.github },
        ];

        for (const field of fields) {
            if (!field.value) continue;
            const input = findByName(field.name) || findByLabel(field.name.replace('urls[', '').replace(']', ''));
            if (input) {
                await humanType(input, field.value);
                await SA.saveAnswerToCache(field.name, field.value, { fieldType: 'text', source: 'profile', confidence: 'high' });
                await sleep(randomDelay(CONFIG.fieldDelay.min, CONFIG.fieldDelay.max));
                results.success.push(field.name);
            } else {
                results.failed.push(field.name);
            }
        }

        // Radio/checkbox fields — use smart answer system
        const radioContainers = document.querySelectorAll('fieldset, [role="radiogroup"], [class*="radio"], [class*="checkbox"]');
        for (const container of radioContainers) {
            const containerText = container.textContent?.trim() || '';
            if (!containerText || containerText.length > 500) continue;

            const legend = container.querySelector('legend, label, [class*="label"]');
            const question = legend?.textContent?.trim() || containerText.substring(0, 100);
            if (!question || question.length < 3) continue;

            const result = await SA.getSmartAnswer(question, 'radio', null, profile, null);
            if (result.answer) {
                // Find and select the matching radio option
                const options = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
                for (const option of options) {
                    const optLabel = option.closest('label')?.textContent?.toLowerCase() || option.value?.toLowerCase();
                    if (optLabel?.includes(result.answer.toLowerCase())) {
                        await humanScroll(option);
                        await simulateMouseTo(option);
                        await sleep(randomDelay(200, 400));
                        option.click();
                        await SA.saveAnswerToCache(question, result.answer, { fieldType: 'radio', source: result.source, confidence: 'high' });
                        results.success.push(question.substring(0, 40));
                        break;
                    }
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
            if (fields.some(f => label.toLowerCase().includes(f.name.replace('urls[', '').replace(']', '').toLowerCase()))) continue;

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

        // Resume upload
        const fileInputs = document.querySelectorAll('input[type="file"]');
        if (fileInputs.length > 0) {
            const container = fileInputs[0].closest('div');
            if (container) container.style.outline = '3px solid #f59e0b';
            results.manual.push('Resume upload');
        }

        const cursor = document.getElementById('unhireable-cursor');
        if (cursor) setTimeout(() => cursor.remove(), 500);

        console.log('[Unhireable] Lever fill complete:', results);
        return { success: true, ...results };
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action !== 'fillForm') return;

        (async () => {
            try {
                const result = await fillLeverForm(message.profile);
                sendResponse(result);
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true;
    });

    console.log('[Unhireable] Enhanced Lever adapter loaded');
})();

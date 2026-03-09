// Unhireable — Universal Form Filler
// ONE engine for LinkedIn Easy Apply AND external ATS forms.
// Provides: serializeForm, applyAnswers, batchFill, uploadResume, generateCoverLetter
// Depends on: logger.js (UHLog), smart-answers.js (UnhireableAnswers)

(function () {
    'use strict';

    // Wait for dependencies
    const SA = window.UnhireableAnswers;
    const log = window.UHLog || {
        debug() { }, info() { }, warn() { }, error() { },
        field() { }, stepStart() { }, stepEnd() { }, geminiCall() { },
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // ========== COVER LETTER PATTERNS ==========
    const COVER_LETTER_PATTERNS = [
        'cover letter', 'why interested', 'why are you', 'additional information',
        'message to', 'note to', 'why do you want', 'tell us about yourself',
        'motivation', 'statement of interest',
    ];

    function isCoverLetterField(label) {
        const l = label.toLowerCase();
        return COVER_LETTER_PATTERNS.some(p => l.includes(p));
    }


    function extractVisibleText(el) {
        if (!el) return '';
        if (!el.children.length) return el.textContent.trim();

        const parts = [];
        const walk = (node) => {
            if (node.nodeType === 3) { // Text node
                const t = node.textContent.trim();
                if (t) parts.push(t);
            } else if (node.nodeType === 1) { // Element node
                const style = window.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return;
                if (node.classList.contains('visually-hidden') ||
                    node.classList.contains('sr-only') ||
                    node.getAttribute('aria-hidden') === 'true') return;

                for (let child of node.childNodes) walk(child);
            }
        };
        walk(el);

        const uniqueParts = [];
        for (let i = 0; i < parts.length; i++) {
            if (i === 0 || parts[i] !== parts[i - 1]) {
                uniqueParts.push(parts[i]);
            }
        }
        return uniqueParts.join(' ').trim();
    }

    // ========== LABEL EXTRACTION ==========
    function getFieldLabel(el, container) {
        const root = container || document;
        // 1. Explicit <label for="id">
        const id = el.id || el.getAttribute('for');
        if (id) {
            const label = root.querySelector(`label[for="${id}"]`);
            if (label) return extractVisibleText(label);
        }
        // 2. Wrapping <label>
        const parentLabel = el.closest('label');
        if (parentLabel) return extractVisibleText(parentLabel);
        // 3. Walk up to find label/legend — LinkedIn uses .fb-dash-form-element__label, .t-14, etc.
        let parent = el.parentElement;
        for (let i = 0; i < 6 && parent; i++) {
            const label = parent.querySelector(
                'label, legend, [class*="label"], [class*="title"], ' +
                '.fb-dash-form-element__label, .artdeco-form-label, .t-14, .t-16, [role="group"] span:first-child'
            );
            if (label && label.textContent.trim().length > 0) return extractVisibleText(label);
            parent = parent.parentElement;
        }
        // 4. Fallbacks (placeholder, aria-label, name, id)
        return (el.placeholder || el.getAttribute('aria-label') || el.name || el.id || '').trim();
    }

    // ========== CORRUPTION DETECTION ==========
    // Checks if a pre-filled value looks corrupted (garbled autofill).
    // Returns true if the field should be re-filled despite having a value.
    function isCorrupted(el, label, profile) {
        const val = el.value?.trim();
        if (!val) return false; // empty is not corrupted, just unfilled

        const info = profile?.personal_info || {};
        const l = label.toLowerCase();

        // Name fields: value should match profile name
        if ((l.includes('first name') || l.includes('given name')) && info.name) {
            const expected = info.name.split(' ')[0];
            if (expected && !val.toLowerCase().includes(expected.toLowerCase())) return true;
        }
        if ((l.includes('last name') || l.includes('family name') || l.includes('surname')) && info.name) {
            const parts = info.name.split(' ');
            const expected = parts[parts.length - 1];
            if (expected && !val.toLowerCase().includes(expected.toLowerCase())) return true;
        }
        // Email
        if (l.includes('email') && info.email) {
            if (!val.includes('@') || !val.includes('.')) return true;
        }
        // Phone: should have mostly digits
        if (l.includes('phone') && info.phone) {
            const digits = val.replace(/\D/g, '');
            if (digits.length < 6) return true;
        }
        // General: garbled text detection (lots of non-printable chars)
        const nonPrintable = val.replace(/[\x20-\x7E\u00C0-\u024F]/g, '');
        if (nonPrintable.length > val.length * 0.3) return true;

        return false;
    }

    // ========== SERIALIZE FORM ==========
    function serializeForm(container, profile) {
        const root = container || document;
        const fields = [];

        // Text inputs & textareas
        const textInputs = root.querySelectorAll(
            'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"]), textarea'
        );
        textInputs.forEach((el, i) => {
            let label = getFieldLabel(el, root);
            if (!label) label = el.getAttribute('aria-placeholder') || el.getAttribute('data-label') || '';
            if (!label || label.length < 1) return;

            const hasValue = el.value?.trim();
            const corrupted = profile ? isCorrupted(el, label, profile) : false;

            // Skip pre-filled unless corrupted
            if (hasValue && !corrupted) return;

            fields.push({
                id: `text_${i}`,
                type: el.tagName === 'TEXTAREA' ? 'textarea' : 'text',
                label: label.substring(0, 200),
                currentValue: corrupted ? '' : (el.value || ''),
                required: el.required || el.getAttribute('aria-required') === 'true',
                element: el,
                needsCorrection: corrupted,
            });
        });

        // Combobox (LinkedIn Email, etc.) — role="combobox", options appear after open
        root.querySelectorAll('[role="combobox"]').forEach((el, i) => {
            if (fields.some(f => f.element === el)) return;
            let label = getFieldLabel(el, root);
            if (!label) label = el.getAttribute('aria-label') || '';
            if (!label || label.length < 1) return;
            const inp = el.querySelector('input') || el;
            const currentVal = (inp.value || inp.textContent || '').trim();
            if (currentVal && currentVal.includes('@')) return; // already has email
            fields.push({
                id: `combobox_${i}`,
                type: 'combobox',
                label: label.substring(0, 200),
                options: [],
                currentValue: currentVal,
                required: el.getAttribute('aria-required') === 'true',
                element: el,
            });
        });

        // Selects
        root.querySelectorAll('select').forEach((el, i) => {
            const label = getFieldLabel(el, root);
            if (!label) return;

            const options = Array.from(el.options)
                .filter(o => o.value && !o.textContent.trim().toLowerCase().includes('select'))
                .map(o => o.textContent.trim());
            const selectedText = el.options[el.selectedIndex]?.textContent?.trim() || '';
            const isPlaceholder = !el.value || el.selectedIndex === 0 ||
                selectedText.toLowerCase().includes('select') ||
                selectedText.toLowerCase().includes('choose') ||
                selectedText === '--' || selectedText === '';

            if (!isPlaceholder) return; // already has valid selection

            fields.push({
                id: `select_${i}`,
                type: 'select',
                label: label.substring(0, 200),
                options,
                currentValue: '',
                required: el.required || el.getAttribute('aria-required') === 'true',
                element: el,
            });
        });

        // Radio groups — two passes:
        // Pass 1: recognized containers (fieldset / radiogroup / LinkedIn class)
        const seenRadioNames = new Set();
        root.querySelectorAll('fieldset, [role="radiogroup"], .jobs-easy-apply-form-section__grouping').forEach((fs, i) => {
            const radios = fs.querySelectorAll('input[type="radio"]');
            if (!radios.length) return;

            if (Array.from(radios).some(r => r.checked)) return;

            const legend = fs.querySelector('legend, label, [class*="label"], .t-14');
            const question = legend?.textContent?.trim();
            if (!question || question.length < 3) return;
            if (question.toLowerCase().includes('resume') || question.toLowerCase().includes('cv')) return;

            const options = [];
            const elements = [];
            for (const radio of radios) {
                const optLabel = radio.closest('label')?.textContent?.trim()
                    || radio.closest('[class*="option"]')?.textContent?.trim()
                    || root.querySelector(`label[for="${radio.id}"]`)?.textContent?.trim()
                    || radio.value;
                options.push(optLabel);
                elements.push(radio);
                if (radio.name) seenRadioNames.add(radio.name);
            }

            fields.push({
                id: `radio_${i}`,
                type: 'radio',
                label: question.substring(0, 200),
                options,
                currentValue: '',
                required: radios[0]?.required || radios[0]?.getAttribute('aria-required') === 'true',
                elements,
            });
        });

        // Pass 2: catch any radio groups NOT inside a recognized container
        // (LinkedIn uses plain <div> wrappers for custom questions like "How did you hear about us")
        const allRadios = Array.from(root.querySelectorAll('input[type="radio"]'));
        const ungrouped = {};
        for (const radio of allRadios) {
            if (seenRadioNames.has(radio.name)) continue;
            if (!radio.name) continue;
            if (!ungrouped[radio.name]) ungrouped[radio.name] = [];
            ungrouped[radio.name].push(radio);
        }
        let radioFallbackIdx = 0;
        for (const [name, radios] of Object.entries(ungrouped)) {
            if (Array.from(radios).some(r => r.checked)) continue;

            // Find the question label — walk up to find a heading/label near these radios
            const firstRadio = radios[0];
            let question = '';
            let node = firstRadio.parentElement;
            for (let depth = 0; depth < 6 && node && node !== root; depth++) {
                const lbl = node.querySelector('legend, [role="group"] > span, h3, h4, label:not([for]), .fb-dash-form-element__label, span[class*="label"]');
                if (lbl) { question = lbl.textContent.trim(); break; }
                // also check for an aria-label on the group container
                if (node.getAttribute('aria-label')) { question = node.getAttribute('aria-label'); break; }
                node = node.parentElement;
            }
            if (!question || question.length < 3) {
                // Last resort: use the label of the first option
                question = root.querySelector(`label[for="${firstRadio.id}"]`)?.textContent?.trim()
                    || firstRadio.getAttribute('aria-label') || name;
            }
            if (question.toLowerCase().includes('resume') || question.toLowerCase().includes('cv')) continue;

            const options = radios.map(r =>
                r.closest('label')?.textContent?.trim()
                || root.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()
                || r.value
            );

            fields.push({
                id: `radio_fallback_${radioFallbackIdx++}`,
                type: 'radio',
                label: question.substring(0, 200),
                options,
                currentValue: '',
                required: radios[0]?.required || radios[0]?.getAttribute('aria-required') === 'true',
                elements: radios,
            });
        }

        // Contenteditable (LinkedIn "Why do you want to work here?" etc.)
        root.querySelectorAll('[contenteditable="true"]').forEach((el, i) => {
            if (fields.some(f => f.element === el)) return;
            const tag = (el.tagName || '').toLowerCase();
            if (tag !== 'div' && tag !== 'p') return;
            let label = getFieldLabel(el, root) || el.getAttribute('aria-label') || el.getAttribute('data-placeholder') || '';
            const parent = el.closest('.fb-dash-form-element, [class*="form-element"], [class*="form-section"]');
            if (!label && parent) {
                const lbl = parent.querySelector('.fb-dash-form-element__label, [class*="label"], .t-14, .t-16');
                if (lbl) label = lbl.textContent.trim();
            }
            if (!label || label.length < 2) return;
            const hasValue = (el.textContent || '').trim();
            if (hasValue) return;
            fields.push({
                id: `contenteditable_${i}`,
                type: 'textarea',
                label: label.substring(0, 200),
                currentValue: '',
                required: el.getAttribute('aria-required') === 'true',
                element: el,
            });
        });

        // Standalone checkboxes
        root.querySelectorAll('input[type="checkbox"]').forEach((el, i) => {
            if (el.closest('fieldset, [role="radiogroup"]')) return;
            if (el.checked) return;
            const label = getFieldLabel(el, root);
            if (!label) return;

            fields.push({
                id: `checkbox_${i}`,
                type: 'checkbox',
                label: label.substring(0, 200),
                currentValue: '',
                required: el.required,
                element: el,
            });
        });

        // Debug when 0 fields — log raw counts to help diagnose LinkedIn DOM changes
        if (fields.length === 0 && root.querySelector) {
            const rawInputs = root.querySelectorAll('input:not([type="hidden"]), select, textarea').length;
            log.info('serialize', {
                count: 0,
                container: container?.className?.substring(0, 40) || 'document',
                rawInputs,
                hint: rawInputs > 0 ? 'inputs exist but skipped (pre-filled or no label)' : 'no inputs in container'
            });
        } else {
            log.info('serialize', { count: fields.length, container: container?.className?.substring(0, 40) || 'document' });
        }
        return fields;
    }

    // ========== APPLY ANSWERS ==========
    async function applyAnswers(fields, answers, hooks) {
        const humanType = hooks?.humanType || defaultHumanType;
        let filled = 0;
        let failed = 0;

        for (const field of fields) {
            const entry = answers[field.id];
            const answer = entry?.answer ?? entry; // Support both {answer, source} and raw string
            const source = entry?.source || 'unknown';

            if (!answer && field.type !== 'checkbox') {
                log.field('skipped', { label: field.label, type: field.type, reason: 'no_answer' });
                continue;
            }

            try {
                switch (field.type) {
                    case 'text': {
                        const el = field.element;
                        // Check for typeahead/combobox
                        const isTypeahead = el.getAttribute('role') === 'combobox' ||
                            el.id?.includes('location') ||
                            field.label.toLowerCase().includes('location') ||
                            field.label.toLowerCase().includes('city');

                        if (isTypeahead && hooks?.onTypeahead) {
                            await hooks.onTypeahead(el, field.label, String(answer));
                        } else {
                            await humanType(el, String(answer));
                        }
                        filled++;
                        log.field('filled', { label: field.label, type: 'text', answer: String(answer).substring(0, 50), source });
                        break;
                    }

                    case 'textarea': {
                        const el = field.element;
                        // Cover letter gets special treatment
                        if (isCoverLetterField(field.label)) {
                            log.field('skipped', { label: field.label, type: 'textarea', reason: 'cover_letter_separate' });
                            // Cover letter handled in batchFill after this loop
                            continue;
                        }
                        await humanType(el, String(answer));
                        filled++;
                        log.field('filled', { label: field.label, type: 'textarea', answer: String(answer).substring(0, 80), source });
                        break;
                    }

                    case 'select': {
                        const el = field.element;
                        const ansLower = String(answer).toLowerCase();
                        const opts = Array.from(el.options).filter(o => o.value);

                        // Exact match
                        let match = opts.find(o => o.textContent.trim().toLowerCase() === ansLower);
                        // Partial match
                        if (!match) match = opts.find(o =>
                            o.textContent.trim().toLowerCase().includes(ansLower) ||
                            ansLower.includes(o.textContent.trim().toLowerCase())
                        );
                        // Fallback: first valid non-placeholder
                        if (!match) {
                            match = opts.find(o =>
                                o.value && !o.textContent.trim().toLowerCase().includes('select') &&
                                !o.textContent.trim().toLowerCase().includes('choose') &&
                                o.textContent.trim() !== '--' && o.textContent.trim() !== ''
                            );
                            if (match) log.warn('select_fallback', { label: field.label, selected: match.textContent.trim(), attempted: answer });
                        }

                        if (match) {
                            el.value = match.value;
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            filled++;
                            log.field('filled', { label: field.label, type: 'select', answer: match.textContent.trim(), source });
                        } else {
                            failed++;
                            log.field('failed', { label: field.label, type: 'select', error: 'no_matching_option', attempted: answer });
                        }
                        break;
                    }

                    case 'radio': {
                        const ansLower = String(answer).toLowerCase();
                        const labelLower = (field.label || '').toLowerCase();
                        const isEEO = /race|ethnicity|veteran|disability|gender|sexual orientation/i.test(labelLower);
                        const declinePatterns = ['decline', 'prefer not', "don't wish", 'do not wish', 'choose not', 'i don\'t wish', 'not say', 'self-identify'];
                        const wantsDecline = declinePatterns.some(p => ansLower.includes(p));
                        let matched = false;

                        for (let idx = 0; idx < (field.elements?.length || 0); idx++) {
                            const radio = field.elements[idx];
                            const optLabel = field.options[idx]?.toLowerCase() || '';
                            if (optLabel.includes(ansLower) || ansLower.includes(optLabel)) {
                                radio.click();
                                radio.dispatchEvent(new Event('change', { bubbles: true }));
                                filled++;
                                matched = true;
                                log.field('filled', { label: field.label, type: 'radio', answer: field.options[idx], source });
                                break;
                            }
                        }

                        // For EEO + decline: try to find a decline-like option
                        if (!matched && isEEO && wantsDecline) {
                            const declineIdx = field.options?.findIndex((o, i) => {
                                const oLower = String(o).toLowerCase();
                                return declinePatterns.some(p => oLower.includes(p));
                            });
                            if (declineIdx >= 0 && field.elements?.[declineIdx]) {
                                field.elements[declineIdx].click();
                                field.elements[declineIdx].dispatchEvent(new Event('change', { bubbles: true }));
                                filled++;
                                matched = true;
                                log.field('filled', { label: field.label, type: 'radio', answer: field.options[declineIdx], source: 'eeo_decline' });
                            }
                        }

                        // Fallback: first non-disabled — but NEVER for EEO when we wanted decline (would wrongfully select demographic)
                        if (!matched && field.elements?.length > 0) {
                            if (isEEO && wantsDecline) {
                                log.field('skipped', { label: field.label, type: 'radio', reason: 'eeo_no_decline_option' });
                            } else {
                                const first = field.elements.find(r => !r.disabled);
                                if (first) {
                                    first.click();
                                    first.dispatchEvent(new Event('change', { bubbles: true }));
                                    filled++;
                                    const fallbackLabel = field.options[field.elements.indexOf(first)] || 'first option';
                                    log.warn('radio_fallback', { label: field.label, selected: fallbackLabel, attempted: answer });
                                    log.field('filled', { label: field.label, type: 'radio', answer: fallbackLabel, source: 'fallback' });
                                } else {
                                    failed++;
                                    log.field('failed', { label: field.label, type: 'radio', error: 'all_disabled' });
                                }
                            }
                        }
                        break;
                    }

                    case 'combobox': {
                        const el = field.element;
                        el.click();
                        el.focus();
                        await sleep(500);
                        const container = el.closest('.artdeco-modal, .jobs-easy-apply-modal') || document;
                        const opts = container.querySelectorAll('[role="option"]');
                        const ans = String(answer).toLowerCase();
                        let option = Array.from(opts).find(o => {
                            const t = (o.textContent || '').trim().toLowerCase();
                            return t === ans || t.includes(ans) || ans.includes(t) || (ans.includes('@') && t.includes('@'));
                        });
                        if (!option && opts.length > 0) {
                            option = Array.from(opts).find(o => !(o.textContent || '').toLowerCase().includes('select'));
                            if (option) log.warn('combobox_fallback', { label: field.label, selected: option.textContent?.trim() });
                        }
                        if (option) {
                            option.click();
                            filled++;
                            log.field('filled', { label: field.label, type: 'combobox', answer: option.textContent?.trim(), source });
                        } else {
                            failed++;
                            log.field('failed', { label: field.label, type: 'combobox', error: 'no_option', attempted: answer });
                        }
                        break;
                    }

                    case 'checkbox': {
                        const el = field.element;
                        const l = field.label.toLowerCase();
                        const shouldCheck = answer === 'check' || answer === 'Yes' || answer === 'true' ||
                            l.includes('agree') || l.includes('consent') || l.includes('acknowledge') ||
                            l.includes('terms') || l.includes('confirm') || l.includes('certify') ||
                            l.includes('i have read');
                        if (shouldCheck && !el.checked) {
                            await sleep(randomDelay(400, 1000));
                            el.click();
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            filled++;
                            log.field('filled', { label: field.label, type: 'checkbox', source: 'consent_autocheck' });
                        }
                        break;
                    }
                }
            } catch (err) {
                failed++;
                log.field('failed', { label: field.label, type: field.type, error: err.message });
            }

            await sleep(rand(100, 400)); // Human pacing between fields
        }

        return { filled, failed };
    }

    // ========== DEFAULT HUMAN TYPE ==========
    // Uses the native prototype value setter so React-controlled inputs
    // (Greenhouse, Lever, Ashby all use React) see the change correctly.
    function setNativeValue(el, val) {
        const tag = el.tagName.toLowerCase();
        const proto = tag === 'textarea'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val);
        else el.value = val;
    }

    async function defaultHumanType(input, value) {
        const isContentEditable = input.isContentEditable || input.getAttribute('contenteditable') === 'true';
        input.focus();
        input.dispatchEvent(new Event('focus', { bubbles: true }));

        if (isContentEditable) {
            input.textContent = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            for (const char of value) {
                input.textContent = (input.textContent || '') + char;
                input.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }));
                await sleep(rand(10, 30));
            }
        } else {
            setNativeValue(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            for (const char of value) {
                const cur = input.value + char;
                setNativeValue(input, cur);
                input.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }));
                await sleep(rand(10, 30));
            }
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // ========== COVER LETTER GENERATOR ==========
    // Shared between LinkedIn and ATS. Backend API → template fallback.
    const API_BASE = 'http://localhost:3030';
    const coverLetterCache = {};

    async function generateCoverLetter(job, profile) {
        const cacheKey = `${job?.company}-${job?.title}`.toLowerCase();
        if (coverLetterCache[cacheKey]) {
            log.info('cover_letter:cached', { company: job?.company });
            return coverLetterCache[cacheKey];
        }

        const info = profile?.personal_info || {};
        const skills = profile?.skills || {};
        const name = info.name || 'Applicant';
        const firstName = name.split(' ')[0];
        const technicalSkills = Array.isArray(skills) ? skills : (skills.technical_skills || []);
        const topSkills = technicalSkills.slice(0, 5).join(', ');
        const company = job?.company || 'your company';
        const title = job?.title || 'this position';

        // Try backend API first (skip if backend down — use template immediately)
        const backendOk = SA?.checkBackendAvailable ? await SA.checkBackendAvailable() : true;
        if (backendOk) {
            try {
                const bgFetch = window.UnhireableAnswers?.bgFetch || fetch;
                const resp = await bgFetch(`${API_BASE}/api/generate-cover-letter`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        job: { title, company },
                        profile: { name, skills: topSkills, summary: profile?.summary },
                    })
                }, 2000);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data?.coverLetter) {
                        log.info('cover_letter:api', { company, length: data.coverLetter.length });
                        coverLetterCache[cacheKey] = data.coverLetter;
                        return data.coverLetter;
                    }
                }
            } catch (e) {
                log.debug('cover_letter:api_failed', { error: e.message });
            }
        }

        // Fallback: template
        const experience = profile?.experience?.[0];
        const recentWork = experience
            ? `At ${experience.company}, I ${experience.highlights?.[0]?.toLowerCase() || 'delivered impactful solutions'}.`
            : 'I have delivered scalable automation systems and full-stack applications.';

        const letter = `Dear Hiring Team at ${company},

I'm ${firstName}, and I'm excited to apply for the ${title} role. With expertise in ${topSkills || 'software development'}, I bring hands-on experience building production systems that deliver real value.

${recentWork}

I'm drawn to ${company} because I believe my skills align well with your team's goals. I'd love the opportunity to contribute and grow with your organization.

Looking forward to discussing how I can add value.

Best regards,
${name}`;

        coverLetterCache[cacheKey] = letter;
        log.info('cover_letter:template', { company, length: letter.length });
        return letter;
    }

    // ========== UPLOAD RESUME ==========
    async function uploadResume(container) {
        const root = container || document;
        log.info('resume:start');

        const storage = await chrome.storage.local.get(['resumeFile']);
        const fileData = storage.resumeFile;
        if (!fileData?.data) {
            log.info('resume:no_file');
            return false;
        }

        let blob;
        if (fileData.data.startsWith('data:')) {
            blob = await (await fetch(fileData.data)).blob();
        } else {
            const binary = atob(fileData.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            blob = new Blob([bytes], { type: fileData.type || 'application/pdf' });
        }
        const file = new File([blob], fileData.name || 'resume.pdf', {
            type: fileData.type || 'application/pdf',
        });

        const upload = (input, label) => {
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            log.info('resume:uploaded', { target: label });
        };

        // Autofill-specific (Ashby, etc.)
        const autofillInput = root.querySelector(
            '[class*="autofill"] input[type="file"], [class*="Autofill"] input[type="file"], [data-testid*="autofill"] input[type="file"]'
        );
        if (autofillInput) upload(autofillInput, 'autofill');

        // Standard resume field
        const fileInputs = root.querySelectorAll('input[type="file"]');
        for (const fi of fileInputs) {
            if (fi === autofillInput) continue;
            const ctx = (fi.closest('div, section, fieldset')?.textContent || '').toLowerCase();
            if (ctx.includes('resume') || ctx.includes('cv') || ctx.includes('curriculum')) {
                upload(fi, 'resume_field');
                break;
            }
        }
        if (!autofillInput && fileInputs.length > 0) {
            const first = Array.from(fileInputs).find(f => !f.files?.length);
            if (first) upload(first, 'first_file_input');
        }

        // Wait for parsing
        log.info('resume:parsing');
        await sleep(3000);
        for (let i = 0; i < 15; i++) {
            const pt = root.textContent?.toLowerCase() || '';
            if (!pt.includes('parsing') && !pt.includes('uploading') &&
                !root.querySelector('[class*="spinner"], [class*="loading"], [class*="progress"]')) break;
            await sleep(1000);
        }
        log.info('resume:done');
        return true;
    }

    // Play a short alert sound when user input is needed
    function playAlertSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch (_) { }
    }

    // ========== ASK USER FOR ANSWER (unknown field modal) ==========
    // Shows an in-page modal when we have no answer. User can provide one (saved for future) or skip.
    function askUserForAnswer(field) {
        return new Promise((resolve) => {
            // Browser notification + sound — works when tab is in background
            try {
                chrome.runtime.sendMessage({
                    action: 'showUnknownFieldNotification',
                    field: { label: field.label, type: field.type },
                }).catch(() => { });
            } catch (_) { }
            playAlertSound();

            const overlay = document.createElement('div');
            overlay.id = 'unhireable-ask-modal-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 2147483646;
                background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #fff; border-radius: 12px; padding: 24px; max-width: 480px; width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            `;

            const label = field.label || 'Unknown question';
            const isTextarea = field.type === 'textarea';

            const h3 = document.createElement('h3');
            h3.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; color: #333;';
            h3.textContent = 'We need your answer';

            const p = document.createElement('p');
            p.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: #666;';
            p.textContent = label;

            const inputElement = document.createElement(isTextarea ? 'textarea' : 'input');
            inputElement.id = 'unhireable-ask-input';
            inputElement.style.cssText = `width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; box-sizing: border-box; min-height: ${isTextarea ? '100px' : 'auto'};`;
            inputElement.placeholder = 'Type your answer (saved for future applications)...';
            if (!isTextarea) inputElement.type = 'text';

            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display: flex; gap: 12px; margin-top: 16px; justify-content: flex-end;';

            const skipBtn = document.createElement('button');
            skipBtn.id = 'unhireable-ask-skip';
            skipBtn.style.cssText = 'padding: 10px 20px; border: 1px solid #ccc; background: #f5f5f5; border-radius: 8px; cursor: pointer; font-size: 14px;';
            skipBtn.textContent = 'Skip';

            const saveBtn = document.createElement('button');
            saveBtn.id = 'unhireable-ask-save';
            saveBtn.style.cssText = 'padding: 10px 20px; border: none; background: #0a66c2; color: #fff; border-radius: 8px; cursor: pointer; font-size: 14px;';
            saveBtn.textContent = 'Save & Continue';

            btnContainer.appendChild(skipBtn);
            btnContainer.appendChild(saveBtn);

            modal.appendChild(h3);
            modal.appendChild(p);

            // If field has options (radio/select), show them as buttons for easier selection
            if (field.options && field.options.length > 0) {
                const optWrap = document.createElement('div');
                optWrap.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px 0; max-height: 180px; overflow-y: auto; padding: 4px;';
                field.options.forEach(opt => {
                    const b = document.createElement('button');
                    b.style.cssText = 'padding: 6px 12px; border: 1px solid #0a66c2; background: #fff; color: #0a66c2; border-radius: 16px; cursor: pointer; font-size: 13px; transition: all 0.2s;';
                    b.textContent = opt;
                    b.onmouseover = () => { b.style.background = '#f0f7fe'; };
                    b.onmouseout = () => { b.style.background = '#fff'; };
                    b.onclick = () => {
                        inputElement.value = opt;
                        saveBtn.click();
                    };
                    optWrap.appendChild(b);
                });
                modal.appendChild(optWrap);
            }

            modal.appendChild(inputElement);
            modal.appendChild(btnContainer);

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const input = inputElement; // reuse already created element

            const cleanup = () => {
                overlay.remove();
            };

            const done = (result) => {
                cleanup();
                resolve(result);
            };

            saveBtn.addEventListener('click', () => {
                const val = input.value?.trim();
                if (val) {
                    log.info('askUser:saved', { label: field.label, length: val.length });
                    done({ answer: val });
                } else {
                    done({ skip: true });
                }
            });

            skipBtn.addEventListener('click', () => {
                log.info('askUser:skipped', { label: field.label });
                done({ skip: true });
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !isTextarea) {
                    e.preventDefault();
                    saveBtn.click();
                }
            });

            input.focus();
        });
    }

    // ========== BATCH FILL — THE PIPELINE ==========
    async function batchFill(container, profile, job, hooks) {
        const root = container || document;
        log.info('batchFill:start', { job: `${job?.title} at ${job?.company}` });

        // 1. Pre-fill hook (resume radio, file upload, etc.)
        if (hooks?.onBeforeFill) {
            await hooks.onBeforeFill(root);
        }

        // 2. Serialize
        const fields = serializeForm(root, profile);
        if (fields.length === 0) {
            log.info('batchFill:no_fields');
            return { filled: 0, failed: 0, skipped: 0, total: 0 };
        }

        // 3. Separate cover letter fields (they get special treatment)
        const coverLetterFields = fields.filter(f => f.type === 'textarea' && isCoverLetterField(f.label));
        const batchFields = fields.filter(f => !(f.type === 'textarea' && isCoverLetterField(f.label)));

        // 4. Batch resolve (pattern → cache → ONE Gemini call)
        // Strip element refs before sending to SA (not serializable)
        const saFields = batchFields.map(({ element, elements, needsCorrection, ...rest }) => rest);
        const answers = SA ? await SA.batchGetAnswers(saFields, profile, job) : {};

        // 5. Unknown-field handling: ask user only. No fallbacks.
        // When pattern/cache/LLM all fail: prompt user. If user skips, field stays empty.
        for (const field of batchFields) {
            if (answers[field.id]) continue;

            if (hooks?.onUnknownField) {
                try {
                    const result = await hooks.onUnknownField(field, profile);
                    if (result?.answer) {
                        answers[field.id] = { answer: result.answer, source: 'user' };
                        if (SA?.saveAnswerToCache) {
                            await SA.saveAnswerToCache(field.label, result.answer, {
                                fieldType: field.type,
                                source: 'user',
                                confidence: 'high',
                            });
                            SA.syncToBackend?.().catch(() => { });
                        }
                    } else {
                        log.field('skipped', { label: field.label, type: field.type, reason: 'user_skipped' });
                    }
                } catch (err) {
                    log.warn('onUnknownField_error', { label: field.label, error: err.message });
                }
            } else {
                log.field('skipped', { label: field.label, type: field.type, reason: 'no_answer_no_hook' });
            }
        }

        // 6. Apply answers to DOM
        const result = await applyAnswers(batchFields, answers, hooks);

        // 7. Handle cover letters separately
        for (const clField of coverLetterFields) {
            const humanType = hooks?.humanType || defaultHumanType;
            try {
                const letter = await generateCoverLetter(job, profile);
                await humanType(clField.element, letter);
                result.filled++;
                log.field('filled', { label: clField.label, type: 'cover_letter', answer: letter.substring(0, 80), source: 'cover_letter_gen' });
            } catch (err) {
                result.failed++;
                log.field('failed', { label: clField.label, type: 'cover_letter', error: err.message });
            }
        }

        log.info('batchFill:done', {
            total: fields.length,
            filled: result.filled,
            failed: result.failed,
            coverLetters: coverLetterFields.length,
        });

        return {
            filled: result.filled,
            failed: result.failed,
            total: fields.length,
            coverLetters: coverLetterFields.length,
        };
    }

    // ========== MESSAGE LISTENERS (for background.js orchestration) ==========
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const action = message.action;

        if (action === 'fillForm') {
            (async () => {
                try {
                    const resumeUploaded = await uploadResume(document);
                    if (resumeUploaded) await sleep(2000);

                    const result = await batchFill(document, message.profile, message.job, {});

                    // Auto-submit if requested
                    let submitted = false;
                    if (message.autoSubmit && result.failed === 0) {
                        await sleep(1500);
                        const btns = document.querySelectorAll('button[type="submit"], button');
                        for (const btn of btns) {
                            if ((btn.textContent || '').toLowerCase().includes('submit')) {
                                btn.click();
                                submitted = true;
                                break;
                            }
                        }
                    }

                    sendResponse({ success: true, ...result, resumeUploaded, submitted });
                } catch (err) {
                    log.error('fillForm:error', { error: err.message });
                    sendResponse({ success: false, error: err.message });
                }
            })();
            return true;
        }

        if (action === 'uploadResume') {
            (async () => {
                const ok = await uploadResume(document);
                sendResponse({ success: ok });
            })();
            return true;
        }

        if (action === 'serializeForm') {
            const fields = serializeForm(document, message.profile);
            // Strip DOM refs for serialization
            const safe = fields.map(({ element, elements, ...rest }) => rest);
            sendResponse({ success: true, fields: safe });
            return false;
        }

        if (action === 'applyAnswers') {
            (async () => {
                // Re-serialize to get fresh element refs
                const fields = serializeForm(document, message.profile);
                const result = await applyAnswers(fields, message.answers, {});
                sendResponse({ success: true, ...result });
            })();
            return true;
        }

        if (action === 'batchAnswerFields') {
            (async () => {
                try {
                    const answers = SA
                        ? await SA.batchGetAnswers(message.fields, message.profile, message.job)
                        : {};
                    sendResponse(answers);
                } catch (err) {
                    log.error('batchAnswerFields:error', { error: err.message });
                    sendResponse({});
                }
            })();
            return true;
        }
    });

    // ========== ATS PAGE INDICATOR ==========
    // Only show on non-LinkedIn pages (LinkedIn has its own UI)
    if (!window.location.hostname.includes('linkedin.com')) {
        const indicator = document.createElement('div');
        indicator.id = 'unhireable-indicator';
        indicator.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white; padding: 10px 18px; border-radius: 24px;
            font-size: 13px; font-family: system-ui, sans-serif;
            z-index: 99999; box-shadow: 0 4px 20px rgba(99,102,241,0.5);
            cursor: pointer; display: flex; align-items: center; gap: 8px;
        `;
        indicator.textContent = '🚀 ';
        const span = document.createElement('span');
        span.textContent = 'Unhireable Ready';
        indicator.appendChild(span);
        indicator.onclick = () => indicator.remove();
        document.body.appendChild(indicator);
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0';
                indicator.style.transition = 'opacity 0.3s';
                setTimeout(() => indicator.remove(), 300);
            }
        }, 5000);
    }

    // ========== EXPOSE API ==========
    window.UnhireableFiller = {
        batchFill,
        serializeForm,
        applyAnswers,
        uploadResume,
        generateCoverLetter,
        isCoverLetterField,
        getFieldLabel,
        askUserForAnswer,
    };

    log.info('filler:loaded', { version: 'universal-v1' });
})();

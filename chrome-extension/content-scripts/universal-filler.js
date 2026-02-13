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

    // ========== LABEL EXTRACTION ==========
    function getFieldLabel(el, container) {
        const root = container || document;
        // 1. Explicit <label for="id">
        const id = el.id || el.getAttribute('for');
        if (id) {
            const label = root.querySelector(`label[for="${id}"]`);
            if (label) return label.textContent.trim();
        }
        // 2. Wrapping <label>
        const parentLabel = el.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        // 3. Walk up to find label/legend
        let parent = el.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
            const label = parent.querySelector('label, legend, [class*="label"], [class*="title"]');
            if (label && label.textContent.trim().length > 1) return label.textContent.trim();
            parent = parent.parentElement;
        }
        // 4. Fallbacks
        return el.placeholder || el.name || el.getAttribute('aria-label') || '';
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
        root.querySelectorAll(
            'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"]), textarea'
        ).forEach((el, i) => {
            const label = getFieldLabel(el, root);
            if (!label || label.length < 2) return;

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

        // Radio groups
        root.querySelectorAll('fieldset, [role="radiogroup"], .jobs-easy-apply-form-section__grouping').forEach((fs, i) => {
            const radios = fs.querySelectorAll('input[type="radio"]');
            if (!radios.length) return;

            // Skip if already selected
            if (Array.from(radios).some(r => r.checked)) return;

            const legend = fs.querySelector('legend, label, [class*="label"], .t-14');
            const question = legend?.textContent?.trim();
            if (!question || question.length < 3) return;

            // Skip resume radio groups (handled by hook)
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

        log.info('serialize', { count: fields.length, container: container?.className?.substring(0, 40) || 'document' });
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

                        // Fallback: first non-disabled
                        if (!matched && field.elements?.length > 0) {
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
    async function defaultHumanType(input, value) {
        input.focus();
        input.value = '';
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        for (const char of value) {
            input.value += char;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(rand(10, 30));
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // ========== COVER LETTER GENERATOR ==========
    // Shared between LinkedIn and ATS. Backend API → template fallback.
    const API_BASE = 'http://localhost:3003';
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

        // Try backend API first
        try {
            const resp = await fetch(`${API_BASE}/api/generate-cover-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job: { title, company },
                    profile: { name, skills: topSkills, summary: profile?.summary },
                }),
                signal: AbortSignal.timeout(5000),
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.coverLetter) {
                    log.info('cover_letter:api', { company, length: data.coverLetter.length });
                    coverLetterCache[cacheKey] = data.coverLetter;
                    return data.coverLetter;
                }
            }
        } catch (e) {
            log.debug('cover_letter:api_failed', { error: e.message });
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

        // 5. Fallback layer — required fields with no answer
        for (const field of batchFields) {
            if (answers[field.id]) continue;
            if (!field.required) continue;

            let fallback = null;
            if (field.type === 'select' && field.options?.length > 0) {
                fallback = field.options[0]; // first valid option
            } else if (field.type === 'radio' && field.options?.length > 0) {
                fallback = field.options[0];
            } else if (field.type === 'text') {
                const l = field.label.toLowerCase();
                const info = profile?.personal_info || {};
                if (l.includes('experience') || l.includes('years')) fallback = String(info.years_experience || '3');
                else if (l.includes('name')) fallback = info.name || '';
                else if (l.includes('email')) fallback = info.email || '';
                else if (l.includes('phone')) fallback = info.phone || '';
            }

            if (fallback) {
                answers[field.id] = { answer: fallback, source: 'fallback' };
                log.warn('fallback_used', { label: field.label, type: field.type, value: fallback });
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
        indicator.innerHTML = '🚀 <span>Unhireable Ready</span>';
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
    };

    log.info('filler:loaded', { version: 'universal-v1' });
})();

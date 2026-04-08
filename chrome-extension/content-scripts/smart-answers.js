// Unhireable Auto-Apply — Smart Answer System (v2)
// Persona-scoped caching + batched LLM calls.
//
// Usage:
//   const SA = window.UnhireableAnswers;
//   // Single field:
//   const result = await SA.getSmartAnswer(question, 'text', null, profile, job);
//   // Batch (preferred — one LLM call for all unknowns):
//   const answers = await SA.batchGetAnswers(fields, profile, job);

(function () {
    'use strict';

    // ========== CONFIG ==========
    const API_BASE_URL = 'http://localhost:3030';

    // ========== SESSION STATS ==========
    const sessionStats = {
        started: new Date().toISOString(),
        geminiCalls: 0,
        geminiSuccesses: 0,
        geminiFails: 0,
        gemini429s: 0,
        patternMatches: 0,
        cacheHits: 0,
        batchCalls: 0,
    };

    // ========== GEMINI CIRCUIT BREAKER ==========
    const geminiCircuit = {
        consecutive429s: 0,
        isOpen: false,
        openedAt: 0,
        cooldownMs: 60000,
        maxConsecutive429s: 3,

        recordSuccess() {
            this.consecutive429s = 0;
            this.isOpen = false;
        },
        record429() {
            this.consecutive429s++;
            sessionStats.gemini429s++;
            if (this.consecutive429s >= this.maxConsecutive429s) {
                this.isOpen = true;
                this.openedAt = Date.now();
                console.warn(`[Unhireable] 🔴 Gemini circuit OPEN — ${this.consecutive429s} consecutive 429s`);
            }
        },
        shouldSkip() {
            if (!this.isOpen) return false;
            if (Date.now() - this.openedAt > this.cooldownMs) {
                this.isOpen = false;
                this.consecutive429s = 0;
                return false;
            }
            return true;
        }
    };

    // ========== UTILITIES ==========
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function logSessionStats() {
        console.log('[Unhireable] 📊 Session Stats:', JSON.stringify(sessionStats, null, 2));
    }

    // ========== PERSONA ==========
    let _activePersonaId = 'default';

    async function getActivePersonaId() {
        try {
            const { activePersonaId } = await chrome.storage.local.get(['activePersonaId']);
            _activePersonaId = activePersonaId || 'default';
        } catch { }
        return _activePersonaId;
    }

    function cacheStorageKey() {
        return `answerCache_${_activePersonaId}`;
    }

    // ========== CACHE KEY ==========
    function normalizeQuestion(question) {
        return question.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 100);
    }

    // ========== TIER 2: PERSONA-SCOPED CACHE ==========
    async function getAnswerFromCache(question) {
        const key = normalizeQuestion(question);
        const storageKey = cacheStorageKey();
        const store = await chrome.storage.local.get([storageKey]);
        const cache = store[storageKey] || {};
        if (cache[key]) {
            cache[key].usedCount = (cache[key].usedCount || 0) + 1;
            cache[key].lastUsed = new Date().toISOString();
            await chrome.storage.local.set({ [storageKey]: cache });
            return cache[key];
        }
        return null;
    }

    async function saveAnswerToCache(question, answer, metadata = {}) {
        const key = normalizeQuestion(question);
        const storageKey = cacheStorageKey();
        const store = await chrome.storage.local.get([storageKey]);
        const cache = store[storageKey] || {};
        cache[key] = {
            answer,
            question: question.substring(0, 200),
            fieldType: metadata.fieldType || 'text',
            confidence: metadata.confidence || 'medium',
            source: metadata.source || 'llm',
            usedCount: 1,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };
        await chrome.storage.local.set({ [storageKey]: cache });
    }

    async function saveBatchToCache(answersMap, fieldsMap) {
        const storageKey = cacheStorageKey();
        const store = await chrome.storage.local.get([storageKey]);
        const cache = store[storageKey] || {};
        for (const [fieldId, answer] of Object.entries(answersMap)) {
            const field = fieldsMap[fieldId];
            if (!field || !answer) continue;
            const key = normalizeQuestion(field.label);
            cache[key] = {
                answer,
                question: field.label.substring(0, 200),
                fieldType: field.type || 'text',
                confidence: 'high',
                source: 'llm_batch',
                usedCount: 1,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            };
        }
        await chrome.storage.local.set({ [storageKey]: cache });
        syncToBackend().catch(() => { });
    }

    // ========== TIER 1: PATTERN MATCHING ==========
    // ONLY ultra-safe patterns that never produce wrong answers.
    // Everything else goes through the LLM batch which can see actual options.
    function getFieldValue(label, profile, job = null) {
        const l = label.toLowerCase();
        const info = profile?.personal_info || {};

        // Contact info — unambiguous exact matches
        if (l.includes('first name')) return info.name?.split(' ')[0] || '';
        if (l.includes('last name')) return info.name?.split(' ').slice(1).join(' ') || '';
        if (l.includes('full name') || l === 'name') return info.name || '';
        if (l.includes('email') && !l.includes('country')) return info.email || '';
        if (l.includes('phone') && !l.includes('country')) return info.phone || '';
        if (l.includes('linkedin')) return info.linkedin || info.linkedin_url || '';

        // Work authorization — safe because there's only one correct answer
        if (l.includes('authorized') || l.includes('legally') || l.includes('right to work')) return 'Yes';

        // Start date — nearly always "Immediately" or ASAP
        if (l.includes('start date') || l.includes('available to start') || l.includes('when can you start')) return 'Immediately';

        // No match — will go to cache then LLM
        return '';
    }

    // ========== TIER 3: BATCHED GEMINI ==========

    async function askGeminiBatch(unknowns, profile, job) {
        if (geminiCircuit.shouldSkip()) {
            console.log('[Unhireable] ⏭️ Gemini circuit open — skipping batch');
            return {};
        }
        if (unknowns.length === 0) return {};

        const { geminiApiKey } = await chrome.storage.local.get(['geminiApiKey']);
        if (!geminiApiKey) {
            console.error('[Unhireable] ❌ No Gemini API key');
            return {};
        }

        sessionStats.geminiCalls++;
        sessionStats.batchCalls++;
        const callNum = sessionStats.geminiCalls;

        const fieldDescriptions = unknowns.map(f => {
            let desc = `- [${f.id}] "${f.label}" (type: ${f.type})`;
            if (f.options?.length) desc += ` options: [${f.options.join(', ')}]`;
            if (f.required) desc += ' [REQUIRED]';
            return desc;
        }).join('\n');

        const skillsList = (Array.isArray(profile?.skills) ? profile.skills : profile?.skills?.technical_skills)?.slice(0, 8)?.join(', ') || '';

        const prompt = `You are filling out a job application form. Based on the candidate profile, provide the best answer for each field.

CANDIDATE:
- Name: ${profile?.personal_info?.name || ''}
- Email: ${profile?.personal_info?.email || ''}
- Location: ${profile?.personal_info?.location || ''}
- Years Experience: ${profile?.personal_info?.years_experience || '5'}
- Skills: ${skillsList}
- Requires Sponsorship: ${profile?.personal_info?.requires_sponsorship ? 'Yes' : 'No'}
- Summary: ${(profile?.summary || '').substring(0, 200)}

JOB: ${job?.title || 'Software Engineer'} at ${job?.company || 'Tech Company'}

FIELDS TO FILL:
${fieldDescriptions}

RULES:
- For radio/select: respond with EXACT text of one option
- For checkboxes about consent/terms: respond "check"
- For text: concise professional answer
- For textarea: 2-3 sentence professional answer
- For gender: pick "Male" unless profile says otherwise
- For authorization: "Yes" for authorized, "No" for sponsorship
- For relocation: "Yes"

Respond ONLY with a JSON object mapping field IDs to answers. No markdown, no explanation.
Example: {"text_0": "John Doe", "radio_1": "Male"}`;

        console.log(`[Unhireable] 🔥 GEMINI BATCH CALL #${callNum} | ${unknowns.length} fields`);

        const MAX_RETRIES = 2;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.3,
                                responseMimeType: 'application/json'
                            }
                        })
                    }
                );

                if (response.status === 429) {
                    geminiCircuit.record429();
                    const backoff = 4000 * Math.pow(2, attempt);
                    if (geminiCircuit.isOpen) return {};
                    console.warn(`[Unhireable] ⏳ 429 — retry in ${backoff / 1000}s`);
                    await sleep(backoff);
                    continue;
                }

                if (!response.ok) {
                    sessionStats.geminiFails++;
                    console.error(`[Unhireable] ❌ Gemini ${response.status}`);
                    return {};
                }

                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const answers = JSON.parse(clean);

                sessionStats.geminiSuccesses++;
                geminiCircuit.recordSuccess();
                console.log(`[Unhireable] ✅ Gemini batch #${callNum}: ${Object.keys(answers).length} answers`);
                return answers;

            } catch (error) {
                sessionStats.geminiFails++;
                console.error('[Unhireable] ❌ Gemini batch error:', error.message);
            }
        }
        return {};
    }

    // Backward-compat shims for greenhouse.js/lever.js (wraps batch)
    async function askGeminiForAnswer(question, fieldType, options, profile, job) {
        const answers = await askGeminiBatch([{
            id: 'single_0', label: question, type: fieldType, options
        }], profile, job);
        return answers['single_0'] || null;
    }
    async function getSmartAnswer(question, fieldType, options, profile, job) {
        const patternAnswer = getFieldValue(question, profile, job);
        if (patternAnswer) { sessionStats.patternMatches++; return { answer: patternAnswer, source: 'pattern' }; }
        const cached = await getAnswerFromCache(question);
        if (cached) { sessionStats.cacheHits++; return { answer: cached.answer, source: 'cache' }; }
        const llmAnswer = await askGeminiForAnswer(question, fieldType, options, profile, job);
        if (llmAnswer) { await saveAnswerToCache(question, llmAnswer, { fieldType, options, source: 'llm' }); return { answer: llmAnswer, source: 'llm' }; }
        return { answer: null, source: 'failed' };
    }
    function logUnknownField(el, label, value) {
        console.log(`[Unhireable] ❓ Unknown field: "${label}" = "${value}"`);
    }

    // ========== ORCHESTRATOR: BATCH (PREFERRED) ==========
    // Accepts: [{id, label, type, options, currentValue}]
    // Returns: {fieldId: {answer, source}}
    async function batchGetAnswers(fields, profile, job = null) {
        await getActivePersonaId();
        const results = {};
        const needsLLM = [];
        const fieldsMap = {};

        for (const field of fields) {
            // Skip already-filled
            if (field.currentValue?.trim()) continue;

            fieldsMap[field.id] = field;

            // Tier 1: Pattern match
            const labelForMatch = field.type === 'radio' || field.type === 'select'
                ? `${field.label} (options: ${(field.options || []).join(', ')})`
                : field.label;
            const patternAnswer = getFieldValue(labelForMatch, profile, job);
            if (patternAnswer) {
                sessionStats.patternMatches++;
                results[field.id] = { answer: patternAnswer, source: 'pattern' };
                continue;
            }

            // Tier 2: Cache
            const cached = await getAnswerFromCache(field.label);
            if (cached) {
                sessionStats.cacheHits++;
                results[field.id] = { answer: cached.answer, source: 'cache' };
                continue;
            }

            // Needs LLM
            needsLLM.push(field);
        }

        console.log(`[Unhireable] 📊 Batch: ${fields.length} total | ${Object.keys(results).length} resolved (${sessionStats.patternMatches} pattern, ${sessionStats.cacheHits} cache) | ${needsLLM.length} need LLM`);

        // Tier 3: One Gemini call for ALL remaining unknowns
        if (needsLLM.length > 0) {
            const llmAnswers = await askGeminiBatch(needsLLM, profile, job);
            for (const [fieldId, answer] of Object.entries(llmAnswers)) {
                if (answer) {
                    results[fieldId] = { answer, source: 'llm' };
                }
            }
            // Save all LLM answers to cache for next time
            await saveBatchToCache(llmAnswers, fieldsMap);
        }

        return results;
    }

    // ========== BACKEND SYNC ==========
    async function syncToBackend() {
        try {
            const personaId = _activePersonaId;
            const storageKey = cacheStorageKey();
            const store = await chrome.storage.local.get([storageKey]);
            const cache = store[storageKey] || {};
            const entries = Object.entries(cache).map(([key, val]) => ({
                normalized_key: key,
                question: val.question || key,
                answer: val.answer || '',
                field_type: val.fieldType || null,
                source: val.source || null,
                confidence: val.confidence || null,
                hit_count: val.usedCount || 1,
                persona_id: personaId,
            }));
            if (entries.length === 0) return;

            const resp = await fetch(`${API_BASE_URL}/api/answer-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entries),
            });
            if (resp.ok) {
                const result = await resp.json();
                console.log(`[Unhireable] 🔄 Synced ${result.data?.upserted || 0} answers (persona: ${personaId})`);
            }
        } catch (e) {
            console.debug('[Unhireable] ⚠️ Backend sync unavailable:', e.message);
        }
    }

    async function pullFromBackend() {
        try {
            await getActivePersonaId();
            const resp = await fetch(`${API_BASE_URL}/api/answer-cache?persona_id=${_activePersonaId}`);
            if (!resp.ok) return;
            const { data: entries } = await resp.json();
            if (!entries || entries.length === 0) return;

            const storageKey = cacheStorageKey();
            const store = await chrome.storage.local.get([storageKey]);
            const cache = store[storageKey] || {};
            let merged = 0;
            for (const entry of entries) {
                const key = entry.normalized_key;
                if (!cache[key]) {
                    cache[key] = {
                        answer: entry.answer,
                        question: entry.question,
                        fieldType: entry.field_type || 'text',
                        confidence: entry.confidence || 'medium',
                        source: entry.source || 'backend',
                        usedCount: entry.hit_count || 1,
                        createdAt: entry.created_at || new Date().toISOString(),
                        lastUsed: entry.updated_at || new Date().toISOString(),
                    };
                    merged++;
                }
            }
            if (merged > 0) {
                await chrome.storage.local.set({ [storageKey]: cache });
                console.log(`[Unhireable] 📥 Pulled ${merged} answers for persona "${_activePersonaId}"`);
            }
        } catch (e) {
            console.debug('[Unhireable] ⚠️ Backend pull unavailable:', e.message);
        }
    }

    // ========== EXPOSE API ==========
    window.UnhireableAnswers = {
        // Batch (preferred — all callers should use this)
        batchGetAnswers,
        // Tier 1 pattern matching (used by universal-filler)
        getFieldValue,
        getAnswerFromCache,
        saveAnswerToCache,
        normalizeQuestion,
        syncToBackend,
        pullFromBackend,
        sessionStats,
        geminiCircuit,
        logSessionStats,
        getActivePersonaId,
        // Backward-compat shims (greenhouse.js, lever.js)
        getSmartAnswer,
        askGeminiForAnswer,
        logUnknownField,
    };

    // Pull cached answers on load
    pullFromBackend().catch(() => { });

    console.log('[Unhireable] 🧠 Smart Answers v2 loaded (persona-scoped, batch-ready)');
})();

// Unhireable — Structured Logger & Audit Trail
// Loaded first on all pages. Provides window.UHLog.

(function () {
    'use strict';

    const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
    let currentLevel = LOG_LEVELS.info;

    const STORAGE_KEY = 'uhApplyAudit';
    const MAX_SESSIONS = 20;

    // ========== CURRENT SESSION ==========
    const session = {
        id: crypto.randomUUID().slice(0, 8),
        startedAt: new Date().toISOString(),
        jobs: [],
        totals: {
            geminiCalls: 0,
            patternHits: 0,
            cacheHits: 0,
            fallbacks: 0,
            fieldsFilled: 0,
            fieldsFailed: 0,
        },
    };

    let _currentJob = null; // active job context
    let _currentStep = null; // active step context

    // ========== CORE LOGGING ==========
    function emit(level, event, data) {
        if (LOG_LEVELS[level] < currentLevel) return;
        const entry = {
            t: new Date().toISOString(),
            s: session.id,
            level,
            event,
            ...data,
        };
        const fn = level === 'error' ? console.error
            : level === 'warn' ? console.warn
                : level === 'debug' ? console.debug
                    : console.log;
        fn(`[UH:${level}] ${event}`, data || '');
        return entry;
    }

    // ========== FIELD-LEVEL LOGGING ==========
    function field(action, detail) {
        emit('info', `field:${action}`, detail);
        if (_currentStep) {
            _currentStep.fields.push({
                action,
                label: detail.label,
                type: detail.type,
                answer: detail.answer,
                source: detail.source,
                error: detail.error,
            });
        }
        // Update totals
        if (action === 'filled') session.totals.fieldsFilled++;
        if (action === 'failed') session.totals.fieldsFailed++;
        if (detail.source === 'pattern') session.totals.patternHits++;
        if (detail.source === 'cache') session.totals.cacheHits++;
        if (detail.source === 'fallback') session.totals.fallbacks++;
    }

    // ========== STEP-LEVEL LOGGING ==========
    function stepStart(stepNum) {
        _currentStep = { num: stepNum, fields: [], startedAt: Date.now() };
        emit('info', 'step:start', { step: stepNum });
    }

    function stepEnd(result) {
        if (!_currentStep) return;
        const summary = {
            step: _currentStep.num,
            durationMs: Date.now() - _currentStep.startedAt,
            fieldsTotal: _currentStep.fields.length,
            filled: _currentStep.fields.filter(f => f.action === 'filled').length,
            failed: _currentStep.fields.filter(f => f.action === 'failed').length,
            result,
        };
        emit('info', 'step:end', summary);
        if (_currentJob) _currentJob.steps.push({ ..._currentStep, ...summary });
        _currentStep = null;
        return summary;
    }

    // ========== JOB-LEVEL LOGGING ==========
    function jobStart(job) {
        _currentJob = {
            title: job.title,
            company: job.company,
            id: job.id,
            type: job.hasEasyApply ? 'easy_apply' : 'external',
            startedAt: Date.now(),
            steps: [],
            geminiCalls: 0,
            status: 'in_progress',
        };
        emit('info', 'job:start', { title: job.title, company: job.company });
    }

    function jobEnd(status, detail) {
        if (!_currentJob) return;
        _currentJob.status = status;
        _currentJob.error = detail?.error;
        _currentJob.durationMs = Date.now() - _currentJob.startedAt;
        emit(status === 'applied' ? 'info' : 'warn', 'job:end', {
            title: _currentJob.title,
            company: _currentJob.company,
            status,
            durationMs: _currentJob.durationMs,
            steps: _currentJob.steps.length,
            error: detail?.error,
        });
        session.jobs.push(_currentJob);
        _currentJob = null;
    }

    function geminiCall(detail) {
        session.totals.geminiCalls++;
        if (_currentJob) _currentJob.geminiCalls++;
        emit('info', 'gemini:call', detail);
    }

    // ========== PERSISTENCE ==========
    async function flush() {
        try {
            const store = await chrome.storage.local.get([STORAGE_KEY]);
            const history = store[STORAGE_KEY] || [];
            history.unshift({
                ...session,
                endedAt: new Date().toISOString(),
                jobs: session.jobs.map(j => ({
                    title: j.title,
                    company: j.company,
                    status: j.status,
                    error: j.error,
                    durationMs: j.durationMs,
                    steps: j.steps.length,
                    geminiCalls: j.geminiCalls,
                })),
            });
            // Keep only recent sessions
            if (history.length > MAX_SESSIONS) history.length = MAX_SESSIONS;
            await chrome.storage.local.set({ [STORAGE_KEY]: history });
            emit('info', 'audit:flushed', { sessions: history.length });
        } catch (e) {
            console.error('[UH] Audit flush failed:', e.message);
        }
    }

    async function sync(backendUrl) {
        try {
            const store = await chrome.storage.local.get([STORAGE_KEY]);
            const history = store[STORAGE_KEY] || [];
            if (history.length === 0) return;
            const resp = await fetch(`${backendUrl}/api/apply-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessions: history.slice(0, 5) }),
                signal: AbortSignal.timeout(5000),
            });
            if (resp.ok) emit('info', 'audit:synced');
        } catch (e) {
            emit('debug', 'audit:sync_failed', { error: e.message });
        }
    }

    // ========== EXPOSE API ==========
    window.UHLog = {
        // Core logging
        debug: (event, data) => emit('debug', event, data),
        info: (event, data) => emit('info', event, data),
        warn: (event, data) => emit('warn', event, data),
        error: (event, data) => emit('error', event, data),

        // Structured tracking
        field,
        stepStart,
        stepEnd,
        jobStart,
        jobEnd,
        geminiCall,

        // Persistence
        flush,
        sync,

        // Accessors
        session,
        setLevel(level) { currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info; },
    };

    emit('info', 'logger:loaded', { sessionId: session.id });
})();

// Unhireable Auto-Apply Extension - Background Service Worker
// Handles communication between Tauri app and content scripts

// WebSocket connection to Tauri app (optional - works standalone too)
let ws = null;
let wsReconnectInterval = null;
let wsConnectAttempts = 0;
const WS_URL = 'ws://127.0.0.1:9876';
const MAX_RECONNECT_ATTEMPTS = 3; // Stop trying after 3 failures

// Connect to Tauri app via WebSocket (optional - extension works without it)
function connectToTauriApp() {
    // Don't retry forever if Tauri isn't running
    if (wsConnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        if (wsReconnectInterval) {
            clearInterval(wsReconnectInterval);
            wsReconnectInterval = null;
        }
        console.log('[Unhireable] Tauri app not running - using standalone mode');
        return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        return; // Already connected
    }

    wsConnectAttempts++;

    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('[Unhireable] Connected to Tauri app');
            chrome.action.setBadgeText({ text: '✓' });
            chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
            wsConnectAttempts = 0; // Reset on successful connection

            // Clear reconnect interval
            if (wsReconnectInterval) {
                clearInterval(wsReconnectInterval);
                wsReconnectInterval = null;
            }
        };

        ws.onmessage = async (event) => {
            try {
                const command = JSON.parse(event.data);
                console.log('[Unhireable] Received command:', command.action);

                const response = await handleCommand(command);
                ws.send(JSON.stringify(response));
            } catch (err) {
                console.error('[Unhireable] Error handling command:', err);
                ws.send(JSON.stringify({
                    success: false,
                    error: err.message
                }));
            }
        };

        ws.onclose = () => {
            ws = null;
            // Only try to reconnect if we were previously connected
            if (wsConnectAttempts === 1) {
                console.log('[Unhireable] Disconnected from Tauri app');
            }
        };

        ws.onerror = () => {
            // Silent error - don't spam console when Tauri isn't running
            ws = null;
        };

    } catch (err) {
        // Silent - Tauri app not running is normal
    }
}

// Handle commands from Tauri app
async function handleCommand(command) {
    switch (command.action) {
        case 'openUrl':
            return await handleOpenUrl(command);

        case 'fillForm':
            return await handleFillForm(command);

        case 'submit':
            return await handleSubmit();

        case 'getStatus':
            return await handleGetStatus();

        case 'closeTab':
            return await handleCloseTab();

        case 'nextJob':
            return await handleNextJob();

        case 'ping':
            return { success: true, message: 'pong' };

        default:
            return { success: false, error: `Unknown command: ${command.action}` };
    }
}

// Open URL in new tab and wait for load
async function handleOpenUrl(command) {
    try {
        const tab = await chrome.tabs.create({ url: command.url, active: true });

        if (command.waitForLoad) {
            // Wait for page to finish loading
            await new Promise((resolve) => {
                const listener = (tabId, info) => {
                    if (tabId === tab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);

                // Timeout after 30 seconds
                setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }, 30000);
            });
        }

        return { success: true, data: { tabId: tab.id } };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Send fill form command to content script
async function handleFillForm(command) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            return { success: false, error: 'No active tab' };
        }

        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'fillForm',
            profile: command.profile,
            autoSubmit: command.autoSubmit,
            humanMode: command.humanMode
        });

        return response || { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Trigger form submission
async function handleSubmit() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            return { success: false, error: 'No active tab' };
        }

        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'submit'
        });

        return response || { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Get current page status
async function handleGetStatus() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            return { success: false, error: 'No active tab' };
        }

        return {
            success: true,
            data: {
                url: tab.url,
                title: tab.title,
                status: tab.status
            }
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Close current tab
async function handleCloseTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await chrome.tabs.remove(tab.id);
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Navigate to next job in list
async function handleNextJob() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            return { success: false, error: 'No active tab' };
        }

        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'nextJob'
        });

        return response || { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Unhireable Auto-Apply extension installed');

    // Initialize default settings
    chrome.storage.local.set({
        autoSubmit: false,  // Start with manual submit for safety
        humanDelay: true,   // Enable human-like delays
        delayMs: { min: 50, max: 150 }  // Typing delay range
    });

    // Try to connect to Tauri app
    connectToTauriApp();
});

// Try to connect on startup
chrome.runtime.onStartup.addListener(() => {
    connectToTauriApp();
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Unhireable Background] Received:', message.type || message.action);

    if (message.type === 'saveJob') {
        // Save matched job to extension storage (and send to Tauri if connected)
        chrome.storage.local.get(['matchedJobs'], (result) => {
            const jobs = result.matchedJobs || [];
            // Avoid duplicates
            if (!jobs.find(j => j.id === message.job.id)) {
                jobs.push(message.job);
                chrome.storage.local.set({ matchedJobs: jobs }, () => {
                    console.log(`[Unhireable] Saved job: ${message.job.title} (${jobs.length} total)`);
                });
            }
        });

        // Forward to Tauri if connected
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'saveJob', job: message.job }));
        }

        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'markApplied') {
        // Update job status
        chrome.storage.local.get(['matchedJobs', 'appliedJobs'], (result) => {
            const matched = result.matchedJobs || [];
            const applied = result.appliedJobs || [];

            const jobIndex = matched.findIndex(j => j.id === message.jobId);
            if (jobIndex >= 0) {
                const job = { ...matched[jobIndex], appliedAt: new Date().toISOString() };
                applied.push(job);
                matched.splice(jobIndex, 1);
                chrome.storage.local.set({ matchedJobs: matched, appliedJobs: applied }, () => {
                    console.log(`[Unhireable] Marked applied: ${job.title}`);
                });
            }
        });

        // Forward to Tauri if connected
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'markApplied', jobId: message.jobId }));
        }

        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'status') {
        // Update badge with counts
        const text = message.applied > 0 ? `${message.applied}` : '';
        chrome.action.setBadgeText({ text });
        chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
        sendResponse({ success: true });
        return true;
    }

    // ========== BATCH EXTERNAL APPLY (multi-tab orchestration) ==========
    if (message.type === 'batchExternalApply') {
        (async () => {
            const jobs = message.jobs || [];
            const profile = message.profile;
            const linkedInTabId = sender.tab?.id;

            console.log(`[Unhireable Batch] Starting batch for ${jobs.length} external jobs`);

            const ATS_REGEX =
                /ashbyhq\.com|boards\.greenhouse\.io|lever\.co|myworkdayjobs\.com|workday\.com.*\/job\/|icims\.com|smartrecruiters\.com|bamboohr\.com|jazz\.co|jobvite\.com|breezy\.hr|applytojob\.com|recruitee\.com/;

            // Step 1: Open all tabs
            const tabJobs = []; // {tabId, job, url}
            for (const job of jobs.slice(0, 6)) {
                if (!job.url) continue;
                try {
                    const tab = await chrome.tabs.create({ url: job.url, active: false });
                    tabJobs.push({ tabId: tab.id, job });
                    console.log(`[Unhireable Batch] Opened tab ${tab.id} for ${job.title || job.url}`);
                } catch (e) {
                    console.error(`[Unhireable Batch] Failed to open tab for ${job.url}:`, e.message);
                }
            }

            if (tabJobs.length === 0) {
                sendResponse({ success: false, error: 'No tabs opened' });
                return;
            }

            // Step 2: Wait for all tabs to load
            await Promise.all(tabJobs.map(tj => new Promise(resolve => {
                const timeout = setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }, 30000);
                const listener = (tabId, info) => {
                    if (tabId === tj.tabId && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        clearTimeout(timeout);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
                // Check if already loaded
                chrome.tabs.get(tj.tabId, tab => {
                    if (tab?.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            })));

            // Wait for content scripts to initialize
            await new Promise(r => setTimeout(r, 3000));

            // Filter to supported ATS only
            const validTabs = [];
            for (const tj of tabJobs) {
                try {
                    const tab = await chrome.tabs.get(tj.tabId);
                    tj.url = tab.url || '';
                    if (ATS_REGEX.test(tj.url)) {
                        validTabs.push(tj);
                    } else {
                        console.log(`[Unhireable Batch] Unsupported ATS: ${tj.url}`);
                        try { await chrome.tabs.remove(tj.tabId); } catch (_) { }
                    }
                } catch (_) { }
            }

            if (validTabs.length === 0) {
                sendResponse({ success: false, error: 'No supported ATS pages found' });
                return;
            }

            // Step 3: Upload resumes to all tabs (parallel)
            await Promise.allSettled(validTabs.map(tj =>
                chrome.tabs.sendMessage(tj.tabId, { action: 'uploadResume' }).catch(() => null)
            ));
            await new Promise(r => setTimeout(r, 4000)); // Wait for parsing

            // Step 4: Serialize all forms (parallel)
            const allFields = []; // {tabId, fields: [{id, label, type, options, currentValue}]}
            await Promise.allSettled(validTabs.map(async tj => {
                try {
                    const result = await chrome.tabs.sendMessage(tj.tabId, { action: 'serializeForm' });
                    if (result?.fields?.length) {
                        allFields.push({ tabId: tj.tabId, job: tj.job, fields: result.fields });
                        console.log(`[Unhireable Batch] Tab ${tj.tabId}: ${result.fields.length} fields`);
                    }
                } catch (e) {
                    console.error(`[Unhireable Batch] Serialize failed for tab ${tj.tabId}:`, e.message);
                }
            }));

            // Step 5: Merge all unknowns, batch through smart-answers
            // We send all fields to a single content script tab to run batchGetAnswers
            // (smart-answers runs in content script context)
            const primaryTabId = validTabs[0].tabId;

            // Build merged field list with tab prefixes
            const mergedFields = [];
            for (const { tabId, fields } of allFields) {
                for (const field of fields) {
                    mergedFields.push({
                        ...field,
                        id: `tab${tabId}_${field.id}`,
                        _originalId: field.id,
                        _tabId: tabId
                    });
                }
            }

            console.log(`[Unhireable Batch] Total fields across ${allFields.length} tabs: ${mergedFields.length}`);

            // Run batch answer on primary tab
            let batchAnswers = {};
            try {
                batchAnswers = await chrome.tabs.sendMessage(primaryTabId, {
                    action: 'batchAnswerFields',
                    fields: mergedFields,
                    profile: profile
                });
            } catch (e) {
                console.error(`[Unhireable Batch] Batch answer failed:`, e.message);
                // Fallback: fill each tab individually
                for (const tj of validTabs) {
                    try {
                        await chrome.tabs.sendMessage(tj.tabId, {
                            action: 'fillForm', profile, autoSubmit: false
                        });
                    } catch (_) { }
                }
                sendResponse({ success: true, mode: 'individual_fallback', tabs: validTabs.length });
                return;
            }

            // Step 6: Distribute answers back to each tab
            const results = [];
            for (const { tabId, fields } of allFields) {
                // Extract this tab's answers from the merged batch
                const tabAnswers = {};
                for (const field of fields) {
                    const mergedId = `tab${tabId}_${field.id}`;
                    if (batchAnswers[mergedId]) {
                        tabAnswers[field.id] = batchAnswers[mergedId];
                    }
                }

                try {
                    const result = await chrome.tabs.sendMessage(tabId, {
                        action: 'applyAnswers',
                        fields: fields,
                        answers: tabAnswers
                    });
                    results.push({ tabId, success: true, filled: result?.filled?.length || 0 });
                    console.log(`[Unhireable Batch] Tab ${tabId}: filled ${result?.filled?.length || 0} fields`);
                } catch (e) {
                    results.push({ tabId, success: false, error: e.message });
                }
            }

            // Step 7: Clean up
            await new Promise(r => setTimeout(r, 2000));
            for (const tj of validTabs) {
                try { await chrome.tabs.remove(tj.tabId); } catch (_) { }
            }
            if (linkedInTabId) {
                try { await chrome.tabs.update(linkedInTabId, { active: true }); } catch (_) { }
            }

            sendResponse({ success: true, mode: 'batch', results, totalTabs: validTabs.length });
        })();
        return true;
    }

    if (message.type === 'externalApply') {
        // Handle external application with proper sequencing:
        // 1. Set up tab watcher FIRST, 2. Tell content script to click, 3. Process new tab
        (async () => {
            const linkedInTabId = sender.tab?.id;
            const profile = message.profile;
            const jobTitle = message.jobTitle || 'Unknown';

            console.log(`[Unhireable Background] External apply: ${jobTitle}`);

            try {
                // Step 1: Set up chrome.tabs.onCreated listener BEFORE the click
                const newTabPromise = new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        chrome.tabs.onCreated.removeListener(onCreated);
                        resolve(null);
                    }, 30000);

                    const onCreated = (tab) => {
                        chrome.tabs.onCreated.removeListener(onCreated);
                        clearTimeout(timeout);
                        console.log(`[Unhireable Background] onCreated fired: tab ${tab.id}`);
                        resolve(tab);
                    };
                    chrome.tabs.onCreated.addListener(onCreated);
                });

                // Step 2: Tell content script to click the Apply button NOW
                let clickResult;
                try {
                    clickResult = await chrome.tabs.sendMessage(linkedInTabId, {
                        action: 'clickExternalApply'
                    });
                } catch (clickErr) {
                    console.error(`[Unhireable Background] Click message failed:`, clickErr.message);
                    sendResponse({ success: false, error: 'Failed to click Apply button' });
                    return;
                }

                if (!clickResult?.clicked) {
                    console.log('[Unhireable Background] No Apply button found on page');
                    sendResponse({ success: false, error: 'No Apply button found' });
                    return;
                }

                console.log('[Unhireable Background] Apply button clicked, waiting for new tab...');

                // Step 3: Wait for the new tab (onCreated will fire)
                const newTab = await newTabPromise;

                if (!newTab) {
                    console.log('[Unhireable Background] No new tab detected after 30s — LinkedIn may need manual action or confirmation modal was missed');
                    sendResponse({ success: false, error: 'No new tab detected for external application' });
                    return;
                }

                console.log(`[Unhireable Background] New tab detected: tab ${newTab.id} (${newTab.url || 'loading...'})`);

                // Step 4: Wait for the new tab to fully load (up to 30s)
                await new Promise((resolve) => {
                    // Check if already complete
                    chrome.tabs.get(newTab.id, (tab) => {
                        if (tab?.status === 'complete') {
                            resolve();
                            return;
                        }

                        const timeout = setTimeout(() => {
                            chrome.tabs.onUpdated.removeListener(onUpdated);
                            resolve();
                        }, 30000);

                        const onUpdated = (tabId, info) => {
                            if (tabId === newTab.id && info.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(onUpdated);
                                clearTimeout(timeout);
                                resolve();
                            }
                        };
                        chrome.tabs.onUpdated.addListener(onUpdated);
                    });
                });

                // Some external Apply redirects go through LinkedIn first, wait for final URL
                await new Promise(r => setTimeout(r, 3000));

                // Step 5: Check if this is a supported ATS page
                const updatedTab = await chrome.tabs.get(newTab.id);
                const url = updatedTab.url || '';
                console.log(`[Unhireable Background] Final URL: ${url}`);

                const isSupportedATS =
                    /ashbyhq\.com/.test(url) ||
                    /boards\.greenhouse\.io/.test(url) ||
                    /lever\.co/.test(url) ||
                    /myworkdayjobs\.com/.test(url) ||
                    /workday\.com.*\/job\//.test(url) ||
                    /icims\.com/.test(url) ||
                    /smartrecruiters\.com/.test(url) ||
                    /bamboohr\.com/.test(url) ||
                    /jazz\.co/.test(url) ||
                    /jobvite\.com/.test(url) ||
                    /breezy\.hr/.test(url) ||
                    /applytojob\.com/.test(url) ||
                    /recruitee\.com/.test(url);

                if (!isSupportedATS) {
                    console.log(`[Unhireable Background] Unsupported ATS: ${url}`);
                    try { await chrome.tabs.remove(newTab.id); } catch (_) { }
                    if (linkedInTabId) {
                        try { await chrome.tabs.update(linkedInTabId, { active: true }); } catch (_) { }
                    }
                    sendResponse({ success: false, error: `Unsupported ATS: ${url}`, type: 'unsupported_ats' });
                    return;
                }

                // Extra delay for content scripts to initialize on ATS page
                await new Promise(r => setTimeout(r, 2000));

                // Step 6: Send fillForm to the ATS content script
                console.log(`[Unhireable Background] Sending fillForm to tab ${newTab.id} (${url})`);
                let fillResult;
                try {
                    fillResult = await Promise.race([
                        chrome.tabs.sendMessage(newTab.id, {
                            action: 'fillForm',
                            profile: profile,
                            autoSubmit: false,
                            humanMode: true
                        }),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('fillForm timed out (60s)')), 60000)
                        )
                    ]);
                } catch (fillErr) {
                    console.error(`[Unhireable Background] fillForm error:`, fillErr.message);
                    fillResult = { success: false, error: fillErr.message };
                }

                console.log(`[Unhireable Background] Fill result:`, fillResult);

                // Step 7: Wait a moment, then close
                await new Promise(r => setTimeout(r, 3000));
                try { await chrome.tabs.remove(newTab.id); } catch (_) { }
                if (linkedInTabId) {
                    try { await chrome.tabs.update(linkedInTabId, { active: true }); } catch (_) { }
                }

                sendResponse({
                    success: fillResult?.success || false,
                    type: 'external',
                    atsUrl: url,
                    fillResult: fillResult
                });

            } catch (err) {
                console.error(`[Unhireable Background] External apply error:`, err);
                if (linkedInTabId) {
                    try { await chrome.tabs.update(linkedInTabId, { active: true }); } catch (_) { }
                }
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    // Pass through other messages
    sendResponse({ success: true });
    return true;
});

// Listen for messages from the Unhireable app (external messaging)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.action === 'syncProfile') {
        // Save profile to extension storage
        chrome.storage.local.set({ userProfile: message.profile }, () => {
            console.log('Profile synced from Unhireable app');
            sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
    }

    if (message.action === 'openAndFill') {
        // Open job URL and trigger auto-fill
        chrome.tabs.create({ url: message.jobUrl }, (tab) => {
            // Wait for page to load, then trigger fill
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);

                    // Small delay to ensure content script is ready
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'fillForm',
                            profile: message.profile,
                            autoSubmit: message.autoSubmit
                        }).then(response => {
                            sendResponse(response);
                        }).catch(err => {
                            sendResponse({ success: false, error: err.message });
                        });
                    }, 1000);
                }
            });
        });
        return true; // Keep channel open for async response
    }
});

// Listen for tab updates to show badge on supported pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    const supportedPatterns = [
        /jobs\.ashbyhq\.com/,
        /boards\.greenhouse\.io/,
        /jobs\.lever\.co/,
        /linkedin\.com\/jobs/
    ];

    const isSupported = supportedPatterns.some(p => p.test(tab.url));

    if (isSupported && !ws) {
        // Not connected to Tauri, show supported indicator
        chrome.action.setBadgeText({ tabId, text: '●' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' });
    }
});

// Initial connection attempt
connectToTauriApp();

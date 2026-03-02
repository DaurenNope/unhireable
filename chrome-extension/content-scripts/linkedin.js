// Unhireable - LinkedIn Deep Scanner & Auto-Apply
// Phase 1: Scans jobs, extracts details, matches against profile
// Phase 2: Applies to matched jobs (Easy Apply first, then external)

(function () {
    'use strict';

    // ========== CONFIGURATION ==========
    const CONFIG = {
        maxAppsPerSession: 10,          // Conservative limit per session
        maxPagesToScan: 3,              // Scan up to N pages of results
        delayBetweenJobs: { min: 4000, max: 8000 },
        delayBetweenSteps: { min: 800, max: 1500 },
        typingDelay: { min: 30, max: 80 },
        matchThreshold: 0.4,            // 40% match minimum
    };

    // State
    let isRunning = false;
    let scannedJobs = [];
    let matchedJobs = [];
    let appliedJobs = [];
    let userProfile = null;
    let applyQueueIndex = 0;  // Track current position in apply queue
    let unknownFields = [];   // Track fields we couldn't fill

    // ========== SMART ANSWER SYSTEM (shared module) ==========
    // All smart answer functions live in smart-answers.js (loaded first via manifest)
    // These are thin aliases so existing code doesn't need to change references
    const SA = window.UnhireableAnswers;
    const UF = window.UnhireableFiller;
    const log = window.UHLog || { debug() { }, info() { }, warn() { }, error() { }, field() { }, stepStart() { }, stepEnd() { }, jobStart() { }, jobEnd() { }, geminiCall() { } };
    const sessionStats = SA.sessionStats;
    const geminiCircuit = SA.geminiCircuit;
    const logSessionStats = SA.logSessionStats;
    const normalizeQuestion = SA.normalizeQuestion;
    const getAnswerFromCache = SA.getAnswerFromCache;

    // ========== FIELD VALUE VALIDATION ==========
    // Check if pre-filled values look corrupted (e.g., "5" for name)
    function isValueCorrupted(fieldLabel, value) {
        const label = fieldLabel.toLowerCase();

        // Name fields should not be just a number
        if ((label.includes('name') || label.includes('first') || label.includes('last')) &&
            /^\d+$/.test(value.trim())) {
            console.log(`[Unhireable] ⚠️ Corrupted value detected: "${value}" for "${fieldLabel}"`);
            return true;
        }

        // Phone should have more than 3 digits
        if (label.includes('phone') && value.length < 5) {
            console.log(`[Unhireable] ⚠️ Corrupted phone: "${value}"`);
            return true;
        }

        // Email must contain @
        if (label.includes('email') && value.trim() && !value.includes('@')) {
            console.log(`[Unhireable] ⚠️ Corrupted email: "${value}"`);
            return true;
        }

        return false;
    }

    // Get correct value from profile for common fields
    function getProfileValueForField(fieldLabel, profile) {
        if (!profile?.personal_info) {
            console.log(`[Unhireable] ⚠️ getProfileValueForField: no profile.personal_info`);
            return null;
        }

        const label = fieldLabel.toLowerCase();
        const info = profile.personal_info;

        console.log(`[Unhireable] 🔍 Looking up profile value for: "${label}" (name: "${info.name}")`);

        // First name - check multiple patterns
        if (label.includes('first name') || (label.includes('first') && !label.includes('last'))) {
            const firstName = info.name?.split(' ')[0] || null;
            console.log(`[Unhireable] 🔍 First name lookup: "${firstName}"`);
            return firstName;
        }

        // Last name - check multiple patterns
        if (label.includes('last name') || (label.includes('last') && !label.includes('first'))) {
            const parts = info.name?.split(' ');
            const lastName = parts?.length > 1 ? parts.slice(1).join(' ') : null;
            console.log(`[Unhireable] 🔍 Last name lookup: "${lastName}"`);
            return lastName;
        }

        if (label.includes('phone') || label.includes('mobile')) {
            return info.phone || null;
        }
        if (label.includes('email')) {
            return info.email || null;
        }
        if (label.includes('state') || label.includes('province')) {
            // Extract state from location "City, State" format
            const parts = info.location?.split(',');
            return parts?.length > 1 ? parts[1]?.trim() : 'California';
        }
        if (label.includes('postal') || label.includes('zip')) {
            return '90001'; // Default LA postal code
        }

        console.log(`[Unhireable] ⚠️ No profile value found for: "${label}"`);
        return null;
    }

    // Persist apply queue to survive page reloads
    async function saveApplyQueue() {
        await chrome.storage.local.set({
            applyQueue: matchedJobs,
            applyQueueIndex: applyQueueIndex,
            isApplying: isRunning
        });
    }

    async function loadApplyQueue() {
        const data = await chrome.storage.local.get(['applyQueue', 'applyQueueIndex', 'isApplying', 'userProfile']);
        if (data.applyQueue && data.applyQueue.length > 0) {
            matchedJobs = data.applyQueue;
            applyQueueIndex = data.applyQueueIndex || 0;
            userProfile = data.userProfile;
            return data.isApplying;
        }
        return false;
    }

    // ========== APPLIED JOB TRACKING ==========
    // Dual tracking: Local (Chrome storage) + Backend (API sync)

    // Save applied job locally (always works, even offline)
    async function saveAppliedJobLocally(job) {
        const { appliedJobsHistory = [] } = await chrome.storage.local.get(['appliedJobsHistory']);

        const record = {
            url: job.href || job.url || window.location.href,
            title: job.title || 'Unknown Title',
            company: job.company || 'Unknown Company',
            appliedAt: new Date().toISOString(),
            appliedVia: 'linkedin_easy_apply',
            synced: false  // Will be set to true after backend sync
        };

        // Avoid duplicates by URL
        if (!appliedJobsHistory.some(j => j.url === record.url)) {
            appliedJobsHistory.push(record);
            await chrome.storage.local.set({ appliedJobsHistory });
            console.log(`[Unhireable] 📊 Saved locally: ${record.title} at ${record.company}`);
        }

        return record;
    }

    // Sync applied job to backend API
    async function syncAppliedJobToBackend(job, record) {
        const BACKEND_URL = 'http://localhost:3030'; // Backend API URL

        try {
            // First, try to create or find the job in the backend
            const jobPayload = {
                title: job.title || record.title,
                company: job.company || record.company,
                url: job.href || record.url,
                source: 'linkedin',
                status: 'applied',
                location: job.location || null,
                description: job.description || null
            };

            // Create job if not exists, or get its ID
            let jobId;
            const jobResponse = await fetch(`${BACKEND_URL}/api/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobPayload)
            });

            if (jobResponse.ok) {
                const jobData = await jobResponse.json();
                jobId = jobData.data?.id;
            } else {
                // Job might already exist - search by URL
                const searchResponse = await fetch(`${BACKEND_URL}/api/jobs?search=${encodeURIComponent(job.href || record.url)}`);
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    if (searchData.data?.length > 0) {
                        jobId = searchData.data[0].id;
                        // Update status to applied
                        await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...searchData.data[0], status: 'applied' })
                        });
                    }
                }
            }

            // Create application record
            if (jobId) {
                const appPayload = {
                    job_id: jobId,
                    status: 'submitted',
                    applied_via: 'linkedin_easy_apply',
                    applied_at: record.appliedAt,
                    notes: `Auto-applied via Unhireable extension`
                };

                const appResponse = await fetch(`${BACKEND_URL}/api/applications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(appPayload)
                });

                if (appResponse.ok) {
                    console.log(`[Unhireable] ☁️ Synced to backend: ${record.title}`);

                    // Mark as synced locally
                    const { appliedJobsHistory = [] } = await chrome.storage.local.get(['appliedJobsHistory']);
                    const idx = appliedJobsHistory.findIndex(j => j.url === record.url);
                    if (idx !== -1) {
                        appliedJobsHistory[idx].synced = true;
                        await chrome.storage.local.set({ appliedJobsHistory });
                    }
                    return true;
                }
            }
        } catch (error) {
            // Silently log — backend is optional
            console.debug(`[Unhireable] Backend sync skipped: ${error.message}`);
        }
        return false;
    }

    // Main tracking function - saves locally then tries backend
    async function trackAppliedJob(job) {
        console.log(`[Unhireable] 📊 Tracking application: ${job.title} at ${job.company}`);

        // 1. Always save locally first (offline-safe)
        const record = await saveAppliedJobLocally(job);

        // 2. Try to sync to backend (non-blocking)
        syncAppliedJobToBackend(job, record).catch(err => {
            console.log('[Unhireable] Backend sync deferred:', err.message);
        });

        // 3. Add to in-memory list
        if (!appliedJobs.some(j => (j.href || j.url) === (job.href || job.url))) {
            appliedJobs.push(job);
        }
    }

    // Retry syncing unsynced jobs (call periodically or on startup)
    async function retrySyncUnsyncedJobs() {
        const { appliedJobsHistory = [] } = await chrome.storage.local.get(['appliedJobsHistory']);
        const unsynced = appliedJobsHistory.filter(j => !j.synced);

        if (unsynced.length > 0) {
            console.log(`[Unhireable] 🔄 Retrying sync for ${unsynced.length} unsynced applications...`);
            for (const record of unsynced) {
                await syncAppliedJobToBackend({ href: record.url, title: record.title, company: record.company }, record);
                await sleep(500); // Rate limit
            }
        }
    }

    async function clearApplyQueue() {
        applyQueueIndex = 0;
        await chrome.storage.local.remove(['applyQueue', 'applyQueueIndex', 'isApplying']);
    }

    // ========== UTILITIES ==========
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // ========== PHASE 1: DEEP SCANNER ==========

    function getJobCards() {
        const selectors = [
            '.jobs-search-results__list-item',
            '.scaffold-layout__list-item',
            '[data-occludable-job-id]',
            '.job-card-container',
            '.jobs-search-results-list li'
        ];

        for (const sel of selectors) {
            const cards = document.querySelectorAll(sel);
            if (cards.length > 0) {
                console.log(`[Unhireable] Found ${cards.length} job cards`);
                return Array.from(cards);
            }
        }
        return [];
    }

    async function clickJobCard(card) {
        const clickable = card.querySelector('a') || card;
        clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(randomDelay(500, 1000));
        clickable.click();
        await sleep(randomDelay(2000, 3000)); // Wait for details to load
    }

    // Extract job ID from a card element (data attributes)
    function getJobIdFromCard(card) {
        // LinkedIn cards have data-occludable-job-id or data-job-id
        const dataJobId = card?.getAttribute('data-occludable-job-id') ||
            card?.getAttribute('data-job-id') ||
            card?.querySelector('[data-job-id]')?.getAttribute('data-job-id');
        if (dataJobId) return dataJobId;

        // Try extracting from the card's link href
        const link = card?.querySelector('a[href*="/jobs/"]');
        if (link) {
            const hrefMatch = link.href.match(/currentJobId=(\d+)/) ||
                link.href.match(/\/jobs\/view\/(\d+)/);
            if (hrefMatch) return hrefMatch[1];
        }
        return null;
    }

    // Extract job ID from the current URL or page
    function getJobIdFromUrl() {
        const url = window.location.href;
        // LinkedIn search uses ?currentJobId=XXXXX
        const paramMatch = url.match(/currentJobId=(\d+)/);
        if (paramMatch) return paramMatch[1];
        // Direct view uses /jobs/view/XXXXX
        const viewMatch = url.match(/\/jobs\/view\/(\d+)/);
        if (viewMatch) return viewMatch[1];
        return null;
    }

    function extractJobDetails(card) {
        // Get full job description
        const titleEl = document.querySelector(
            '.job-details-jobs-unified-top-card__job-title, ' +
            '.jobs-unified-top-card__job-title, ' +
            '.t-24.t-bold'
        );
        const companyEl = document.querySelector(
            '.job-details-jobs-unified-top-card__company-name, ' +
            '.jobs-unified-top-card__company-name'
        );
        const locationEl = document.querySelector(
            '.job-details-jobs-unified-top-card__bullet, ' +
            '.jobs-unified-top-card__bullet'
        );
        const descriptionEl = document.querySelector(
            '.jobs-description-content__text, ' +
            '.jobs-description__content, ' +
            '.jobs-box__html-content'
        );
        const workplaceEl = document.querySelector(
            '.job-details-jobs-unified-top-card__workplace-type, ' +
            '.jobs-unified-top-card__workplace-type'
        );

        const description = descriptionEl?.innerText || '';

        // Check for Easy Apply button
        const easyApplyBtn = document.querySelector(
            'button.jobs-apply-button--top-card, ' +
            'button[aria-label*="Easy Apply"]'
        );
        const hasEasyApply = easyApplyBtn &&
            !easyApplyBtn.disabled &&
            easyApplyBtn.textContent.toLowerCase().includes('easy apply');

        // Extract email from description if present
        const emailMatch = description.match(/[\w.-]+@[\w.-]+\.\w+/);
        const email = emailMatch ? emailMatch[0] : null;

        // Job ID: prefer card data → URL param → URL path
        const jobId = getJobIdFromCard(card) || getJobIdFromUrl() || `unknown_${Date.now()}`;

        // Build a clean URL for this specific job
        const url = window.location.href;

        return {
            id: jobId,
            title: titleEl?.innerText?.trim() || 'Unknown',
            company: companyEl?.innerText?.trim() || 'Unknown',
            location: locationEl?.innerText?.trim() || '',
            workplace: workplaceEl?.innerText?.trim() || '',
            description: description,
            hasEasyApply: hasEasyApply,
            email: email,
            url: url,
            scannedAt: new Date().toISOString()
        };
    }

    function isRemoteFriendly(job) {
        const text = `${job.title} ${job.location} ${job.workplace} ${job.description}`.toLowerCase();

        // Must be remote
        const isRemote = text.includes('remote') ||
            text.includes('work from home') ||
            text.includes('wfh') ||
            job.workplace?.toLowerCase().includes('remote');

        // Check for US-only restrictions
        const usOnly = text.includes('must be located in us') ||
            text.includes('us only') ||
            text.includes('united states only') ||
            text.includes('us citizens only') ||
            text.includes('no visa sponsorship') ||
            text.includes('cannot sponsor');

        return isRemote && !usOnly;
    }

    function calculateMatchScore(job, profile) {
        if (!profile || !profile.skills) return 0.3;

        const text = `${job.title} ${job.description}`.toLowerCase();
        const skills = profile.skills || [];

        let matches = 0;
        let titleMatches = 0;

        for (const skill of skills) {
            const skillLower = skill.toLowerCase();
            if (text.includes(skillLower)) {
                matches++;
                // Extra credit for skills in title
                if (job.title.toLowerCase().includes(skillLower)) {
                    titleMatches++;
                }
            }
        }

        // Score based on raw matches, not ratio to total skills
        // 1 match = 15%, 2 = 30%, 3 = 45%, 4+ = 50%+
        let baseScore = Math.min(matches * 0.15, 0.5);

        // Title matches are extra valuable (+10% each)
        baseScore += titleMatches * 0.1;

        // Bonus for having multiple matches (compound boost)
        if (matches >= 3) baseScore += 0.1;
        if (matches >= 5) baseScore += 0.1;

        // Experience level bonus
        const summary = (profile.summary || '').toLowerCase();
        let expBonus = 0;
        if (text.includes('senior') && (summary.includes('5+') || summary.includes('years'))) {
            expBonus = 0.1;
        } else if (!text.includes('senior') && !text.includes('lead')) {
            expBonus = 0.05; // Mid-level/flexible
        }

        return Math.min(baseScore + expBonus, 1.0);
    }

    // Scan a single page of job cards
    async function scanCurrentPage(attemptedSet, sessionMatchedIds) {
        const cards = getJobCards();
        if (cards.length === 0) return { scanned: 0, matched: 0, deduped: 0 };

        let pageScanned = 0, pageMatched = 0, pageDeduped = 0;

        for (let i = 0; i < cards.length && isRunning; i++) {
            console.log(`[Unhireable] Scanning job ${i + 1}/${cards.length}`);
            updateStatus(`Scanning ${i + 1}/${cards.length}`);

            try {
                // Pre-extract job ID from card BEFORE clicking (avoids loading wrong job detail)
                const cardJobId = getJobIdFromCard(cards[i]);

                // Skip if already matched in this session (avoids duplicate INFUSE-type bugs)
                if (cardJobId && sessionMatchedIds.has(cardJobId)) {
                    console.log(`[Unhireable] ♻️ Skip: Already matched in session - ${cardJobId}`);
                    pageDeduped++;
                    continue;
                }

                // Skip if already attempted in a previous session
                if (cardJobId && attemptedSet.has(cardJobId)) {
                    console.log(`[Unhireable] ♻️ Skip: Already attempted - ${cardJobId}`);
                    pageDeduped++;
                    continue;
                }

                await clickJobCard(cards[i]);
                const job = extractJobDetails(cards[i]);
                scannedJobs.push(job);
                pageScanned++;

                // Double-check dedup with extracted ID (card ID might differ from detail ID)
                if (sessionMatchedIds.has(job.id) || attemptedSet.has(job.id)) {
                    console.log(`[Unhireable] ♻️ Skip: Duplicate after detail load - ${job.title} (${job.id})`);
                    pageDeduped++;
                    continue;
                }

                // Check remote-friendly
                if (!isRemoteFriendly(job)) {
                    console.log(`[Unhireable] ⏭️ Skip: Not remote-friendly - ${job.title}`);
                    continue;
                }

                // Calculate match
                const matchScore = calculateMatchScore(job, userProfile);
                job.matchScore = matchScore;

                if (matchScore >= CONFIG.matchThreshold) {
                    matchedJobs.push(job);
                    sessionMatchedIds.add(job.id);
                    pageMatched++;
                    console.log(`[Unhireable] ✅ Match: ${job.title} at ${job.company} (${(matchScore * 100).toFixed(0)}%) [ID: ${job.id}]`);

                    // Send to background to save to DB
                    chrome.runtime.sendMessage({
                        type: 'saveJob',
                        job: job
                    });
                } else {
                    console.log(`[Unhireable] ⏭️ Skip: Low match (${(matchScore * 100).toFixed(0)}%) - ${job.title}`);
                }

            } catch (err) {
                console.error(`[Unhireable] ❌ Error scanning job ${i + 1}:`, err.message || err);
            }

            await sleep(randomDelay(1000, 2000));
        }

        return { scanned: pageScanned, matched: pageMatched, deduped: pageDeduped };
    }

    // Navigate to the next page of LinkedIn results (SPA-safe, no full reload)
    function goToNextPage() {
        // Try multiple pagination button selectors
        const selectors = [
            '.artdeco-pagination__button--next:not([disabled])',
            'button[aria-label="Next"]:not([disabled])',
            'li.artdeco-pagination__indicator--number.active + li button',
        ];

        for (const sel of selectors) {
            const btn = document.querySelector(sel);
            if (btn && !btn.disabled) {
                console.log(`[Unhireable] 📄 Clicking pagination: ${sel}`);
                btn.scrollIntoView({ block: 'center' });
                btn.click();
                return true;
            }
        }

        // NO URL fallback — full page reload kills script context.
        // If no button found, stop scanning additional pages.
        console.log('[Unhireable] ⚠️ No pagination button found — stopping multi-page scan');
        return false;
    }

    async function scanAllJobs() {
        console.log('[Unhireable] 🔍 Starting deep scan...');
        scannedJobs = [];
        matchedJobs = [];

        // Load config
        const { attemptedJobIds = [], scheduleConfig } = await chrome.storage.local.get(['attemptedJobIds', 'scheduleConfig']);
        const attemptedSet = new Set(attemptedJobIds);
        const sessionMatchedIds = new Set(); // In-session dedup
        const maxPages = scheduleConfig?.maxPages || CONFIG.maxPagesToScan;
        console.log(`[Unhireable] 📋 ${attemptedSet.size} previously attempted jobs | scanning up to ${maxPages} pages`);

        // Remember the starting page URL so we can return to it after scanning
        const startUrl = window.location.href;
        let totalDeduped = 0;
        let pagesScanned = 0;

        // Scan multiple pages
        for (let page = 1; page <= maxPages && isRunning; page++) {
            console.log(`[Unhireable] 📄 Scanning page ${page}/${maxPages}...`);
            showNotification(`Scanning page ${page}/${maxPages}...`);

            // Wait for page to stabilize
            await sleep(2000);

            const cards = getJobCards();
            if (cards.length === 0) {
                console.log(`[Unhireable] ⚠️ Page ${page}: No job cards found, stopping.`);
                break;
            }

            const pageResult = await scanCurrentPage(attemptedSet, sessionMatchedIds);
            totalDeduped += pageResult.deduped;
            pagesScanned++;
            console.log(`[Unhireable] 📊 Page ${page} done: ${pageResult.scanned} scanned, ${pageResult.matched} matched, ${pageResult.deduped} deduped`);

            // Navigate to next page if not the last
            if (page < maxPages && isRunning) {
                // Capture fingerprint of current page to detect when new content loads
                const currentCards = getJobCards();
                const firstCardId = currentCards.length > 0 ? getJobIdFromCard(currentCards[0]) : null;
                const firstCardText = currentCards.length > 0 ? currentCards[0].textContent?.substring(0, 100) : '';
                console.log(`[Unhireable] ➡️ Navigating to page ${page + 1}... (current first card: ${firstCardId})`);

                const navSuccess = goToNextPage();
                if (!navSuccess) {
                    console.log(`[Unhireable] ⚠️ Could not navigate to page ${page + 1}, stopping scan.`);
                    break;
                }

                // Wait for new page content — poll until first card changes (max 15s)
                let contentChanged = false;
                for (let attempt = 0; attempt < 6; attempt++) {
                    await sleep(2500);
                    const newCards = getJobCards();
                    const newFirstId = newCards.length > 0 ? getJobIdFromCard(newCards[0]) : null;
                    const newFirstText = newCards.length > 0 ? newCards[0].textContent?.substring(0, 100) : '';

                    if (newFirstId && newFirstId !== firstCardId) {
                        console.log(`[Unhireable] ✅ Page ${page + 1} loaded (new first card: ${newFirstId})`);
                        contentChanged = true;
                        break;
                    }
                    if (newFirstText && newFirstText !== firstCardText) {
                        console.log(`[Unhireable] ✅ Page ${page + 1} loaded (content changed)`);
                        contentChanged = true;
                        break;
                    }
                    console.log(`[Unhireable] ⏳ Waiting for page ${page + 1} content... (attempt ${attempt + 1}/6)`);
                }

                if (!contentChanged) {
                    console.log(`[Unhireable] ⚠️ Page ${page + 1} content didn't change after 15s — stopping multi-page scan`);
                    break;
                }
            }
        }

        // Navigate BACK to page 1 so applyToAllMatched can find the job cards
        if (pagesScanned > 1) {
            console.log('[Unhireable] ↩️ Returning to page 1 for apply phase...');
            // Use history.back or direct URL navigation to page 1
            const url = new URL(startUrl);
            url.searchParams.delete('start'); // page 1 has no start param
            window.history.pushState(null, '', url.toString());
            // Trigger LinkedIn SPA route change
            window.dispatchEvent(new PopStateEvent('popstate'));
            await sleep(3000);
            // If cards didn't reload, try clicking the page 1 button
            const cards = getJobCards();
            if (cards.length === 0) {
                console.log('[Unhireable] ⚠️ Page 1 cards not loaded after popstate, reloading via pagination...');
                const page1Btn = document.querySelector('li.artdeco-pagination__indicator--number button');
                if (page1Btn) {
                    page1Btn.click();
                    await sleep(3000);
                }
            }
        }

        // Sort: Easy Apply first, then by match score
        matchedJobs.sort((a, b) => {
            if (a.hasEasyApply && !b.hasEasyApply) return -1;
            if (!a.hasEasyApply && b.hasEasyApply) return 1;
            return b.matchScore - a.matchScore;
        });

        if (totalDeduped > 0) {
            console.log(`[Unhireable] ♻️ Skipped ${totalDeduped} already-attempted jobs total`);
        }
        console.log(`[Unhireable] 📊 Scan complete: ${pagesScanned} pages, ${scannedJobs.length} scanned, ${matchedJobs.length} unique matches`);
        showNotification(`Found ${matchedJobs.length} matching jobs across ${pagesScanned} pages!`);

        // Save matches to storage for "Apply to Matches" button
        applyQueueIndex = 0;
        await chrome.storage.local.set({ applyQueue: matchedJobs, applyQueueIndex: 0, isApplying: false });

        return matchedJobs;
    }

    // ========== PHASE 2: APPLY (WITH HUMAN SIMULATION) ==========

    // Helper to get random character for typos
    function randomChar() {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        return chars[Math.floor(Math.random() * chars.length)];
    }

    // Simulate mouse cursor movement
    async function simulateMouseTo(element) {
        const rect = element.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2 + (Math.random() - 0.5) * 20;
        const targetY = rect.top + rect.height / 2 + (Math.random() - 0.5) * 10;

        let cursor = document.getElementById('unhireable-cursor');
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.id = 'unhireable-cursor';
            cursor.style.cssText = `
                position: fixed;
                width: 20px; height: 20px;
                background: radial-gradient(circle, rgba(99,102,241,0.6) 0%, transparent 70%);
                border-radius: 50%;
                pointer-events: none;
                z-index: 999999;
                transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
            `;
            document.body.appendChild(cursor);
        }
        cursor.style.left = `${targetX - 10}px`;
        cursor.style.top = `${targetY - 10}px`;
        cursor.style.opacity = '1';
        await sleep(randomDelay(100, 300));
    }

    // Human-like scroll to element
    async function humanScroll(element) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (!isVisible) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(randomDelay(300, 600));
        }
    }

    // Set value on React-controlled input (works with LinkedIn's React forms)
    function setNativeValue(element, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

        if (valueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
        } else if (valueSetter) {
            valueSetter.call(element, value);
        } else {
            element.value = value;
        }
    }

    // Human-like typing with typos and variable speed
    async function humanType(element, text) {
        await humanScroll(element);
        await simulateMouseTo(element);
        await sleep(randomDelay(100, 300));

        element.focus();
        setNativeValue(element, '');
        element.dispatchEvent(new Event('input', { bubbles: true }));

        let currentValue = '';
        const typoChance = 0.06; // 6% typo chance

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Simulate occasional typo
            if (Math.random() < typoChance && i > 0 && text.length > 3) {
                // Type wrong char
                currentValue += randomChar();
                setNativeValue(element, currentValue);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(randomDelay(60, 120));

                // Pause noticing mistake
                await sleep(randomDelay(150, 400));

                // Backspace
                currentValue = currentValue.slice(0, -1);
                setNativeValue(element, currentValue);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(randomDelay(50, 100));
            }

            // Type correct character
            currentValue += char;
            setNativeValue(element, currentValue);
            element.dispatchEvent(new Event('input', { bubbles: true }));

            // Variable typing speed
            let delay = randomDelay(CONFIG.typingDelay.min, CONFIG.typingDelay.max);
            if (char === ' ') delay *= 0.6;
            if (char.match(/[A-Z]/)) delay *= 1.3;
            if (char.match(/[0-9@.]/)) delay *= 1.2;
            await sleep(delay);

            // Occasional thinking pause
            if (Math.random() < 0.02) await sleep(randomDelay(200, 500));
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        await sleep(randomDelay(100, 200));
    }

    // Simple value set for when speed is needed
    async function setFieldValue(element, value) {
        await humanScroll(element);
        element.focus();
        setNativeValue(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(randomDelay(50, 150));
    }

    // ========== LINKEDIN-SPECIFIC HOOKS FOR UNIVERSAL FILLER ==========

    // Select resume radio if none is active
    async function selectResumeRadio(container) {
        const allRadios = container.querySelectorAll('input[type="radio"]');
        let hasActiveResume = false;
        for (const radio of allRadios) {
            const radioLabel = (radio.closest('label')?.textContent ||
                container.querySelector(`label[for="${radio.id}"]`)?.textContent || '').trim();
            if (radioLabel.toLowerCase().startsWith('deselect resume')) {
                hasActiveResume = true;
                log.info('resume:already_active', { label: radioLabel.substring(0, 60) });
                break;
            }
        }
        if (!hasActiveResume) {
            for (const radio of allRadios) {
                const radioLabel = (radio.closest('label')?.textContent ||
                    container.querySelector(`label[for="${radio.id}"]`)?.textContent || '').trim();
                const lowerLabel = radioLabel.toLowerCase();
                if (lowerLabel.startsWith('select resume') ||
                    (lowerLabel.includes('resume') && !lowerLabel.includes('deselect') && !lowerLabel.includes('remove'))) {
                    if (!radio.checked) {
                        log.info('resume:selecting', { label: radioLabel.substring(0, 60) });
                        radio.click();
                        await sleep(randomDelay(200, 400));
                    }
                    break;
                }
            }
        }
    }

    // Handle LinkedIn typeahead fields (location, etc.)
    async function handleLinkedInTypeahead(el, label, value) {
        log.info('typeahead:start', { label, value });
        el.focus();
        setNativeValue(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(1500);

        const container = el.closest('.artdeco-modal, .jobs-easy-apply-modal') || document;
        const suggestion = container.querySelector(
            '.basic-typeahead__selectable, .search-typeahead-v2__hit, ' +
            '[role="option"], .typeahead-suggestion, .search-global-typeahead__hit'
        );
        if (suggestion) {
            suggestion.click();
            log.info('typeahead:clicked_suggestion', { label });
        } else {
            log.warn('typeahead:no_suggestion', { label });
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
        }
    }

    // Build hooks object for UF.batchFill
    function getLinkedInHooks() {
        return {
            humanType,
            onBeforeFill: (container) => selectResumeRadio(container),
            onTypeahead: (el, label, answer) => handleLinkedInTypeahead(el, label, answer),
        };
    }

    // fillFormFields — DELETED: replaced by UF.batchFill() in applyToJob step loop
    // See universal-filler.js for the new unified implementation




    // Helper: dismiss modal and handle "Save this application?" confirmation
    async function dismissModal(modalRef) {
        const modal = modalRef || document.querySelector('.jobs-easy-apply-modal, .artdeco-modal');
        if (modal) {
            const closeBtn = modal.querySelector('button[aria-label="Dismiss"], button[data-test-modal-close-btn]');
            if (closeBtn) closeBtn.click();
        }
        await sleep(1000);
        // Handle "Save this application?" confirmation dialog
        const saveDialog = document.querySelector('[data-test-dialog], .artdeco-modal--layer-confirmation');
        if (saveDialog) {
            const discardBtn = Array.from(saveDialog.querySelectorAll('button')).find(btn =>
                btn.textContent.toLowerCase().includes('discard')
            );
            if (discardBtn) {
                console.log('[Unhireable] 🗑️ Clicking Discard on save dialog');
                discardBtn.click();
                await sleep(1000);
                return;
            }
        }
        // Fallback: look for any "Discard" button on the page
        const anyDiscard = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent.toLowerCase().trim() === 'discard'
        );
        if (anyDiscard) {
            console.log('[Unhireable] 🗑️ Fallback: clicking Discard button');
            anyDiscard.click();
            await sleep(1000);
        }
    }

    async function clickNextOrSubmit(providedModal) {
        // Use provided modal reference, or re-query with broad selectors
        const modal = providedModal || document.querySelector(
            '.jobs-easy-apply-modal, .artdeco-modal, [role="dialog"], .artdeco-modal__content'
        );
        if (!modal) {
            console.log('[Unhireable] ⚠️ No modal found for button search');
            return 'stuck';
        }

        // Multilingual button text patterns
        const SUBMIT_TEXTS = ['submit', 'send application', '提交申请', '提交', 'отправить', 'envoyer', 'absenden'];
        const REVIEW_TEXTS = ['review', '审查', '审阅', 'просмотр', 'vérifier'];
        const NEXT_TEXTS = ['next', 'continue', '下一步', '继续', 'далее', 'suivant', 'weiter'];

        const isMatch = (text, patterns) => patterns.some(p => text.includes(p));

        // Search primary buttons including footer/actionbar areas
        const buttons = modal.querySelectorAll(
            'button.artdeco-button--primary, ' +
            '.jobs-easy-apply-footer button.artdeco-button--primary, ' +
            'footer button.artdeco-button--primary, ' +
            '.artdeco-modal__actionbar button.artdeco-button--primary'
        );
        console.log(`[Unhireable] 🔍 Found ${buttons.length} primary buttons in modal`);

        // First priority: Submit buttons
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            console.log(`[Unhireable]   Button: "${text}" (aria: "${ariaLabel}")`);

            if (isMatch(text, SUBMIT_TEXTS) || isMatch(ariaLabel, SUBMIT_TEXTS)) {
                if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
                    console.log('[Unhireable] ⚠️ Submit button is disabled - form may be incomplete');
                    continue;
                }
                console.log('[Unhireable] 🚀 Clicking SUBMIT button');
                await sleep(randomDelay(1500, 3000));
                btn.scrollIntoView({ block: 'center' });
                await sleep(200);
                btn.click();
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                return 'submitted';
            }
        }

        // Second priority: Review button
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            if (isMatch(text, REVIEW_TEXTS)) {
                if (btn.disabled) continue;
                console.log('[Unhireable] 📋 Clicking REVIEW button');
                await sleep(randomDelay(500, 1000));
                btn.click();
                return 'review';
            }
        }

        // Third priority: Next/Continue
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            if (isMatch(text, NEXT_TEXTS)) {
                if (btn.disabled) continue;
                console.log('[Unhireable] ➡️ Clicking NEXT button');
                await sleep(randomDelay(300, 700));
                btn.click();
                return 'next';
            }
        }

        // Fallback: scan ALL buttons in modal (including non-primary) for navigation text
        const allButtons = modal.querySelectorAll('button:not([disabled])');
        for (const btn of allButtons) {
            const text = btn.textContent.toLowerCase().trim();
            if (isMatch(text, SUBMIT_TEXTS)) {
                console.log('[Unhireable] 🚀 Fallback SUBMIT button found:', text);
                btn.click();
                return 'submitted';
            }
            if (isMatch(text, NEXT_TEXTS) || isMatch(text, REVIEW_TEXTS)) {
                console.log('[Unhireable] ➡️ Fallback navigation button found:', text);
                btn.click();
                return isMatch(text, REVIEW_TEXTS) ? 'review' : 'next';
            }
        }

        // Last resort: search the ENTIRE document footer (LinkedIn sometimes renders footer outside modal DOM)
        const docFooter = document.querySelector('.jobs-easy-apply-footer, .artdeco-modal__actionbar');
        if (docFooter) {
            for (const btn of docFooter.querySelectorAll('button:not([disabled])')) {
                const text = btn.textContent.toLowerCase().trim();
                if (isMatch(text, SUBMIT_TEXTS)) {
                    console.log('[Unhireable] 🚀 Document-footer SUBMIT found:', text);
                    btn.click();
                    return 'submitted';
                }
                if (isMatch(text, NEXT_TEXTS) || isMatch(text, REVIEW_TEXTS)) {
                    console.log('[Unhireable] ➡️ Document-footer navigation found:', text);
                    btn.click();
                    return isMatch(text, REVIEW_TEXTS) ? 'review' : 'next';
                }
            }
        }

        console.log('[Unhireable] ⚠️ No clickable button found in modal');
        return 'stuck';
    }

    async function handleExternalApply(job) {
        console.log(`[Unhireable] 🌐 External applying to: ${job.title} at ${job.company}`);

        // Send message to background FIRST — it will set up tab watcher,
        // then tell us to click, then handle the new tab
        try {
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('External apply timed out (90s)'));
                }, 90000);

                chrome.runtime.sendMessage({
                    type: 'externalApply',
                    profile: userProfile,
                    jobTitle: `${job.title} at ${job.company}`,
                    jobUrl: job.url
                }, (response) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (result.success) {
                console.log(`[Unhireable] ✅ External form filled: ${result.atsUrl || 'unknown ATS'}`);
                return { success: true, type: 'external', atsUrl: result.atsUrl };
            } else if (result.type === 'unsupported_ats') {
                console.log(`[Unhireable] ⚠️ Unsupported ATS: ${result.error}`);
                return { success: false, type: 'unsupported_ats', error: result.error };
            } else {
                console.warn(`[Unhireable] ❌ External fill failed: ${result.error}`);
                return { success: false, type: 'external', error: result.error };
            }
        } catch (err) {
            console.error(`[Unhireable] 💥 External apply error: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    async function applyToJob(job) {
        console.log(`[Unhireable] 📝 Applying to: ${job.title} at ${job.company}`);

        if (!job.hasEasyApply) {
            return await handleExternalApply(job);
        }

        // Check if already applied before wasting time
        const appliedBadge = document.querySelector(
            '.jobs-details-top-card__applied-label, ' +
            '.artdeco-inline-feedback--success, ' +
            '.post-apply-timeline, ' +
            '[data-test-applied-label]'
        );
        const pageText = document.querySelector('.jobs-details-top-card, .job-details-jobs-unified-top-card')?.textContent || '';
        if (appliedBadge || pageText.toLowerCase().includes('applied ') || pageText.toLowerCase().includes('application submitted')) {
            console.log('[Unhireable] ⏭️ Already applied to this job — skipping');
            return { success: false, error: 'Already applied', skipped: true };
        }

        // Click Easy Apply button - IMPORTANT: avoid the filter toggle!
        // The filter has id="searchFilter_applyWithLinkedin", we need the job apply button
        const easyApplySelectors = [
            // Primary: The main apply button in job details
            '.jobs-apply-button--top-card',
            '.jobs-unified-top-card button.jobs-apply-button',
            '.job-details-jobs-unified-top-card__container--two-pane button[aria-label*="Easy Apply"]',
            // Secondary: Other apply button variants (but NOT filter)
            'button.jobs-apply-button:not([id*="searchFilter"])',
            '.jobs-s-apply button:not([role="radio"])',
            // Fallback: aria-label match but exclude filter
            'button[aria-label*="Easy Apply"]:not([id*="searchFilter"]):not([role="radio"])'
        ];

        let easyApplyBtn = null;
        for (const sel of easyApplySelectors) {
            const btn = document.querySelector(sel);
            // Extra check: make sure it's not the filter
            if (btn && !btn.id?.includes('searchFilter') && btn.getAttribute('role') !== 'radio') {
                easyApplyBtn = btn;
                console.log('[Unhireable] 🔘 Found Easy Apply button:', sel, btn.textContent?.trim());
                break;
            }
        }

        if (!easyApplyBtn) {
            console.log('[Unhireable] ❌ No Easy Apply button found');
            return { success: false, error: 'No Easy Apply button' };
        }

        // Verify the button actually says "Easy Apply" — not just "Apply" (external redirect)
        const btnText = (easyApplyBtn.textContent || '').trim().toLowerCase();
        if (!btnText.includes('easy apply')) {
            console.log(`[Unhireable] 🌐 Button says "${btnText}" — trying external apply`);
            return await handleExternalApply(job);
        }

        // If we got a container div, find the actual button inside
        let clickTarget = easyApplyBtn;
        if (easyApplyBtn.tagName.toLowerCase() !== 'button') {
            const innerBtn = easyApplyBtn.querySelector('button');
            if (innerBtn) {
                clickTarget = innerBtn;
                console.log('[Unhireable] 🔘 Found inner button inside container');
            }
        }

        console.log('[Unhireable] 🖱️ Clicking Easy Apply...', clickTarget.tagName);

        // Ensure button is visible and click it properly
        clickTarget.scrollIntoView({ block: 'center' });
        await sleep(300);
        clickTarget.focus();
        await sleep(100);

        // Try multiple click methods
        clickTarget.click();

        // Also dispatch click event for stubborn buttons
        clickTarget.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        // Wait for modal to appear (up to 8 seconds with more frequent checks)
        let modal = null;
        const modalSelectors = [
            '.jobs-easy-apply-modal',
            '.artdeco-modal[role="dialog"]',
            '.artdeco-modal',
            '[data-test-modal]',
            '.jobs-easy-apply-content',
            'div[class*="easy-apply"]',
            '.jobs-apply-modal'
        ];

        console.log('[Unhireable] ⏳ Waiting for modal...');
        for (let wait = 0; wait < 16; wait++) {
            await sleep(500);
            for (const sel of modalSelectors) {
                modal = document.querySelector(sel);
                if (modal && modal.offsetParent !== null) { // Check if visible
                    console.log('[Unhireable] ✅ Modal appeared:', sel);
                    break;
                }
            }
            if (modal) break;

            // Log progress every 2 seconds
            if (wait % 4 === 3) {
                console.log(`[Unhireable] Still waiting... (${(wait + 1) * 0.5}s)`);
            }
        }

        if (!modal) {
            console.log('[Unhireable] ❌ Modal never appeared after clicking Easy Apply');
            console.log('[Unhireable] 📍 Button was:', easyApplyBtn.outerHTML.substring(0, 200));
            return { success: false, error: 'Modal did not open' };
        }

        // Fill and submit up to 6 steps
        let lastStepSignature = '';
        let sameStepCount = 0;

        for (let step = 0; step < 6; step++) {
            console.log(`[Unhireable] 📄 Step ${step + 1}/6`);

            const currentModal = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal');
            if (!currentModal) {
                console.log('[Unhireable] ✅ Modal closed - application likely complete');
                return { success: true, message: 'Application complete' };
            }

            // Detect if we're stuck in a loop (same form repeated)
            const currentFields = currentModal.querySelectorAll('input, select, textarea');
            const stepSignature = Array.from(currentFields).map(f => f.name || f.id || f.placeholder || '').join('|');

            // Check if we're on the review page (progress bar ≥ 95% or "Review" heading visible)
            const progressBar = currentModal.querySelector('progress, .artdeco-completeness-meter-linear__progress-element');
            const progressValue = progressBar ? (parseFloat(progressBar.style?.width) || parseFloat(progressBar.getAttribute('value')) || 0) : 0;
            const reviewHeading = currentModal.querySelector('h2, h3');
            const isReviewPage = progressValue >= 95 ||
                (reviewHeading && /review|审查|просмотр/i.test(reviewHeading.textContent));

            // Check for submit-like buttons (multilingual)
            const submitTexts = ['submit', 'send application', '提交申请', '提交', 'отправить', 'envoyer', 'absenden'];
            const hasSubmitBtn = Array.from(currentModal.querySelectorAll('button')).some(btn => {
                const text = btn.textContent.toLowerCase().trim();
                const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                return submitTexts.some(st => text.includes(st) || aria.includes(st)) && !btn.disabled;
            });

            if (stepSignature === lastStepSignature) {
                sameStepCount++;
                if (isReviewPage || hasSubmitBtn) {
                    console.log('[Unhireable] 🔄 Review page detected (progress/submit) — proceeding to submit');
                    sameStepCount = 0;
                } else if (sameStepCount >= 2) {
                    console.log('[Unhireable] 🛑 Stuck in loop — same step repeated 3 times. Needs manual input.');
                    showNotification(`⚠️ ${job.company}: stuck on a step, needs manual input`);
                    await dismissModal(currentModal);
                    return { success: false, error: 'Stuck in loop', needsManual: true };
                }
            } else {
                sameStepCount = 0;
            }
            lastStepSignature = stepSignature;

            // Human pause - simulate reading the form before filling
            await sleep(randomDelay(1000, 2000));

            try {
                log.stepStart(step + 1);
                const fillResult = await UF.batchFill(currentModal, userProfile, job, getLinkedInHooks());
                const filledCount = fillResult.filled;
                log.stepEnd(filledCount > 0 ? 'filled' : 'empty');
                await sleep(randomDelay(CONFIG.delayBetweenSteps.min, CONFIG.delayBetweenSteps.max));

                // If form is completely empty (0 visible fields) AND no submit button, skip Next
                const visibleFields = currentModal.querySelectorAll('input:not([type="hidden"]), select, textarea');
                if (visibleFields.length === 0 && !hasSubmitBtn && !isReviewPage) {
                    console.log('[Unhireable] ⚠️ Empty form and no submit — skipping Next click');
                    continue;
                }

                const action = await clickNextOrSubmit(currentModal);
                console.log('[Unhireable] Action result:', action);

                if (action === 'submitted') {
                    await sleep(1000);
                    const dismissBtn = document.querySelector('button[aria-label="Dismiss"]');
                    if (dismissBtn) dismissBtn.click();
                    await trackAppliedJob(job);
                    return { success: true, submitted: true };
                } else if (action === 'stuck') {
                    const requiredEmpties = currentModal.querySelectorAll(
                        'input[required]:not([type="radio"]):not([type="checkbox"]), ' +
                        'select[required], textarea[required]'
                    );
                    const hasUnfilledRequired = Array.from(requiredEmpties).some(f => !f.value || !f.value.trim());
                    if (hasUnfilledRequired) {
                        console.log('[Unhireable] 🛑 Stuck with unfilled required fields — needs manual input');
                        showNotification(`⚠️ ${job.company}: needs manual input`);
                        await dismissModal(currentModal);
                        return { success: false, error: 'Required fields unfilled', needsManual: true };
                    }
                    return { success: false, error: 'Could not proceed', needsManual: true };
                }
            } catch (stepError) {
                console.error(`[Unhireable] 💥 Error on step ${step + 1}:`, stepError.message);
                await dismissModal();
                return { success: false, error: `Step ${step + 1} crashed: ${stepError.message}` };
            }

            await sleep(randomDelay(800, 1500));
        }

        return { success: false, error: 'Too many steps' };
    }

    // ===== CROSS-SESSION DAILY RATE LIMITING =====
    async function checkDailyLimit() {
        const { dailyApplyCount = 0, dailyResetDate, scheduleConfig } = await chrome.storage.local.get(
            ['dailyApplyCount', 'dailyResetDate', 'scheduleConfig']
        );
        const dailyLimit = scheduleConfig?.dailyLimit || 25;
        const today = new Date().toDateString();

        // Reset counter if it's a new day
        if (dailyResetDate !== today) {
            await chrome.storage.local.set({ dailyApplyCount: 0, dailyResetDate: today });
            return { count: 0, limit: dailyLimit, remaining: dailyLimit };
        }

        return { count: dailyApplyCount, limit: dailyLimit, remaining: Math.max(0, dailyLimit - dailyApplyCount) };
    }

    async function incrementDailyCount() {
        const { dailyApplyCount = 0 } = await chrome.storage.local.get(['dailyApplyCount']);
        await chrome.storage.local.set({ dailyApplyCount: dailyApplyCount + 1 });
    }

    async function applyToAllMatched() {
        console.log(`[Unhireable] 🚀 Applying to ${matchedJobs.length} jobs, starting at index ${applyQueueIndex}...`);

        // Check daily limit before starting
        const daily = await checkDailyLimit();
        if (daily.remaining <= 0) {
            showNotification(`Daily limit reached (${daily.count}/${daily.limit}). Try again tomorrow!`);
            console.log(`[Unhireable] 🛑 Daily limit reached: ${daily.count}/${daily.limit}`);
            return 0;
        }

        const effectiveSessionLimit = Math.min(CONFIG.maxAppsPerSession, daily.remaining);
        console.log(`[Unhireable] 📊 Daily: ${daily.count}/${daily.limit}, session cap: ${effectiveSessionLimit}`);

        let applied = 0;

        // Resume from where we left off
        for (let i = applyQueueIndex; i < matchedJobs.length; i++) {
            if (!isRunning) break;
            if (applied >= effectiveSessionLimit) {
                const reason = applied >= daily.remaining ? 'daily limit' : 'session limit';
                showNotification(`${reason.charAt(0).toUpperCase() + reason.slice(1)} reached (${applied} apps)`);
                break;
            }

            const job = matchedJobs[i];
            sessionStats.jobsAttempted++;
            console.log(`[Unhireable] 📝 Apply ${i + 1}/${matchedJobs.length}: "${job.title}" at ${job.company} [ID: ${job.id}]`);
            updateStatus(`Applying ${i + 1}/${matchedJobs.length}: ${job.company}`);

            try {
                // Strategy 1: Find card by job ID (most reliable)
                let foundCard = false;
                const jobCards = getJobCards();

                for (const card of jobCards) {
                    const cardId = getJobIdFromCard(card);
                    if (cardId === job.id) {
                        const clickable = card.querySelector('a') || card;
                        clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await sleep(500);
                        clickable.click();
                        await sleep(2000);
                        foundCard = true;
                        break;
                    }
                }

                // Strategy 2: Match by company name (fallback)
                if (!foundCard) {
                    for (const card of jobCards) {
                        if (card.textContent.includes(job.company)) {
                            const clickable = card.querySelector('a') || card;
                            clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await sleep(500);
                            clickable.click();
                            await sleep(2000);
                            foundCard = true;
                            console.log(`[Unhireable] Found card by company name fallback: ${job.company}`);
                            break;
                        }
                    }
                }

                // Strategy 3: Navigate directly to the job URL
                if (!foundCard && job.id && job.id !== `unknown_${Date.now()}`) {
                    console.log(`[Unhireable] ⚠️ Card not in DOM, navigating to job ${job.id} via URL...`);
                    const url = new URL(window.location.href);
                    url.searchParams.set('currentJobId', job.id);
                    window.history.pushState(null, '', url.toString());
                    window.dispatchEvent(new PopStateEvent('popstate'));
                    await sleep(3000);
                    foundCard = true; // Assume navigation worked
                }

                if (!foundCard) {
                    sessionStats.jobsSkipped++;
                    console.log(`[Unhireable] ⏭️ Skipping ${job.company} - card not found [ID: ${job.id}]`);
                    continue;
                }

                // Per-job timeout: 3 minutes max (external apply can take longer)
                const jobResult = await Promise.race([
                    applyToJob(job),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Job application timed out (3 min)')), 180000)
                    )
                ]);

                if (jobResult.success) {
                    applied++;
                    sessionStats.jobsApplied++;
                    appliedJobs.push({ ...job, appliedAt: new Date().toISOString(), applyType: jobResult.type || 'easy_apply' });
                    await incrementDailyCount();

                    if (jobResult.type === 'external') {
                        showNotification(`🌐 External filled: ${job.company} (${applied}/${CONFIG.maxAppsPerSession})`);
                    } else {
                        showNotification(`Applied to ${job.company} (${applied}/${CONFIG.maxAppsPerSession})`);
                    }

                    // Update DB
                    chrome.runtime.sendMessage({
                        type: 'markApplied',
                        jobId: job.id
                    });
                } else if (jobResult.type === 'unsupported_ats') {
                    sessionStats.jobsSkipped++;
                    console.log(`[Unhireable] ⏭️ Unsupported ATS for ${job.company} — skipping`);
                } else if (jobResult.needsManual) {
                    sessionStats.jobsSkipped++;
                    showNotification(`${job.company} needs manual input — skipping`);
                    // Ensure modal is fully closed before moving to next job
                    await dismissModal();
                } else {
                    sessionStats.jobsFailed++;
                    console.warn(`[Unhireable] ❌ Failed: ${job.company} — ${jobResult.error || 'unknown'}`);
                    await dismissModal();
                }

            } catch (err) {
                sessionStats.jobsFailed++;
                console.error(`[Unhireable] 💥 Apply error on ${job.company}:`, err.message);
                // Always try to clean up modal on error
                try { await dismissModal(); } catch (_) { }
            }

            // Save progress after each job
            applyQueueIndex = i + 1;
            await saveApplyQueue();

            // Dedup: save this job ID as attempted so it's skipped next run
            const { attemptedJobIds = [] } = await chrome.storage.local.get(['attemptedJobIds']);
            if (!attemptedJobIds.includes(job.id)) {
                attemptedJobIds.push(job.id);
                await chrome.storage.local.set({ attemptedJobIds });
            }

            await sleep(randomDelay(CONFIG.delayBetweenJobs.min, CONFIG.delayBetweenJobs.max));
        }

        logSessionStats();
        console.log(`[Unhireable] ✅ Applied to ${applied} jobs`);
        showNotification(`Done! Applied to ${applied}/${sessionStats.jobsAttempted} jobs (${sessionStats.jobsFailed} failed)`);
        await clearApplyQueue();  // Clear queue when done
        return applied;
    }

    // ========== MAIN AUTOPILOT ==========

    async function runAutopilot() {
        if (isRunning) return;
        isRunning = true;

        // Load profile
        const stored = await chrome.storage.local.get(['userProfile']);
        userProfile = stored.userProfile;

        if (!userProfile) {
            showNotification('No profile! Click extension → Set Test Profile');
            isRunning = false;
            return;
        }

        console.log('[Unhireable] 🤖 Autopilot started');
        showNotification('Autopilot starting...');

        try {
            // Phase 1: Scan
            await scanAllJobs();

            if (matchedJobs.length === 0) {
                showNotification('No matching jobs found');
                isRunning = false;
                return;
            }

            // Phase 2: Apply
            await applyToAllMatched();

        } catch (err) {
            console.error('[Unhireable] Autopilot error:', err);
            showNotification('Error: ' + err.message);
        }

        isRunning = false;
        updateStatus('Idle');
    }

    function stopAutopilot() {
        isRunning = false;
        showNotification('Autopilot stopped');
        updateStatus('Stopped');
    }

    // ========== UI ==========

    function showNotification(message) {
        let notif = document.getElementById('unhireable-notif');
        if (!notif) {
            notif = document.createElement('div');
            notif.id = 'unhireable-notif';
            notif.style.cssText = `
                position: fixed; top: 20px; right: 20px;
                padding: 16px 24px; background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white; border-radius: 12px; font-family: system-ui;
                font-size: 14px; font-weight: 500; z-index: 999999;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(notif);
        }
        notif.textContent = '🤖 ' + message;
        notif.style.opacity = '1';
        clearTimeout(notif._t);
        notif._t = setTimeout(() => notif.style.opacity = '0', 5000);
    }

    function updateStatus(status) {
        chrome.runtime.sendMessage({
            type: 'status', status,
            matched: matchedJobs.length, applied: appliedJobs.length
        });
    }

    // ========== MESSAGE HANDLING ==========

    // Bridge: allow page-level JS (e.g. browser automation) to trigger commands
    window.addEventListener('message', (event) => {
        if (event.source !== window || event.data?.type !== 'unhireable') return;
        const action = event.data.action;
        console.log('[Unhireable] Window message:', action);

        if (action === 'startAutopilot') {
            runAutopilot();
        } else if (action === 'stopAutopilot') {
            stopAutopilot();
        } else if (action === 'scanOnly') {
            (async () => {
                const stored = await chrome.storage.local.get(['userProfile']);
                userProfile = stored.userProfile;
                isRunning = true;
                await scanAllJobs();
                isRunning = false;
                console.log(`[Unhireable] Scan complete: ${matchedJobs.length} matches`);
            })();
        } else if (action === 'applyToMatches') {
            (async () => {
                if (matchedJobs.length === 0) await loadApplyQueue();
                if (matchedJobs.length === 0) {
                    showNotification('No matches to apply to! Scan first.');
                    return;
                }
                const stored = await chrome.storage.local.get(['userProfile']);
                userProfile = stored.userProfile;
                isRunning = true;
                applyQueueIndex = 0;
                await saveApplyQueue();
                await applyToAllMatched();
                isRunning = false;
            })();
        } else if (action === 'testApplySingle') {
            (async () => {
                const stored = await chrome.storage.local.get(['userProfile']);
                userProfile = stored.userProfile;
                if (!userProfile) {
                    console.log('[Unhireable] ❌ No profile loaded');
                    return;
                }
                const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title');
                const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name');
                const currentJob = {
                    title: titleEl?.textContent?.trim() || 'Unknown',
                    company: companyEl?.textContent?.trim() || 'Unknown',
                    hasEasyApply: true
                };
                console.log('[Unhireable] 🧪 Testing apply on:', currentJob);
                try {
                    const result = await applyToJob(currentJob);
                    console.log('[Unhireable] 🧪 Test result:', result);
                } catch (err) {
                    console.error('[Unhireable] Test apply error:', err);
                }
            })();
        }
    });

    // Safety check - chrome.runtime may be undefined if extension context is invalidated
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) {
        console.error('[Unhireable] ❌ Chrome runtime not available - extension may need reload');
        return;
    }

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        console.log('[Unhireable] Message:', msg.action);

        if (msg.action === 'clickExternalApply') {
            // Background is telling us to click the Apply button now (tab watcher is ready)
            const applyBtn = document.querySelector(
                'button.jobs-apply-button--top-card, ' +
                'button.jobs-apply-button:not([id*="searchFilter"]), ' +
                'button#jobs-apply-button-id'
            );
            if (applyBtn) {
                applyBtn.click();
                console.log('[Unhireable] 🖱️ Clicked external Apply button (on background request)');

                // LinkedIn sometimes shows a "You are leaving LinkedIn" confirmation modal
                // before opening the external page. We need to auto-click "Continue" if it appears.
                (async () => {
                    for (let attempt = 0; attempt < 6; attempt++) {
                        await new Promise(r => setTimeout(r, 500));
                        // Look for common confirmation modal buttons
                        const confirmBtns = document.querySelectorAll(
                            '.artdeco-modal button, ' +
                            '[data-test-modal] button, ' +
                            '.modal button'
                        );
                        for (const btn of confirmBtns) {
                            const text = (btn.textContent || '').trim().toLowerCase();
                            if (text.includes('continue') || text.includes('apply') ||
                                text.includes('proceed') || text.includes('go to') ||
                                text.includes('leave') || text.includes('open')) {
                                console.log(`[Unhireable] 🖱️ Clicking confirmation: "${btn.textContent.trim()}"`);
                                btn.click();
                                return;
                            }
                        }
                        // Also check for dismiss/close buttons that may appear with a redirect link
                        const extLink = document.querySelector(
                            '.artdeco-modal a[target="_blank"], ' +
                            '.artdeco-modal a[href*="apply"], ' +
                            '[data-test-modal] a[target="_blank"]'
                        );
                        if (extLink) {
                            console.log(`[Unhireable] 🖱️ Clicking external link in modal: ${extLink.href}`);
                            extLink.click();
                            return;
                        }
                    }
                    console.log('[Unhireable] ⚠️ No confirmation modal detected (may have redirected directly)');
                })();

                sendResponse({ clicked: true });
            } else {
                console.log('[Unhireable] ❌ No Apply button found');
                sendResponse({ clicked: false });
            }
            return;
        }

        if (msg.action === 'startAutopilot') {
            runAutopilot();
            sendResponse({ success: true });
        } else if (msg.action === 'stopAutopilot') {
            stopAutopilot();
            sendResponse({ success: true });
        } else if (msg.action === 'getStatus') {
            sendResponse({
                isRunning,
                scanned: scannedJobs.length,
                matched: matchedJobs.length,
                applied: appliedJobs.length
            });
        } else if (msg.action === 'scanOnly') {
            (async () => {
                const stored = await chrome.storage.local.get(['userProfile']);
                userProfile = stored.userProfile;
                isRunning = true;
                await scanAllJobs();
                isRunning = false;
                sendResponse({ success: true, matched: matchedJobs.length });
            })();
            return true;
        } else if (msg.action === 'applyToMatches') {
            (async () => {
                // Load from storage if needed
                if (matchedJobs.length === 0) {
                    await loadApplyQueue();
                }

                if (matchedJobs.length === 0) {
                    showNotification('No matches to apply to! Scan first.');
                    sendResponse({ success: false, error: 'No matches' });
                    return;
                }

                const stored = await chrome.storage.local.get(['userProfile']);
                userProfile = stored.userProfile;
                isRunning = true;
                applyQueueIndex = 0;  // Start from beginning
                await saveApplyQueue();
                await applyToAllMatched();
                isRunning = false;
                sendResponse({ success: true, applied: appliedJobs.length });
            })();
            return true;
        } else if (msg.action === 'testApplySingle') {
            // Test on the currently visible job - no scanning, no navigation
            (async () => {
                const stored = await chrome.storage.local.get(['userProfile']);
                userProfile = stored.userProfile;

                if (!userProfile) {
                    sendResponse({ success: false, error: 'Load profile first!' });
                    return;
                }

                // Get current job info from the page
                const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title');
                const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name');

                const currentJob = {
                    title: titleEl?.textContent?.trim() || 'Unknown',
                    company: companyEl?.textContent?.trim() || 'Unknown',
                    hasEasyApply: !!document.querySelector(
                        'button.jobs-apply-button--top-card, ' +
                        'button[aria-label*="Easy Apply"]:not([id*="searchFilter"]):not([role="radio"])'
                    )
                };

                console.log('[Unhireable] 🧪 Testing apply on:', currentJob);
                showNotification(`Testing: ${currentJob.company}...`);

                try {
                    const result = await applyToJob(currentJob);
                    console.log('[Unhireable] 🧪 Test result:', result);

                    if (result.success) {
                        showNotification(`✅ Applied to ${currentJob.company}!`);
                        sendResponse({ success: true });
                    } else {
                        showNotification(`⚠️ ${result.error || 'Needs manual input'}`);
                        sendResponse({ success: false, error: result.error || 'Manual needed' });
                    }
                } catch (err) {
                    console.error('[Unhireable] Test apply error:', err);
                    sendResponse({ success: false, error: err.message });
                }
            })();
            return true;
        } else if (msg.action === 'getUnknownFields') {
            // Get the backlog of unknown fields
            (async () => {
                const stored = await chrome.storage.local.get(['unknownFieldsBacklog']);
                sendResponse({ fields: stored.unknownFieldsBacklog || [] });
            })();
            return true;
        } else if (msg.action === 'clearUnknownFields') {
            // Clear the backlog
            (async () => {
                await chrome.storage.local.remove(['unknownFieldsBacklog']);
                unknownFields = [];
                sendResponse({ success: true });
            })();
            return true;
        }

        return true;
    });

    // REMOVED: duplicate window.postMessage handler — consolidated into the one at line ~1896

    console.log('[Unhireable] 🚀 LinkedIn Auto-Apply loaded');

    // Auto-resume disabled for now - was causing infinite refresh loop
    // TODO: Fix to only resume on the correct job page
    (async () => {
        // Clear any stuck apply sessions on load
        await chrome.storage.local.remove(['isApplying']);

        if (window.location.href.includes('/jobs/')) {
            showNotification('Ready! Click extension to start');
        }
    })();

})();

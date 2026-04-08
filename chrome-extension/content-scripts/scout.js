// Unhireable - Autonomous Scout Mode
// This script runs silently on LinkedIn Jobs to gather opportunities.

(function () {
    'use strict';

    console.log('[Unhireable Scout] 🔍 Initializing autonomous scouting...');

    function getJobMetadata() {
        const jobs = [];
        const jobCards = document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container');

        console.log(`[Unhireable Scout] Found ${jobCards.length} candidates.`);

        jobCards.forEach((card, index) => {
            try {
                // Link and Title
                const linkEl = card.querySelector('a.job-card-list__title, .job-card-container__link, a[href*="/jobs/view/"]');
                if (!linkEl) return;

                const url = new URL(linkEl.href, window.location.origin).origin + new URL(linkEl.href, window.location.origin).pathname;
                const title = linkEl.innerText.trim();

                // Company
                const companyEl = card.querySelector('.job-card-container__company-name, .job-card-container__primary-description');
                const company = companyEl ? companyEl.innerText.split('\n')[0].trim() : 'Unknown Company';

                // Location
                const locationEl = card.querySelector('.job-card-container__metadata-item--low-light, .job-card-list__metadata-item');
                const location = locationEl ? locationEl.innerText.trim() : 'Remote';

                // Easy Apply Detection
                const easyApplyEl = card.querySelector('.job-card-container__apply-method, .job-card-list__footer-item--easy-apply');
                const isEasyApply = !!easyApplyEl;

                jobs.push({
                    title,
                    company,
                    url,
                    location,
                    source: 'linkedin',
                    status: 'scouted',
                    match_score: null, // To be calculated by backend
                    description: isEasyApply ? 'Easy Apply' : null
                });
            } catch (err) {
                console.warn(`[Unhireable Scout] Error parsing job card ${index}:`, err);
            }
        });

        return jobs;
    }

    // Auto-scroll to trigger lazy loading
    async function autoScroll(maxDepth = 3) {
        const container = document.querySelector('.jobs-search-results-list') || window;
        for (let i = 0; i < maxDepth; i++) {
            container.scrollBy(0, 800);
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    async function runScout() {
        await autoScroll();
        const jobs = getJobMetadata();
        chrome.runtime.sendMessage({
            action: 'jobsScouted',
            jobs: jobs
        });
    }

    // Listen for manual triggers from background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'startScout') {
            console.log('[Unhireable Scout] Received startScout command');
            runScout()
                .then(() => {
                    console.log('[Unhireable Scout] Scout completed successfully');
                    sendResponse({ success: true });
                })
                .catch((err) => {
                    console.error('[Unhireable Scout] Scout failed:', err);
                    sendResponse({ success: false, error: err.message });
                });
            return true;
        }
    });

    // Auto-scout on load if requested
    if (window.location.search.includes('unhireable_scout=true')) {
        setTimeout(runScout, 3000);
    }
})();

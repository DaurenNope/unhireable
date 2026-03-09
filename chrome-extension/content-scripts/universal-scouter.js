// Unhireable - Universal Scout Mode
// This script attempts to detect job postings on any website using LD+JSON, Meta tags, and Heuristics.

(function () {
    'use strict';

    console.log('[Unhireable Universal Scout] 🔍 Scanning for job listings...');

    function extractFromJSONLD() {
        const jobs = [];
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');

        scripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);

                // Handle both single objects and arrays
                const items = Array.isArray(data) ? data : [data];

                items.forEach(item => {
                    // Look for JobPosting type
                    if (item['@type'] === 'JobPosting' || item['@type']?.includes('JobPosting')) {
                        jobs.push({
                            title: item.title,
                            company: item.hiringOrganization?.name || 'Unknown Company',
                            url: item.url || window.location.href,
                            location: item.jobLocation?.address?.addressLocality || 'Remote',
                            description: item.description ? stripHtml(item.description).substring(0, 500) : null,
                            source: window.location.hostname
                        });
                    }
                });
            } catch (e) {
                // Ignore parse errors for non-matching JSONLD
            }
        });
        return jobs;
    }

    function extractFromMetaTags() {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
        const ogDescription = document.querySelector('meta[property="og:description"]')?.content;
        const ogUrl = document.querySelector('meta[property="og:url"]')?.content;

        // Very basic heuristic: if title contains "Job" or "Hiring" or we are on a "jobs" path
        if (ogTitle && (ogTitle.toLowerCase().includes('job') || window.location.pathname.includes('jobs'))) {
            return [{
                title: ogTitle,
                company: document.title.split('|')[0].split('-')[0].trim(),
                url: ogUrl || window.location.href,
                location: 'Unknown',
                description: ogDescription ? ogDescription.substring(0, 500) : null,
                source: window.location.hostname
            }];
        }
        return [];
    }

    function stripHtml(html) {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    async function runUniversalScout() {
        let jobs = extractFromJSONLD();

        if (jobs.length === 0) {
            console.log('[Unhireable Universal Scout] No LD+JSON found, trying Meta tags...');
            jobs = extractFromMetaTags();
        }

        if (jobs.length === 0) {
            console.log('[Unhireable Universal Scout] No obvious job metadata found.');
        } else {
            console.log(`[Unhireable Universal Scout] Found ${jobs.length} jobs.`);
            chrome.runtime.sendMessage({
                action: 'jobsScouted',
                jobs: jobs.map(j => ({
                    ...j,
                    status: 'scouted',
                    match_score: null
                }))
            });
        }
    }

    // Listen for manual triggers
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'startUniversalScout') {
            runUniversalScout().then(() => sendResponse({ success: true }));
            return true;
        }
    });

    // Auto-scout if flag present
    if (window.location.search.includes('unhireable_universal_scout=true')) {
        setTimeout(runUniversalScout, 2000);
    }
})();

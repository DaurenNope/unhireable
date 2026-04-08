// Unhireable Auto-Apply - Main Content Script
// This script routes to the appropriate ATS-specific adapter

(async function () {
    'use strict';

    const url = window.location.href;

    // Determine which adapter to load based on URL
    let adapterLoaded = false;

    // Helper to inject a script
    async function loadAdapter(scriptName) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL(`content-scripts/${scriptName}`);
            script.onload = () => {
                console.log(`[Unhireable] Loaded ${scriptName} adapter`);
                resolve(true);
            };
            script.onerror = () => {
                console.warn(`[Unhireable] Failed to load ${scriptName}`);
                resolve(false);
            };
            (document.head || document.documentElement).appendChild(script);
        });
    }

    // Route based on URL
    if (url.includes('linkedin.com/jobs')) {
        adapterLoaded = true; // LinkedIn adapter auto-loads via manifest
        console.log('[Unhireable] LinkedIn job page detected');
    } else if (url.includes('jobs.ashbyhq.com') || url.includes('ashbyhq.com')) {
        adapterLoaded = true; // Ashby adapter auto-loads via manifest
        console.log('[Unhireable] Ashby job page detected');
    } else if (url.includes('greenhouse.io')) {
        adapterLoaded = true; // Greenhouse adapter auto-loads via manifest
        console.log('[Unhireable] Greenhouse job page detected');
    } else if (url.includes('lever.co')) {
        adapterLoaded = true; // Lever adapter auto-loads via manifest
        console.log('[Unhireable] Lever job page detected');
    } else if (url.includes('workday.com')) {
        console.log('[Unhireable] Workday job page detected');
        adapterLoaded = true;
    }

    if (!adapterLoaded) {
        console.log('[Unhireable] No specific adapter for this page');
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'fillForm') {
            console.log('[Unhireable] Fill form request received');
            // The specific adapter will handle this message
            sendResponse({ received: true, url: url });
        }
        return true;
    });

    console.log('[Unhireable] Content script loaded');
})();

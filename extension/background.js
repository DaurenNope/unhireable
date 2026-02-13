/**
 * Unhireable Auto-Apply - Background Service Worker
 */

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Unhireable] Extension installed');

    // Set default profile
    chrome.storage.local.get('userProfile', (result) => {
        if (!result.userProfile) {
            chrome.storage.local.set({
                userProfile: {
                    name: 'Dauren Nurseitov',
                    email: 'dauren.nope@gmail.com',
                    phone: '+1234567890',
                    linkedin: 'https://linkedin.com/in/dauren',
                    github: 'https://github.com/daurenm',
                    portfolio: '',
                    location: 'Remote',
                    skills: ['Python', 'Solidity', 'JavaScript', 'TypeScript', 'FastAPI'],
                    experience_summary: 'Founder at Rahmet Labs with experience in DeFi, blockchain, and full-stack development.'
                }
            });
        }
    });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FILL_COMPLETE') {
        console.log('[Unhireable] Fill complete:', message.result);

        // Could send to Unhireable app API here
        // fetch('http://localhost:8080/api/applications', {
        //   method: 'POST',
        //   body: JSON.stringify({ job_url: sender.tab.url, status: 'applied' })
        // });
    }

    if (message.type === 'LOG') {
        console.log('[Unhireable]', message.data);
    }
});

// Optional: Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'unhireable-fill',
        title: 'Auto-Fill with Unhireable',
        contexts: ['page']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'unhireable-fill') {
        chrome.tabs.sendMessage(tab.id, { type: 'AUTO_FILL' });
    }
});

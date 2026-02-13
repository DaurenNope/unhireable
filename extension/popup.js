/**
 * Unhireable Auto-Apply - Popup Script
 */

// Elements
const btnFill = document.getElementById('btn-fill');
const statusEl = document.getElementById('status');
const atsTypeEl = document.getElementById('ats-type');

// Profile fields
const profileFields = {
    name: document.getElementById('profile-name'),
    email: document.getElementById('profile-email'),
    linkedin: document.getElementById('profile-linkedin'),
    github: document.getElementById('profile-github')
};

// Load saved profile
async function loadProfile() {
    const stored = await chrome.storage.local.get('userProfile');
    const profile = stored.userProfile || {
        name: 'Dauren Nurseitov',
        email: 'dauren.nope@gmail.com',
        linkedin: 'https://linkedin.com/in/dauren',
        github: 'https://github.com/daurenm'
    };

    profileFields.name.value = profile.name || '';
    profileFields.email.value = profile.email || '';
    profileFields.linkedin.value = profile.linkedin || '';
    profileFields.github.value = profile.github || '';
}

// Save profile
async function saveProfile() {
    const profile = {
        name: profileFields.name.value,
        email: profileFields.email.value,
        linkedin: profileFields.linkedin.value,
        github: profileFields.github.value
    };

    await chrome.storage.local.set({ userProfile: profile });

    // Update content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_PROFILE', profile });
    }
}

// Detect ATS on current page
async function detectATS() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_ATS' });
        if (response && response.ats) {
            atsTypeEl.textContent = `${response.ats.toUpperCase()} Detected`;
            atsTypeEl.style.background = 'rgba(46, 213, 115, 0.3)';
        }
    } catch (e) {
        atsTypeEl.textContent = 'No ATS Detected';
        atsTypeEl.style.background = 'rgba(255, 107, 107, 0.3)';
    }
}

// Auto-fill handler
async function handleAutoFill() {
    btnFill.disabled = true;
    btnFill.innerHTML = '<span>⏳</span><span>Filling...</span>';

    // Save profile first
    await saveProfile();

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error('No active tab');

        const response = await chrome.tabs.sendMessage(tab.id, { type: 'AUTO_FILL' });

        if (response && response.success) {
            statusEl.className = 'status success';
            statusEl.textContent = `✅ Form filled! (${response.ats})`;
        } else {
            throw new Error('Fill failed');
        }
    } catch (e) {
        statusEl.className = 'status error';
        statusEl.textContent = `❌ Error: ${e.message}`;
    }

    btnFill.disabled = false;
    btnFill.innerHTML = '<span>✨</span><span>Auto-Fill Application</span>';
}

// Event listeners
btnFill.addEventListener('click', handleAutoFill);

// Save profile on input change
Object.values(profileFields).forEach(field => {
    field.addEventListener('change', saveProfile);
});

// Initialize
loadProfile();
detectATS();

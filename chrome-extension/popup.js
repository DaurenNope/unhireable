// Unhireable Auto-Apply Extension - Popup Script

const ATS_PATTERNS = {
    ashby: /jobs\.ashbyhq\.com|\.ashbyhq\.com/,
    greenhouse: /boards\.greenhouse\.io/,
    lever: /jobs\.lever\.co/,
    linkedin: /linkedin\.com\/jobs/
};

const ATS_NAMES = {
    ashby: 'Ashby ATS',
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    linkedin: 'LinkedIn Easy Apply'
};

// DOM Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const atsName = document.getElementById('atsName');
const profilePreview = document.getElementById('profilePreview');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const fillBtn = document.getElementById('fillBtn');
const autoSubmitToggle = document.getElementById('autoSubmitToggle');
const settingsBtn = document.getElementById('settingsBtn');
const successMessage = document.getElementById('successMessage');

let currentAts = null;
let userProfile = null;

// Initialize popup
async function init() {
    await loadProfile();
    await checkCurrentPage();
    await loadSettings();
    await loadApplicationStats();
    setupEventListeners();
    setupJobsQueueButtons();
}

// Load user profile from storage
async function loadProfile() {
    try {
        const result = await chrome.storage.local.get(['userProfile']);
        if (result.userProfile) {
            userProfile = result.userProfile;
            displayProfile();
        } else {
            // Show profile editor for quick setup
            profilePreview.style.display = 'block';
            profileName.textContent = '⚠️ No profile set';
            profileEmail.textContent = 'Click edit or fill form below';

            // Show the editor automatically
            const profileEditor = document.getElementById('profileEditor');
            if (profileEditor) {
                profileEditor.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

// Display profile in popup
function displayProfile() {
    if (!userProfile?.personal_info) return;

    profilePreview.style.display = 'block';
    profileName.textContent = userProfile.personal_info.name || 'No name set';
    profileEmail.textContent = userProfile.personal_info.email || 'No email set';
}

// Check current tab for ATS
async function checkCurrentPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
            updateStatus(false, 'No active tab');
            return;
        }

        const url = tab.url;

        for (const [ats, pattern] of Object.entries(ATS_PATTERNS)) {
            if (pattern.test(url)) {
                currentAts = ats;
                updateStatus(true, `Ready to fill`, ATS_NAMES[ats]);
                fillBtn.disabled = !userProfile;
                return;
            }
        }

        updateStatus(false, 'Not on application page');
        atsName.textContent = 'Navigate to a supported job application';

    } catch (err) {
        console.error('Failed to check page:', err);
        updateStatus(false, 'Error checking page');
    }
}

// Update status display
function updateStatus(active, text, atsLabel = null) {
    statusDot.classList.toggle('inactive', !active);
    statusText.textContent = text;
    if (atsLabel) {
        atsName.textContent = atsLabel;
    }
}

// Load settings
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['autoSubmit', 'humanMode']);
        autoSubmitToggle.checked = result.autoSubmit || false;
        const humanModeToggle = document.getElementById('humanModeToggle');
        if (humanModeToggle) {
            humanModeToggle.checked = result.humanMode !== false; // Default true
        }
    } catch (err) {
        console.error('Failed to load settings:', err);
    }

    // Load schedule config
    try {
        const { scheduleConfig, dailyApplyCount = 0, lastAutoScan } = await chrome.storage.local.get(
            ['scheduleConfig', 'dailyApplyCount', 'lastAutoScan']
        );

        const scheduleToggle = document.getElementById('scheduleEnabledToggle');
        const scheduleOptions = document.getElementById('scheduleOptions');
        const scanFrequency = document.getElementById('scanFrequency');
        const dailyLimitSelect = document.getElementById('dailyLimitSelect');
        const activeHoursStart = document.getElementById('activeHoursStart');
        const activeHoursEnd = document.getElementById('activeHoursEnd');
        const dailyCountEl = document.getElementById('dailyApplyCount');
        const lastScanEl = document.getElementById('lastAutoScan');

        if (scheduleConfig) {
            if (scheduleToggle) scheduleToggle.checked = scheduleConfig.enabled || false;
            if (scheduleOptions) scheduleOptions.style.display = scheduleConfig.enabled ? 'block' : 'none';
            if (scanFrequency) scanFrequency.value = String(scheduleConfig.intervalHours || 4);
            if (dailyLimitSelect) dailyLimitSelect.value = String(scheduleConfig.dailyLimit || 25);
            if (activeHoursStart) activeHoursStart.value = String(scheduleConfig.activeHoursStart || 9);
            if (activeHoursEnd) activeHoursEnd.value = String(scheduleConfig.activeHoursEnd || 17);
        }

        if (dailyCountEl) dailyCountEl.textContent = dailyApplyCount;
        if (lastScanEl && lastAutoScan) {
            const ago = Math.round((Date.now() - new Date(lastAutoScan).getTime()) / 60000);
            lastScanEl.textContent = ago < 60 ? `${ago}m ago` : `${Math.round(ago / 60)}h ago`;
        }
    } catch (err) {
        console.error('Failed to load schedule settings:', err);
    }
}

// Set user's profile (Dauren - comprehensive for tailored resume generation)
async function setTestProfile() {
    const masterProfile = {
        personal_info: {
            name: "Dauren Nox",
            email: "dauren@rahmetlabs.com",
            phone: "+1 (818) 555-0100",
            location: "Los Angeles, California",
            linkedin_url: "https://www.linkedin.com/in/dauren-nox",
            github_url: "https://github.com/daurenm",
            portfolio_url: "https://dauren-nox.netlify.app",
            requires_sponsorship: false,
            willing_to_relocate: true,
            years_experience: "5",
            salary_expectation: "5000"
        },
        title: "Founder @ Rahmet Labs | AI Automation | Full-Stack Engineer",
        titles: [
            "Full Stack Engineer",
            "Software Engineer",
            "AI/ML Engineer",
            "Blockchain Developer",
            "Automation Engineer"
        ],
        summary: "Founder and Full-Stack Engineer with 5+ years experience building AI automation systems, blockchain solutions, and full-stack applications. Delivered 30+ automation systems and 20+ websites/apps for enterprises. Strong background in Web3, smart contracts, and product management. Advised leading bank on $500K crypto portfolio. Launched NFT diploma project for major Central Asian university.",
        skills: [
            "Python", "TypeScript", "JavaScript", "React", "Node.js", "Solidity",
            "Smart Contracts", "Web3", "AI/ML", "Automation", "PostgreSQL", "Redis",
            "Docker", "AWS", "FastAPI", "Django", "Next.js"
        ],
        experience: [
            {
                company: "Rahmet Labs",
                role: "Founder",
                duration: "Feb 2024 - Present",
                highlights: [
                    "Built Leadiya - AI-powered sales automation platform",
                    "Built Unhireable - AI job matching and auto-apply system",
                    "Delivered 30+ automation systems and 20+ websites/apps for enterprises"
                ]
            },
            {
                company: "Zorox Labs",
                role: "Founder & Product Manager",
                duration: "Jul 2021 - Feb 2024",
                highlights: [
                    "Led 6-person team in blockchain consultancy",
                    "Managed early-stage crypto project investments",
                    "Developed automation scripts for blockchain research"
                ]
            },
            {
                company: "EYEQ DAO",
                role: "Full Stack Engineer",
                duration: "Nov 2022 - Mar 2023",
                highlights: [
                    "Developed secure Solidity smart contracts",
                    "Led front-end development",
                    "Provided strategic technical insights"
                ]
            }
        ],
        education: {
            school: "California State University, Northridge",
            degree: "Bachelor's in Computational Science",
            graduation_year: 2020
        },
        certifications: [
            "Solidity Development - freeCodeCamp",
            "ConsenSys Academy Blockchain Developer Program",
            "Google Project Management Certificate",
            "PMI Risk Management Professional (PMI-RMP)"
        ],
        languages: [
            { language: "English", proficiency: "Native" },
            { language: "Russian", proficiency: "Native" },
            { language: "Mandarin", proficiency: "Limited working" }
        ]
    };

    await chrome.storage.local.set({ userProfile: masterProfile });
    userProfile = masterProfile;
    displayProfile();

    if (currentAts) {
        fillBtn.disabled = false;
    }

    successMessage.textContent = '✅ Your profile loaded!';
    successMessage.classList.add('show');
    setTimeout(() => successMessage.classList.remove('show'), 2000);
}

// Load real profile from Unhireable backend API
async function loadRealProfile() {
    try {
        // Try to fetch from backend API
        const response = await fetch('http://localhost:3003/api/profile');

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();

        if (result.data) {
            const profile = result.data;

            // Normalize the profile structure for the extension
            const normalizedProfile = {
                personal_info: profile.personal_info || {},
                summary: profile.summary || '',
                skills: Array.isArray(profile.skills)
                    ? profile.skills
                    : (profile.skills?.technical_skills || [])
            };

            await chrome.storage.local.set({ userProfile: normalizedProfile });
            userProfile = normalizedProfile;
            displayProfile();

            if (currentAts) {
                fillBtn.disabled = false;
            }

            successMessage.textContent = `✅ Loaded: ${normalizedProfile.personal_info?.name || 'Profile'}`;
            successMessage.classList.add('show');
            setTimeout(() => successMessage.classList.remove('show'), 2000);
        } else {
            successMessage.textContent = '⚠️ No profile found in backend';
            successMessage.classList.add('show');
            setTimeout(() => successMessage.classList.remove('show'), 2000);
        }
    } catch (err) {
        console.error('Failed to load profile from API:', err);
        successMessage.textContent = '❌ Backend API not running';
        successMessage.classList.add('show');
        setTimeout(() => successMessage.classList.remove('show'), 2000);
    }
}

// Save schedule config to storage (triggers background.js alarm re-registration)
async function saveScheduleConfig() {
    const config = {
        enabled: document.getElementById('scheduleEnabledToggle')?.checked || false,
        intervalHours: parseInt(document.getElementById('scanFrequency')?.value || '4'),
        dailyLimit: parseInt(document.getElementById('dailyLimitSelect')?.value || '25'),
        activeHoursStart: parseInt(document.getElementById('activeHoursStart')?.value || '9'),
        activeHoursEnd: parseInt(document.getElementById('activeHoursEnd')?.value || '17')
    };
    await chrome.storage.local.set({ scheduleConfig: config });
    console.log('[Popup] Schedule config saved:', config);
}

// Setup event listeners
function setupEventListeners() {
    // Dashboard buttons
    setupDashboardButtons();
    
    // Auto-fill button
    if (fillBtn) {
        fillBtn.addEventListener('click', handleFillClick);
    }

    // Schedule config listeners
    const scheduleToggle = document.getElementById('scheduleEnabledToggle');
    const scheduleOptions = document.getElementById('scheduleOptions');
    if (scheduleToggle) {
        scheduleToggle.addEventListener('change', () => {
            if (scheduleOptions) scheduleOptions.style.display = scheduleToggle.checked ? 'block' : 'none';
            saveScheduleConfig();
        });
    }
    ['scanFrequency', 'dailyLimitSelect', 'activeHoursStart', 'activeHoursEnd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', saveScheduleConfig);
    });

    // Autopilot button
    const autopilotBtn = document.getElementById('autopilotBtn');
    const stopBtn = document.getElementById('stopAutopilotBtn');
    const scanOnlyBtn = document.getElementById('scanOnlyBtn');
    const autopilotStatus = document.getElementById('autopilotStatus');

    if (autopilotBtn) {
        autopilotBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.url?.includes('linkedin.com/jobs')) {
                    alert('Please navigate to LinkedIn Jobs first');
                    return;
                }

                autopilotBtn.style.display = 'none';
                stopBtn.style.display = 'flex';
                autopilotStatus.style.display = 'block';

                await chrome.tabs.sendMessage(tab.id, { action: 'startAutopilot' });
            } catch (err) {
                console.error('Autopilot error:', err);
                autopilotBtn.style.display = 'flex';
                stopBtn.style.display = 'none';
            }
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.tabs.sendMessage(tab.id, { action: 'stopAutopilot' });

                autopilotBtn.style.display = 'flex';
                stopBtn.style.display = 'none';
            } catch (err) {
                console.error('Stop error:', err);
            }
        });
    }

    const applyMatchesBtn = document.getElementById('applyMatchesBtn');

    if (scanOnlyBtn) {
        scanOnlyBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.url?.includes('linkedin.com/jobs')) {
                    alert('Please navigate to LinkedIn Jobs first');
                    return;
                }

                scanOnlyBtn.innerHTML = '<span>🔍</span><span>Scanning...</span>';
                scanOnlyBtn.disabled = true;
                stopBtn.style.display = 'flex';  // Show stop button
                autopilotStatus.style.display = 'block';

                const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanOnly' });

                if (response?.success && response.matched > 0) {
                    scanOnlyBtn.innerHTML = `<span>✅</span><span>Found ${response.matched} matches</span>`;
                    // Show Apply button with match count
                    if (applyMatchesBtn) {
                        applyMatchesBtn.style.display = 'flex';
                        applyMatchesBtn.innerHTML = `<span>✅</span><span>Apply to ${response.matched} Matches</span>`;
                    }
                } else if (response?.success) {
                    scanOnlyBtn.innerHTML = '<span>⚠️</span><span>No matches found</span>';
                } else {
                    scanOnlyBtn.innerHTML = '<span>❌</span><span>Scan failed</span>';
                }

                stopBtn.style.display = 'none';  // Hide stop button
                setTimeout(() => {
                    scanOnlyBtn.innerHTML = '<span>🔍</span><span>Scan Only (No Apply)</span>';
                    scanOnlyBtn.disabled = false;
                }, 3000);
            } catch (err) {
                console.error('Scan error:', err);
                scanOnlyBtn.innerHTML = '<span>❌</span><span>Error</span>';
                scanOnlyBtn.disabled = false;
                stopBtn.style.display = 'none';
            }
        });
    }

    // Apply to previously scanned matches
    if (applyMatchesBtn) {
        applyMatchesBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                applyMatchesBtn.innerHTML = '<span>⏳</span><span>Applying...</span>';
                applyMatchesBtn.disabled = true;
                stopBtn.style.display = 'flex';
                autopilotStatus.style.display = 'block';

                await chrome.tabs.sendMessage(tab.id, { action: 'applyToMatches' });
            } catch (err) {
                console.error('Apply error:', err);
                applyMatchesBtn.innerHTML = '<span>❌</span><span>Error</span>';
                applyMatchesBtn.disabled = false;
            }
        });
    }

    // Auto-submit toggle
    if (autoSubmitToggle) {
        autoSubmitToggle.addEventListener('change', async () => {
            await chrome.storage.local.set({ autoSubmit: autoSubmitToggle.checked });
        });
    }

    // Human mode toggle
    const humanModeToggle = document.getElementById('humanModeToggle');
    if (humanModeToggle) {
        humanModeToggle.addEventListener('change', async () => {
            await chrome.storage.local.set({ humanMode: humanModeToggle.checked });
        });
    }

    // Settings button - open Unhireable app
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            // Try to open the Tauri app or fallback to localhost
            chrome.tabs.create({ url: 'http://localhost:3003/settings' });
        });
    }

    // Test profile button
    const testProfileBtn = document.getElementById('testProfileBtn');
    if (testProfileBtn) {
        testProfileBtn.addEventListener('click', setTestProfile);
    }

    // Test Apply This Job button - test on the currently open job
    const testApplyBtn = document.getElementById('testApplyBtn');
    if (testApplyBtn) {
        testApplyBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.url?.includes('linkedin.com/jobs')) {
                    alert('Open a LinkedIn job page first!');
                    return;
                }

                testApplyBtn.innerHTML = '<span>⏳</span><span>Testing...</span>';
                testApplyBtn.disabled = true;

                const response = await chrome.tabs.sendMessage(tab.id, { action: 'testApplySingle' });

                if (response?.success) {
                    testApplyBtn.innerHTML = '<span>✅</span><span>Applied!</span>';
                } else {
                    testApplyBtn.innerHTML = `<span>⚠️</span><span>${response?.error || 'Manual needed'}</span>`;
                }

                setTimeout(() => {
                    testApplyBtn.innerHTML = '<span>🎯</span><span>Test Apply This Job</span>';
                    testApplyBtn.disabled = false;
                }, 3000);
            } catch (err) {
                console.error('Test apply error:', err);
                testApplyBtn.innerHTML = '<span>❌</span><span>Error - check console</span>';
                testApplyBtn.disabled = false;
            }
        });
    }

    // Load real profile button
    const loadProfileBtn = document.getElementById('loadProfileBtn');
    if (loadProfileBtn) {
        loadProfileBtn.addEventListener('click', loadRealProfile);
    }

    // View Unknown Fields button - for debugging form fields we couldn't fill
    const viewUnknownFieldsBtn = document.getElementById('viewUnknownFieldsBtn');
    if (viewUnknownFieldsBtn) {
        // Load count on init
        chrome.storage.local.get(['unknownFieldsBacklog'], (result) => {
            const count = result.unknownFieldsBacklog?.length || 0;
            viewUnknownFieldsBtn.querySelector('span:last-child').textContent = `View Unknown Fields (${count})`;
        });

        viewUnknownFieldsBtn.addEventListener('click', async () => {
            const result = await chrome.storage.local.get(['unknownFieldsBacklog']);
            const fields = result.unknownFieldsBacklog || [];

            if (fields.length === 0) {
                alert('No unknown fields logged yet!\n\nRun "Test Apply This Job" on various jobs to collect field patterns.');
                return;
            }

            // Format for display
            let report = `📋 Unknown Fields Backlog (${fields.length})\n\n`;
            fields.forEach((f, i) => {
                report += `${i + 1}. ${f.field.label}\n`;
                report += `   Type: ${f.field.tagName} (${f.field.type || 'n/a'})\n`;
                report += `   Job: ${f.job?.company || 'Unknown'}\n`;
                if (f.field.options) {
                    report += `   Options: ${f.field.options.slice(0, 3).join(', ')}${f.field.options.length > 3 ? '...' : ''}\n`;
                }
                report += '\n';
            });

            // Copy to clipboard
            await navigator.clipboard.writeText(JSON.stringify(fields, null, 2));
            alert(report + '\n✅ Full JSON copied to clipboard!');
        });
    }

    // Profile editor
    const editProfileBtn = document.getElementById('editProfileBtn');
    const profileEditor = document.getElementById('profileEditor');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    if (editProfileBtn && profileEditor) {
        editProfileBtn.addEventListener('click', () => {
            profileEditor.style.display = profileEditor.style.display === 'none' ? 'block' : 'none';
            // Populate with current values
            if (userProfile) {
                document.getElementById('inputName').value = userProfile.personal_info?.name || '';
                document.getElementById('inputEmail').value = userProfile.personal_info?.email || '';
                document.getElementById('inputPhone').value = userProfile.personal_info?.phone || '';
                document.getElementById('inputLocation').value = userProfile.personal_info?.location || '';
                document.getElementById('inputSkills').value = (userProfile.skills || []).join(', ');
                document.getElementById('inputSummary').value = userProfile.summary || '';
            }
        });
    }

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const newProfile = {
                personal_info: {
                    name: document.getElementById('inputName').value,
                    email: document.getElementById('inputEmail').value,
                    phone: document.getElementById('inputPhone').value,
                    location: document.getElementById('inputLocation').value,
                    requires_sponsorship: false,
                    willing_to_relocate: true
                },
                summary: document.getElementById('inputSummary').value,
                skills: document.getElementById('inputSkills').value.split(',').map(s => s.trim()).filter(s => s)
            };

            await chrome.storage.local.set({ userProfile: newProfile });
            userProfile = newProfile;
            displayProfile();
            profileEditor.style.display = 'none';

            if (currentAts) {
                fillBtn.disabled = false;
            }

            successMessage.textContent = '✅ Profile saved!';
            successMessage.classList.add('show');
            setTimeout(() => successMessage.classList.remove('show'), 2000);
        });
    }

    // ========== LLM SETTINGS HANDLERS ==========

    // Load and display Gemini API key
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    const cacheCount = document.getElementById('cacheCount');
    const viewCacheBtn = document.getElementById('viewCacheBtn');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const cacheViewer = document.getElementById('cacheViewer');
    const cacheList = document.getElementById('cacheList');
    const closeCacheBtn = document.getElementById('closeCacheBtn');

    console.log('[Unhireable Popup] LLM elements:', {
        geminiApiKeyInput: !!geminiApiKeyInput,
        saveApiKeyBtn: !!saveApiKeyBtn,
        cacheCount: !!cacheCount
    });

    // Load saved API key on popup open
    if (geminiApiKeyInput && cacheCount) {
        chrome.storage.local.get(['geminiApiKey', 'answerCache'], (result) => {
            console.log('[Unhireable Popup] Loaded from storage:', {
                hasApiKey: !!result.geminiApiKey,
                cacheSize: Object.keys(result.answerCache || {}).length
            });
            if (result.geminiApiKey) {
                geminiApiKeyInput.value = '••••••••••••••••'; // Masked
                geminiApiKeyInput.dataset.saved = result.geminiApiKey;
            }
            // Update cache count
            const count = Object.keys(result.answerCache || {}).length;
            cacheCount.textContent = count;
        });
    }

    // Save API key
    if (saveApiKeyBtn && geminiApiKeyInput) {
        saveApiKeyBtn.addEventListener('click', async () => {
            const key = geminiApiKeyInput.value.trim();
            console.log('[Unhireable Popup] Saving API key, length:', key.length, 'contains dots:', key.includes('•'));
            if (key && !key.includes('•')) {
                await chrome.storage.local.set({ geminiApiKey: key });
                console.log('[Unhireable Popup] API key saved!');
                geminiApiKeyInput.value = '••••••••••••••••';
                geminiApiKeyInput.dataset.saved = key;

                successMessage.textContent = '✅ API key saved!';
                successMessage.classList.add('show');
                setTimeout(() => successMessage.classList.remove('show'), 2000);
            }
        });
    }

    // Clear masked value when user starts typing
    if (geminiApiKeyInput) {
        geminiApiKeyInput.addEventListener('focus', () => {
            if (geminiApiKeyInput.value.includes('•')) {
                geminiApiKeyInput.value = '';
            }
        });
    }

    // View cache
    if (viewCacheBtn) {
        viewCacheBtn.addEventListener('click', async () => {
            const { answerCache = {} } = await chrome.storage.local.get(['answerCache']);
            const entries = Object.entries(answerCache);

            if (entries.length === 0) {
                cacheList.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No cached answers yet</div>';
            } else {
                cacheList.innerHTML = entries.map(([key, data]) => `
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; margin-bottom: 6px; border-radius: 6px;">
                        <div style="color: #888; margin-bottom: 4px;">${data.question || key}</div>
                        <div style="color: #22c55e; font-weight: 500;">${data.answer}</div>
                        <div style="color: #666; font-size: 10px; margin-top: 4px;">
                            Source: ${data.source} · Used: ${data.usedCount}x
                        </div>
                    </div>
                `).join('');
            }

            cacheViewer.style.display = 'block';
        });
    }

    // Close cache viewer
    if (closeCacheBtn) {
        closeCacheBtn.addEventListener('click', () => {
            cacheViewer.style.display = 'none';
        });
    }

    // Clear cache
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            if (confirm('Clear all cached answers? This cannot be undone.')) {
                await chrome.storage.local.set({ answerCache: {} });
                cacheCount.textContent = '0';

                successMessage.textContent = '🗑️ Cache cleared!';
                successMessage.classList.add('show');
                setTimeout(() => successMessage.classList.remove('show'), 2000);
            }
        });
    }

    // Export cache as JSON file
    const exportCacheBtn = document.getElementById('exportCacheBtn');
    if (exportCacheBtn) {
        exportCacheBtn.addEventListener('click', async () => {
            const { answerCache = {} } = await chrome.storage.local.get(['answerCache']);
            const entries = Object.entries(answerCache);

            if (entries.length === 0) {
                alert('No cached answers to export!');
                return;
            }

            // Add stats to export
            const exportData = {
                _meta: {
                    exportedAt: new Date().toISOString(),
                    totalEntries: entries.length,
                    sources: entries.reduce((acc, [_, v]) => {
                        acc[v.source || 'unknown'] = (acc[v.source || 'unknown'] || 0) + 1;
                        return acc;
                    }, {})
                },
                answers: answerCache
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `unhireable-answers-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            successMessage.textContent = `📤 Exported ${entries.length} answers!`;
            successMessage.classList.add('show');
            setTimeout(() => successMessage.classList.remove('show'), 2000);
        });
    }

    // Import cache from JSON file
    const importCacheBtn = document.getElementById('importCacheBtn');
    const importCacheFile = document.getElementById('importCacheFile');
    if (importCacheBtn && importCacheFile) {
        importCacheBtn.addEventListener('click', () => importCacheFile.click());
        importCacheFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Support both raw cache and wrapped export format
                const importedAnswers = data.answers || data;

                if (typeof importedAnswers !== 'object' || Array.isArray(importedAnswers)) {
                    alert('Invalid cache file format!');
                    return;
                }

                // Merge with existing cache (don't overwrite)
                const { answerCache = {} } = await chrome.storage.local.get(['answerCache']);
                let newCount = 0;
                for (const [key, value] of Object.entries(importedAnswers)) {
                    if (key === '_meta') continue; // Skip metadata
                    if (!answerCache[key]) {
                        answerCache[key] = value;
                        newCount++;
                    }
                }

                await chrome.storage.local.set({ answerCache });
                const totalCount = Object.keys(answerCache).length;
                cacheCount.textContent = totalCount;

                successMessage.textContent = `📥 Imported ${newCount} new answers (${totalCount} total)`;
                successMessage.classList.add('show');
                setTimeout(() => successMessage.classList.remove('show'), 3000);
            } catch (err) {
                console.error('Import error:', err);
                alert('Failed to import: ' + err.message);
            }
            importCacheFile.value = ''; // Reset
        });
    }

    // Resume upload handler
    const uploadResumeBtn = document.getElementById('uploadResumeBtn');
    const resumeFileInput = document.getElementById('resumeFileInput');
    const resumeUploadStatus = document.getElementById('resumeUploadStatus');

    if (uploadResumeBtn && resumeFileInput) {
        uploadResumeBtn.addEventListener('click', () => resumeFileInput.click());
        
        resumeFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            resumeUploadStatus.style.display = 'block';
            resumeUploadStatus.textContent = '📄 Parsing resume...';
            uploadResumeBtn.disabled = true;

            try {
                const arrayBuffer = await file.arrayBuffer();
                let text;

                if (file.name.toLowerCase().endsWith('.pdf')) {
                    text = await window.UnhireableResumeParser.extractFromPDF(arrayBuffer);
                } else if (file.name.toLowerCase().match(/\.(docx?)$/)) {
                    text = await window.UnhireableResumeParser.extractFromDOCX(arrayBuffer);
                } else {
                    throw new Error('Unsupported file type. Please upload PDF or DOCX.');
                }

                const profile = window.UnhireableResumeParser.parseResume(text);
                
                // Save to storage
                await chrome.storage.local.set({ userProfile: profile });
                userProfile = profile;
                
                // Update UI
                displayProfile();
                fillBtn.disabled = false;
                
                // Populate editor fields
                if (profile.personal_info) {
                    document.getElementById('inputName').value = profile.personal_info.name || '';
                    document.getElementById('inputEmail').value = profile.personal_info.email || '';
                    document.getElementById('inputPhone').value = profile.personal_info.phone || '';
                    document.getElementById('inputLocation').value = profile.personal_info.location || '';
                    document.getElementById('inputSkills').value = Array.isArray(profile.skills) ? profile.skills.join(', ') : '';
                    document.getElementById('inputSummary').value = profile.summary || '';
                }

                resumeUploadStatus.textContent = `✅ Parsed: ${profile.personal_info?.name || 'Profile'} - ${profile.skills?.length || 0} skills found`;
                resumeUploadStatus.style.color = '#22c55e';
                
                successMessage.textContent = `✅ Resume uploaded: ${profile.personal_info?.name || 'Profile'}`;
                successMessage.classList.add('show');
                setTimeout(() => successMessage.classList.remove('show'), 3000);

            } catch (err) {
                console.error('Resume parse error:', err);
                resumeUploadStatus.textContent = `❌ ${err.message}`;
                resumeUploadStatus.style.color = '#ef4444';
            } finally {
                uploadResumeBtn.disabled = false;
                resumeFileInput.value = ''; // Reset
            }
        });
    }
}

// Handle fill button click
async function handleFillClick() {
    if (!currentAts || !userProfile) return;

    fillBtn.disabled = true;
    fillBtn.innerHTML = '<span>⏳</span><span>Filling...</span>';

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const settings = await chrome.storage.local.get(['humanMode']);
        const humanMode = settings.humanMode !== false;

        // Send message to content script
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'fillForm',
            profile: userProfile,
            autoSubmit: autoSubmitToggle.checked,
            humanMode: humanMode
        });

        if (response?.success || response?.received) {
            successMessage.classList.add('show');

            // Show what was filled and what needs manual attention
            if (response.manual && response.manual.length > 0) {
                successMessage.innerHTML = `✅ Filled! <br><span style="font-size:11px;opacity:0.8">Manual: ${response.manual.join(', ')}</span>`;
            } else if (autoSubmitToggle.checked && response.submitted) {
                successMessage.textContent = '✅ Applied successfully!';
            } else {
                successMessage.textContent = '✅ Form fill triggered!';
            }

            fillBtn.innerHTML = '<span>✅</span><span>Sent!</span>';
            setTimeout(() => {
                fillBtn.innerHTML = '<span>⚡</span><span>Auto-Fill Application</span>';
                fillBtn.disabled = false;
            }, 2000);
        } else {
            fillBtn.innerHTML = '<span>❌</span><span>Failed - Try Again</span>';
            fillBtn.disabled = false;
        }

    } catch (err) {
        console.error('Fill error:', err);
        fillBtn.innerHTML = '<span>❌</span><span>Error - Retry</span>';
        fillBtn.disabled = false;
    }
}

// Listen for profile updates from the app
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'profileUpdated') {
        userProfile = message.profile;
        displayProfile();
        if (currentAts) {
            fillBtn.disabled = false;
        }
        sendResponse({ success: true });
    }
});

// Load Job Queue from storage
async function loadJobQueue() {
    try {
        const result = await chrome.storage.local.get(['matchedJobs', 'appliedJobs']);
        const matchedJobs = result.matchedJobs || [];
        const appliedJobs = result.appliedJobs || [];
        
        // Filter out already applied
        const queueJobs = matchedJobs.filter(job => 
            !appliedJobs.some(applied => applied.url === job.url)
        );
        
        // Update queue count
        const queueCountEl = document.getElementById('queueCount');
        if (queueCountEl) {
            queueCountEl.textContent = queueJobs.length;
        }
        
        // Show/hide queue panel
        const queuePanel = document.getElementById('jobQueuePanel');
        if (queuePanel) {
            queuePanel.style.display = queueJobs.length > 0 ? 'block' : 'none';
        }
        
        // Update queue list
        const queueList = document.getElementById('queueList');
        if (queueList && queueJobs.length > 0) {
            queueList.innerHTML = queueJobs.slice(0, 5).map(job => `
                <div style="display: flex; justify-content: space-between; align-items: center; 
                            padding: 6px 8px; background: rgba(255,255,255,0.05); 
                            border-radius: 4px; margin-bottom: 4px;">
                    <div style="overflow: hidden; text-overflow: ellipsis;">
                        <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${job.title || 'Unknown Position'}
                        </div>
                        <div style="color: #71717a; font-size: 10px;">
                            ${job.company || 'Unknown Company'}
                        </div>
                    </div>
                    ${job.score ? `<div style="font-size: 11px; color: ${job.score >= 4 ? '#22c55e' : '#f59e0b'}; 
                                     font-weight: 600; margin-left: 8px;">
                        ${job.score.toFixed(1)}
                    </div>` : ''}
                </div>
            `).join('');
            
            if (queueJobs.length > 5) {
                queueList.innerHTML += `<div style="text-align: center; color: #71717a; font-size: 10px; padding: 4px;">
                    +${queueJobs.length - 5} more jobs...
                </div>`;
            }
        }
    } catch (err) {
        console.error('Failed to load job queue:', err);
    }
}

// Load Application Stats
async function loadApplicationStats() {
    try {
        const result = await chrome.storage.local.get(['appliedJobs', 'scoutedJobs']);
        const appliedJobs = result.appliedJobs || [];
        
        // Show stats dashboard if we have data
        const statsDashboard = document.getElementById('statsDashboard');
        if (statsDashboard && appliedJobs.length > 0) {
            statsDashboard.style.display = 'block';
            
            // Calculate stats
            const total = appliedJobs.length;
            const thisWeek = appliedJobs.filter(job => {
                const appliedDate = new Date(job.appliedAt || job.timestamp);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return appliedDate >= weekAgo;
            }).length;
            
            const today = appliedJobs.filter(job => {
                const appliedDate = new Date(job.appliedAt || job.timestamp);
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                return appliedDate >= todayStart;
            }).length;
            
            const lastApplied = appliedJobs.length > 0 
                ? new Date(appliedJobs[appliedJobs.length - 1].appliedAt || appliedJobs[appliedJobs.length - 1].timestamp).toLocaleDateString()
                : 'Never';
            
            // Update UI
            document.getElementById('statTotalApplied').textContent = total;
            document.getElementById('statThisWeek').textContent = thisWeek;
            document.getElementById('statToday').textContent = today;
            document.getElementById('statLastApplied').textContent = lastApplied;
        }
        
        // Also load job queue
        await loadJobQueue();
    } catch (err) {
        console.error('Failed to load application stats:', err);
    }
}

// Open Dashboard buttons
function setupDashboardButtons() {
    const openDashboardBtn = document.getElementById('openDashboardBtn');
    const quickDashboardBtn = document.getElementById('quickDashboardBtn');
    
    const openDashboard = () => {
        chrome.tabs.create({ url: 'http://localhost:8080' });
    };
    
    if (openDashboardBtn) openDashboardBtn.addEventListener('click', openDashboard);
    if (quickDashboardBtn) quickDashboardBtn.addEventListener('click', openDashboard);
}

// Jobs Queue Functions
async function loadJobsQueueSummary() {
    try {
        const result = await chrome.storage.local.get(['matchedJobs']);
        const matchedJobs = result.matchedJobs || [];
        
        // Update badge
        const badge = document.getElementById('jobsCountBadge');
        if (badge) {
            badge.textContent = matchedJobs.length;
        }
        
        // Update summary
        const summary = document.getElementById('jobsSummary');
        if (summary && matchedJobs.length > 0) {
            summary.style.display = 'block';
            
            const highScoreCount = matchedJobs.filter(j => j.score >= 4.0).length;
            const pendingCount = matchedJobs.filter(j => j.status === 'new' || !j.status).length;
            
            document.getElementById('highScoreCount').textContent = highScoreCount;
            document.getElementById('pendingCount').textContent = pendingCount;
        }
    } catch (err) {
        console.error('Failed to load jobs queue summary:', err);
    }
}

async function importEvaluatedJobs() {
    const fileInput = document.getElementById('jobsImportFile');
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.jobs || !Array.isArray(data.jobs)) {
                alert('Invalid file format. Expected extension_jobs_import.json');
                return;
            }
            
            // Get existing jobs
            const result = await chrome.storage.local.get(['matchedJobs']);
            const existingJobs = result.matchedJobs || [];
            
            // Merge: new jobs take precedence by URL
            const jobMap = new Map(existingJobs.map(j => [j.url, j]));
            
            data.jobs.forEach(job => {
                if (job.url) {
                    job.addedToQueueAt = new Date().toISOString();
                    job.status = 'new';
                    jobMap.set(job.url, job);
                }
            });
            
            const mergedJobs = Array.from(jobMap.values());
            
            // Save
            await chrome.storage.local.set({ matchedJobs: mergedJobs });
            
            // Update UI
            await loadJobsQueueSummary();
            await loadJobQueue();
            
            alert(`✅ Imported ${data.jobs.length} jobs\n` +
                  `⭐ High scores (4.0+): ${data.byScore?.['4.0-5.0'] || 0}\n` +
                  `📊 Total in queue: ${mergedJobs.length}`);
            
        } catch (err) {
            console.error('Failed to import jobs:', err);
            alert('❌ Failed to import: ' + err.message);
        }
        
        // Reset file input
        fileInput.value = '';
    };
    
    fileInput.click();
}

function viewJobsQueue() {
    // Open dashboard in new tab
    chrome.tabs.create({ url: 'http://localhost:8080/dashboard/' });
}

// Setup Jobs Queue buttons
function setupJobsQueueButtons() {
    const importBtn = document.getElementById('importJobsBtn');
    const viewBtn = document.getElementById('viewJobsBtn');
    
    if (importBtn) {
        importBtn.addEventListener('click', importEvaluatedJobs);
    }
    
    if (viewBtn) {
        viewBtn.addEventListener('click', viewJobsQueue);
    }
    
    // Load summary on init
    loadJobsQueueSummary();
}

// Initialize
init();

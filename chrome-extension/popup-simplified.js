/**
 * Unhireable Simplified Popup - Queue-based Auto-Apply
 */

let jobQueue = [];
let isApplying = false;

// DOM Elements
const noQueueState = document.getElementById('noQueueState');
const queueState = document.getElementById('queueState');
const queueFileInput = document.getElementById('queueFileInput');
const importBtn = document.getElementById('importBtn');
const importNewBtn = document.getElementById('importNewBtn');
const applyAllBtn = document.getElementById('applyAllBtn');
const jobList = document.getElementById('jobList');

// Load queue from storage on startup
chrome.storage.local.get(['jobQueue'], (result) => {
    if (result.jobQueue && result.jobQueue.length > 0) {
        jobQueue = result.jobQueue;
        showQueueState();
        renderJobs();
    }
});

// Import button click
importBtn.addEventListener('click', () => queueFileInput.click());
importNewBtn.addEventListener('click', () => queueFileInput.click());

// File input change
queueFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            jobQueue = (data.jobs || []).map(job => ({
                ...job,
                status: 'pending', // pending, applied, failed
                appliedAt: null,
                error: null
            }));

            saveQueue();
            showQueueState();
            renderJobs();
            updateStats();

        } catch (err) {
            alert('Failed to parse queue file: ' + err.message);
        }
    };
    reader.readAsText(file);
    queueFileInput.value = ''; // Reset
});

// Apply all button
applyAllBtn.addEventListener('click', async () => {
    if (isApplying) return;
    
    const pendingJobs = jobQueue.filter(j => j.status === 'pending');
    if (pendingJobs.length === 0) {
        alert('No pending jobs to apply!');
        return;
    }

    isApplying = true;
    applyAllBtn.disabled = true;
    applyAllBtn.textContent = '⏳ Applying...';

    for (const job of pendingJobs) {
        await applyToJob(job);
        updateStats();
        renderJobs();
        
        // Human-like delay between applications
        await delay(5000 + Math.random() * 5000);
    }

    isApplying = false;
    applyAllBtn.disabled = false;
    applyAllBtn.textContent = '▶ Apply to All Jobs';
    
    const applied = jobQueue.filter(j => j.status === 'applied').length;
    alert(`Applied to ${applied} jobs!`);
});

async function applyToJob(job) {
    try {
        // Open job URL in new tab
        const tab = await chrome.tabs.create({ 
            url: job.url,
            active: true 
        });

        // Wait for page load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Send message to content script to apply
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'applyFromQueue',
            job: job
        });

        if (response && response.success) {
            job.status = 'applied';
            job.appliedAt = new Date().toISOString();
        } else {
            job.status = 'failed';
            job.error = response?.error || 'Unknown error';
        }

        saveQueue();

        // Close tab after a moment (optional)
        await new Promise(resolve => setTimeout(resolve, 2000));
        await chrome.tabs.remove(tab.id);

    } catch (error) {
        console.error('Failed to apply:', error);
        job.status = 'failed';
        job.error = error.message;
        saveQueue();
    }
}

function showQueueState() {
    noQueueState.style.display = 'none';
    queueState.style.display = 'block';
}

function renderJobs() {
    if (jobQueue.length === 0) {
        jobList.innerHTML = '<div style="text-align: center; color: #71717a; padding: 20px;">No jobs in queue</div>';
        return;
    }

    jobList.innerHTML = jobQueue.map((job, index) => {
        const statusClass = job.status === 'applied' ? 'applied' : 
                           job.status === 'failed' ? 'failed' : '';
        const statusBadge = job.status === 'pending' ? 
            '<span class="status-badge status-pending">Pending</span>' :
            job.status === 'applied' ?
            '<span class="status-badge status-applied">✓ Applied</span>' :
            '<span class="status-badge status-failed">✗ Failed</span>';

        return `
            <div class="job-item ${statusClass}">
                <div class="job-info">
                    <div class="job-title">${escapeHtml(job.title)} ${statusBadge}</div>
                    <div class="job-company">${escapeHtml(job.company)}</div>
                </div>
                <div class="job-score">${job.score.toFixed(1)}</div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    const total = jobQueue.length;
    const applied = jobQueue.filter(j => j.status === 'applied').length;
    const remaining = total - applied;
    const progress = total > 0 ? (applied / total) * 100 : 0;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statApplied').textContent = applied;
    document.getElementById('statRemaining').textContent = remaining;
    document.getElementById('progressBar').style.width = `${progress}%`;
}

function saveQueue() {
    chrome.storage.local.set({ jobQueue });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

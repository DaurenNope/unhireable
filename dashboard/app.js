/**
 * Unhireable Dashboard - Job Review and Queue Management
 */

let allJobs = [];
let queue = new Set();
let currentFilter = { minScore: 4, recommendation: 'APPLY', showQueued: false };

// Load jobs from JSON file
function loadJobs() {
    document.getElementById('fileInput').click();
}

document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            allJobs = data.jobs || [];
            updateStats();
            filterJobs();
            showNotification(`Loaded ${allJobs.length} jobs`);
        } catch (err) {
            alert('Failed to parse JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
});

// Update statistics
function updateStats() {
    const goodMatches = allJobs.filter(j => j.score >= 4);
    const avgScore = allJobs.length > 0 
        ? (allJobs.reduce((sum, j) => sum + j.score, 0) / allJobs.length).toFixed(1)
        : 0;

    document.getElementById('statTotal').textContent = allJobs.length;
    document.getElementById('statGood').textContent = goodMatches.length;
    document.getElementById('statQueued').textContent = queue.size;
    document.getElementById('statAvg').textContent = avgScore;
}

// Filter and display jobs
function filterJobs() {
    currentFilter = {
        minScore: parseFloat(document.getElementById('minScore').value),
        recommendation: document.getElementById('recFilter').value,
        showQueued: document.getElementById('showQueued').checked
    };

    let filtered = allJobs.filter(job => {
        if (job.score < currentFilter.minScore) return false;
        if (currentFilter.recommendation !== 'all' && job.recommendation !== currentFilter.recommendation) return false;
        if (currentFilter.showQueued && !queue.has(job.url)) return false;
        return true;
    });

    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score);

    displayJobs(filtered);
}

// Display job cards
function displayJobs(jobs) {
    const container = document.getElementById('jobsContainer');
    
    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No jobs match filters</h3>
                <p>Try adjusting your filters or load more jobs.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = jobs.map(job => {
        const scoreClass = job.score >= 4 ? 'score-high' : job.score >= 3 ? 'score-medium' : 'score-low';
        const isQueued = queue.has(job.url);
        
        return `
            <div class="job-card ${isQueued ? 'queued' : ''}" data-url="${job.url}">
                <div class="job-main">
                    <div class="job-header">
                        <div>
                            <div class="job-title">${escapeHtml(job.title)}</div>
                            <div class="job-company">${escapeHtml(job.company)}</div>
                            <div class="job-location">${escapeHtml(job.location)}</div>
                        </div>
                    </div>
                    <div class="job-summary" style="margin-top: 8px; font-size: 13px; color: #a1a1aa;">
                        ${escapeHtml(job.summary || 'No summary available')}
                    </div>
                    <div class="job-details">
                        <div class="blocks-grid">
                            ${renderBlocks(job.blocks)}
                        </div>
                        <p><strong>CV Highlights:</strong> ${(job.cv_highlights || []).join(', ')}</p>
                        <p><strong>Interview Prep:</strong></p>
                        <ul style="margin-left: 20px; margin-top: 4px;">
                            ${(job.interview_prep || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                        </ul>
                        <p style="margin-top: 12px;">
                            <a href="${job.url}" target="_blank" style="color: #6366f1;">View Job Posting →</a>
                        </p>
                    </div>
                </div>
                <div class="job-actions">
                    <div class="job-score">
                        <div class="score-badge ${scoreClass}">${job.score.toFixed(1)}</div>
                    </div>
                    <button class="btn ${isQueued ? 'btn-secondary' : 'btn-primary'} btn-small" 
                            onclick="toggleQueue('${job.url}')">
                        ${isQueued ? '✓ Queued' : '+ Add to Queue'}
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="toggleDetails(this)">
                        Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderBlocks(blocks) {
    if (!blocks) return '';
    
    const blockNames = {
        'A': 'Role Fit',
        'B': 'Skills',
        'C': 'Logistics',
        'D': 'Company'
    };
    
    return Object.entries(blocks).map(([key, data]) => `
        <div class="block-item">
            <div class="block-label">${blockNames[key] || key}</div>
            <div class="block-score" style="color: ${data.score >= 4 ? '#22c55e' : data.score >= 3 ? '#eab308' : '#ef4444'}">
                ${data.score}/5
            </div>
        </div>
    `).join('');
}

// Toggle job details
function toggleDetails(btn) {
    const card = btn.closest('.job-card');
    card.classList.toggle('expanded');
    btn.textContent = card.classList.contains('expanded') ? 'Hide' : 'Details';
}

// Toggle queue
function toggleQueue(url) {
    if (queue.has(url)) {
        queue.delete(url);
    } else {
        queue.add(url);
    }
    
    updateStats();
    filterJobs(); // Re-render to show updated state
    updateExportPanel();
    
    showNotification(queue.has(url) ? 'Added to queue' : 'Removed from queue');
}

// Update export panel
function updateExportPanel() {
    const panel = document.getElementById('exportPanel');
    const count = document.getElementById('queueCount');
    
    if (queue.size > 0) {
        panel.style.display = 'block';
        count.textContent = queue.size;
    } else {
        panel.style.display = 'none';
    }
}

// Export queue as JSON for extension
function exportQueue() {
    if (queue.size === 0) {
        alert('Queue is empty. Add some jobs first!');
        return;
    }

    const queueJobs = allJobs.filter(job => queue.has(job.url));
    const exportData = {
        exported_at: new Date().toISOString(),
        total_jobs: queueJobs.length,
        jobs: queueJobs.map(job => ({
            title: job.title,
            company: job.company,
            location: job.location,
            url: job.url,
            score: job.score,
            summary: job.summary,
            cv_highlights: job.cv_highlights,
            interview_prep: job.interview_prep,
            tailored_summary: job.tailored_summary
        }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unhireable-queue-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(`Exported ${queueJobs.length} jobs for extension`);
}

// Notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(34, 197, 94, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-load from data directory on startup (for local file:// usage)
window.addEventListener('DOMContentLoaded', () => {
    // Try to load from localStorage if previously loaded
    const saved = localStorage.getItem('unhireable_jobs');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            allJobs = data.jobs || [];
            updateStats();
            filterJobs();
        } catch (e) {
            console.error('Failed to restore jobs', e);
        }
    }
});

// Save to localStorage when jobs change
window.addEventListener('beforeunload', () => {
    if (allJobs.length > 0) {
        localStorage.setItem('unhireable_jobs', JSON.stringify({ jobs: allJobs }));
    }
});

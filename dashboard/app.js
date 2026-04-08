/**
 * Unhireable Dashboard - Minimalist Job Review
 */

let allJobs = [];
let queue = new Set();
let expandedJobs = new Set();

// Load jobs
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
            renderJobs();
            toast(`Imported ${allJobs.length} jobs`);
        } catch (err) {
            alert('Failed to parse JSON');
        }
    };
    reader.readAsText(file);
});

// Stats
function updateStats() {
    const good = allJobs.filter(j => j.score >= 4).length;
    const avg = allJobs.length ? (allJobs.reduce((s, j) => s + j.score, 0) / allJobs.length).toFixed(1) : '0.0';
    
    document.getElementById('statTotal').textContent = allJobs.length;
    document.getElementById('statGood').textContent = good;
    document.getElementById('statQueued').textContent = queue.size;
    document.getElementById('statAvg').textContent = avg;
    document.getElementById('queueCount').textContent = queue.size;
    document.getElementById('queuePanel').style.display = queue.size ? 'block' : 'none';
}

// Filter
function filterJobs() {
    renderJobs();
}

function getFilteredJobs() {
    const minScore = parseFloat(document.getElementById('minScore').value);
    const rec = document.getElementById('recFilter').value;
    const queuedOnly = document.getElementById('showQueued').checked;
    
    return allJobs.filter(job => {
        if (job.score < minScore) return false;
        if (rec !== 'all' && job.recommendation !== rec) return false;
        if (queuedOnly && !queue.has(job.url)) return false;
        return true;
    }).sort((a, b) => b.score - a.score);
}

// Render
function renderJobs() {
    const container = document.getElementById('jobsContainer');
    const jobs = getFilteredJobs();
    
    if (!jobs.length) {
        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📋</div>
                <h3>No jobs found</h3>
                <p>Try adjusting your filters or import new jobs.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = jobs.map(job => {
        const isQueued = queue.has(job.url);
        const isExpanded = expandedJobs.has(job.url);
        const scoreClass = job.score >= 4 ? 'score-high' : job.score >= 3 ? 'score-medium' : 'score-low';
        const recLabel = job.recommendation === 'APPLY' ? 'Apply' : job.recommendation === 'CONSIDER' ? 'Consider' : 'Skip';
        
        return `
            <div class="job ${isQueued ? 'queued' : ''} ${isExpanded ? 'expanded' : ''}" data-url="${escapeHtml(job.url)}">
                <div class="job-main">
                    <div class="job-header">
                        <h3 class="job-title">${escapeHtml(job.title)}</h3>
                    </div>
                    <div class="job-meta">
                        <span>${escapeHtml(job.company)}</span>
                        <span>${escapeHtml(job.location)}</span>
                    </div>
                    <p class="job-summary">${escapeHtml(job.summary || '')}</p>
                    <div class="job-tags">
                        ${(job.cv_highlights || []).slice(0, 4).map(h => `<span class="tag">${escapeHtml(h)}</span>`).join('')}
                        ${isQueued ? '<span class="tag tag-green">In Queue</span>' : ''}
                    </div>
                    
                    ${isExpanded ? `
                        <div class="details">
                            <div class="blocks">
                                ${renderBlocks(job.blocks)}
                            </div>
                            <ul class="prep-list">
                                ${(job.interview_prep || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                
                <div class="job-actions">
                    <div class="score">
                        <div class="score-value ${scoreClass}">${job.score.toFixed(1)}</div>
                        <div class="score-label">${recLabel}</div>
                    </div>
                    <button class="btn ${isQueued ? 'btn-ghost' : 'btn-primary'} btn-small" onclick="toggleQueue('${escapeHtml(job.url)}')">
                        ${isQueued ? 'Remove' : 'Add to Queue'}
                    </button>
                    <button class="btn btn-ghost btn-small" onclick="toggleExpand('${escapeHtml(job.url)}')">
                        ${isExpanded ? 'Less' : 'More'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderBlocks(blocks) {
    if (!blocks) return '';
    const names = { A: 'Role', B: 'Skills', C: 'Logistics', D: 'Company' };
    return Object.entries(blocks).map(([k, v]) => `
        <div class="block">
            <div class="block-name">${names[k]}</div>
            <div class="block-score" style="color: ${v.score >= 4 ? 'var(--success)' : v.score >= 3 ? 'var(--warning)' : 'var(--danger)'}">${v.score}</div>
        </div>
    `).join('');
}

function toggleQueue(url) {
    if (queue.has(url)) queue.delete(url);
    else queue.add(url);
    updateStats();
    renderJobs();
    toast(queue.has(url) ? 'Added to queue' : 'Removed from queue');
}

function toggleExpand(url) {
    if (expandedJobs.has(url)) expandedJobs.delete(url);
    else expandedJobs.add(url);
    renderJobs();
}

function exportQueue() {
    if (!queue.size) {
        alert('Queue is empty');
        return;
    }
    
    const jobs = allJobs.filter(j => queue.has(j.url));
    const data = {
        exported_at: new Date().toISOString(),
        total_jobs: jobs.length,
        jobs: jobs.map(j => ({ title: j.title, company: j.company, location: j.location, url: j.url, score: j.score, summary: j.summary, cv_highlights: j.cv_highlights, interview_prep: j.interview_prep }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `queue-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast(`Exported ${jobs.length} jobs`);
}

function toast(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--success);color:white;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;z-index:1000;animation:slideIn 0.2s;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, 2000);
}

function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('unhireable_jobs');
    if (saved) {
        try {
            allJobs = JSON.parse(saved).jobs || [];
            updateStats();
            renderJobs();
        } catch (e) {}
    }
});

window.addEventListener('beforeunload', () => {
    if (allJobs.length) localStorage.setItem('unhireable_jobs', JSON.stringify({ jobs: allJobs }));
});

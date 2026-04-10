/**
 * Unhireable Dashboard - Minimalist Job Review
 * Updated: Auto-loads from data files, handles raw & evaluated jobs
 */

let allJobs = [];
let queue = new Set();
let expandedJobs = new Set();

// Auto-load data files on startup
async function loadDataFiles() {
    try {
        const [rawRes, evalRes] = await Promise.allSettled([
            fetch('/data/jobs_raw.json'),
            fetch('/data/jobs_evaluated.json')
        ]);
        
        let rawJobs = [];
        let evaluatedJobs = [];
        
        if (rawRes.status === 'fulfilled' && rawRes.value.ok) {
            const rawData = await rawRes.value.json();
            rawJobs = (rawData.jobs || []).map(j => ({ ...j, _evaluated: false, _source: 'scanned' }));
        }
        
        if (evalRes.status === 'fulfilled' && evalRes.value.ok) {
            const evalData = await evalRes.value.json();
            evaluatedJobs = (evalData.jobs || []).map(j => ({ ...j, _evaluated: true, _source: 'evaluated' }));
        }
        
        // Merge: evaluated jobs take precedence (by URL)
        const jobMap = new Map();
        
        // Add raw jobs first
        rawJobs.forEach(job => {
            if (job.url) jobMap.set(job.url, job);
        });
        
        // Override with evaluated jobs
        evaluatedJobs.forEach(job => {
            if (job.url) jobMap.set(job.url, job);
        });
        
        allJobs = Array.from(jobMap.values());
        
        if (allJobs.length > 0) {
            updateStats();
            renderJobs();
            toast(`Loaded ${allJobs.length} jobs (${evaluatedJobs.length} evaluated, ${rawJobs.length - evaluatedJobs.length} pending)`);
        }
    } catch (e) {
        console.log('No data files found, waiting for import');
    }
}

// Load jobs from file (manual import)
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
            allJobs = (data.jobs || []).map(j => ({ ...j, _evaluated: !!j.score }));
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
    const evaluated = allJobs.filter(j => j._evaluated || j.score > 0);
    const good = evaluated.filter(j => j.score >= 4).length;
    const pending = allJobs.filter(j => !j._evaluated && !j.score).length;
    const avg = evaluated.length ? (evaluated.reduce((s, j) => s + (j.score || 0), 0) / evaluated.length).toFixed(1) : '0.0';
    
    document.getElementById('statTotal').textContent = allJobs.length;
    document.getElementById('statGood').textContent = good;
    document.getElementById('statQueued').textContent = queue.size;
    document.getElementById('statAvg').textContent = avg;
    document.getElementById('queueCount').textContent = queue.size;
    document.getElementById('queuePanel').style.display = queue.size ? 'block' : 'none';
    
    // Update filter label if pending exists
    const pendingFilter = document.getElementById('pendingCount');
    if (pendingFilter) pendingFilter.textContent = pending;
}

// Filter
function filterJobs() {
    renderJobs();
}

function getFilteredJobs() {
    const minScore = parseFloat(document.getElementById('minScore').value);
    const rec = document.getElementById('recFilter').value;
    const queuedOnly = document.getElementById('showQueued')?.checked || false;
    const showPending = document.getElementById('showPending')?.checked !== false; // default true
    const searchQuery = document.getElementById('searchInput')?.value?.toLowerCase()?.trim() || '';
    
    return allJobs.filter(job => {
        const isPending = !job._evaluated && !job.score;
        
        // Search filter (applies to all jobs)
        if (searchQuery) {
            const searchable = `${job.title || ''} ${job.company || ''} ${job.location || ''} ${job.summary || ''} ${job.description || ''}`.toLowerCase();
            if (!searchable.includes(searchQuery)) return false;
        }
        
        // Handle pending jobs
        if (isPending) {
            if (!showPending) return false;
            return true; // pending jobs bypass score filter
        }
        
        // Handle evaluated jobs
        if ((job.score || 0) < minScore) return false;
        if (rec !== 'all' && job.recommendation !== rec) return false;
        if (queuedOnly && !queue.has(job.url)) return false;
        return true;
    }).sort((a, b) => {
        // Sort: evaluated first (by score), then pending
        const aEval = a._evaluated || a.score > 0;
        const bEval = b._evaluated || b.score > 0;
        if (aEval && !bEval) return -1;
        if (!aEval && bEval) return 1;
        return (b.score || 0) - (a.score || 0);
    });
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
        const isPending = !job._evaluated && !job.score;
        
        // Score display
        let scoreHtml;
        if (isPending) {
            scoreHtml = `
                <div class="score">
                    <div class="score-value score-pending">-</div>
                    <div class="score-label">Pending</div>
                </div>
            `;
        } else {
            const score = job.score || 0;
            const scoreClass = score >= 4 ? 'score-high' : score >= 3 ? 'score-medium' : 'score-low';
            const recLabel = job.recommendation === 'APPLY' ? 'Apply' : job.recommendation === 'CONSIDER' ? 'Consider' : 'Skip';
            scoreHtml = `
                <div class="score">
                    <div class="score-value ${scoreClass}">${score.toFixed(1)}</div>
                    <div class="score-label">${recLabel}</div>
                </div>
            `;
        }
        
        // Source badge
        const sourceBadge = job._source === 'scanned' ? '<span class="tag tag-blue">Scanned</span>' : 
                           job._source === 'evaluated' ? '<span class="tag tag-purple">Evaluated</span>' : '';
        
        return `
            <div class="job ${isQueued ? 'queued' : ''} ${isExpanded ? 'expanded' : ''} ${isPending ? 'pending' : ''}" data-url="${escapeHtml(job.url)}">
                <div class="job-main">
                    <div class="job-header">
                        <h3 class="job-title">${escapeHtml(job.title)}</h3>
                    </div>
                    <div class="job-meta">
                        <span>${escapeHtml(job.company)}</span>
                        <span>${escapeHtml(job.location)}</span>
                    </div>
                    <p class="job-summary">${escapeHtml(job.summary || job.description || '')}</p>
                    <div class="job-tags">
                        ${(job.cv_highlights || []).slice(0, 4).map(h => `<span class="tag">${escapeHtml(h)}</span>`).join('')}
                        ${sourceBadge}
                        ${isQueued ? '<span class="tag tag-green">In Queue</span>' : ''}
                    </div>
                    
                    ${isExpanded ? `
                        <div class="details">
                            ${job._evaluated ? `
                                <div class="blocks">
                                    ${renderBlocks(job.blocks)}
                                </div>
                                <ul class="prep-list">
                                    ${(job.interview_prep || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                                </ul>
                            ` : `
                                <div class="pending-notice">
                                    <p>This job hasn't been evaluated yet. Run the evaluator to see match score and recommendations.</p>
                                </div>
                            `}
                        </div>
                    ` : ''}
                </div>
                
                <div class="job-actions">
                    ${scoreHtml}
                    <button class="btn ${isQueued ? 'btn-ghost' : 'btn-primary'} btn-small" onclick="toggleQueue('${escapeHtml(job.url)}')">
                        ${isQueued ? 'Remove' : 'Add to Queue'}
                    </button>
                    ${!isPending && job.recommendation === 'APPLY' ? `
                        <button class="btn btn-small" style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white;" onclick="applyToJob('${escapeHtml(job.url)}', '${escapeHtml(job.title)}', '${escapeHtml(job.company)}')">
                            ⚡ Apply Now
                        </button>
                    ` : ''}
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

// Apply to job - opens in new tab and triggers extension
function applyToJob(url, title, company) {
    // Add to queue with auto-apply flag
    const job = allJobs.find(j => j.url === url);
    if (job) {
        queue.add(url);
        
        // Store in localStorage for extension to pick up
        const pendingApplications = JSON.parse(localStorage.getItem('unhireable_pending_applications') || '[]');
        pendingApplications.push({
            url,
            title,
            company,
            addedAt: new Date().toISOString(),
            autoApply: true
        });
        localStorage.setItem('unhireable_pending_applications', JSON.stringify(pendingApplications));
        
        // Update queue display
        renderJobs();
        updateStats();
        
        // Open job in new tab
        window.open(url, '_blank');
        
        toast(`Opening ${company} - ${title}. Extension will auto-fill when page loads.`);
    }
}

// Full Pipeline - runs scan → evaluate → import
let pipelineAbortController = null;

async function runFullPipeline() {
    if (pipelineAbortController) {
        toast('Pipeline already running');
        return;
    }

    pipelineAbortController = new AbortController();
    const signal = pipelineAbortController.signal;

    // Show pipeline panel
    const panel = document.getElementById('pipelinePanel');
    panel.style.display = 'block';

    // Reset steps
    updateStep('Scan', 'pending');
    updateStep('Evaluate', 'waiting');
    updateStep('Import', 'waiting');
    updateStep('Load', 'waiting');
    updateProgress(0);
    logPipeline('🚀 Starting full pipeline...');

    try {
        // Step 1: Scan
        logPipeline('🔍 Step 1/4: Scanning job portals...');
        updateStep('Scan', 'running');
        updateProgress(10);

        // Check if scanner config exists
        const configRes = await fetch('../data/config.yml');
        if (!configRes.ok) {
            throw new Error('Scanner config not found. Run from project root: node scanner/llm-agnostic-scan.mjs');
        }

        // Run scanner via fetch to local API (if available) or shell
        // For now, we'll simulate with a message to user
        logPipeline('⏳ Scanner would run here. In production: spawn scanner process');
        await simulateDelay(2000, signal);

        // Check for jobs_raw.json
        const rawRes = await fetch('../data/jobs_raw.json');
        if (!rawRes.ok) {
            throw new Error('No jobs found. Run scanner first: node scanner/llm-agnostic-scan.mjs');
        }

        const rawJobs = await rawRes.json();
        logPipeline(`✅ Found ${rawJobs.length} raw jobs`);
        updateStep('Scan', 'complete');
        updateProgress(25);

        // Step 2: Evaluate
        logPipeline('⚖️ Step 2/4: Evaluating jobs with AI...');
        updateStep('Evaluate', 'running');
        updateProgress(30);

        // Check for evaluated jobs
        const evalRes = await fetch('../data/jobs_evaluated.json');
        if (!evalRes.ok) {
            logPipeline('⏳ Evaluator would run here. Run: cd evaluator && opencode .');
            await simulateDelay(2000, signal);
            throw new Error('No evaluated jobs found. Run evaluator first.');
        }

        const evaluatedJobs = await evalRes.json();
        logPipeline(`✅ Found ${evaluatedJobs.length} evaluated jobs`);
        updateStep('Evaluate', 'complete');
        updateProgress(60);

        // Step 3: Import to Extension Format
        logPipeline('📥 Step 3/4: Converting to extension format...');
        updateStep('Import', 'running');
        updateProgress(65);

        // Check for extension import file
        const extRes = await fetch('../data/extension_jobs_import.json');
        if (!extRes.ok) {
            logPipeline('⏳ Running import script...');
            await simulateDelay(1500, signal);
            throw new Error('Extension import file not found. Run: node scripts/import-to-extension.mjs');
        }

        const extJobs = await extRes.json();
        logPipeline(`✅ Generated extension import file with ${extJobs.length} jobs`);
        updateStep('Import', 'complete');
        updateProgress(80);

        // Step 4: Load into Dashboard
        logPipeline('📊 Step 4/4: Loading into dashboard...');
        updateStep('Load', 'running');
        updateProgress(85);

        await loadJobs();
        logPipeline('✅ Dashboard updated with new jobs');
        updateStep('Load', 'complete');
        updateProgress(100);

        document.getElementById('pipelineStatus').textContent = '✅ Pipeline Complete!';
        toast('🎉 Full pipeline complete! Review evaluated jobs.');

    } catch (err) {
        if (err.name === 'AbortError') {
            logPipeline('⏹ Pipeline stopped by user');
            document.getElementById('pipelineStatus').textContent = '⏹ Stopped';
        } else {
            console.error('Pipeline error:', err);
            logPipeline(`❌ Error: ${err.message}`);
            document.getElementById('pipelineStatus').textContent = '❌ Error';
            toast('❌ Pipeline failed: ' + err.message);
        }
    } finally {
        pipelineAbortController = null;
        setTimeout(() => {
            if (!pipelineAbortController) {
                panel.style.display = 'none';
            }
        }, 5000);
    }
}

function stopPipeline() {
    if (pipelineAbortController) {
        pipelineAbortController.abort();
        pipelineAbortController = null;
    }
}

function updateStep(step, status) {
    const statusEl = document.getElementById(`step${step}Status`);
    const iconEl = document.getElementById(`step${step}`);

    if (!statusEl) return;

    statusEl.textContent = status;
    statusEl.style.color = {
        'waiting': '#666',
        'pending': '#888',
        'running': '#a5b4fc',
        'complete': '#22c55e',
        'error': '#ef4444'
    }[status] || '#888';

    if (iconEl) {
        iconEl.style.opacity = status === 'complete' ? '1' : status === 'running' ? '0.8' : '0.5';
    }
}

function updateProgress(percent) {
    const bar = document.getElementById('pipelineProgress');
    if (bar) bar.style.width = `${percent}%`;
}

function logPipeline(message) {
    const log = document.getElementById('pipelineLog');
    if (log) {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        log.innerHTML += `<div>[${time}] ${message}</div>`;
        log.scrollTop = log.scrollHeight;
    }
    console.log('[Pipeline]', message);
}

function simulateDelay(ms, signal) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, ms);
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('AbortError'));
            });
        }
    });
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    // Try to load from data files first
    loadDataFiles();
    
    // Fallback to localStorage if no files
    const saved = localStorage.getItem('unhireable_jobs');
    if (saved && allJobs.length === 0) {
        try {
            const data = JSON.parse(saved);
            allJobs = (data.jobs || []).map(j => ({ ...j, _evaluated: !!j.score }));
            updateStats();
            renderJobs();
        } catch (e) {}
    }
});

window.addEventListener('beforeunload', () => {
    if (allJobs.length) localStorage.setItem('unhireable_jobs', JSON.stringify({ jobs: allJobs }));
});

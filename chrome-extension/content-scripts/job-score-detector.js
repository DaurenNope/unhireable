/**
 * Job Score Detector - Content Script
 * 
 * Detects when user visits a job URL that was evaluated
 * Shows score badge on the page
 * Communicates with popup to display detailed info
 */

(function() {
    'use strict';

    let evaluatedJob = null;
    let scoreBadge = null;

    // Initialize
    init();

    async function init() {
        // Check if current URL matches an evaluated job
        const currentUrl = window.location.href;
        
        try {
            const result = await chrome.storage.local.get(['matchedJobs']);
            const matchedJobs = result.matchedJobs || [];
            
            // Find matching job by URL
            evaluatedJob = matchedJobs.find(job => {
                // Match by URL (handle slight variations)
                const jobUrl = job.url?.toLowerCase() || '';
                const current = currentUrl.toLowerCase();
                
                // Exact match or job URL is in current URL
                return jobUrl === current || 
                       (jobUrl && current.includes(jobUrl)) ||
                       (current && jobUrl.includes(current.split('?')[0]));
            });
            
            if (evaluatedJob && evaluatedJob.score) {
                console.log('[Unhireable] Evaluated job detected:', evaluatedJob);
                showScoreBadge(evaluatedJob);
                notifyPopup(evaluatedJob);
            }
        } catch (err) {
            console.error('[Unhireable] Failed to check job score:', err);
        }
    }

    function showScoreBadge(job) {
        // Remove existing badge
        if (scoreBadge) {
            scoreBadge.remove();
        }

        // Create badge element
        scoreBadge = document.createElement('div');
        scoreBadge.id = 'unhireable-score-badge';
        
        // Determine color based on score
        let color = '#ef4444'; // red for low scores
        let bgColor = 'rgba(239, 68, 68, 0.15)';
        let borderColor = 'rgba(239, 68, 68, 0.3)';
        
        if (job.score >= 4.0) {
            color = '#22c55e'; // green for high scores
            bgColor = 'rgba(34, 197, 94, 0.15)';
            borderColor = 'rgba(34, 197, 94, 0.3)';
        } else if (job.score >= 3.0) {
            color = '#f59e0b'; // yellow for medium scores
            bgColor = 'rgba(245, 158, 11, 0.15)';
            borderColor = 'rgba(245, 158, 11, 0.3)';
        }

        // Determine recommendation text
        let recText = job.recommendation || 'PENDING';
        let recEmoji = '⚪';
        if (recText === 'APPLY') recEmoji = '✅';
        if (recText === 'SKIP') recEmoji = '❌';
        if (recText === 'CONSIDER') recEmoji = '🤔';

        // Badge styles
        scoreBadge.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: ${bgColor};
            backdrop-filter: blur(10px);
            border: 1px solid ${borderColor};
            border-radius: 12px;
            padding: 12px 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            color: #fff;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            transition: all 0.2s ease;
            max-width: 280px;
        `;

        // Badge content
        scoreBadge.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 16px;">🚀</span>
                <span style="font-weight: 600; font-size: 14px;">Unhireable Score</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px;">
                <span style="font-size: 24px; font-weight: 700; color: ${color};">${job.score.toFixed(1)}</span>
                <span style="font-size: 14px; color: #888;">/ 5.0</span>
            </div>
            <div style="font-size: 12px; color: ${color}; font-weight: 500; margin-bottom: 4px;">
                ${recEmoji} ${recText}
            </div>
            ${job.summary ? `<div style="font-size: 11px; color: #aaa; line-height: 1.4; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">${truncate(job.summary, 100)}</div>` : ''}
        `;

        // Hover effect
        scoreBadge.addEventListener('mouseenter', () => {
            scoreBadge.style.transform = 'scale(1.02)';
            scoreBadge.style.boxShadow = '0 6px 30px rgba(0, 0, 0, 0.4)';
        });

        scoreBadge.addEventListener('mouseleave', () => {
            scoreBadge.style.transform = 'scale(1)';
            scoreBadge.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        });

        // Click to expand (show more details)
        scoreBadge.addEventListener('click', () => {
            toggleExpandedDetails(job);
        });

        // Add to page
        document.body.appendChild(scoreBadge);

        // Auto-hide after 10 seconds (but keep small indicator)
        setTimeout(() => {
            if (scoreBadge) {
                minimizeBadge(job);
            }
        }, 10000);
    }

    function minimizeBadge(job) {
        if (!scoreBadge) return;

        let color = '#ef4444';
        if (job.score >= 4.0) color = '#22c55e';
        else if (job.score >= 3.0) color = '#f59e0b';

        scoreBadge.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: ${color};
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        scoreBadge.innerHTML = job.score.toFixed(1);
        
        scoreBadge.onclick = () => {
            showScoreBadge(job);
        };
    }

    function toggleExpandedDetails(job) {
        // Create or toggle expanded panel
        let panel = document.getElementById('unhireable-expanded-panel');
        
        if (panel) {
            panel.remove();
            return;
        }

        panel = document.createElement('div');
        panel.id = 'unhireable-expanded-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999998;
            background: rgba(30, 30, 46, 0.98);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            color: #fff;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            max-width: 350px;
            max-height: 80vh;
            overflow-y: auto;
        `;

        // Build detailed content
        let blocksHtml = '';
        if (job.blocks) {
            const blockLabels = {
                'A': 'Role Fit',
                'B': 'Skills Match',
                'C': 'Logistics',
                'D': 'Company Quality'
            };

            Object.entries(job.blocks).forEach(([key, block]) => {
                const label = blockLabels[key] || `Block ${key}`;
                const score = block.score || 0;
                const reason = block.reason || '';
                
                let color = '#ef4444';
                if (score >= 4) color = '#22c55e';
                else if (score >= 3) color = '#f59e0b';

                blocksHtml += `
                    <div style="margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-weight: 500; font-size: 12px;">${label}</span>
                            <span style="color: ${color}; font-weight: 600;">${score}/5</span>
                        </div>
                        <div style="font-size: 11px; color: #aaa; line-height: 1.4;">${truncate(reason, 120)}</div>
                    </div>
                `;
            });
        }

        // CV Highlights
        let highlightsHtml = '';
        if (job.cv_highlights && job.cv_highlights.length > 0) {
            highlightsHtml = `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">CV Highlights</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${job.cv_highlights.map(h => `
                            <span style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 4px 8px; border-radius: 4px; font-size: 11px;">${h}</span>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Interview Prep
        let interviewHtml = '';
        if (job.interview_prep && job.interview_prep.length > 0) {
            interviewHtml = `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">🎯 Interview Prep</div>
                    ${job.interview_prep.map((story, i) => `
                        <div style="font-size: 11px; color: #aaa; line-height: 1.4; margin-bottom: 6px; padding: 8px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; border-left: 2px solid #22c55e;">
                            <strong style="color: #22c55e;">Story ${i + 1}:</strong> ${truncate(story, 100)}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Close button
        const closeBtn = `
            <button id="unhireable-close-panel" style="
                position: absolute;
                top: 10px;
                right: 10px;
                background: none;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
            ">×</button>
        `;

        panel.innerHTML = `
            ${closeBtn}
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-right: 30px;">
                <span style="font-size: 20px;">🚀</span>
                <div>
                    <div style="font-weight: 600; font-size: 14px;">${job.company}</div>
                    <div style="font-size: 12px; color: #888;">${truncate(job.title, 40)}</div>
                </div>
            </div>
            
            <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 16px;">
                <span style="font-size: 32px; font-weight: 700; color: ${job.score >= 4 ? '#22c55e' : job.score >= 3 ? '#f59e0b' : '#ef4444'};">${job.score.toFixed(1)}</span>
                <span style="font-size: 14px; color: #888;">/ 5.0</span>
                <span style="margin-left: auto; padding: 4px 10px; background: ${job.recommendation === 'APPLY' ? 'rgba(34, 197, 94, 0.2)' : job.recommendation === 'SKIP' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${job.recommendation === 'APPLY' ? '#22c55e' : job.recommendation === 'SKIP' ? '#ef4444' : '#f59e0b'}; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                    ${job.recommendation}
                </span>
            </div>

            ${job.summary ? `<div style="font-size: 12px; color: #ccc; line-height: 1.5; margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">${job.summary}</div>` : ''}

            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Evaluation Breakdown</div>
            ${blocksHtml}

            ${highlightsHtml}
            ${interviewHtml}

            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 8px;">
                <button id="unhireable-apply-btn" style="
                    flex: 1;
                    padding: 10px 16px;
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    border: none;
                    border-radius: 8px;
                    color: #fff;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                ">✅ Mark as Applied</button>
                <button id="unhireable-skip-btn" style="
                    flex: 1;
                    padding: 10px 16px;
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    color: #ef4444;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                ">❌ Skip</button>
            </div>
        `;

        document.body.appendChild(panel);

        // Close button handler
        document.getElementById('unhireable-close-panel').addEventListener('click', () => {
            panel.remove();
        });

        // Apply button handler
        document.getElementById('unhireable-apply-btn').addEventListener('click', async () => {
            await updateJobStatus(job.url, 'applied');
            panel.remove();
            scoreBadge.remove();
            alert('✅ Marked as applied! Open the extension popup to auto-fill the form.');
        });

        // Skip button handler
        document.getElementById('unhireable-skip-btn').addEventListener('click', async () => {
            await updateJobStatus(job.url, 'skipped');
            panel.remove();
            scoreBadge.remove();
        });
    }

    async function updateJobStatus(url, status) {
        try {
            const result = await chrome.storage.local.get(['matchedJobs']);
            const matchedJobs = result.matchedJobs || [];
            
            const updatedJobs = matchedJobs.map(job => {
                if (job.url === url) {
                    return { ...job, status, updatedAt: new Date().toISOString() };
                }
                return job;
            });
            
            await chrome.storage.local.set({ matchedJobs: updatedJobs });
            console.log('[Unhireable] Updated job status:', { url, status });
        } catch (err) {
            console.error('[Unhireable] Failed to update status:', err);
        }
    }

    function notifyPopup(job) {
        // Notify popup that we're on an evaluated job page
        chrome.runtime.sendMessage({
            type: 'EVALUATED_JOB_DETECTED',
            job: {
                url: job.url,
                title: job.title,
                company: job.company,
                score: job.score,
                recommendation: job.recommendation
            }
        });
    }

    function truncate(str, maxLength) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'GET_DETECTED_JOB') {
            sendResponse({ job: evaluatedJob });
        }
    });

})();

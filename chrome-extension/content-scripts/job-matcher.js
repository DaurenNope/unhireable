// Unhireable Job Matcher - Compare resume to job requirements
(function() {
    'use strict';

    console.log('[Unhireable] 🎯 Job Matcher loaded');

    const JobMatcher = {
        
        // Calculate match score between profile and job
        calculateMatchScore(profile, jobText) {
            if (!profile || !jobText) return { score: 0, reasons: [] };

            const scores = {
                skills: 0,
                experience: 0,
                title: 0,
                location: 0
            };
            const reasons = [];
            const jobTextLower = jobText.toLowerCase();

            // 1. Skills Match (40% of total score)
            const profileSkills = profile.skills || [];
            if (profileSkills.length > 0) {
                const matchedSkills = [];
                const missingSkills = [];

                for (const skill of profileSkills) {
                    const skillLower = skill.toLowerCase();
                    // Check for exact match or partial match
                    if (jobTextLower.includes(skillLower)) {
                        matchedSkills.push(skill);
                    } else {
                        missingSkills.push(skill);
                    }
                }

                // Calculate skills score based on match percentage
                const matchRatio = matchedSkills.length / profileSkills.length;
                scores.skills = Math.round(matchRatio * 40);

                if (matchedSkills.length > 0) {
                    reasons.push(`✅ ${matchedSkills.length}/${profileSkills.length} skills match (${matchedSkills.slice(0, 5).join(', ')}${matchedSkills.length > 5 ? '...' : ''})`);
                }
                if (missingSkills.length > 0 && matchRatio < 0.5) {
                    reasons.push(`⚠️ Missing: ${missingSkills.slice(0, 3).join(', ')}${missingSkills.length > 3 ? '...' : ''}`);
                }
            }

            // 2. Title/Seniority Match (25% of total score)
            const titleScore = this.matchTitleLevel(profile, jobText);
            scores.title = titleScore.score;
            if (titleScore.reason) {
                reasons.push(titleScore.reason);
            }

            // 3. Experience Match (20% of total score)
            const experience = profile.experience || [];
            const requiredYears = this.extractRequiredYears(jobText);
            if (requiredYears && experience.length > 0) {
                const totalYears = this.calculateTotalExperience(experience);
                if (totalYears >= requiredYears) {
                    scores.experience = 20;
                    reasons.push(`✅ ${totalYears}+ years experience (required: ${requiredYears})`);
                } else if (totalYears >= requiredYears * 0.7) {
                    scores.experience = 12;
                    reasons.push(`⚠️ ${totalYears} years (required: ${requiredYears})`);
                } else {
                    scores.experience = Math.max(0, (totalYears / requiredYears) * 20);
                }
            } else {
                scores.experience = 10; // Neutral if can't determine
            }

            // 4. Location Match (15% of total score)
            const locationMatch = this.matchLocation(profile, jobText);
            scores.location = locationMatch.score;
            if (locationMatch.reason) {
                reasons.push(locationMatch.reason);
            }

            // Calculate total score
            const totalScore = scores.skills + scores.title + scores.experience + scores.location;

            return {
                score: Math.min(100, Math.round(totalScore)),
                breakdown: scores,
                reasons: reasons,
                recommendation: this.getRecommendation(totalScore)
            };
        },

        matchTitleLevel(profile, jobText) {
            const jobTextLower = jobText.toLowerCase();
            const profileText = JSON.stringify(profile).toLowerCase();

            // Seniority keywords
            const levels = {
                senior: ['senior', 'sr.', 'lead', 'principal', 'staff', 'architect'],
                mid: ['mid-level', 'mid level', 'intermediate', 'experienced'],
                junior: ['junior', 'jr.', 'entry', 'entry-level', 'associate', 'intern']
            };

            // Detect job seniority
            let jobLevel = null;
            for (const [level, keywords] of Object.entries(levels)) {
                if (keywords.some(k => jobTextLower.includes(k))) {
                    jobLevel = level;
                    break;
                }
            }

            // Detect profile seniority from experience
            let profileLevel = 'junior';
            const experience = profile.experience || [];
            const totalYears = this.calculateTotalExperience(experience);
            
            if (totalYears >= 5) profileLevel = 'senior';
            else if (totalYears >= 2) profileLevel = 'mid';

            // Score based on alignment
            if (!jobLevel) {
                return { score: 15, reason: null }; // Can't determine
            }

            const levelValues = { junior: 1, mid: 2, senior: 3 };
            const diff = levelValues[profileLevel] - levelValues[jobLevel];

            if (diff >= 0) {
                // Profile meets or exceeds requirement
                return { 
                    score: 25, 
                    reason: `✅ Level match: ${profileLevel} applying to ${jobLevel}` 
                };
            } else if (diff === -1) {
                // Slightly under (e.g., mid applying to senior)
                return { 
                    score: 15, 
                    reason: `⚠️ Level gap: ${profileLevel} → ${jobLevel}` 
                };
            } else {
                // Significantly under
                return { 
                    score: 5, 
                    reason: `❌ Level mismatch: ${profileLevel} → ${jobLevel}` 
                };
            }
        },

        extractRequiredYears(jobText) {
            // Look for patterns like "3+ years", "5 years of experience", "minimum 2 years"
            const patterns = [
                /(\d+)\+?\s*years?\s+(?:of\s+)?experience/i,
                /minimum\s+(\d+)\s*years?/i,
                /at\s+least\s+(\d+)\s*years?/i,
                /(\d+)-\d+\s*years?\s+(?:of\s+)?experience/i,
            ];

            for (const pattern of patterns) {
                const match = jobText.match(pattern);
                if (match) {
                    return parseInt(match[1]);
                }
            }
            return null;
        },

        calculateTotalExperience(experience) {
            if (!Array.isArray(experience)) return 0;
            
            let totalYears = 0;
            for (const exp of experience) {
                if (exp.duration) {
                    // Parse duration like "3 years", "Jan 2020 - Present"
                    const yearsMatch = exp.duration.match(/(\d+)\s*(?:years?|yrs?)/i);
                    if (yearsMatch) {
                        totalYears += parseInt(yearsMatch[1]);
                    }
                }
            }
            return totalYears;
        },

        matchLocation(profile, jobText) {
            const profileLocation = profile.personal_info?.location?.toLowerCase() || '';
            const jobTextLower = jobText.toLowerCase();

            // Check for remote
            if (jobTextLower.includes('remote') || jobTextLower.includes('work from home')) {
                if (profileLocation.includes('remote') || true) { // Everyone can apply to remote
                    return { 
                        score: 15, 
                        reason: '✅ Remote position' 
                    };
                }
            }

            // Check for location match
            if (profileLocation) {
                // Extract city/state from profile
                const locationParts = profileLocation.split(',').map(p => p.trim().toLowerCase());
                
                for (const part of locationParts) {
                    if (jobTextLower.includes(part)) {
                        return { 
                            score: 15, 
                            reason: `✅ Location match: ${profile.personal_info.location}` 
                        };
                    }
                }
            }

            // Check for relocation assistance
            if (jobTextLower.includes('relocation') || jobTextLower.includes('visa sponsorship')) {
                return { 
                    score: 10, 
                    reason: '⚠️ Relocation/visa may be needed' 
                };
            }

            return { score: 5, reason: null };
        },

        getRecommendation(score) {
            if (score >= 80) return { level: 'strong', text: 'Strong match - Highly recommended' };
            if (score >= 60) return { level: 'good', text: 'Good match - Worth applying' };
            if (score >= 40) return { level: 'fair', text: 'Fair match - Possible fit' };
            return { level: 'weak', text: 'Weak match - Consider other options' };
        },

        // Extract job text from LinkedIn page
        extractJobTextFromLinkedIn() {
            const selectors = [
                '.jobs-description-content',
                '.job-details-jobs-unified-top-card__job-description',
                '[data-test-id="job-description"]',
                '.description',
                '#job-details'
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    return el.textContent;
                }
            }

            // Fallback: try to find any large text block that looks like a job description
            const allText = Array.from(document.querySelectorAll('p, li, div'))
                .map(el => el.textContent)
                .filter(text => text.length > 100 && text.length < 5000)
                .join('\n');

            return allText;
        }
    };

    // Expose globally
    window.UnhireableJobMatcher = JobMatcher;
})();

// Unhireable Resume Parser - Extract profile from PDF/DOCX
(function() {
    'use strict';

    console.log('[Unhireable] 📄 Resume Parser loaded');

    // Simple regex-based parser for common resume formats
    const ResumeParser = {
        
        // Extract text from PDF using pdf.js
        async extractFromPDF(arrayBuffer) {
            try {
                // Load PDF.js from CDN if not available
                if (typeof pdfjsLib === 'undefined') {
                    await this.loadPDFJS();
                }
                
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let text = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ') + '\n';
                }
                
                return text;
            } catch (err) {
                console.error('[Unhireable] PDF extraction error:', err);
                throw new Error('Failed to extract PDF text');
            }
        },

        // Load PDF.js library
        loadPDFJS() {
            return new Promise((resolve, reject) => {
                if (typeof pdfjsLib !== 'undefined') {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.onload = () => {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load PDF.js'));
                document.head.appendChild(script);
            });
        },

        // Extract text from DOCX (simplified - just extracts text from XML)
        async extractFromDOCX(arrayBuffer) {
            try {
                const JSZip = await this.loadJSZip();
                const zip = await JSZip.loadAsync(arrayBuffer);
                const xml = await zip.file('word/document.xml')?.async('text');
                
                if (!xml) {
                    throw new Error('Invalid DOCX file');
                }

                // Simple XML text extraction
                const text = xml
                    .replace(/<[^>]+>/g, ' ')  // Remove XML tags
                    .replace(/\s+/g, ' ')     // Normalize whitespace
                    .trim();
                
                return text;
            } catch (err) {
                console.error('[Unhireable] DOCX extraction error:', err);
                throw new Error('Failed to extract DOCX text');
            }
        },

        // Load JSZip library
        loadJSZip() {
            return new Promise((resolve, reject) => {
                if (typeof JSZip !== 'undefined') {
                    resolve(JSZip);
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.onload = () => resolve(window.JSZip);
                script.onerror = () => reject(new Error('Failed to load JSZip'));
                document.head.appendChild(script);
            });
        },

        // Parse resume text into structured profile
        parseResume(text) {
            const profile = {
                personal_info: {},
                skills: [],
                experience: [],
                summary: ''
            };

            // Clean up text
            text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            // Extract name (usually at the top)
            profile.personal_info.name = this.extractName(text);
            
            // Extract email
            profile.personal_info.email = this.extractEmail(text);
            
            // Extract phone
            profile.personal_info.phone = this.extractPhone(text);
            
            // Extract location
            profile.personal_info.location = this.extractLocation(text);
            
            // Extract LinkedIn
            profile.personal_info.linkedin_url = this.extractLinkedIn(text);
            
            // Extract GitHub
            profile.personal_info.github_url = this.extractGitHub(text);
            
            // Extract website/portfolio
            profile.personal_info.portfolio_url = this.extractWebsite(text);
            
            // Extract skills
            profile.skills = this.extractSkills(text);
            
            // Extract summary
            profile.summary = this.extractSummary(text);

            return profile;
        },

        extractName(text) {
            // Common patterns: First Last at the top of resume
            const lines = text.split('\n').slice(0, 10); // Check first 10 lines
            
            for (const line of lines) {
                // Match patterns like "John Smith", "John A. Smith", "John-Smith"
                const match = line.match(/^([A-Z][a-z]+(?:[-'][A-Z][a-z]+)?\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+)$/);
                if (match && line.length < 50 && !line.includes('@') && !line.includes('http')) {
                    return match[1].trim();
                }
            }
            
            return '';
        },

        extractEmail(text) {
            const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
            return match ? match[1] : '';
        },

        extractPhone(text) {
            // Various phone formats
            const patterns = [
                /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/,  // US: (555) 123-4567
                /(\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,4})/,  // International
            ];
            
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) return match[1];
            }
            return '';
        },

        extractLocation(text) {
            // Match "City, State" or "City, Country" patterns
            const patterns = [
                /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*(?:[A-Z]{2}|[A-Z][a-z]+))/,  // San Francisco, CA
                /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z][a-z]+)/,  // San Francisco, California
            ];
            
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) return match[1];
            }
            return '';
        },

        extractLinkedIn(text) {
            const match = text.match(/(https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i);
            return match ? match[1] : '';
        },

        extractGitHub(text) {
            const match = text.match(/(https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+)/i);
            return match ? match[1] : '';
        },

        extractWebsite(text) {
            // Personal website/portfolio (not LinkedIn/GitHub)
            const patterns = [
                /(https?:\/\/[a-zA-Z0-9_-]+\.(?:com|io|dev|net|org)(?:\/[a-zA-Z0-9_-]+)*)/gi,
            ];
            
            for (const pattern of patterns) {
                const matches = text.match(pattern);
                if (matches) {
                    // Filter out LinkedIn and GitHub
                    const site = matches.find(m => !m.includes('linkedin') && !m.includes('github'));
                    if (site) return site;
                }
            }
            return '';
        },

        extractSkills(text) {
            const commonSkills = [
                'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'PHP', 'Swift',
                'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask',
                'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'AWS', 'Azure', 'GCP',
                'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Git', 'Linux', 'REST API',
                'GraphQL', 'HTML', 'CSS', 'SASS', 'Tailwind', 'Bootstrap', 'Material UI',
                'Machine Learning', 'AI', 'Data Science', 'Pandas', 'NumPy', 'TensorFlow',
                'React Native', 'Flutter', 'iOS', 'Android', 'Unity', 'Unreal Engine'
            ];

            const found = [];
            const textLower = text.toLowerCase();
            
            for (const skill of commonSkills) {
                if (textLower.includes(skill.toLowerCase())) {
                    found.push(skill);
                }
            }

            // Also look for skills section
            const skillsSection = text.match(/skills?[\s:]*([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\n[A-Z]|experience|education|$)/i);
            if (skillsSection) {
                const additional = skillsSection[1]
                    .split(/[,•\|\/]+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 2 && s.length < 30);
                found.push(...additional);
            }

            return [...new Set(found)].slice(0, 20); // Remove duplicates, max 20
        },

        extractSummary(text) {
            // Look for summary/objective section
            const patterns = [
                /summary[\s:]*([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\n[A-Z]|experience|education|$)/i,
                /objective[\s:]*([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\n[A-Z]|experience|education|$)/i,
                /about me[\s:]*([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\n[A-Z]|experience|education|$)/i,
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    return match[1].trim().substring(0, 500);
                }
            }

            return '';
        }
    };

    // Expose to popup
    window.UnhireableResumeParser = ResumeParser;
})();

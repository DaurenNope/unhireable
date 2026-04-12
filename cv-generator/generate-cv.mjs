#!/usr/bin/env node
/**
 * CV Generator - Creates ATS-optimized PDF CVs tailored to specific jobs
 * 
 * Usage: 
 *   node cv-generator/generate-cv.mjs --job=<job-url-or-id>
 *   node cv-generator/generate-cv.mjs --all  (generate for all APPLY recommendations)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const OUTPUT_DIR = join(DATA_DIR, 'generated-cvs');

// Parse arguments
const args = process.argv.slice(2);
let JOB_URL = null;
let GENERATE_ALL = false;

args.forEach(arg => {
    if (arg.startsWith('--job=')) {
        JOB_URL = arg.split('=')[1];
    }
    if (arg === '--all') {
        GENERATE_ALL = true;
    }
});

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load CV data
const cvPath = join(DATA_DIR, 'cv.txt');
const preferencesPath = join(DATA_DIR, 'config.yml');
const jobsPath = join(DATA_DIR, 'jobs_evaluated.json');

if (!existsSync(cvPath)) {
    console.error('❌ cv.txt not found. Add your CV to data/cv.txt');
    process.exit(1);
}

if (!existsSync(jobsPath)) {
    console.error('❌ jobs_evaluated.json not found. Run evaluator first.');
    process.exit(1);
}

const baseCV = readFileSync(cvPath, 'utf8');
const jobs = JSON.parse(readFileSync(jobsPath, 'utf8'));

console.log('📄 CV Generator');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Load preferences from config
let preferences = {};
if (existsSync(preferencesPath)) {
    const configText = readFileSync(preferencesPath, 'utf8');
    // Simple YAML parsing
    const prefMatch = configText.match(/preferences:\n([\s\S]*?)(?:\n\w|$)/);
    if (prefMatch) {
        const lines = prefMatch[1].split('\n');
        lines.forEach(line => {
            const match = line.match(/\s+(\w+):\s*(.+)/);
            if (match) {
                preferences[match[1]] = match[2].replace(/"/g, '');
            }
        });
    }
}

// HTML Template for CV
function generateHTML(cvData, job, tailoring) {
    const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CV - ${cvData.name || 'Candidate'}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 10.5pt;
            line-height: 1.4;
            color: #333;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0.5in;
        }
        
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        
        .name {
            font-size: 24pt;
            font-weight: bold;
            color: #1a1a1a;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        
        .contact-info {
            font-size: 9pt;
            color: #555;
        }
        
        .contact-info span {
            margin: 0 8px;
        }
        
        .section {
            margin-bottom: 16px;
        }
        
        .section-title {
            font-size: 11pt;
            font-weight: bold;
            color: #1a1a1a;
            text-transform: uppercase;
            border-bottom: 1px solid #999;
            padding-bottom: 4px;
            margin-bottom: 10px;
            letter-spacing: 0.5px;
        }
        
        .job-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 3px;
        }
        
        .job-title {
            font-weight: bold;
            font-size: 11pt;
        }
        
        .job-date {
            font-size: 9pt;
            color: #666;
            font-style: italic;
        }
        
        .company {
            font-size: 10pt;
            color: #555;
            margin-bottom: 6px;
        }
        
        .job-description {
            margin-left: 0;
        }
        
        .job-description ul {
            margin-left: 18px;
            margin-top: 4px;
        }
        
        .job-description li {
            margin-bottom: 3px;
            text-align: justify;
        }
        
        .skills-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .skill-tag {
            background: #f0f0f0;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 9pt;
        }
        
        .skill-tag.highlight {
            background: #e8f4e8;
            border: 1px solid #22c55e;
            font-weight: 500;
        }
        
        .tailoring-section {
            background: #f8f9fa;
            border-left: 3px solid #6366f1;
            padding: 10px 12px;
            margin-bottom: 16px;
            font-size: 9.5pt;
        }
        
        .tailoring-title {
            font-weight: bold;
            color: #6366f1;
            margin-bottom: 6px;
        }
        
        .tailoring-role {
            color: #555;
            margin-bottom: 4px;
        }
        
        .tailoring-highlights {
            margin-top: 8px;
        }
        
        .tailoring-highlights strong {
            color: #1a1a1a;
        }
        
        @media print {
            body {
                padding: 0;
            }
            .tailoring-section {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            .skill-tag.highlight {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="name">${cvData.name || 'CANDIDATE NAME'}</div>
        <div class="contact-info">
            ${cvData.email ? `<span>${cvData.email}</span> |` : ''}
            ${cvData.phone ? `<span>${cvData.phone}</span> |` : ''}
            ${cvData.linkedin ? `<span>${cvData.linkedin}</span> |` : ''}
            ${cvData.location ? `<span>${cvData.location}</span>` : ''}
        </div>
    </div>

    ${tailoring ? `
    <div class="tailoring-section">
        <div class="tailoring-title">📌 Tailored for: ${job.company}</div>
        <div class="tailoring-role">${job.title}</div>
        <div class="tailoring-highlights">
            <strong>Matched Skills:</strong> ${tailoring.matchedSkills.join(', ')}<br>
            <strong>Key Highlights:</strong> ${tailering.highlights.join(' • ')}
        </div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">Professional Summary</div>
        <div class="job-description">
            ${tailoring ? tailoring.summary : (cvData.summary || 'Results-driven professional with expertise in relevant technologies.')}
        </div>
    </div>

    <div class="section">
        <div class="section-title">Technical Skills</div>
        <div class="skills-grid">
            ${(cvData.skills || []).map(skill => {
                const isMatched = tailoring?.matchedSkills?.some(matched => 
                    skill.toLowerCase().includes(matched.toLowerCase()) || 
                    matched.toLowerCase().includes(skill.toLowerCase())
                );
                return `<span class="skill-tag${isMatched ? ' highlight' : ''}">${skill}</span>`;
            }).join('')}
        </div>
    </div>

    <div class="section">
        <div class="section-title">Professional Experience</div>
        ${(cvData.experience || []).map(exp => `
        <div style="margin-bottom: 14px;">
            <div class="job-header">
                <span class="job-title">${exp.title}</span>
                <span class="job-date">${exp.dates}</span>
            </div>
            <div class="company">${exp.company}${exp.location ? `, ${exp.location}` : ''}</div>
            <div class="job-description">
                <ul>
                    ${exp.bullets.map(bullet => `<li>${bullet}</li>`).join('')}
                </ul>
            </div>
        </div>
        `).join('')}
    </div>

    <div class="section">
        <div class="section-title">Education</div>
        ${(cvData.education || []).map(edu => `
        <div style="margin-bottom: 8px;">
            <div class="job-header">
                <span class="job-title">${edu.degree}</span>
                <span class="job-date">${edu.dates}</span>
            </div>
            <div class="company">${edu.school}${edu.location ? `, ${edu.location}` : ''}</div>
        </div>
        `).join('')}
    </div>

    ${cvData.projects ? `
    <div class="section">
        <div class="section-title">Projects</div>
        ${cvData.projects.map(proj => `
        <div style="margin-bottom: 10px;">
            <div class="job-title">${proj.name}</div>
            <div class="job-description">
                <ul>
                    <li>${proj.description}</li>
                </ul>
            </div>
        </div>
        `).join('')}
    </div>
    ` : ''}

</body>
</html>`;
}

// Parse CV text into structured data
function parseCV(cvText) {
    const lines = cvText.split('\n').filter(l => l.trim());
    
    // Extract name (first non-empty line)
    const name = lines[0]?.trim() || 'Candidate';
    
    // Extract email, phone, linkedin
    const emailMatch = cvText.match(/([\w.-]+@[\w.-]+\.\w+)/);
    const phoneMatch = cvText.match(/(\+?\d{1,3}[-.]?\s?\(?\d{3}\)?[-.]?\s?\d{3}[-.]?\s?\d{4})/);
    const linkedinMatch = cvText.match(/(linkedin\.com\/in\/[\w-]+)/i);
    
    // Extract skills section
    const skillsMatch = cvText.match(/(?:Skills|Technical Skills|Technologies)[\s\S]*?(?=\n\n|\n[A-Z]|\Z)/i);
    const skills = skillsMatch ? 
        skillsMatch[0].split(/[,•\n]/).map(s => s.trim()).filter(s => s && s.length > 1 && !s.match(/^(Skills|Technical)/i)) :
        [];
    
    // Simple structure
    return {
        name,
        email: emailMatch ? emailMatch[1] : '',
        phone: phoneMatch ? phoneMatch[1] : '',
        linkedin: linkedinMatch ? linkedinMatch[1] : '',
        summary: lines.slice(1, 4).join(' ').trim(),
        skills: [...new Set(skills)].slice(0, 20), // Max 20 skills
        experience: [], // Would need more complex parsing
        education: []
    };
}

// Generate tailored content based on job
function generateTailoring(cvData, job) {
    const jobSkills = job.requiredSkills || [];
    const cvSkills = cvData.skills || [];
    
    // Find matching skills
    const matchedSkills = cvSkills.filter(cvSkill => 
        jobSkills.some(jobSkill => 
            cvSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
            jobSkill.toLowerCase().includes(cvSkill.toLowerCase())
        )
    );
    
    // Generate summary highlighting fit
    const summary = `Experienced professional with ${matchedSkills.length}+ years in ${matchedSkills.slice(0, 3).join(', ')}. 
        Proven track record delivering results in ${job.company || 'similar environments'}. 
        Seeking to leverage expertise in ${job.title || 'this role'} to drive impact.`;
    
    // Key highlights from evaluation
    const highlights = job.cv_highlights || matchedSkills.slice(0, 4);
    
    return {
        matchedSkills,
        summary,
        highlights
    };
}

// Generate PDF for a single job
async function generateCVForJob(job, browser) {
    console.log(`📄 Generating CV for: ${job.company} - ${job.title}`);
    
    // Parse base CV
    const cvData = parseCV(baseCV);
    
    // Generate tailoring
    const tailoring = generateTailoring(cvData, job);
    
    // Generate HTML
    const html = generateHTML(cvData, job, tailoring);
    
    // Create filename
    const safeCompany = (job.company || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const safeTitle = (job.title || 'Position').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const filename = `${safeCompany}_${safeTitle}_${Date.now()}.pdf`;
    const outputPath = join(OUTPUT_DIR, filename);
    
    // Generate PDF with Puppeteer
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    await page.pdf({
        path: outputPath,
        format: 'Letter',
        printBackground: true,
        margin: {
            top: '0.4in',
            right: '0.5in',
            bottom: '0.4in',
            left: '0.5in'
        }
    });
    
    await page.close();
    
    console.log(`  ✅ Saved: ${filename}`);
    
    return {
        filename,
        path: outputPath,
        jobUrl: job.url,
        company: job.company,
        title: job.title,
        tailoring
    };
}

// Main function
async function main() {
    // Launch browser
    const browser = await puppeteer.launch({
        headless: 'new'
    });
    
    const generated = [];
    
    if (JOB_URL) {
        // Generate for specific job
        const job = jobs.find(j => j.url === JOB_URL || j.id === JOB_URL);
        if (!job) {
            console.error(`❌ Job not found: ${JOB_URL}`);
            await browser.close();
            process.exit(1);
        }
        
        const result = await generateCVForJob(job, browser);
        generated.push(result);
        
    } else if (GENERATE_ALL) {
        // Generate for all APPLY recommendations
        const applyJobs = jobs.filter(j => j.recommendation === 'APPLY' && j.score >= 4.0);
        
        if (applyJobs.length === 0) {
            console.log('⚠️ No APPLY recommendations found with score >= 4.0');
            console.log('Run with --all --min-score=3.0 to include CONSIDER jobs');
            await browser.close();
            process.exit(0);
        }
        
        console.log(`🎯 Found ${applyJobs.length} APPLY jobs to generate CVs for\n`);
        
        for (let i = 0; i < applyJobs.length; i++) {
            console.log(`[${i + 1}/${applyJobs.length}]`);
            try {
                const result = await generateCVForJob(applyJobs[i], browser);
                generated.push(result);
            } catch (err) {
                console.error(`  ❌ Failed: ${err.message}`);
            }
            console.log();
        }
        
    } else {
        console.log('Usage:');
        console.log('  node cv-generator/generate-cv.mjs --job=<url>     # Generate for specific job');
        console.log('  node cv-generator/generate-cv.mjs --all          # Generate for all APPLY jobs');
        await browser.close();
        process.exit(1);
    }
    
    await browser.close();
    
    // Save manifest
    const manifestPath = join(OUTPUT_DIR, 'cv-manifest.json');
    writeFileSync(manifestPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        count: generated.length,
        cvs: generated
    }, null, 2));
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Generated ${generated.length} CV(s)`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📋 Manifest: ${manifestPath}`);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});

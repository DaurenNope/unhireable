const STORAGE_KEY = 'unhireable-mock-db';
const SAMPLE_JOBS = [
    {
        id: 1,
        title: 'Senior Frontend Developer',
        company: 'Tech Corp',
        url: 'https://example.com/jobs/senior-frontend-developer',
        description: 'We are looking for an experienced frontend developer to join our remote-first team.',
        requirements: 'Expertise with React, TypeScript, Tailwind CSS. Experience with state machines a plus.',
        location: 'Remote',
        salary: '$120k - $180k',
        source: 'demo',
        status: 'saved',
        match_score: null,
    },
    {
        id: 2,
        title: 'Full Stack Engineer',
        company: 'StartupXYZ',
        url: 'https://example.com/jobs/full-stack-engineer',
        description: 'Own features end-to-end across our Node/React stack. Work directly with founders.',
        requirements: 'Node.js, React, PostgreSQL, AWS',
        location: 'San Francisco, CA (Remote OK)',
        salary: '$100k - $150k',
        source: 'demo',
        status: 'saved',
        match_score: null,
    },
    {
        id: 3,
        title: 'Backend Engineer',
        company: 'DataFlow Inc',
        url: 'https://example.com/jobs/backend-engineer',
        description: 'Help us scale our data platform to millions of events per minute.',
        requirements: 'Python, Django, Docker, Kubernetes',
        location: 'New York, NY / Hybrid',
        salary: '$130k - $170k',
        source: 'demo',
        status: 'saved',
        match_score: null,
    },
    {
        id: 4,
        title: 'DevOps Engineer',
        company: 'CloudSystems',
        url: 'https://example.com/jobs/devops-engineer',
        description: 'Build resilient infrastructure with Terraform and Kubernetes.',
        requirements: 'AWS, Terraform, Kubernetes, CI/CD',
        location: 'Remote - North America',
        salary: '$140k - $190k',
        source: 'demo',
        status: 'saved',
        match_score: null,
    },
    {
        id: 5,
        title: 'Mobile Developer',
        company: 'AppStudio',
        url: 'https://example.com/jobs/mobile-developer',
        description: 'Create beautiful mobile experiences for millions of users across iOS and Android.',
        requirements: 'React Native, Swift, Kotlin',
        location: 'Austin, TX / Remote',
        salary: '$110k - $160k',
        source: 'demo',
        status: 'saved',
        match_score: null,
    },
    {
        id: 6,
        title: 'Data Scientist',
        company: 'AI Labs',
        url: 'https://example.com/jobs/data-scientist',
        description: 'Work on cutting-edge ML models with a top-tier AI research team.',
        requirements: 'Python, Machine Learning, TensorFlow, SQL',
        location: 'Boston, MA',
        salary: '$125k - $175k',
        source: 'demo',
        status: 'saved',
        match_score: null,
    },
    {
        id: 7,
        title: 'Product Designer',
        company: 'DesignCo',
        url: 'https://example.com/jobs/product-designer',
        description: 'Design delightful user experiences for our flagship product. Collaborate with product and engineering.',
        requirements: 'Figma, User Research, Prototyping',
        location: 'Remote',
        salary: '$90k - $140k',
        source: 'demo',
        status: 'saved',
        match_score: null,
    },
    {
        id: 8,
        title: 'QA Automation Engineer',
        company: 'QualityTech',
        url: 'https://example.com/jobs/qa-automation-engineer',
        description: 'Build reliable automation suites for our web and mobile applications.',
        requirements: 'Playwright, Cypress, Selenium, CI/CD',
        location: 'Seattle, WA (Hybrid)',
        salary: '$85k - $120k',
        source: 'demo',
        status: 'saved',
        match_score: null,
    },
];
const FALLBACK_JOB = SAMPLE_JOBS[0] ?? {
    id: 0,
    title: 'Sample Role',
    company: 'Example Company',
    url: 'https://example.com/jobs/sample-role',
    description: 'Sample job description for mock mode.',
    requirements: 'Sample requirements list',
    location: 'Remote',
    salary: '$100k',
    source: 'demo',
    status: 'saved',
    match_score: null,
};
let memoryDb = {
    jobs: SAMPLE_JOBS,
    profile: null,
    nextJobId: SAMPLE_JOBS.length + 1,
    activities: [],
};
const hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
function loadDb() {
    if (!hasLocalStorage) {
        return memoryDb;
    }
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            memoryDb = {
                jobs: parsed.jobs ?? SAMPLE_JOBS,
                profile: parsed.profile ?? null,
                nextJobId: parsed.nextJobId ?? (parsed.jobs?.length ?? SAMPLE_JOBS.length) + 1,
                activities: parsed.activities ?? [],
            };
        }
        else {
            saveDb(memoryDb);
        }
    }
    catch (error) {
        console.warn('Failed to load mock DB from storage, resetting', error);
        saveDb(memoryDb);
    }
    return memoryDb;
}
function saveDb(db) {
    memoryDb = db;
    if (hasLocalStorage) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDb));
        }
        catch (error) {
            console.warn('Failed to save mock DB to storage', error);
        }
    }
}
const RESUME_TEMPLATES = ['modern', 'classic', 'minimal', 'executive'];
const COVER_LETTER_TEMPLATES = ['professional', 'storytelling', 'concise'];
function generateMatchScore(job, profile) {
    const base = Math.random() * 20 + 60; // 60 - 80 baseline
    const bonus = profile?.skills?.technical_skills?.some((skill) => job.description?.toLowerCase().includes(skill.toLowerCase()))
        ? 15
        : 0;
    return Math.min(99, Math.round(base + bonus + Math.random() * 10));
}
const COMMON_SKILL_KEYWORDS = [
    'react',
    'typescript',
    'javascript',
    'python',
    'node',
    'aws',
    'azure',
    'gcp',
    'terraform',
    'kubernetes',
    'docker',
    'graphql',
    'sql',
    'nosql',
    'ml',
    'machine learning',
    'ai',
    'data',
    'figma',
    'design',
    'marketing',
    'sales',
    'product',
    'django',
    'flask',
    'java',
    'go',
];
function extractSkillsFromJob(job) {
    const text = `${job.description ?? ''} ${job.requirements ?? ''}`.toLowerCase();
    const skills = new Set();
    for (const keyword of COMMON_SKILL_KEYWORDS) {
        if (text.includes(keyword.toLowerCase())) {
            skills.add(keyword.toLowerCase());
        }
    }
    return Array.from(skills);
}
function categorizeRole(title) {
    const lower = title.toLowerCase();
    const patterns = [
        ['machine learning', 'Machine Learning / AI'],
        ['ml engineer', 'Machine Learning / AI'],
        ['data scientist', 'Data Science / Analytics'],
        ['data engineer', 'Data Engineering'],
        ['data analyst', 'Data Science / Analytics'],
        ['frontend', 'Frontend Engineering'],
        ['front-end', 'Frontend Engineering'],
        ['backend', 'Backend Engineering'],
        ['back-end', 'Backend Engineering'],
        ['full stack', 'Full-Stack Engineering'],
        ['software engineer', 'Software Engineering'],
        ['software developer', 'Software Engineering'],
        ['devops', 'DevOps / SRE'],
        ['site reliability', 'DevOps / SRE'],
        ['sre', 'DevOps / SRE'],
        ['cloud', 'Cloud Engineering'],
        ['security', 'Security'],
        ['product manager', 'Product Management'],
        ['product marketing', 'Product Marketing'],
        ['marketing', 'Marketing'],
        ['designer', 'Design / UX'],
        ['ux', 'Design / UX'],
        ['ui', 'Design / UX'],
        ['sales', 'Sales'],
        ['account executive', 'Sales'],
        ['customer success', 'Customer Success'],
        ['support', 'Customer Support'],
        ['qa', 'Quality Assurance'],
        ['project manager', 'Project / Program Management'],
        ['program manager', 'Project / Program Management'],
        ['finance', 'Finance / Accounting'],
        ['legal', 'Legal'],
    ];
    for (const [pattern, category] of patterns) {
        if (lower.includes(pattern)) {
            return category;
        }
    }
    return title.split(' ').slice(0, 2).join(' ') || 'Other';
}
function percentage(count, total) {
    if (!total)
        return 0;
    return Math.round(((count / total) * 1000)) / 10;
}
function topStats(counts, total, limit) {
    return Object.entries(counts)
        .map(([name, count]) => ({
        name,
        job_count: count,
        percentage: percentage(count, total),
    }))
        .sort((a, b) => b.job_count - a.job_count)
        .slice(0, limit);
}
function computeMarketInsights(db, timeframeDays) {
    const jobs = [...db.jobs];
    const total = jobs.length;
    const totalPrevious = Math.max(0, Math.round(total * 0.75));
    const skillCounts = {};
    const roleCounts = {};
    const companyCounts = {};
    const sourceCounts = {};
    const locationCounts = {};
    let remoteCount = 0;
    jobs.forEach((job) => {
        companyCounts[job.company] = (companyCounts[job.company] ?? 0) + 1;
        sourceCounts[job.source] = (sourceCounts[job.source] ?? 0) + 1;
        const roleCategory = categorizeRole(job.title);
        roleCounts[roleCategory] = (roleCounts[roleCategory] ?? 0) + 1;
        if (job.location) {
            const normalized = job.location.trim();
            if (normalized.toLowerCase().includes('remote')) {
                remoteCount += 1;
            }
            locationCounts[normalized] = (locationCounts[normalized] ?? 0) + 1;
        }
        else {
            remoteCount += 1;
            locationCounts['Remote'] = (locationCounts['Remote'] ?? 0) + 1;
        }
        const skills = extractSkillsFromJob(job);
        const uniqueSkills = new Set(skills);
        uniqueSkills.forEach((skill) => {
            skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
        });
    });
    const trendingSkills = topStats(skillCounts, total, 12);
    const userSkills = new Set();
    if (db.profile) {
        db.profile.skills.technical_skills.forEach((skill) => userSkills.add(skill.toLowerCase()));
        db.profile.experience.forEach((exp) => exp.technologies.forEach((tech) => userSkills.add(tech.toLowerCase())));
    }
    const skillsToLearn = Object.entries(skillCounts)
        .filter(([skill]) => !userSkills.has(skill.toLowerCase()))
        .map(([name, count]) => ({
        name,
        job_count: count,
        percentage: percentage(count, total),
    }))
        .sort((a, b) => b.job_count - a.job_count)
        .slice(0, 8);
    const topRoles = topStats(roleCounts, total, 8);
    return {
        timeframe_days: timeframeDays,
        total_jobs_previous: totalPrevious,
        total_jobs_considered: total,
        remote_percentage: total ? Math.round((remoteCount / total) * 1000) / 10 : 0,
        onsite_percentage: total
            ? Math.round(((total - remoteCount) / total) * 1000) / 10
            : 0,
        trending_skills: trendingSkills,
        skill_trends: trendingSkills.slice(0, 8).map((stat) => {
            const previous = Math.max(0, Math.round(stat.job_count * 0.75));
            return {
                name: stat.name,
                current_count: stat.job_count,
                previous_count: previous,
                delta_percentage: previous === 0
                    ? 100
                    : Math.round(((stat.job_count - previous) / previous) * 1000) / 10,
            };
        }),
        skills_to_learn: skillsToLearn,
        trending_roles: topRoles,
        role_trends: topRoles.map((stat) => {
            const previous = Math.max(0, Math.round(stat.job_count * 0.8));
            return {
                name: stat.name,
                current_count: stat.job_count,
                previous_count: previous,
                delta_percentage: previous === 0
                    ? 100
                    : Math.round(((stat.job_count - previous) / previous) * 1000) / 10,
            };
        }),
        top_companies: topStats(companyCounts, total, 10),
        top_locations: topStats(locationCounts, total, 10),
        sources_breakdown: topStats(sourceCounts, total, Object.keys(sourceCounts).length),
    };
}
function searchJobs(jobs, query) {
    if (!query) {
        return jobs;
    }
    const q = query.toLowerCase();
    return jobs.filter((job) => {
        const haystack = [
            job.title,
            job.company,
            job.description,
            job.requirements,
            job.location,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes(q);
    });
}
function toGeneratedDocument(type, profile, job, templateName) {
    const now = new Date().toISOString();
    const profileName = profile?.personal_info.name ?? 'Your Name';
    const profileEmail = profile?.personal_info.email ?? 'your.email@example.com';
    const profilePhone = profile?.personal_info.phone ?? '';
    const profileLocation = profile?.personal_info.location ?? '';
    const profileLinkedIn = profile?.personal_info.linkedin ?? '';
    const profileGithub = profile?.personal_info.github ?? '';
    const technicalSkills = profile?.skills?.technical_skills?.join(', ') ?? 'JavaScript, TypeScript, React';
    const softSkills = profile?.skills?.soft_skills?.join(', ') ?? 'Communication, Problem-solving';
    // Extract job details
    const jobTitle = job.title ?? 'Position';
    const company = job.company ?? 'Company';
    const jobDesc = job.description ?? '';
    const jobReqs = job.requirements ?? '';
    // Match profile skills to job requirements
    const reqKeywords = `${jobDesc} ${jobReqs}`.toLowerCase();
    const matchedSkills = profile?.skills?.technical_skills?.filter(skill => reqKeywords.includes(skill.toLowerCase())) ?? [];
    // Get most recent experience
    const latestExp = profile?.experience?.[0];
    const yearsOfExp = profile?.experience?.length ? `${profile.experience.length * 2}+` : '5+';
    let content = '';
    if (type === 'resume') {
        content = `# ${profileName}
**${jobTitle} Candidate**

${profileEmail}${profilePhone ? ` | ${profilePhone}` : ''}${profileLocation ? ` | ${profileLocation}` : ''}
${profileLinkedIn ? `LinkedIn: ${profileLinkedIn}` : ''}${profileGithub ? ` | GitHub: ${profileGithub}` : ''}

---

## Professional Summary

Results-driven professional with ${yearsOfExp} years of experience seeking the **${jobTitle}** role at **${company}**. ${matchedSkills.length > 0 ? `Strong expertise in ${matchedSkills.slice(0, 3).join(', ')}, directly aligned with this role's requirements.` : `Proven track record in delivering high-quality solutions and driving business impact.`}

---

## Technical Skills

${technicalSkills}

**Soft Skills:** ${softSkills}

---

## Professional Experience

${profile?.experience?.map((exp) => `### ${exp.position} | ${exp.company}
*${exp.duration}*

${exp.description?.join('\n- ') ?? 'Delivered impactful solutions and drove team success.'}

**Technologies:** ${exp.technologies?.join(', ') ?? 'Various technologies'}
`).join('\n') ?? `### Senior Developer | Previous Company
*2020 - Present*

- Led development initiatives and delivered production-ready solutions
- Collaborated with cross-functional teams to achieve business objectives
- Mentored junior developers and established best practices
`}

---

## Education

${profile?.education?.map(edu => `**${edu.degree}** - ${edu.institution} (${edu.year})`).join('\n') ?? '**Bachelor of Science in Computer Science** - University (2018)'}

---

*Resume tailored for ${jobTitle} at ${company}*`;
    }
    else if (type === 'cover_letter') {
        content = `# Cover Letter

**${profileName}**
${profileEmail}${profilePhone ? ` | ${profilePhone}` : ''}
${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

---

**Re: Application for ${jobTitle}**

Dear Hiring Manager at ${company},

I am writing to express my strong interest in the **${jobTitle}** position at **${company}**. ${jobDesc ? `Your mission to "${jobDesc.substring(0, 100)}${jobDesc.length > 100 ? '...' : ''}" particularly resonates with me.` : 'I am excited about the opportunity to contribute to your team.'}

${latestExp ? `In my current role as **${latestExp.position}** at **${latestExp.company}**, I have ${latestExp.description?.[0]?.substring(0, 150) ?? 'gained extensive experience delivering impactful solutions'}.` : 'Throughout my career, I have consistently delivered high-quality work and driven measurable results.'}

${matchedSkills.length > 0 ? `My expertise in **${matchedSkills.slice(0, 3).join(', ')}** directly aligns with your requirements. ` : ''}I am confident that my combination of technical skills and ${yearsOfExp} years of industry experience make me an excellent fit for this role.

${jobReqs ? `I noticed you're looking for someone with ${jobReqs.substring(0, 80)}${jobReqs.length > 80 ? '...' : ''}. These are areas where I have demonstrated proven success.` : ''}

I would welcome the opportunity to discuss how my background, skills, and enthusiasm can contribute to ${company}'s continued success. Thank you for considering my application.

Sincerely,

**${profileName}**
${profileEmail}
${profileLinkedIn ? `LinkedIn: ${profileLinkedIn}` : ''}`;
    }
    else {
        // Email version - concise
        content = `Subject: Application for ${jobTitle} - ${profileName}

Dear Hiring Team,

I'm excited to apply for the **${jobTitle}** position at **${company}**.

${matchedSkills.length > 0 ? `With expertise in ${matchedSkills.slice(0, 3).join(', ')}, I'm well-positioned to contribute immediately.` : `With ${yearsOfExp} years of relevant experience, I bring proven skills that align with this role.`}

${latestExp ? `Currently at ${latestExp.company} as ${latestExp.position}, I've ${latestExp.description?.[0]?.substring(0, 80) ?? 'delivered impactful solutions'}.` : ''}

I'd love to discuss how I can add value to your team.

Best regards,
${profileName}
${profileEmail}
${profilePhone ? `Phone: ${profilePhone}` : ''}`;
    }
    return {
        content,
        format: 'Markdown',
        metadata: {
            title: `${profileName} - ${job.title} ${type === 'resume' ? 'Resume' : type === 'cover_letter' ? 'Cover Letter' : 'Email'}`,
            job_title: job.title,
            company: job.company,
            generated_at: now,
            template_used: templateName ?? 'personalized',
            word_count: content.split(/\s+/).length,
        },
    };
}
export const fallbackSchedulerConfig = {
    enabled: false,
    schedule: '0 9 * * *',
    query: 'demo',
    sources: [],
    min_match_score: 60,
    send_notifications: true,
};
export const fallbackSchedulerStatus = {
    enabled: false,
    running: false,
    schedule: '0 9 * * *',
    query: 'demo',
    sources: [],
    min_match_score: 60,
    send_notifications: true,
};
export async function handleMockCommand(command, args = {}) {
    const db = loadDb();
    switch (command) {
        case 'get_jobs': {
            const { status, query } = args || {};
            let jobs = [...db.jobs];
            if (status) {
                jobs = jobs.filter((job) => job.status === status);
            }
            if (query) {
                jobs = searchJobs(jobs, String(query));
            }
            return jobs;
        }
        case 'scrape_jobs':
        case 'scrape_jobs_selected': {
            const query = args?.query ? String(args.query) : '';
            const freshJobs = searchJobs(SAMPLE_JOBS, query);
            const existingUrls = new Set(db.jobs.map((job) => job.url));
            const newJobs = freshJobs.filter((job) => !existingUrls.has(job.url));
            if (newJobs.length > 0) {
                const jobsWithIds = newJobs.map((job) => ({
                    ...job,
                    id: db.nextJobId++,
                    source: job.source === 'demo' ? 'remotive' : job.source,
                }));
                const lastJob = jobsWithIds[jobsWithIds.length - 1];
                db.jobs = [...db.jobs, ...jobsWithIds];
                db.activities.push({
                    id: db.activities.length + 1,
                    entity_type: 'job',
                    entity_id: lastJob?.id ?? 0,
                    action: 'created',
                    description: `Added ${jobsWithIds.length} job(s) from mock scraper`,
                    metadata: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
                saveDb(db);
            }
            return searchJobs(db.jobs, query);
        }
        case 'get_user_profile':
            return db.profile;
        case 'save_user_profile': {
            db.profile = args?.profile ?? null;
            db.activities.push({
                id: db.activities.length + 1,
                entity_type: 'profile',
                entity_id: 1,
                action: 'updated',
                description: 'Updated user profile (mock)',
                metadata: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            saveDb(db);
            return;
        }
        case 'update_job_match_scores': {
            const profile = args?.profile;
            db.jobs = db.jobs.map((job) => ({
                ...job,
                match_score: generateMatchScore(job, profile),
            }));
            saveDb(db);
            return db.jobs.length;
        }
        case 'get_market_insights': {
            const timeframeDays = Number(args?.timeframe_days ?? 30);
            return computeMarketInsights(db, timeframeDays);
        }
        case 'match_jobs_for_profile': {
            const profile = args?.profile;
            const min = args?.min_score ?? 0;
            return db.jobs
                .map((job) => ({
                job_id: job.id ?? null,
                job,
                match_score: generateMatchScore(job, profile),
                skills_match: Math.round(Math.random() * 20 + 60),
                experience_match: Math.round(Math.random() * 20 + 60),
                location_match: job.location?.toLowerCase().includes('remote')
                    ? 95
                    : 70,
                matched_skills: profile?.skills?.technical_skills?.slice(0, 3) ?? [],
                missing_skills: ['Team leadership', 'System design'],
                match_reasons: [
                    'Strong alignment with core skill requirements',
                    'Culture fit based on remote-first environment',
                ],
                experience_level: 'senior',
            }))
                .filter((result) => result.match_score >= Number(min));
        }
        case 'calculate_job_match_score': {
            const jobId = args?.job_id;
            const job = db.jobs.find((item) => item.id === jobId);
            if (!job) {
                throw new Error('Job not found in mock database');
            }
            return {
                job_id: job.id ?? null,
                job,
                match_score: generateMatchScore(job, args?.profile),
                skills_match: Math.round(Math.random() * 20 + 60),
                experience_match: Math.round(Math.random() * 20 + 60),
                location_match: job.location?.toLowerCase().includes('remote') ? 90 : 70,
                matched_skills: ['React', 'TypeScript', 'Tailwind CSS'],
                missing_skills: ['AWS'],
                match_reasons: [
                    'Profile skills align closely with job requirements',
                    'Experience level matches expectations',
                ],
                experience_level: 'senior',
            };
        }
        case 'get_activities':
            return [...db.activities].slice(-25).reverse();
        case 'get_available_resume_templates':
            return RESUME_TEMPLATES;
        case 'get_available_cover_letter_templates':
            return COVER_LETTER_TEMPLATES;
        case 'generate_resume': {
            const job = db.jobs.find((item) => item.id === args?.job_id) ?? FALLBACK_JOB;
            return toGeneratedDocument('resume', args?.profile, job, args?.template_name);
        }
        case 'generate_cover_letter': {
            const job = db.jobs.find((item) => item.id === args?.job_id) ?? FALLBACK_JOB;
            return toGeneratedDocument('cover_letter', args?.profile, job, args?.template_name);
        }
        case 'generate_email_version': {
            const job = db.jobs.find((item) => item.id === args?.job_id) ?? FALLBACK_JOB;
            return toGeneratedDocument('email', args?.profile, job, args?.template_name);
        }
        case 'analyze_job_for_profile': {
            const job = db.jobs.find((item) => item.id === args?.job_id) ?? FALLBACK_JOB;
            return {
                extracted_keywords: ['React', 'TypeScript', 'Tailwind', 'Design Systems'],
                required_skills: ['React', 'TypeScript', 'State Management'],
                preferred_skills: ['Animations', 'Storybook'],
                experience_level: 'senior',
                company_tone: 'Bold, product-focused, high agency',
                key_responsibilities: [
                    'Ship product UI for Unhireable app',
                    'Collaborate with AI and matching teams',
                    'Own design system improvements',
                ],
                match_score: generateMatchScore(job, args?.profile),
                job_title: job.title,
                company: job.company,
            };
        }
        case 'test_email_connection':
        case 'send_test_email':
        case 'send_job_match_email_with_result':
        case 'send_new_jobs_notification_email':
            return 'Email functionality is mocked in web preview.';
        case 'extract_emails_from_jobs':
            return [];
        case 'create_contacts_from_jobs':
            return 0;
        case 'get_scheduler_config':
            return fallbackSchedulerConfig;
        case 'update_scheduler_config':
            return 'Scheduler configuration updated (mock)';
        case 'start_scheduler':
            return 'Scheduler started (mock)';
        case 'stop_scheduler':
            return 'Scheduler stopped (mock)';
        case 'get_scheduler_status':
            return fallbackSchedulerStatus;
        default:
            throw new Error(`Tauri bridge not available. Command "${command}" is not supported in web preview mode.`);
    }
}
export function isTauriAvailable() {
    if (typeof window === 'undefined') {
        return false;
    }
    const tauriWindow = window;
    const tauri = tauriWindow.__TAURI__;
    return Boolean(tauri?.invoke || tauri?.core?.invoke);
}

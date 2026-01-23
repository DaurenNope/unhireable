//! Full Automation Demo
//! End-to-end demonstration: Job Discovery → Application → Response Handling

use jobez_lib::applicator::{
    ApplyMode, ApplicationConfig, JobApplicator, PreApplyCheck, 
    get_reliability, AtsDetector,
};
use jobez_lib::db::models::{Job, JobStatus};
use jobez_lib::generator::{UserProfile, PersonalInfo, SkillsProfile, ExperienceEntry, EducationEntry};
use jobez_lib::scraper::ScraperManager;
use std::collections::HashMap;

fn main() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════════╗");
    println!("║     🚀 JOBEZ FULL AUTOMATION DEMO 🚀                             ║");
    println!("║     End-to-End: Discovery → Application → Response              ║");
    println!("╚══════════════════════════════════════════════════════════════════╝");
    println!("");

    // Create test user profile
    let profile = create_demo_profile();
    println!("✅ User Profile Loaded: {} <{}>", profile.personal_info.name, profile.personal_info.email);
    println!("   Skills: {:?}", &profile.skills.technical_skills[..3.min(profile.skills.technical_skills.len())]);
    println!("");

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: JOB DISCOVERY
    // ═══════════════════════════════════════════════════════════════════
    println!("═══════════════════════════════════════════════════════════════════");
    println!("PHASE 1: JOB DISCOVERY");
    println!("═══════════════════════════════════════════════════════════════════");
    println!("");

    let scraper = ScraperManager::new();
    
    // Sources to scrape
    let sources = vec![
        ("remoteok", "Remote OK"),
        ("remotive", "Remotive"),
        ("wwr", "WeWorkRemotely"),
        ("themuse", "The Muse"),
        ("arbeitnow", "Arbeitnow"),
        ("jobicy", "Jobicy"),
    ];

    let mut all_jobs: Vec<Job> = Vec::new();
    let mut source_stats: HashMap<String, usize> = HashMap::new();

    println!("🔍 Searching for: \"software engineer\"");
    println!("");

    for (source_id, source_name) in &sources {
        print!("   {} {} ... ", "📡", source_name);
        
        let source_vec = vec![source_id.to_string()];
        match scraper.scrape_selected(&source_vec, "software engineer") {
            Ok(jobs) => {
                let count = jobs.len();
                source_stats.insert(source_name.to_string(), count);
                println!("✅ {} jobs", count);
                all_jobs.extend(jobs);
            }
            Err(e) => {
                println!("❌ Error: {}", e);
                source_stats.insert(source_name.to_string(), 0);
            }
        }
    }

    println!("");
    println!("📊 Discovery Results:");
    println!("   Total Jobs Found: {}", all_jobs.len());
    for (source, count) in &source_stats {
        if *count > 0 {
            println!("   • {}: {} jobs", source, count);
        }
    }
    println!("");

    if all_jobs.is_empty() {
        println!("⚠️  No jobs found. Using sample jobs for demo...");
        all_jobs = create_sample_jobs();
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: JOB ANALYSIS & FILTERING
    // ═══════════════════════════════════════════════════════════════════
    println!("═══════════════════════════════════════════════════════════════════");
    println!("PHASE 2: JOB ANALYSIS & FILTERING");
    println!("═══════════════════════════════════════════════════════════════════");
    println!("");

    println!("🔬 Analyzing {} jobs for ATS type and reliability...", all_jobs.len());
    println!("");

    let mut greenhouse_jobs = Vec::new();
    let mut lever_jobs = Vec::new();
    let mut other_reliable_jobs = Vec::new();
    let mut manual_only_jobs = Vec::new();

    for job in all_jobs.iter().take(20) {
        let ats = AtsDetector::detect_ats(&job.url);
        let reliability = get_reliability(&ats);
        
        match ats {
            Some(jobez_lib::applicator::AtsType::Greenhouse) => greenhouse_jobs.push(job.clone()),
            Some(jobez_lib::applicator::AtsType::Lever) => lever_jobs.push(job.clone()),
            Some(jobez_lib::applicator::AtsType::Workable) |
            Some(jobez_lib::applicator::AtsType::AshbyHQ) |
            Some(jobez_lib::applicator::AtsType::SmartRecruiters) => other_reliable_jobs.push(job.clone()),
            _ => manual_only_jobs.push(job.clone()),
        }
    }

    println!("📊 ATS Distribution (first 20 jobs):");
    println!("   🟢 Greenhouse (High reliability): {}", greenhouse_jobs.len());
    println!("   🟢 Lever (High reliability): {}", lever_jobs.len());
    println!("   🟡 Other reliable ATS: {}", other_reliable_jobs.len());
    println!("   🔴 Manual-only (Unknown/Low): {}", manual_only_jobs.len());
    println!("");

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: APPLICATION MODES
    // ═══════════════════════════════════════════════════════════════════
    println!("═══════════════════════════════════════════════════════════════════");
    println!("PHASE 3: APPLICATION MODES");
    println!("═══════════════════════════════════════════════════════════════════");
    println!("");

    let modes = [ApplyMode::Manual, ApplyMode::SemiAuto, ApplyMode::Autopilot];
    
    // Pick a sample job for each demonstration
    let sample_jobs: Vec<&Job> = all_jobs.iter().take(6).collect();
    
    for mode in &modes {
        println!("{} {} MODE", mode.icon(), mode.name().to_uppercase());
        println!("   {}", mode.description());
        println!("");
        
        for job in sample_jobs.iter().take(2) {
            let check = PreApplyCheck::check(&job.url, *mode);
            let status = if check.can_proceed { "✅ CAN APPLY" } else { "❌ SKIP" };
            println!("   {} {} @ {}", status, truncate(&job.title, 30), truncate(&job.company, 20));
            if !check.can_proceed {
                if let Some(rec) = &check.recommended_mode {
                    println!("      └─ Recommend: {} mode", rec);
                }
            }
        }
        println!("");
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: APPLICATION SIMULATION
    // ═══════════════════════════════════════════════════════════════════
    println!("═══════════════════════════════════════════════════════════════════");
    println!("PHASE 4: APPLICATION SIMULATION");
    println!("═══════════════════════════════════════════════════════════════════");
    println!("");

    // Create applicator with Semi-Auto mode for demo
    let config = ApplicationConfig::from_mode(ApplyMode::SemiAuto);
    let applicator = JobApplicator::with_config(config);

    println!("🤖 Simulating applications in Semi-Auto mode...");
    println!("");

    let mut applied = 0;
    let mut skipped = 0;

    for job in all_jobs.iter().take(5) {
        let check = applicator.pre_check(&job.url);
        
        print!("   {} @ {} ... ", truncate(&job.title, 25), truncate(&job.company, 15));
        
        if check.can_proceed {
            // In a real scenario, this would open browser and fill forms
            println!("✅ Would apply (ATS: {})", check.ats_type.unwrap_or("Unknown".to_string()));
            applied += 1;
        } else {
            println!("⏭️  Skip ({})", check.reason);
            skipped += 1;
        }
    }

    println!("");
    println!("📊 Application Results:");
    println!("   ✅ Would Apply: {}", applied);
    println!("   ⏭️  Skipped: {}", skipped);
    println!("");

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: EMAIL/RESPONSE HANDLING
    // ═══════════════════════════════════════════════════════════════════
    println!("═══════════════════════════════════════════════════════════════════");
    println!("PHASE 5: EMAIL CLASSIFICATION (Simulated Responses)");
    println!("═══════════════════════════════════════════════════════════════════");
    println!("");

    let sample_emails = vec![
        ("Interview Invitation", "Hi! We'd like to schedule an interview for the Software Engineer role.", "🟢 InterviewInvitation", "Schedule interview"),
        ("Application Received", "Thank you for applying. We have received your application.", "⚪ ApplicationConfirmation", "No action"),
        ("Assessment Required", "Please complete the following coding assessment within 7 days.", "🟡 Assessment", "Complete assessment"),
        ("Rejection", "After careful review, we've decided to move forward with other candidates.", "🔴 Rejection", "Track for learning"),
        ("Offer Letter", "We're pleased to extend an offer for the position!", "🟢 Offer", "Review offer"),
        ("Recruiter Message", "I found your profile interesting. Are you open to new opportunities?", "🟣 RecruiterOutreach", "Respond if interested"),
    ];

    println!("📧 Simulated Email Classifications:");
    println!("");

    for (subject, _body, category, action) in &sample_emails {
        println!("   {} \"{}\"", category, subject);
        println!("      └─ Action: {}", action);
    }
    println!("");

    // ═══════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════
    println!("═══════════════════════════════════════════════════════════════════");
    println!("AUTOMATION PIPELINE SUMMARY");
    println!("═══════════════════════════════════════════════════════════════════");
    println!("");

    println!("🔄 THE FULL AUTOMATION CYCLE:");
    println!("");
    println!("   1️⃣  DISCOVER");
    println!("      • {} job sources configured", sources.len());
    println!("      • Searches: \"software engineer\", etc.");
    println!("      • Result: {} jobs found", all_jobs.len());
    println!("");
    println!("   2️⃣  ANALYZE");
    println!("      • Detect ATS type for each job");
    println!("      • Calculate match score vs profile");
    println!("      • Filter by reliability + preferences");
    println!("");
    println!("   3️⃣  APPLY (Three Modes)");
    println!("      👁️  Manual: You review, you submit");
    println!("      ⚡ Semi-Auto: Auto-fill, you confirm");
    println!("      🚀 Autopilot: Fully automatic (reliable ATS only)");
    println!("");
    println!("   4️⃣  TRACK");
    println!("      • Email monitoring for responses");
    println!("      • Auto-classify: Interview/Rejection/Offer/etc.");
    println!("      • Desktop notifications for important updates");
    println!("");
    println!("   5️⃣  LEARN");
    println!("      • Track success rates by ATS type");
    println!("      • Improve matching based on outcomes");
    println!("      • Adjust strategy automatically");
    println!("");

    println!("╔══════════════════════════════════════════════════════════════════╗");
    println!("║  ✅ DEMO COMPLETE - Your job hunting is now automated!          ║");
    println!("╚══════════════════════════════════════════════════════════════════╝");
    println!("");
}

fn create_demo_profile() -> UserProfile {
    let mut exp_years = HashMap::new();
    exp_years.insert("TypeScript".to_string(), 5);
    exp_years.insert("React".to_string(), 4);
    
    UserProfile {
        personal_info: PersonalInfo {
            name: "Demo User".to_string(),
            email: "demo@jobez.dev".to_string(),
            phone: Some("+1-555-0123".to_string()),
            location: Some("San Francisco, CA".to_string()),
            linkedin: Some("https://linkedin.com/in/demouser".to_string()),
            github: Some("https://github.com/demouser".to_string()),
            portfolio: None,
        },
        summary: "Full-stack software engineer with 5+ years of experience building scalable web applications.".to_string(),
        skills: SkillsProfile {
            technical_skills: vec![
                "TypeScript".to_string(),
                "React".to_string(),
                "Node.js".to_string(),
                "Python".to_string(),
                "PostgreSQL".to_string(),
                "AWS".to_string(),
                "Docker".to_string(),
                "Kubernetes".to_string(),
            ],
            soft_skills: vec![
                "Team Leadership".to_string(),
                "Communication".to_string(),
                "Problem Solving".to_string(),
            ],
            experience_years: exp_years,
            proficiency_levels: HashMap::new(),
        },
        experience: vec![
            ExperienceEntry {
                company: "Tech Corp".to_string(),
                position: "Senior Software Engineer".to_string(),
                duration: "2022 - Present".to_string(),
                description: vec!["Led development of microservices architecture".to_string()],
                technologies: vec!["TypeScript".to_string(), "Node.js".to_string()],
            },
        ],
        education: vec![
            EducationEntry {
                institution: "State University".to_string(),
                degree: "B.S. Computer Science".to_string(),
                year: "2018".to_string(),
                details: None,
            },
        ],
        projects: vec![],
    }
}

fn create_sample_jobs() -> Vec<Job> {
    vec![
        Job {
            id: Some(1),
            title: "Senior Software Engineer".to_string(),
            company: "TechCorp".to_string(),
            location: Some("Remote".to_string()),
            url: "https://boards.greenhouse.io/techcorp/jobs/12345".to_string(),
            description: Some("Build scalable systems...".to_string()),
            requirements: None,
            salary: Some("$150k - $200k".to_string()),
            source: "greenhouse".to_string(),
            created_at: None,
            updated_at: None,
            status: JobStatus::Saved,
            match_score: Some(85.0),
        },
        Job {
            id: Some(2),
            title: "Full Stack Developer".to_string(),
            company: "StartupXYZ".to_string(),
            location: Some("Remote".to_string()),
            url: "https://jobs.lever.co/startupxyz/abcdef".to_string(),
            description: Some("Join our growing team...".to_string()),
            requirements: None,
            salary: Some("$120k - $160k".to_string()),
            source: "lever".to_string(),
            created_at: None,
            updated_at: None,
            status: JobStatus::Saved,
            match_score: Some(78.0),
        },
        Job {
            id: Some(3),
            title: "Backend Engineer".to_string(),
            company: "BigCorp".to_string(),
            location: Some("NYC".to_string()),
            url: "https://bigcorp.wd5.myworkdayjobs.com/careers/job/123".to_string(),
            description: Some("Work on distributed systems...".to_string()),
            requirements: None,
            salary: Some("$180k - $220k".to_string()),
            source: "workday".to_string(),
            created_at: None,
            updated_at: None,
            status: JobStatus::Saved,
            match_score: Some(72.0),
        },
    ]
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len-3])
    }
}

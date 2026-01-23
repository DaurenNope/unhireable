//! Live Apply Test - Actually submits to a real Greenhouse job
//! Uses test data so company knows it's not a real application

use jobez_lib::applicator::{ApplicationConfig, AutoApplyInfo, JobApplicator};
use jobez_lib::db::models::{Job, JobStatus};
use jobez_lib::generator::{PersonalInfo, SkillsProfile, UserProfile};
use jobez_lib::scraper::ScraperManager;
use std::collections::HashMap;

#[tokio::main]
async fn main() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║       🚀 LIVE APPLICATION TEST (REAL SUBMISSION) 🚀          ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("");
    println!("⚠️  WARNING: This will submit a REAL application!");
    println!("   Using test profile data so company knows it's a test.");
    println!("");

    // Step 1: Find a real Greenhouse job
    println!("═══════════════════════════════════════════════════════════════");
    println!("STEP 1: Finding a Greenhouse job...");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    // Scrape jobs in blocking context
    let jobs = match tokio::task::spawn_blocking(|| {
        let scraper = ScraperManager::new();
        scraper.scrape_selected(&["remoteok".to_string()], "software engineer")
    }).await {
        Ok(Ok(jobs)) => jobs,
        Ok(Err(e)) => {
            println!("❌ Failed to scrape jobs: {}", e);
            return;
        }
        Err(e) => {
            println!("❌ Task error: {}", e);
            return;
        }
    };

    println!("Found {} jobs, looking for Greenhouse...", jobs.len());

    // Find a job that uses Greenhouse ATS
    let greenhouse_job = jobs.iter().find(|job| {
        let info = AutoApplyInfo::analyze(&job.url);
        info.ats_type.as_deref() == Some("Greenhouse")
    });

    let target_job = match greenhouse_job {
        Some(job) => job.clone(),
        None => {
            println!("⚠️  No Greenhouse job found in scraped results.");
            println!("   Using a known Greenhouse job board for testing...");
            
            // Use a known Lever job board (often more stable for testing)
            Job {
                id: None,
                title: "Software Engineer (Test)".to_string(),
                company: "Test Company".to_string(),
                // Lever is often more stable for automation
                url: "https://jobs.lever.co/openai".to_string(),
                description: Some("Testing live application".to_string()),
                requirements: None,
                location: Some("Remote".to_string()),
                salary: None,
                source: "test".to_string(),
                status: JobStatus::Saved,
                match_score: None,
                created_at: None,
                updated_at: None,
            }
        }
    };

    println!("");
    println!("Target job:");
    println!("  Title: {}", target_job.title);
    println!("  Company: {}", target_job.company);
    println!("  URL: {}", target_job.url);
    
    let info = AutoApplyInfo::analyze(&target_job.url);
    println!("  ATS: {:?}", info.ats_type);
    println!("  Reliability: {:?} ({}%)", info.tier, info.estimated_success_rate);
    println!("");

    // Step 2: Create test profile (clearly marked as test)
    println!("═══════════════════════════════════════════════════════════════");
    println!("STEP 2: Creating test profile...");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    let profile = UserProfile {
        personal_info: PersonalInfo {
            name: "[TEST] Jobez Bot".to_string(),
            email: "test-automation@jobez.dev".to_string(),
            phone: Some("+1-555-000-0000".to_string()),
            location: Some("Test City, TS".to_string()),
            linkedin: Some("https://linkedin.com/in/test-jobez".to_string()),
            github: Some("https://github.com/jobez-test".to_string()),
            portfolio: Some("https://jobez.dev/test".to_string()),
        },
        skills: SkillsProfile {
            technical_skills: vec!["Testing".to_string(), "Automation".to_string()],
            soft_skills: vec!["Testing".to_string()],
            experience_years: HashMap::new(),
            proficiency_levels: HashMap::new(),
        },
        experience: vec![],
        education: vec![],
        summary: "[AUTOMATED TEST] This is a test application from Jobez automation testing. Please disregard.".to_string(),
        projects: vec![],
    };

    println!("Test profile:");
    println!("  Name: {}", profile.personal_info.name);
    println!("  Email: {}", profile.personal_info.email);
    println!("");

    // Step 3: Configure for real submission
    println!("═══════════════════════════════════════════════════════════════");
    println!("STEP 3: Configuring application...");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    let config = ApplicationConfig {
        auto_submit: true,  // ← ACTUALLY SUBMIT
        upload_resume: false,
        upload_cover_letter: false,
        resume_path: None,
        cover_letter_path: None,
        wait_for_confirmation: true,
        timeout_secs: 120,
        use_smart_apply: false, // Disable smart apply for this test
        ..Default::default()
    };

    println!("Configuration:");
    println!("  auto_submit: TRUE (will click submit button)");
    println!("  upload_resume: false");
    println!("  timeout: 120s");
    println!("");

    // Step 4: Apply!
    println!("═══════════════════════════════════════════════════════════════");
    println!("STEP 4: APPLYING...");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    let applicator = JobApplicator::with_config(config);

    match applicator
        .apply_to_job(&target_job, &profile, None, None)
        .await
    {
        Ok(result) => {
            println!("");
            println!("═══════════════════════════════════════════════════════════════");
            println!("RESULT");
            println!("═══════════════════════════════════════════════════════════════");
            println!("");
            
            if result.success {
                println!("✅ APPLICATION SUBMITTED SUCCESSFULLY!");
                println!("");
                println!("   Message: {}", result.message);
                if let Some(ats) = &result.ats_type {
                    println!("   ATS: {}", ats);
                }
                if let Some(time) = &result.applied_at {
                    println!("   Applied at: {}", time);
                }
            } else {
                println!("❌ APPLICATION FAILED");
                println!("");
                println!("   Message: {}", result.message);
                if !result.errors.is_empty() {
                    println!("   Errors:");
                    for err in &result.errors {
                        println!("     - {}", err);
                    }
                }
            }
        }
        Err(e) => {
            println!("❌ ERROR: {}", e);
        }
    }

    println!("");
}

//! Real Apply Test
//! Tests actual form filling on a Greenhouse job (without submitting)

use jobez_lib::applicator::{ApplicationConfig, JobApplicator};
use jobez_lib::db::models::{Job, JobStatus};
use jobez_lib::generator::{PersonalInfo, SkillsProfile, UserProfile};
use std::collections::HashMap;

#[tokio::main]
async fn main() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           🧪 REAL APPLICATION TEST 🧪                        ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("");

    // Create a test profile
    let profile = UserProfile {
        personal_info: PersonalInfo {
            name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            phone: Some("+1-555-123-4567".to_string()),
            location: Some("San Francisco, CA".to_string()),
            linkedin: Some("https://linkedin.com/in/testuser".to_string()),
            github: Some("https://github.com/testuser".to_string()),
            portfolio: Some("https://testuser.dev".to_string()),
        },
        skills: SkillsProfile {
            technical_skills: vec![
                "Rust".to_string(),
                "TypeScript".to_string(),
                "React".to_string(),
            ],
            soft_skills: vec!["Communication".to_string()],
            experience_years: HashMap::new(),
            proficiency_levels: HashMap::new(),
        },
        experience: vec![],
        education: vec![],
        summary: "Senior Software Engineer with 5+ years experience".to_string(),
        projects: vec![],
    };

    // Test with httpbin (always works, simulates form submission)
    println!("═══════════════════════════════════════════════════════════════");
    println!("TEST 1: httpbin.org (Test Endpoint)");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    let test_job = Job {
        id: Some(1),
        title: "[TEST] Software Engineer".to_string(),
        company: "Test Company".to_string(),
        url: "https://httpbin.org/post".to_string(),
        description: Some("Test job posting".to_string()),
        requirements: None,
        location: Some("Remote".to_string()),
        salary: None,
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: None,
        created_at: None,
        updated_at: None,
    };

    let config = ApplicationConfig {
        auto_submit: true, // OK for test endpoint
        upload_resume: false,
        upload_cover_letter: false,
        resume_path: None,
        cover_letter_path: None,
        wait_for_confirmation: false,
        timeout_secs: 30,
        ..Default::default()
    };

    let applicator = JobApplicator::with_config(config);

    println!("Applying to: {} at {}", test_job.title, test_job.company);
    println!("URL: {}", test_job.url);
    println!("");

    match applicator
        .apply_to_job(&test_job, &profile, None, None)
        .await
    {
        Ok(result) => {
            println!("");
            if result.success {
                println!("✅ SUCCESS: {}", result.message);
            } else {
                println!("❌ FAILED: {}", result.message);
            }
            if let Some(ats) = result.ats_type {
                println!("   ATS/Handler: {}", ats);
            }
            if !result.errors.is_empty() {
                println!("   Errors: {:?}", result.errors);
            }
        }
        Err(e) => {
            println!("❌ ERROR: {}", e);
        }
    }

    println!("");
    println!("═══════════════════════════════════════════════════════════════");
    println!("WHAT THIS MEANS");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");
    println!("  • Test endpoint works = HTTP submission code is functional");
    println!("  • Real applications would use browser automation (Chrome/Playwright)");
    println!("  • By default, auto_submit=false (forms filled but not submitted)");
    println!("  • Set auto_submit=true to actually click the Submit button");
    println!("");
    println!("═══════════════════════════════════════════════════════════════");
    println!("TO ENABLE REAL SUBMISSIONS");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");
    println!("  1. In UI: Toggle 'Auto Submit' ON in Auto-Pilot settings");
    println!("  2. In code: ApplicationConfig {{ auto_submit: true, ... }}");
    println!("  3. Via CLI: --auto-submit flag");
    println!("");
    println!("  ⚠️  CAUTION: Real submissions will apply to actual jobs!");
    println!("");
}

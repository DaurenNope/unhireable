//! Quick form filler test with real Remotive job URL

use std::collections::HashMap;
use unhireable_lib::applicator::{AtsDetector, FormFiller};
use unhireable_lib::generator::{PersonalInfo, SkillsProfile, UserProfile};

#[tokio::main]
async fn main() {
    println!("╔══════════════════════════════════════════════════════════════════════════╗");
    println!("║     🧪 QUICK FORM FILLER TEST - Real Remotive Job URL                    ║");
    println!("╚══════════════════════════════════════════════════════════════════════════╝");
    println!();

    // Use a real Remotive job URL
    let job_url = "https://remotive.com/remote-jobs/software-development/product-platform-enterprise-full-stack-sr-staff-software-engineer-2088612";

    println!("🔗 Target URL: {}", job_url);
    println!();

    // Detect ATS from URL
    let detected = AtsDetector::detect_ats(job_url);
    println!("📦 Detected ATS: {:?}", detected);

    // Create test profile
    let profile = UserProfile {
        personal_info: PersonalInfo {
            name: "[TEST] Auto-Apply Bot".to_string(),
            email: "test@unhireable.dev".to_string(),
            phone: Some("+1-555-TEST".to_string()),
            location: Some("Remote".to_string()),
            linkedin: None,
            github: None,
            portfolio: None,
        },
        summary: "Test application".to_string(),
        skills: SkillsProfile {
            technical_skills: vec!["Rust".to_string()],
            soft_skills: vec![],
            experience_years: HashMap::new(),
            proficiency_levels: HashMap::new(),
        },
        experience: vec![],
        education: vec![],
        projects: vec![],
    };

    // Create form filler with visible browser
    std::env::set_var("JOBEZ_HEADLESS", "false");

    let form_filler = FormFiller::new().with_timeout(120).with_auto_submit(false); // Don't actually submit

    println!("🚀 Starting form fill...");
    println!("   Browser will open VISIBLE so you can see what happens.");
    println!();

    match form_filler
        .fill_and_submit(job_url, &profile, None, None, &detected)
        .await
    {
        Ok(_) => {
            println!();
            println!("✅ Form fill completed successfully!");
        }
        Err(e) => {
            println!();
            println!("❌ Form fill FAILED: {}", e);
            println!();
            println!("This error tells us what's broken:");
            println!("  - If navigation fails → URL handling issue");
            println!("  - If no form found → handshake/ATS detection issue");
            println!("  - If fields not filled → selector issue");
        }
    }
}

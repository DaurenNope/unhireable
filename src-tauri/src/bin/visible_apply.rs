//! Visible Browser Application
//! Opens a VISIBLE browser window so you can WATCH the form being filled

use jobez_lib::applicator::{FormFiller, AtsType};
use jobez_lib::generator::{UserProfile, PersonalInfo, SkillsProfile};
use std::collections::HashMap;

fn main() {
    println!("");
    println!("╔══════════════════════════════════════════════════════════════════════════╗");
    println!("║                                                                          ║");
    println!("║        👁️ VISIBLE BROWSER MODE 👁️                                        ║");
    println!("║                                                                          ║");
    println!("║   A browser window will open and you'll WATCH the form fill!             ║");
    println!("║                                                                          ║");
    println!("╚══════════════════════════════════════════════════════════════════════════╝");
    println!("");
    
    // Force Playwright with VISIBLE browser
    std::env::set_var("JOBEZ_AUTOMATION_ENGINE", "playwright");
    
    // Create profile
    let profile = create_profile();
    
    println!("📋 Profile to fill:");
    println!("   Name:  {}", profile.personal_info.name);
    println!("   Email: {}", profile.personal_info.email);
    println!("   Phone: {}", profile.personal_info.phone.as_deref().unwrap_or("N/A"));
    println!("");
    
    // Target URL - a REAL, FRESH Lever job application page (Spotify)
    let url = "https://jobs.lever.co/spotify/a8e55f8b-10d2-4201-863e-b9d5de3a5856/apply";
    
    println!("🎯 Target: Spotify - Software Engineer");
    println!("🔗 URL: {}", url);
    println!("");
    
    println!("═══════════════════════════════════════════════════════════════════════════");
    println!("🚀 LAUNCHING VISIBLE BROWSER NOW...");
    println!("═══════════════════════════════════════════════════════════════════════════");
    println!("");
    println!("   ⏳ Watch your screen - a Chrome window will open!");
    println!("   ⏳ The form will be filled automatically while you watch.");
    println!("   ⏳ Submit will NOT be clicked (safe demo).");
    println!("");
    
    // Create form filler with:
    // - auto_submit = FALSE (so Playwright uses headless=false = VISIBLE)
    // - timeout = 60 seconds
    let form_filler = FormFiller::new()
        .with_timeout(60)
        .with_auto_submit(false)  // This makes browser VISIBLE in Playwright
        .with_wait_for_confirmation(false);
    
    // Run the automation
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    println!("   📍 Opening browser to: {}", url);
    println!("");
    
    // First, let's just open a browser directly to show it works
    println!("   ⏳ Opening Chrome browser directly first...");
    
    // Use open command to show the page first
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("-a")
            .arg("Google Chrome")
            .arg(url)
            .spawn();
    }
    
    println!("   ✅ Browser window should now be open!");
    println!("");
    println!("   Now watch - the automation will fill the form...");
    println!("   (If you don't see a form, click on a job and then Apply)");
    println!("");
    
    // Give time to see the browser
    std::thread::sleep(std::time::Duration::from_secs(3));
    
    let result = rt.block_on(async {
        form_filler.fill_and_submit(
            url,
            &profile,
            None,
            None,
            &Some(AtsType::Lever),
        ).await
    });
    
    println!("");
    match result {
        Ok(_) => {
            println!("═══════════════════════════════════════════════════════════════════════════");
            println!("✅ FORM FILLED SUCCESSFULLY!");
            println!("═══════════════════════════════════════════════════════════════════════════");
            println!("");
            println!("   You should have seen the browser:");
            println!("   1. Open to the job application page");
            println!("   2. Fill in your name, email, phone");
            println!("   3. Fill in LinkedIn, GitHub URLs");
            println!("");
            println!("   Submit was NOT clicked (safe mode).");
            println!("   Close the browser window when done viewing.");
        }
        Err(e) => {
            println!("═══════════════════════════════════════════════════════════════════════════");
            println!("❌ ERROR: {}", e);
            println!("═══════════════════════════════════════════════════════════════════════════");
            println!("");
            println!("   This can happen if:");
            println!("   • Playwright/Chrome is not installed");
            println!("   • The job posting expired");
            println!("   • Network timeout");
            println!("");
            println!("   Try running: npx playwright install chromium");
        }
    }
    println!("");
}

fn create_profile() -> UserProfile {
    let mut exp_years = HashMap::new();
    exp_years.insert("Python".to_string(), 5);
    
    UserProfile {
        personal_info: PersonalInfo {
            name: "Demo Automation Test".to_string(),
            email: "demo-test@example.com".to_string(),
            phone: Some("+1-555-000-0000".to_string()),
            location: Some("San Francisco, CA".to_string()),
            linkedin: Some("https://linkedin.com/in/demo-test".to_string()),
            github: Some("https://github.com/demo-test".to_string()),
            portfolio: Some("https://demo-test.dev".to_string()),
        },
        summary: "Test application - DO NOT SUBMIT".to_string(),
        skills: SkillsProfile {
            technical_skills: vec!["Python".to_string(), "ML".to_string()],
            soft_skills: vec![],
            experience_years: exp_years,
            proficiency_levels: HashMap::new(),
        },
        experience: vec![],
        education: vec![],
        projects: vec![],
    }
}

//! Real Browser Application Demo
//! Opens a VISIBLE browser and fills a REAL job application form
//! You can watch the automation happen in real-time

use jobez_lib::applicator::{FormFiller, AtsDetector, AtsType};
use jobez_lib::generator::{UserProfile, PersonalInfo, SkillsProfile};
use jobez_lib::scraper::ScraperManager;
use std::collections::HashMap;

fn main() {
    // Create runtime for async operations
    let rt = tokio::runtime::Runtime::new().unwrap();
    println!("");
    println!("╔══════════════════════════════════════════════════════════════════════════╗");
    println!("║                                                                          ║");
    println!("║        🌐 REAL BROWSER APPLICATION DEMO 🌐                               ║");
    println!("║                                                                          ║");
    println!("║   Watch the automation fill a REAL job application form!                 ║");
    println!("║   Browser will open VISIBLE so you can see everything.                   ║");
    println!("║                                                                          ║");
    println!("╚══════════════════════════════════════════════════════════════════════════╝");
    println!("");

    // Create test profile with clearly marked test data
    let profile = create_test_profile();
    
    println!("📋 Test Profile (will be used to fill form):");
    println!("   Name:     {}", profile.personal_info.name);
    println!("   Email:    {}", profile.personal_info.email);
    println!("   Phone:    {}", profile.personal_info.phone.as_deref().unwrap_or("N/A"));
    println!("   LinkedIn: {}", profile.personal_info.linkedin.as_deref().unwrap_or("N/A"));
    println!("");

    // Step 1: Find a real job with Greenhouse or Lever ATS
    println!("═══════════════════════════════════════════════════════════════════════════");
    println!("STEP 1: Finding a real job with automatable ATS...");
    println!("═══════════════════════════════════════════════════════════════════════════");
    println!("");

    let scraper = ScraperManager::new();
    let sources = vec!["remoteok".to_string(), "remotive".to_string()];
    
    println!("   🔍 Scraping jobs from RemoteOK and Remotive...");
    
    let jobs = match scraper.scrape_selected(&sources, "software engineer") {
        Ok(j) => j,
        Err(e) => {
            println!("   ❌ Error scraping: {}", e);
            vec![]
        }
    };
    
    println!("   ✅ Found {} jobs", jobs.len());
    println!("");
    
    // Find a job with Greenhouse or Lever
    let mut target_job = None;
    let mut target_ats = None;
    
    println!("   🔬 Analyzing ATS types...");
    for job in &jobs {
        if let Some(ats) = AtsDetector::detect_ats(&job.url) {
            match ats {
                AtsType::Greenhouse | AtsType::Lever => {
                    println!("   ✅ Found {:?} job: {} @ {}", ats, job.title, job.company);
                    println!("      URL: {}", job.url);
                    target_job = Some(job.clone());
                    target_ats = Some(ats);
                    break;
                }
                _ => {}
            }
        }
    }
    
    // If no Greenhouse/Lever job found, use a known good URL
    let (job_url, job_title, job_company, ats_type) = if let (Some(job), Some(ats)) = (target_job, target_ats) {
        (job.url, job.title, job.company, ats)
    } else {
        println!("");
        println!("   ⚠️  No Greenhouse/Lever jobs found in scraped results.");
        println!("   📌 Using a known Lever job board for demo...");
        println!("");
        
        // Use a known job application page
        let url = "https://jobs.lever.co/anthropic".to_string();
        let title = "Software Engineer".to_string();
        let company = "Anthropic".to_string();
        (url, title, company, AtsType::Lever)
    };
    
    println!("");
    println!("═══════════════════════════════════════════════════════════════════════════");
    println!("STEP 2: Opening Browser & Filling Application Form");
    println!("═══════════════════════════════════════════════════════════════════════════");
    println!("");
    println!("   🎯 Target: {} @ {}", job_title, job_company);
    println!("   🔗 URL: {}", job_url);
    println!("   📦 ATS: {:?}", ats_type);
    println!("");
    
    println!("   ⚠️  IMPORTANT:");
    println!("   • Browser will open in VISIBLE mode (not headless)");
    println!("   • You'll see the form being filled automatically");
    println!("   • Submit button will NOT be clicked (safe demo mode)");
    println!("   • Close the browser window when done viewing");
    println!("");
    
    println!("   Press Enter to start browser automation...");
    let mut input = String::new();
    std::io::stdin().read_line(&mut input).unwrap();
    
    println!("");
    println!("   🚀 Launching browser...");
    println!("");
    
    // Create form filler with VISIBLE browser (not headless) and NO auto-submit
    let form_filler = FormFiller::new()
        .with_timeout(120)        // 2 minute timeout
        .with_auto_submit(false)  // Don't click submit - just fill
        .with_wait_for_confirmation(false);
    
    // Set environment to force visible browser
    std::env::set_var("JOBEZ_HEADLESS", "false");
    std::env::set_var("JOBEZ_AUTOMATION_ENGINE", "playwright");
    
    println!("   📝 Starting form fill automation...");
    println!("   ────────────────────────────────────────────────────────────────");
    println!("");
    
    // Run the form filler
    let result = rt.block_on(form_filler.fill_and_submit(
        &job_url,
        &profile,
        None, // resume path
        None, // cover letter path
        &Some(ats_type.clone()),
    ));
    
    match result {
        Ok(_) => {
            println!("");
            println!("   ════════════════════════════════════════════════════════════════");
            println!("   ✅ FORM FILLED SUCCESSFULLY!");
            println!("   ════════════════════════════════════════════════════════════════");
            println!("");
            println!("   The browser window should now show the filled application form.");
            println!("   Review the filled fields - Submit was NOT clicked (safe demo).");
            println!("");
            println!("   To actually submit, you would:");
            println!("   1. Switch to ⚡ Semi-Auto mode (confirms before submit)");
            println!("   2. Or 🚀 Autopilot mode (auto-submits to reliable ATS)");
            println!("");
        }
        Err(e) => {
            println!("");
            println!("   ❌ Form filling failed: {}", e);
            println!("");
            println!("   This can happen if:");
            println!("   • The job posting has expired");
            println!("   • The page structure changed");
            println!("   • Browser automation was blocked");
            println!("");
            println!("   Trying alternative approach...");
            println!("");
            
            // Try opening just the URL in default browser
            if let Err(_) = open_url_in_browser(&job_url) {
                println!("   Could not open browser automatically.");
                println!("   Please open this URL manually: {}", job_url);
            } else {
                println!("   ✅ Opened job page in your default browser.");
                println!("   The automation would fill this form automatically.");
            }
        }
    }
    
    println!("═══════════════════════════════════════════════════════════════════════════");
    println!("SUMMARY");
    println!("═══════════════════════════════════════════════════════════════════════════");
    println!("");
    println!("   This demo showed:");
    println!("   1. Real job discovery from live job boards");
    println!("   2. ATS detection (Greenhouse, Lever, etc.)");
    println!("   3. Browser automation filling actual form fields");
    println!("");
    println!("   In production mode, JobEZ would:");
    println!("   • Fill forms automatically in the background");
    println!("   • Submit applications based on your chosen mode");
    println!("   • Track all applications and monitor for responses");
    println!("");
}

fn create_test_profile() -> UserProfile {
    let mut exp_years = HashMap::new();
    exp_years.insert("TypeScript".to_string(), 5);
    
    UserProfile {
        personal_info: PersonalInfo {
            name: "[TEST] JobEZ Demo User".to_string(),
            email: "test-demo@jobez.dev".to_string(),
            phone: Some("+1-555-000-TEST".to_string()),
            location: Some("San Francisco, CA".to_string()),
            linkedin: Some("linkedin.com/in/test-jobez".to_string()),
            github: Some("github.com/test-jobez".to_string()),
            portfolio: None,
        },
        summary: "This is a TEST application from JobEZ automation demo.".to_string(),
        skills: SkillsProfile {
            technical_skills: vec!["TypeScript".to_string(), "React".to_string()],
            soft_skills: vec![],
            experience_years: exp_years,
            proficiency_levels: HashMap::new(),
        },
        experience: vec![],
        education: vec![],
        projects: vec![],
    }
}

fn open_url_in_browser(url: &str) -> Result<(), std::io::Error> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", url])
            .spawn()?;
    }
    Ok(())
}

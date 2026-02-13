//! CLI Test Runner - Run system tests from command line

use unhireable_lib::automation::{AutomationConfig, AutoPilotConfig, EmailClassifier};
use unhireable_lib::db::{Database, models::JobStatus};
use unhireable_lib::db::queries::JobQueries;
use unhireable_lib::matching::JobMatcher;
use std::path::PathBuf;

fn main() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║           🧪 UNHIREABLE SYSTEM TESTS 🧪                  ║");
    println!("╚══════════════════════════════════════════════════════════╝");
    println!("");

    let mut passed = 0;
    let mut failed = 0;

    // Test 1: Database
    print!("Testing Database Connection... ");
    match test_database() {
        Ok(msg) => { println!("✅ {}", msg); passed += 1; }
        Err(msg) => { println!("❌ {}", msg); failed += 1; }
    }

    // Test 2: Job Matcher
    print!("Testing Job Matcher... ");
    match test_job_matcher() {
        Ok(msg) => { println!("✅ {}", msg); passed += 1; }
        Err(msg) => { println!("❌ {}", msg); failed += 1; }
    }

    // Test 3: Email Classifier
    print!("Testing Email Classifier... ");
    match test_email_classifier() {
        Ok(msg) => { println!("✅ {}", msg); passed += 1; }
        Err(msg) => { println!("❌ {}", msg); failed += 1; }
    }

    // Test 4: Automation Config
    print!("Testing Automation Config... ");
    match test_automation_config() {
        Ok(msg) => { println!("✅ {}", msg); passed += 1; }
        Err(msg) => { println!("❌ {}", msg); failed += 1; }
    }

    // Test 5: Scraper
    print!("Testing Scraper Manager... ");
    match test_scraper() {
        Ok(msg) => { println!("✅ {}", msg); passed += 1; }
        Err(msg) => { println!("❌ {}", msg); failed += 1; }
    }

    println!("\n═══════════════════════════════════════════════════════════");
    println!("RESULTS: {}/{} tests passed", passed, passed + failed);
    if failed == 0 {
        println!("🎉 All tests passed!");
    } else {
        println!("⚠️  {} test(s) failed", failed);
    }
    println!("═══════════════════════════════════════════════════════════\n");
}

fn test_database() -> Result<String, String> {
    // Get app data directory
    let app_dir = dirs::data_dir()
        .map(|p| p.join("com.unhireable.app"))
        .unwrap_or_else(|| PathBuf::from("."));
    
    let db_path = app_dir.join("unhireable.db");
    
    match Database::new(&db_path) {
        Ok(db) => {
            let conn = db.get_connection();
            match conn.list_jobs(None) {
                Ok(jobs) => Ok(format!("Connected, {} jobs in database", jobs.len())),
                Err(e) => Err(format!("Query failed: {}", e)),
            }
        }
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}

fn test_job_matcher() -> Result<String, String> {
    use unhireable_lib::db::models::Job;
    use unhireable_lib::generator::{UserProfile, PersonalInfo, SkillsProfile};
    use std::collections::HashMap;

    let test_job = Job {
        id: Some(1),
        title: "Senior Rust Developer".to_string(),
        company: "TechCorp".to_string(),
        url: "https://example.com".to_string(),
        description: Some("Looking for experienced Rust developer with TypeScript skills".to_string()),
        requirements: None,
        location: Some("Remote".to_string()),
        salary: Some("$150k".to_string()),
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: None,
        created_at: None,
        updated_at: None,
                ..Default::default()
        };

    let profile = UserProfile {
        personal_info: PersonalInfo {
            name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            phone: Some("555-1234".to_string()),
            location: Some("Remote".to_string()),
            linkedin: None,
            github: None,
            portfolio: None,
        },
        summary: "Experienced developer".to_string(),
        skills: SkillsProfile {
            technical_skills: vec!["Rust".to_string(), "TypeScript".to_string(), "React".to_string()],
            soft_skills: vec!["Communication".to_string()],
            experience_years: HashMap::new(),
            proficiency_levels: HashMap::new(),
        },
        experience: vec![],
        education: vec![],
        projects: vec![],
    };

    let matcher = JobMatcher::new();
    let result = matcher.calculate_match(&test_job, &profile);

    if result.match_score > 0.0 {
        Ok(format!("Score: {:.1}%, matched skills: {:?}", result.match_score, result.matched_skills))
    } else {
        Err("Match score is 0".to_string())
    }
}

fn test_email_classifier() -> Result<String, String> {
    let classifier = EmailClassifier::new();

    let test_cases = vec![
        ("Interview Invitation", "We'd like to schedule an interview with you next week."),
        ("Application Update", "Unfortunately, we've decided to move forward with other candidates."),
        ("Job Offer", "We are pleased to offer you the position with a salary of $150,000."),
    ];

    let mut results = vec![];
    for (subject, body) in test_cases {
        let (category, confidence) = classifier.classify(subject, body);
        results.push(format!("{:?}({:.0}%)", category, confidence * 100.0));
    }

    Ok(format!("Classified 3 emails: {}", results.join(", ")))
}

fn test_automation_config() -> Result<String, String> {
    let config = AutomationConfig::default();
    let autopilot = AutoPilotConfig::default();

    if config.application.dry_run && !autopilot.enabled {
        Ok(format!(
            "Config OK (dry_run={}, max_apps={}, autopilot_enabled={})",
            config.application.dry_run,
            config.application.max_applications_per_run,
            autopilot.enabled
        ))
    } else {
        Err("Unexpected default config values".to_string())
    }
}

fn test_scraper() -> Result<String, String> {
    let _scraper = unhireable_lib::scraper::ScraperManager::new();
    Ok("Scraper initialized (sources: remoteok, wellfound, remotive, linkedin, hh_kz)".to_string())
}

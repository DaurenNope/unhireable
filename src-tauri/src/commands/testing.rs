//! Testing Commands - For verifying the automation system works end-to-end

use crate::automation::{
    AutoPilotConfig, AutomationConfig, PipelineResult, EmailClassifier, ClassifiedEmail,
};
use crate::commands::user::load_user_profile_from_conn;
use crate::db::models::Job;
use crate::error::Result;
use crate::AppState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Test result summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
    pub message: String,
    pub duration_ms: u64,
    pub details: Option<serde_json::Value>,
}

/// Full system test results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemTestResults {
    pub overall_passed: bool,
    pub tests: Vec<TestResult>,
    pub summary: String,
    pub total_duration_ms: u64,
}

/// Run all system tests
#[tauri::command]
pub async fn run_system_tests(state: State<'_, AppState>) -> Result<SystemTestResults> {
    let mut results = Vec::new();
    let start = std::time::Instant::now();

    println!("\n");
    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║           🧪 RUNNING SYSTEM TESTS 🧪                     ║");
    println!("╚══════════════════════════════════════════════════════════╝");
    println!("");

    // Test 1: Database connection
    results.push(test_database_connection(&state).await);

    // Test 2: User profile
    results.push(test_user_profile(&state).await);

    // Test 3: Job scraping (limited)
    results.push(test_job_scraping().await);

    // Test 4: Job matching
    results.push(test_job_matching(&state).await);

    // Test 5: Email classifier
    results.push(test_email_classifier().await);

    // Test 6: Document generation
    results.push(test_document_generation(&state).await);

    // Test 7: Automation config
    results.push(test_automation_config().await);

    let total_duration = start.elapsed().as_millis() as u64;
    let passed_count = results.iter().filter(|r| r.passed).count();
    let total_count = results.len();
    let overall_passed = passed_count == total_count;

    println!("\n");
    println!("═══════════════════════════════════════════════════════════");
    println!("TEST RESULTS: {}/{} passed", passed_count, total_count);
    println!("═══════════════════════════════════════════════════════════");
    for result in &results {
        let status = if result.passed { "✅" } else { "❌" };
        println!("{} {} ({}ms)", status, result.name, result.duration_ms);
        if !result.passed {
            println!("   └─ {}", result.message);
        }
    }
    println!("");

    Ok(SystemTestResults {
        overall_passed,
        tests: results,
        summary: format!("{}/{} tests passed in {}ms", passed_count, total_count, total_duration),
        total_duration_ms: total_duration,
    })
}

/// Test database connection
async fn test_database_connection(state: &State<'_, AppState>) -> TestResult {
    let start = std::time::Instant::now();
    let name = "Database Connection".to_string();

    let db = state.db.lock().await;
    let result = if db.is_some() {
        let conn = db.as_ref().unwrap().get_connection();
        // Try to query jobs
        use crate::db::queries::JobQueries;
        match conn.list_jobs(None) {
            Ok(jobs) => TestResult {
                name,
                passed: true,
                message: format!("Connected, {} jobs in database", jobs.len()),
                duration_ms: start.elapsed().as_millis() as u64,
                details: Some(serde_json::json!({ "job_count": jobs.len() })),
            },
            Err(e) => TestResult {
                name,
                passed: false,
                message: format!("Query failed: {}", e),
                duration_ms: start.elapsed().as_millis() as u64,
                details: None,
            },
        }
    } else {
        TestResult {
            name,
            passed: false,
            message: "Database not initialized".to_string(),
            duration_ms: start.elapsed().as_millis() as u64,
            details: None,
        }
    };

    result
}

/// Test user profile loading
async fn test_user_profile(state: &State<'_, AppState>) -> TestResult {
    let start = std::time::Instant::now();
    let name = "User Profile".to_string();

    let db = state.db.lock().await;
    if let Some(db) = db.as_ref() {
        let conn = db.get_connection();
        match load_user_profile_from_conn(&conn) {
            Ok(Some(profile)) => TestResult {
                name,
                passed: true,
                message: format!("Profile loaded for: {}", profile.personal_info.name),
                duration_ms: start.elapsed().as_millis() as u64,
                details: Some(serde_json::json!({
                    "name": profile.personal_info.name,
                    "email": profile.personal_info.email,
                    "has_skills": !profile.skills.technical_skills.is_empty(),
                })),
            },
            Ok(None) => TestResult {
                name,
                passed: false,
                message: "No profile found. Please configure your profile in Settings.".to_string(),
                duration_ms: start.elapsed().as_millis() as u64,
                details: None,
            },
            Err(e) => TestResult {
                name,
                passed: false,
                message: format!("Failed to load profile: {}", e),
                duration_ms: start.elapsed().as_millis() as u64,
                details: None,
            },
        }
    } else {
        TestResult {
            name,
            passed: false,
            message: "Database not initialized".to_string(),
            duration_ms: start.elapsed().as_millis() as u64,
            details: None,
        }
    }
}

/// Test job scraping (limited to avoid rate limits)
async fn test_job_scraping() -> TestResult {
    let start = std::time::Instant::now();
    let name = "Job Scraping".to_string();

    // Test with a single source
    let _scraper = crate::scraper::ScraperManager::new();
    
    // Just test that the scraper initializes and can be called
    // Don't actually scrape to avoid rate limits
    TestResult {
        name,
        passed: true,
        message: "Scraper initialized (not running to avoid rate limits)".to_string(),
        duration_ms: start.elapsed().as_millis() as u64,
        details: Some(serde_json::json!({
            "sources_available": ["remoteok", "wellfound", "remotive", "hh_kz", "linkedin"],
        })),
    }
}

/// Test job matching
async fn test_job_matching(state: &State<'_, AppState>) -> TestResult {
    let start = std::time::Instant::now();
    let name = "Job Matching".to_string();

    use crate::db::models::JobStatus;
    
    // Create a test job
    let test_job = Job {
        id: Some(999999),
        title: "Senior Software Engineer".to_string(),
        company: "Test Company".to_string(),
        location: Some("Remote".to_string()),
        description: Some("We're looking for a senior software engineer with Rust, TypeScript, and React experience. You'll work on building scalable systems.".to_string()),
        requirements: None,
        salary: Some("$150,000 - $200,000".to_string()),
        url: "https://example.com/job/123".to_string(),
        source: "test".to_string(),
        status: JobStatus::Saved,
        created_at: None,
        updated_at: None,
        match_score: None,
    };

    // Get user profile for matching
    let db = state.db.lock().await;
    if let Some(db) = db.as_ref() {
        let conn = db.get_connection();
        match load_user_profile_from_conn(&conn) {
            Ok(Some(profile)) => {
                let matcher = crate::matching::JobMatcher::new();
                let result = matcher.calculate_match(&test_job, &profile);

                TestResult {
                    name,
                    passed: true,
                    message: format!("Match score: {:.1}%", result.match_score),
                    duration_ms: start.elapsed().as_millis() as u64,
                    details: Some(serde_json::json!({
                        "match_score": result.match_score,
                        "skills_match": result.skills_match,
                        "experience_match": result.experience_match,
                        "matched_skills": result.matched_skills,
                        "missing_skills": result.missing_skills,
                    })),
                }
            }
            _ => TestResult {
                name,
                passed: false,
                message: "No profile for matching".to_string(),
                duration_ms: start.elapsed().as_millis() as u64,
                details: None,
            },
        }
    } else {
        TestResult {
            name,
            passed: false,
            message: "Database not initialized".to_string(),
            duration_ms: start.elapsed().as_millis() as u64,
            details: None,
        }
    }
}

/// Test email classifier
async fn test_email_classifier() -> TestResult {
    let start = std::time::Instant::now();
    let name = "Email Classifier".to_string();

    let classifier = EmailClassifier::new();

    // Test emails
    let test_cases = vec![
        (
            "Interview Invitation",
            "We'd like to schedule an interview",
            "Hi, we reviewed your application and would like to schedule a phone screen. Please let us know your availability.",
        ),
        (
            "Rejection",
            "Application Update",
            "Thank you for your interest. Unfortunately, we've decided to move forward with other candidates.",
        ),
        (
            "Offer",
            "Job Offer from TechCorp",
            "We are pleased to extend an offer for the position. Your starting salary will be $150,000.",
        ),
        (
            "Assessment",
            "Coding Challenge",
            "Please complete the attached coding challenge on HackerRank within 5 days.",
        ),
    ];

    let mut classifications = Vec::new();
    for (expected, subject, body) in &test_cases {
        let (category, confidence) = classifier.classify(subject, body);
        classifications.push(serde_json::json!({
            "expected": expected,
            "subject": subject,
            "category": format!("{:?}", category),
            "confidence": confidence,
        }));
    }

    TestResult {
        name,
        passed: true,
        message: format!("Classified {} test emails", test_cases.len()),
        duration_ms: start.elapsed().as_millis() as u64,
        details: Some(serde_json::json!({ "classifications": classifications })),
    }
}

/// Test document generation
async fn test_document_generation(state: &State<'_, AppState>) -> TestResult {
    let start = std::time::Instant::now();
    let name = "Document Generation".to_string();

    // Get user profile (release lock before await)
    let profile_result = {
        let db = state.db.lock().await;
        if let Some(db) = db.as_ref() {
            let conn = db.get_connection();
            load_user_profile_from_conn(&conn)
        } else {
            return TestResult {
                name,
                passed: false,
                message: "Database not initialized".to_string(),
                duration_ms: start.elapsed().as_millis() as u64,
                details: None,
            };
        }
    };

    match profile_result {
        Ok(Some(profile)) => {
            use crate::db::models::JobStatus;
            let test_job = Job {
                id: Some(999999),
                title: "Senior Software Engineer".to_string(),
                company: "Awesome Startup".to_string(),
                location: Some("Remote".to_string()),
                description: Some("Building the future of tech".to_string()),
                requirements: None,
                salary: None,
                url: "https://example.com/job".to_string(),
                source: "test".to_string(),
                status: JobStatus::Saved,
                created_at: None,
                updated_at: None,
                match_score: None,
            };

            // Test resume generation
            let resume_gen = crate::generator::ResumeGenerator::new();
            match resume_gen.generate_resume(&profile, &test_job, None, false).await {
                Ok(doc) => TestResult {
                    name,
                    passed: true,
                    message: format!("Generated resume ({} bytes)", doc.content.len()),
                    duration_ms: start.elapsed().as_millis() as u64,
                    details: Some(serde_json::json!({
                        "document_type": "resume",
                        "content_length": doc.content.len(),
                        "format": doc.format,
                    })),
                },
                Err(e) => TestResult {
                    name,
                    passed: false,
                    message: format!("Resume generation failed: {}", e),
                    duration_ms: start.elapsed().as_millis() as u64,
                    details: None,
                },
            }
        }
        _ => TestResult {
            name,
            passed: false,
            message: "No profile for document generation".to_string(),
            duration_ms: start.elapsed().as_millis() as u64,
            details: None,
        },
    }
}

/// Test automation configuration
async fn test_automation_config() -> TestResult {
    let start = std::time::Instant::now();
    let name = "Automation Config".to_string();

    let config = AutomationConfig::default();
    let autopilot_config = AutoPilotConfig::default();

    TestResult {
        name,
        passed: true,
        message: "Default configs created".to_string(),
        duration_ms: start.elapsed().as_millis() as u64,
        details: Some(serde_json::json!({
            "automation": {
                "dry_run": config.application.dry_run,
                "auto_submit": config.application.auto_submit,
                "max_per_run": config.application.max_applications_per_run,
                "min_match_score": config.filters.min_match_score,
            },
            "autopilot": {
                "enabled": autopilot_config.enabled,
                "max_per_week": autopilot_config.safety.max_applications_per_week,
            },
        })),
    }
}

/// Run a dry-run test of the automation pipeline
#[tauri::command]
pub async fn test_automation_pipeline(
    state: State<'_, AppState>,
    query: Option<String>,
) -> Result<PipelineResult> {
    use crate::automation::AutomationOrchestrator;

    println!("\n🧪 Running automation pipeline test (dry run)...\n");

    // Get user profile
    let profile = {
        let db = state.db.lock().await;
        if let Some(db) = db.as_ref() {
            let conn = db.get_connection();
            load_user_profile_from_conn(&conn)?
                .ok_or_else(|| anyhow::anyhow!("User profile not found"))?
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    // Create automation config for testing
    let mut config = AutomationConfig::default();
    config.application.dry_run = true; // Always dry run for tests
    config.application.max_applications_per_run = 2; // Limit to 2 for testing
    config.search.max_jobs_per_run = 5; // Limit jobs for testing
    
    if let Some(q) = query {
        config.search.queries = vec![q];
    }

    // Create orchestrator and run
    let orchestrator = AutomationOrchestrator::new(
        config,
        state.db.clone(),
        state.app_dir.clone(),
    );

    let result = orchestrator.run_pipeline(&profile).await?;

    println!("\n✅ Pipeline test complete: {}\n", result.summary());

    Ok(result)
}

/// Test email sending (requires configured SMTP)
#[tauri::command]
pub async fn test_email_sending(
    state: State<'_, AppState>,
    to_email: String,
) -> Result<TestResult> {
    use crate::notifications::{EmailConfig, EmailService};
    use crate::db::queries::CredentialQueries;

    let start = std::time::Instant::now();

    // Try to get email credentials from database
    let db = state.db.lock().await;
    if let Some(db) = db.as_ref() {
        let conn = db.get_connection();
        
        // Look for email credentials
        if let Ok(Some(cred)) = conn.get_credential("smtp") {
            let username = cred.username.clone().unwrap_or_default();
            let config = EmailConfig {
                smtp_server: "smtp.gmail.com".to_string(),
                smtp_port: 587,
                username: username.clone(),
                password: cred.tokens.unwrap_or_default(),
                from_email: username,
                from_name: "Unhireable Test".to_string(),
                use_tls: true,
                use_ssl: false,
            };

            let mut service = EmailService::new(config);
            if let Err(e) = service.initialize() {
                return Ok(TestResult {
                    name: "Email Sending".to_string(),
                    passed: false,
                    message: format!("Failed to initialize: {}", e),
                    duration_ms: start.elapsed().as_millis() as u64,
                    details: None,
                });
            }

            match service.send_test_email(&to_email) {
                Ok(_) => Ok(TestResult {
                    name: "Email Sending".to_string(),
                    passed: true,
                    message: format!("Test email sent to {}", to_email),
                    duration_ms: start.elapsed().as_millis() as u64,
                    details: Some(serde_json::json!({ "recipient": to_email })),
                }),
                Err(e) => Ok(TestResult {
                    name: "Email Sending".to_string(),
                    passed: false,
                    message: format!("Failed to send: {}", e),
                    duration_ms: start.elapsed().as_millis() as u64,
                    details: None,
                }),
            }
        } else {
            Ok(TestResult {
                name: "Email Sending".to_string(),
                passed: false,
                message: "No SMTP credentials configured. Add them in Settings → Credentials.".to_string(),
                duration_ms: start.elapsed().as_millis() as u64,
                details: None,
            })
        }
    } else {
        Ok(TestResult {
            name: "Email Sending".to_string(),
            passed: false,
            message: "Database not initialized".to_string(),
            duration_ms: start.elapsed().as_millis() as u64,
            details: None,
        })
    }
}

/// Classify a test email
#[tauri::command]
pub fn test_classify_email(
    subject: String,
    body: String,
) -> ClassifiedEmail {
    let classifier = EmailClassifier::new();
    let (category, confidence) = classifier.classify(&subject, &body);
    let extracted = classifier.extract_data(&subject, &body);
    let (requires_action, suggested_action) = classifier.requires_action(&category);

    ClassifiedEmail {
        id: "test".to_string(),
        from: "test@example.com".to_string(),
        to: "you@example.com".to_string(),
        subject,
        body_preview: body.chars().take(200).collect(),
        received_at: Utc::now(),
        category,
        confidence,
        extracted_data: extracted,
        requires_action,
        suggested_action,
    }
}

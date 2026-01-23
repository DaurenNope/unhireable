use unhireable_lib::db::Database;
use unhireable_lib::generator::{
    EducationEntry, ExperienceEntry, PersonalInfo, SkillsProfile, UserProfile,
};
use unhireable_lib::run_auto_apply_logic;
use rusqlite::params;
use std::collections::HashMap;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::sync::Mutex;

#[tokio::test]
async fn test_auto_apply_dry_run() {
    // 1. Setup temporary directory for DB and app data
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app_dir = dir.path().to_path_buf();

    // 2. Initialize Database
    let db = Database::new(&db_path).expect("Failed to create database");
    let db = Arc::new(Mutex::new(Some(db)));

    // 3. Create a dummy resume file
    let resume_path = app_dir.join("resume.pdf");
    std::fs::write(&resume_path, b"dummy pdf content").expect("Failed to write dummy resume");

    // 4. Insert User Profile into DB
    let profile = UserProfile {
        personal_info: PersonalInfo {
            name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            phone: Some("123-456-7890".to_string()),
            location: Some("Remote".to_string()),
            linkedin: None,
            github: None,
            portfolio: None,
        },
        summary: "Experienced developer".to_string(),
        skills: SkillsProfile {
            technical_skills: vec!["Rust".to_string(), "TypeScript".to_string()],
            soft_skills: vec!["Communication".to_string()],
            experience_years: HashMap::new(),
            proficiency_levels: HashMap::new(),
        },
        experience: vec![ExperienceEntry {
            company: "Tech Corp".to_string(),
            position: "Senior Developer".to_string(),
            duration: "2 years".to_string(),
            description: vec!["Built things".to_string()],
            technologies: vec!["Rust".to_string()],
        }],
        education: vec![EducationEntry {
            institution: "University".to_string(),
            degree: "BS CS".to_string(),
            year: "2020".to_string(),
            details: None,
        }],
        projects: vec![],
    };

    let profile_json = serde_json::to_string(&profile).unwrap();

    {
        let db_guard = db.lock().await;
        if let Some(db) = &*db_guard {
            let conn = db.get_connection();
            conn.execute(
                "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, ?2)",
                params![profile_json, chrono::Utc::now()],
            )
            .expect("Failed to insert profile");
        }
    }

    // 5. Run Auto-Apply Logic (Dry Run)
    // We use a query that is likely to find jobs, or we can rely on the scraper finding something.
    // Since we can't guarantee network or jobs, we primarily check that it runs without error.
    // If it finds 0 jobs, it returns early.

    let result = run_auto_apply_logic(
        db.clone(),
        app_dir.clone(),
        "remote developer".to_string(),
        5,
        true, // dry_run
    )
    .await;

    match result {
        Ok(res) => {
            println!(
                "Auto-apply result: Scraped {}, Filtered {}, Submitted {}, Failed {}",
                res.jobs_scraped,
                res.jobs_filtered,
                res.applications_submitted,
                res.applications_failed
            );

            // If we scraped jobs, we should have processed them
            if res.jobs_filtered > 0 {
                assert_eq!(
                    res.applications_submitted + res.applications_failed,
                    res.jobs_filtered
                );
                // In dry run, they should be "submitted" (simulated success)
                assert!(res.applications_submitted > 0);
            } else {
                println!("Warning: No jobs scraped/filtered, so no applications tested.");
            }
        }
        Err(e) => {
            panic!("Auto-apply failed: {}", e);
        }
    }
}

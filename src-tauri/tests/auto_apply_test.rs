use unhireable_lib::db::models::{Job, JobStatus};
use unhireable_lib::db::queries::JobQueries;
use unhireable_lib::db::Database;
use unhireable_lib::generator::{
    EducationEntry, ExperienceEntry, PersonalInfo, SkillsProfile, UserProfile,
};
use unhireable_lib::run_auto_apply_with_seed_jobs;
use rusqlite::params;
use std::collections::HashMap;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::sync::Mutex;

fn make_profile() -> UserProfile {
    UserProfile {
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
    }
}

fn seed_remote_senior_jobs() -> Vec<Job> {
    vec![
        Job {
            title: "Senior Rust Engineer".to_string(),
            company: "Remote First Inc".to_string(),
            url: "https://remotefirst.io/jobs/rust-1".to_string(),
            description: Some("Build high-performance services in Rust.".to_string()),
            location: Some("Remote".to_string()),
            source: "test".to_string(),
            status: JobStatus::Saved,
            ..Default::default()
        },
        Job {
            title: "Lead Backend Developer".to_string(),
            company: "Anywhere Co".to_string(),
            url: "https://anywhere.co/jobs/backend".to_string(),
            description: Some("Lead backend development for our SaaS product.".to_string()),
            location: Some("Anywhere".to_string()),
            source: "test".to_string(),
            status: JobStatus::Saved,
            ..Default::default()
        },
    ]
}

/// Full dry-run pipeline test that runs completely offline.
/// Uses `run_auto_apply_with_seed_jobs` to bypass network scraping.
#[tokio::test]
async fn test_auto_apply_dry_run_offline() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app_dir = dir.path().to_path_buf();

    let db = Database::new(&db_path).expect("db init");
    let db = Arc::new(Mutex::new(Some(db)));

    // Write a dummy resume so the pipeline finds it
    std::fs::write(app_dir.join("resume.pdf"), b"dummy pdf content").unwrap();

    // Store the profile in the DB (the pipeline loads it from there)
    let profile = make_profile();
    let profile_json = serde_json::to_string(&profile).unwrap();
    {
        let guard = db.lock().await;
        if let Some(d) = &*guard {
            let conn = d.get_connection();
            conn.execute(
                "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, ?2)",
                params![profile_json, chrono::Utc::now()],
            )
            .unwrap();
        }
    }

    let candidate_jobs = seed_remote_senior_jobs();
    let jobs_scraped = candidate_jobs.len();

    let result = run_auto_apply_with_seed_jobs(
        db.clone(),
        app_dir.clone(),
        candidate_jobs,
        jobs_scraped,
        10,
        true, // dry_run
    )
    .await
    .expect("pipeline should succeed");

    // Both jobs pass the filter (remote + senior/lead/developer title)
    assert_eq!(result.jobs_scraped, 2, "should report 2 scraped");
    assert_eq!(result.jobs_filtered, 2, "both jobs pass the filter");
    assert_eq!(result.applications_submitted, 2, "both should be dry-run submitted");
    assert_eq!(result.applications_failed, 0);

    // Applications should be persisted in the DB
    let guard = db.lock().await;
    if let Some(d) = &*guard {
        use unhireable_lib::db::queries::ApplicationQueries;
        let conn = d.get_connection();
        let apps = conn.list_applications(None, None).unwrap();
        assert_eq!(apps.len(), 2, "both applications should be in DB");
        assert!(apps.iter().all(|a| a.applied_via.as_deref() == Some("auto")),
            "applied_via should be 'auto' for all auto-applied jobs");
    }
}

/// Jobs that don't pass the remote+senior filter should be discarded.
#[tokio::test]
async fn test_pipeline_filters_non_remote_jobs() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app_dir = dir.path().to_path_buf();

    let db = Database::new(&db_path).unwrap();
    let db = Arc::new(Mutex::new(Some(db)));

    std::fs::write(app_dir.join("resume.pdf"), b"dummy").unwrap();

    let profile = make_profile();
    let profile_json = serde_json::to_string(&profile).unwrap();
    {
        let guard = db.lock().await;
        if let Some(d) = &*guard {
            d.get_connection().execute(
                "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, ?2)",
                params![profile_json, chrono::Utc::now()],
            ).unwrap();
        }
    }

    let candidate_jobs = vec![
        // Should be filtered OUT — not remote, not senior
        Job {
            title: "Office Receptionist".to_string(),
            company: "Local Corp".to_string(),
            url: "https://localcorp.com/jobs/receptionist".to_string(),
            location: Some("New York, NY".to_string()),
            source: "test".to_string(),
            status: JobStatus::Saved,
            ..Default::default()
        },
        // Should be filtered OUT — hh.kz source is always excluded
        Job {
            title: "Senior Developer".to_string(),
            company: "RU Corp".to_string(),
            url: "https://hh.kz/jobs/senior".to_string(),
            location: Some("Remote".to_string()),
            source: "hh.kz".to_string(),
            status: JobStatus::Saved,
            ..Default::default()
        },
        // Should PASS — remote senior engineer
        Job {
            title: "Senior Software Engineer".to_string(),
            company: "Remote Co".to_string(),
            url: "https://remoteco.io/jobs/sse".to_string(),
            location: Some("Remote".to_string()),
            source: "test".to_string(),
            status: JobStatus::Saved,
            ..Default::default()
        },
    ];

    let result = run_auto_apply_with_seed_jobs(
        db.clone(),
        app_dir,
        candidate_jobs,
        3,
        10,
        true,
    )
    .await
    .expect("pipeline should succeed");

    assert_eq!(result.jobs_scraped, 3);
    assert_eq!(result.jobs_filtered, 1, "only the remote senior engineer should pass");
    assert_eq!(result.applications_submitted, 1);
}

/// Live network test — requires internet and ~60s. Run with: cargo test -- --ignored
#[tokio::test]
#[ignore = "requires live internet — run manually with: cargo test -- --ignored"]
async fn test_auto_apply_live_network() {
    use unhireable_lib::run_auto_apply_logic;

    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app_dir = dir.path().to_path_buf();

    let db = Database::new(&db_path).unwrap();
    let db = Arc::new(Mutex::new(Some(db)));

    std::fs::write(app_dir.join("resume.pdf"), b"dummy").unwrap();

    let profile = make_profile();
    let profile_json = serde_json::to_string(&profile).unwrap();
    {
        let guard = db.lock().await;
        if let Some(d) = &*guard {
            d.get_connection().execute(
                "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, ?2)",
                params![profile_json, chrono::Utc::now()],
            ).unwrap();
        }
    }

    let result = run_auto_apply_logic(db, app_dir, "remote developer".to_string(), 5, true).await;
    match result {
        Ok(r) => println!("Live run: scraped={}, filtered={}, submitted={}", r.jobs_scraped, r.jobs_filtered, r.applications_submitted),
        Err(e) => panic!("Live run failed: {}", e),
    }
}

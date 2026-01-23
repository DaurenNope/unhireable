// Test utilities for comprehensive testing

use unhireable_lib::db::models::{Job, JobStatus, Application, ApplicationStatus};
use unhireable_lib::generator::{UserProfile, PersonalInfo, SkillsProfile, ExperienceEntry};
use unhireable_lib::events::{Event, EventBus};
use chrono::Utc;
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::Mutex;
use std::collections::HashMap;

/// Create a temporary database for testing
pub fn create_test_db() -> (unhireable_lib::db::Database, TempDir) {
    let temp_dir = tempfile::tempdir().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("test.db");
    let db = unhireable_lib::db::Database::new(&db_path).expect("Failed to create test database");
    (db, temp_dir)
}

/// Create a test job with default values
pub fn create_test_job() -> Job {
    Job {
        id: None,
        title: "Senior React Developer".to_string(),
        company: "Tech Corp".to_string(),
        url: "https://example.com/job/1".to_string(),
        description: Some(
            "We are looking for a senior React developer with TypeScript experience. \
             Must know Node.js, Docker, and REST APIs. Remote work available. \
             5+ years of experience required."
                .to_string(),
        ),
        requirements: Some(
            "Experience with React, TypeScript, Node.js required. \
             Docker experience preferred. Strong problem-solving skills."
                .to_string(),
        ),
        location: Some("Remote".to_string()),
        salary: None,
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: None,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    }
}

/// Create a test job with custom fields
pub fn create_test_job_with(title: &str, company: &str, url: &str) -> Job {
    Job {
        id: None,
        title: title.to_string(),
        company: company.to_string(),
        url: url.to_string(),
        description: Some(format!("Description for {} at {}", title, company)),
        requirements: Some("Requirements".to_string()),
        location: Some("Remote".to_string()),
        salary: None,
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: None,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    }
}

/// Create multiple test jobs
pub fn create_test_jobs(count: usize) -> Vec<Job> {
    (0..count)
        .map(|i| {
            let mut job = create_test_job();
            job.title = format!("Test Job {}", i + 1);
            job.url = format!("https://example.com/job/{}", i + 1);
            job
        })
        .collect()
}

/// Create a test user profile
pub fn create_test_profile() -> UserProfile {
    UserProfile {
        personal_info: PersonalInfo {
            name: "John Doe".to_string(),
            email: "john@example.com".to_string(),
            phone: None,
            location: Some("San Francisco, CA".to_string()),
            linkedin: None,
            github: None,
            portfolio: None,
        },
        summary: "Experienced React developer with 5 years of experience".to_string(),
        skills: SkillsProfile {
            technical_skills: vec![
                "React".to_string(),
                "TypeScript".to_string(),
                "Node.js".to_string(),
                "JavaScript".to_string(),
            ],
            soft_skills: vec!["Communication".to_string(), "Problem-solving".to_string()],
            experience_years: {
                let mut map = HashMap::new();
                map.insert("React".to_string(), 5);
                map.insert("TypeScript".to_string(), 4);
                map.insert("Node.js".to_string(), 3);
                map
            },
            proficiency_levels: HashMap::new(),
        },
        experience: vec![ExperienceEntry {
            company: "Previous Corp".to_string(),
            position: "Senior Frontend Developer".to_string(),
            duration: "3 years".to_string(),
            description: vec![
                "Built React applications".to_string(),
                "Worked with TypeScript and Node.js".to_string(),
            ],
            technologies: vec![
                "React".to_string(),
                "TypeScript".to_string(),
                "Node.js".to_string(),
            ],
        }],
        education: vec![],
        projects: vec!["React project with AWS".to_string()],
    }
}

/// Create a test application
pub fn create_test_application(job_id: i64) -> Application {
    Application {
        id: None,
        job_id,
        status: ApplicationStatus::Pending,
        applied_at: Some(Utc::now()),
        resume_path: None,
        cover_letter_path: None,
        notes: None,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    }
}

/// Create a test event bus
pub async fn create_test_event_bus() -> Arc<EventBus> {
    Arc::new(EventBus::new())
}

/// Wait for async operations to complete
pub async fn wait_for_async() {
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
}

/// Assert that two jobs are equal (ignoring timestamps)
pub fn assert_jobs_equal(job1: &Job, job2: &Job) {
    assert_eq!(job1.title, job2.title, "Job titles should match");
    assert_eq!(job1.company, job2.company, "Job companies should match");
    assert_eq!(job1.url, job2.url, "Job URLs should match");
    assert_eq!(job1.source, job2.source, "Job sources should match");
}









// E2E tests for complete application workflow

use unhireable_lib::db::{Database, models::{JobStatus, ApplicationStatus}};
use tempfile::TempDir;

#[tokio::test]
async fn test_application_workflow_end_to_end() {
    // Create test database
    let temp_dir = tempfile::tempdir().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new(&db_path).expect("Failed to create test database");
    
    // Step 1: Create a job
    let mut job = unhireable_lib::db::models::Job {
        id: None,
        title: "Senior Developer".to_string(),
        company: "Tech Corp".to_string(),
        url: "https://example.com/job/1".to_string(),
        description: Some("Job description".to_string()),
        requirements: Some("Requirements".to_string()),
        location: Some("Remote".to_string()),
        salary: None,
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: Some(85.0),
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
    };
    
    {
        let conn = db.get_connection();
        conn.create_job(&mut job).expect("Failed to create job");
    }
    
    let job_id = job.id.expect("Job should have an ID");
    
    // Step 2: Create an application
    let mut application = unhireable_lib::db::models::Application {
        id: None,
        job_id,
        status: ApplicationStatus::Pending,
        applied_at: Some(chrono::Utc::now()),
        resume_path: Some("/path/to/resume.pdf".to_string()),
        cover_letter_path: Some("/path/to/cover_letter.pdf".to_string()),
        notes: Some("Applied via website".to_string()),
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
    };
    
    {
        let conn = db.get_connection();
        conn.create_application(&mut application).expect("Failed to create application");
    }
    
    let application_id = application.id.expect("Application should have an ID");
    
    // Step 3: Verify application was created
    {
        let conn = db.get_connection();
        let retrieved = conn.get_application(application_id).expect("Failed to get application");
        assert!(retrieved.is_some(), "Application should be retrievable");
        let app = retrieved.unwrap();
        assert_eq!(app.job_id, job_id);
        assert_eq!(app.status, ApplicationStatus::Pending);
    }
    
    // Step 4: Update application status
    {
        let conn = db.get_connection();
        let mut app = conn.get_application(application_id)
            .expect("Failed to get application")
            .expect("Application should exist");
        app.status = ApplicationStatus::Interviewing;
        conn.update_application(&app).expect("Failed to update application");
    }
    
    // Step 5: Verify status update
    {
        let conn = db.get_connection();
        let retrieved = conn.get_application(application_id).expect("Failed to get application");
        assert!(retrieved.is_some(), "Application should still exist");
        let app = retrieved.unwrap();
        assert_eq!(app.status, ApplicationStatus::Interviewing, "Status should be updated");
    }
    
    // Step 6: List applications for the job
    {
        let conn = db.get_connection();
        let applications = conn.list_applications(Some(job_id), None)
            .expect("Failed to list applications");
        assert!(!applications.is_empty(), "Should have at least one application");
        assert!(applications.iter().any(|a| a.id == Some(application_id)), 
                "Should find the created application");
    }
}

#[tokio::test]
async fn test_job_to_application_linking() {
    // Create test database
    let temp_dir = tempfile::tempdir().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new(&db_path).expect("Failed to create test database");
    
    // Create multiple jobs
    let job_ids = {
        let conn = db.get_connection();
        let mut ids = Vec::new();
        for i in 0..3 {
            let mut job = unhireable_lib::db::models::Job {
                id: None,
                title: format!("Job {}", i + 1),
                company: format!("Company {}", i + 1),
                url: format!("https://example.com/job/{}", i + 1),
                description: Some("Description".to_string()),
                requirements: None,
                location: Some("Remote".to_string()),
                salary: None,
                source: "test".to_string(),
                status: JobStatus::Saved,
                match_score: None,
                created_at: Some(chrono::Utc::now()),
                updated_at: Some(chrono::Utc::now()),
            };
            conn.create_job(&mut job).expect("Failed to create job");
            if let Some(id) = job.id {
                ids.push(id);
            }
        }
        ids
    };
    
    // Create applications for first two jobs
    {
        let conn = db.get_connection();
        for job_id in &job_ids[0..2] {
            let mut application = unhireable_lib::db::models::Application {
                id: None,
                job_id: *job_id,
                status: ApplicationStatus::Pending,
                applied_at: Some(chrono::Utc::now()),
                resume_path: None,
                cover_letter_path: None,
                notes: None,
                created_at: Some(chrono::Utc::now()),
                updated_at: Some(chrono::Utc::now()),
            };
            conn.create_application(&mut application).expect("Failed to create application");
        }
    }
    
    // Verify applications are linked correctly
    {
        let conn = db.get_connection();
        let applications_job0 = conn.list_applications(Some(job_ids[0]), None)
            .expect("Failed to list applications");
        assert_eq!(applications_job0.len(), 1, "Job 0 should have 1 application");
        
        let applications_job1 = conn.list_applications(Some(job_ids[1]), None)
            .expect("Failed to list applications");
        assert_eq!(applications_job1.len(), 1, "Job 1 should have 1 application");
        
        let applications_job2 = conn.list_applications(Some(job_ids[2]), None)
            .expect("Failed to list applications");
        assert_eq!(applications_job2.len(), 0, "Job 2 should have 0 applications");
    }
}









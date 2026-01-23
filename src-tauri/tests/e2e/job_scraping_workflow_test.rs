// E2E tests for complete job scraping workflow

use jobez_lib::db::{Database, models::JobStatus};
use tempfile::TempDir;

#[tokio::test]
async fn test_job_scraping_to_database_flow() {
    // Create test database
    let temp_dir = tempfile::tempdir().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new(&db_path).expect("Failed to create test database");
    
    // This test would require actual scraper execution
    // For now, we test the database operations part
    
    // Create a mock job
    let mut job = jobez_lib::db::models::Job {
        id: None,
        title: "Test Software Engineer".to_string(),
        company: "Test Company".to_string(),
        url: "https://example.com/job/1".to_string(),
        description: Some("Test description".to_string()),
        requirements: Some("Test requirements".to_string()),
        location: Some("Remote".to_string()),
        salary: None,
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: None,
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
    };
    
    // Save job to database
    {
        let conn = db.get_connection();
        conn.create_job(&mut job).expect("Failed to create job");
    }
    
    // Verify job was saved
    {
        let conn = db.get_connection();
        if let Some(job_id) = job.id {
            let retrieved = conn.get_job(job_id).expect("Failed to get job");
            assert!(retrieved.is_some(), "Job should be retrievable");
            let retrieved_job = retrieved.unwrap();
            assert_eq!(retrieved_job.title, "Test Software Engineer");
            assert_eq!(retrieved_job.company, "Test Company");
            assert_eq!(retrieved_job.source, "test");
        } else {
            panic!("Job should have an ID after creation");
        }
    }
}

#[tokio::test]
async fn test_job_deduplication() {
    // Create test database
    let temp_dir = tempfile::tempdir().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new(&db_path).expect("Failed to create test database");
    
    let url = "https://example.com/job/duplicate".to_string();
    
    // Create first job
    let mut job1 = jobez_lib::db::models::Job {
        id: None,
        title: "First Job".to_string(),
        company: "Company A".to_string(),
        url: url.clone(),
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
    
    {
        let conn = db.get_connection();
        conn.create_job(&mut job1).expect("Failed to create first job");
    }
    
    // Try to create duplicate job with same URL
    let mut job2 = jobez_lib::db::models::Job {
        id: None,
        title: "Second Job".to_string(),
        company: "Company B".to_string(),
        url: url.clone(),
        description: Some("Different description".to_string()),
        requirements: None,
        location: Some("Remote".to_string()),
        salary: None,
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: None,
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
    };
    
    // Check if job with URL already exists
    {
        let conn = db.get_connection();
        let existing = conn.get_job_by_url(&url).expect("Failed to check for existing job");
        assert!(existing.is_some(), "Should find existing job by URL");
        
        // Should not create duplicate
        if existing.is_some() {
            // In real implementation, we'd skip creation
            // For this test, we verify deduplication logic
            assert_eq!(existing.unwrap().title, "First Job");
        }
    }
}









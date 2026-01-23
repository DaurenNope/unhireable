// Test utilities for comprehensive testing
#[cfg(test)]
pub mod test_helpers {
    use super::super::db::{models::Job, Database};
    use chrono::Utc;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Create a temporary database for testing
    pub fn create_test_db() -> (Database, TempDir) {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");
        let db = Database::new(&db_path).expect("Failed to create test database");
        (db, temp_dir)
    }

    /// Create a test job with default values
    pub fn create_test_job() -> Job {
        Job {
            id: None,
            title: "Test Software Engineer".to_string(),
            company: "Test Company".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("Test job description".to_string()),
            requirements: Some("Test requirements".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            source: "test".to_string(),
            status: super::super::db::models::JobStatus::Saved,
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

    /// Assert that two jobs are equal (ignoring timestamps)
    pub fn assert_jobs_equal(job1: &Job, job2: &Job) {
        assert_eq!(job1.title, job2.title, "Job titles should match");
        assert_eq!(job1.company, job2.company, "Job companies should match");
        assert_eq!(job1.url, job2.url, "Job URLs should match");
        assert_eq!(job1.source, job2.source, "Job sources should match");
    }
}

#[cfg(test)]
pub use test_helpers::*;

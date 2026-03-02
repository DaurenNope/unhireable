use unhireable_lib::db::models::{Application, ApplicationStatus, Job, JobStatus};
use unhireable_lib::db::queries::{ApplicationQueries, JobQueries};
use unhireable_lib::db::Database;
use tempfile::tempdir;

#[test]
fn migrations_and_job_crud_work() {
    // Keep temp directory alive for the duration of the test to avoid 'readonly database'
    let dir = tempdir().expect("temp dir");
    let db_path = dir.path().join("test.db");
    let db = Database::new(db_path).expect("db init");
    let conn = db.get_connection();

    // Create job
    let mut job = Job {
        title: "Senior Frontend Developer".into(),
        company: "Tech Corp".into(),
        url: "https://example.com/jobs/senior-frontend".into(),
        description: Some("React, TypeScript".into()),
        requirements: Some("React; TS".into()),
        location: Some("Remote".into()),
        salary: Some("$120k - $180k".into()),
        source: "test".into(),
        status: JobStatus::Saved,
        ..Default::default()
    };
    conn.create_job(&mut job).expect("create job");
    assert!(job.id.is_some(), "job id should be set after insert");

    // Get job by id
    let fetched = conn.get_job(job.id.unwrap()).expect("get job");
    assert!(fetched.is_some(), "job should be found");
    let fetched = fetched.unwrap();
    assert_eq!(fetched.title, "Senior Frontend Developer");
    assert_eq!(fetched.company, "Tech Corp");
    assert_eq!(fetched.status, JobStatus::Saved);

    // Update job status and match_score
    let mut updated = fetched.clone();
    updated.status = JobStatus::Applied;
    updated.match_score = Some(83.5);
    conn.update_job(&updated).expect("update job");

    let fetched2 = conn.get_job(updated.id.unwrap()).unwrap().unwrap();
    assert_eq!(fetched2.status, JobStatus::Applied);
    assert_eq!(fetched2.match_score, Some(83.5));

    // List jobs
    let all = conn.list_jobs(None).expect("list");
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].url, "https://example.com/jobs/senior-frontend");

    // Create application linked to job
    let mut app = Application {
        job_id: fetched2.id.unwrap(),
        status: ApplicationStatus::Submitted,
        notes: Some("Submitted via company portal".into()),
        ..Default::default()
    };
    conn.create_application(&mut app)
        .expect("create application");
    assert!(app.id.is_some());

    // Read application back
    let apps = conn
        .list_applications(Some(fetched2.id.unwrap()), None)
        .expect("list apps");
    assert_eq!(apps.len(), 1);
    assert_eq!(apps[0].status, ApplicationStatus::Submitted);
}

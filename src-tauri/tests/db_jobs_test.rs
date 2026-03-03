use unhireable_lib::db::models::{Application, ApplicationStatus, Job, JobStatus};
use unhireable_lib::db::queries::{ApplicationQueries, JobQueries};
use unhireable_lib::db::Database;
use tempfile::tempdir;

fn open_db() -> (tempfile::TempDir, Database) {
    let dir = tempdir().expect("temp dir");
    let db_path = dir.path().join("test.db");
    let db = Database::new(db_path).expect("db init");
    (dir, db)
}

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

/// Verify that `contact_email` on a job is persisted and read back correctly.
#[test]
fn contact_email_round_trips_through_db() {
    let (_dir, db) = open_db();
    let conn = db.get_connection();

    let mut job = Job {
        title: "Product Manager".into(),
        company: "Acme Inc".into(),
        url: "https://acme.com/pm".into(),
        source: "test".into(),
        status: JobStatus::Saved,
        contact_email: Some("hiring@acme.com".into()),
        ..Default::default()
    };
    conn.create_job(&mut job).expect("create job");
    let id = job.id.unwrap();

    // get_job must return contact_email
    let fetched = conn.get_job(id).unwrap().unwrap();
    assert_eq!(fetched.contact_email.as_deref(), Some("hiring@acme.com"));

    // list_jobs must also return it
    let list = conn.list_jobs(None).unwrap();
    assert_eq!(list[0].contact_email.as_deref(), Some("hiring@acme.com"));

    // update_job must persist a changed email
    let mut updated = fetched.clone();
    updated.contact_email = Some("jobs@acme.com".into());
    conn.update_job(&updated).unwrap();
    let re_fetched = conn.get_job(id).unwrap().unwrap();
    assert_eq!(re_fetched.contact_email.as_deref(), Some("jobs@acme.com"));

    // get_job_by_url must also return it
    let by_url = conn.get_job_by_url("https://acme.com/pm").unwrap().unwrap();
    assert_eq!(by_url.contact_email.as_deref(), Some("jobs@acme.com"));
}

/// Verify that `applied_via` on an application is persisted and read back.
#[test]
fn applied_via_round_trips_through_db() {
    let (_dir, db) = open_db();
    let conn = db.get_connection();

    // Need a parent job first
    let mut job = Job {
        title: "Backend Engineer".into(),
        company: "Stripe".into(),
        url: "https://stripe.com/be".into(),
        source: "test".into(),
        status: JobStatus::Saved,
        ..Default::default()
    };
    conn.create_job(&mut job).unwrap();

    let mut app = Application {
        job_id: job.id.unwrap(),
        status: ApplicationStatus::Submitted,
        applied_via: Some("linkedin".into()),
        notes: Some("Applied via LinkedIn Easy Apply".into()),
        ..Default::default()
    };
    conn.create_application(&mut app).unwrap();
    let app_id = app.id.unwrap();

    // get_application must return applied_via
    let fetched = conn.get_application(app_id).unwrap().unwrap();
    assert_eq!(fetched.applied_via.as_deref(), Some("linkedin"));

    // list_applications must also return it
    let list = conn.list_applications(Some(job.id.unwrap()), None).unwrap();
    assert_eq!(list[0].applied_via.as_deref(), Some("linkedin"));

    // update_application must persist a changed channel
    let mut updated = fetched.clone();
    updated.applied_via = Some("email".into());
    conn.update_application(&updated).unwrap();
    let re_fetched = conn.get_application(app_id).unwrap().unwrap();
    assert_eq!(re_fetched.applied_via.as_deref(), Some("email"));
}

/// Verify that NULL values for both optional fields are handled gracefully.
#[test]
fn optional_fields_default_to_none() {
    let (_dir, db) = open_db();
    let conn = db.get_connection();

    let mut job = Job {
        title: "Data Analyst".into(),
        company: "Corp".into(),
        url: "https://corp.com/da".into(),
        source: "test".into(),
        status: JobStatus::Saved,
        contact_email: None,
        ..Default::default()
    };
    conn.create_job(&mut job).unwrap();
    let fetched = conn.get_job(job.id.unwrap()).unwrap().unwrap();
    assert!(fetched.contact_email.is_none(), "contact_email should be None when not set");

    let mut app = Application {
        job_id: job.id.unwrap(),
        status: ApplicationStatus::Preparing,
        applied_via: None,
        ..Default::default()
    };
    conn.create_application(&mut app).unwrap();
    let fetched_app = conn.get_application(app.id.unwrap()).unwrap().unwrap();
    assert!(fetched_app.applied_via.is_none(), "applied_via should be None when not set");
}

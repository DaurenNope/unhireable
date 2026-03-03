/// In-process HTTP tests for the Axum REST API server.
///
/// Uses `tower::ServiceExt::oneshot` to send requests directly to the
/// router without binding a port, so tests are fast and fully offline.
use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::Value;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::sync::Mutex;
use tower::ServiceExt; // .oneshot()

use unhireable_lib::db::models::{Job, JobStatus};
use unhireable_lib::db::queries::JobQueries;
use unhireable_lib::db::Database;
use unhireable_lib::web_server::{create_router, WebAppState};

/// Build a WebAppState backed by a fresh in-memory-ish temp DB.
fn make_state() -> (tempfile::TempDir, WebAppState) {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let db = Database::new(&db_path).expect("db init");
    let app_dir = dir.path().to_path_buf();
    let state = WebAppState {
        db: Arc::new(Mutex::new(Some(db))),
        app_dir,
    };
    (dir, state)
}

async fn body_json(body: Body) -> Value {
    let bytes = body.collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_health_returns_200() {
    let (_dir, state) = make_state();
    let app = create_router(state);

    let req = Request::builder()
        .method(Method::GET)
        .uri("/api/health")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

// ---------------------------------------------------------------------------
// Jobs CRUD
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_jobs_empty_returns_200() {
    let (_dir, state) = make_state();
    let app = create_router(state);

    let req = Request::builder()
        .method(Method::GET)
        .uri("/api/jobs")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let json = body_json(resp.into_body()).await;
    // Should return a list (possibly wrapped in {data: []})
    let jobs = json.get("data").unwrap_or(&json);
    assert!(jobs.is_array(), "response should contain a jobs array");
    assert_eq!(jobs.as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn create_and_get_job_via_api() {
    let (_dir, state) = make_state();
    let app = create_router(state);

    let body = serde_json::json!({
        "title": "Senior Rust Engineer",
        "company": "Ferrous Inc",
        "url": "https://ferrous.inc/jobs/rust",
        "source": "test",
        "status": "saved"
    });

    let req = Request::builder()
        .method(Method::POST)
        .uri("/api/jobs")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED, "POST /api/jobs should return 201");

    let created = body_json(resp.into_body()).await;
    let data = created.get("data").unwrap_or(&created);
    let job_id = data.get("id")
        .expect("response should include id")
        .as_i64()
        .unwrap();

    // Now GET the job by ID
    let req2 = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/jobs/{}", job_id))
        .body(Body::empty())
        .unwrap();

    let resp2 = app.oneshot(req2).await.unwrap();
    assert_eq!(resp2.status(), StatusCode::OK);

    let fetched = body_json(resp2.into_body()).await;
    let data2 = fetched.get("data").unwrap_or(&fetched);
    assert_eq!(data2["title"], "Senior Rust Engineer");
    assert_eq!(data2["company"], "Ferrous Inc");
}

#[tokio::test]
async fn get_nonexistent_job_returns_404() {
    let (_dir, state) = make_state();
    let app = create_router(state);

    let req = Request::builder()
        .method(Method::GET)
        .uri("/api/jobs/99999")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn delete_job_removes_it() {
    let (_dir, state) = make_state();

    // Pre-seed a job directly via DB
    {
        let guard = state.db.lock().await;
        if let Some(db) = &*guard {
            let conn = db.get_connection();
            let mut job = Job {
                title: "To Be Deleted".to_string(),
                company: "Gone Co".to_string(),
                url: "https://gone.co/job".to_string(),
                source: "test".to_string(),
                status: JobStatus::Saved,
                ..Default::default()
            };
            conn.create_job(&mut job).unwrap();
        }
    }

    let app = create_router(state);

    // First confirm it exists
    let list_req = Request::builder()
        .uri("/api/jobs")
        .body(Body::empty())
        .unwrap();
    let list_resp = app.clone().oneshot(list_req).await.unwrap();
    let list_json = body_json(list_resp.into_body()).await;
    let jobs = list_json.get("data").unwrap_or(&list_json).as_array().unwrap();
    assert_eq!(jobs.len(), 1);
    let id = jobs[0]["id"].as_i64().unwrap();

    // Delete it
    let del_req = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/jobs/{}", id))
        .body(Body::empty())
        .unwrap();
    let del_resp = app.clone().oneshot(del_req).await.unwrap();
    assert!(
        del_resp.status() == StatusCode::OK || del_resp.status() == StatusCode::NO_CONTENT,
        "DELETE should return 200 or 204, got {}",
        del_resp.status()
    );

    // Confirm gone
    let list_req2 = Request::builder()
        .uri("/api/jobs")
        .body(Body::empty())
        .unwrap();
    let list_resp2 = app.oneshot(list_req2).await.unwrap();
    let list_json2 = body_json(list_resp2.into_body()).await;
    let jobs2 = list_json2.get("data").unwrap_or(&list_json2).as_array().unwrap();
    assert_eq!(jobs2.len(), 0, "job should be deleted");
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_applications_empty_returns_200() {
    let (_dir, state) = make_state();
    let app = create_router(state);

    let req = Request::builder()
        .uri("/api/applications")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let json = body_json(resp.into_body()).await;
    let apps = json.get("data").unwrap_or(&json);
    assert!(apps.is_array());
}

// ---------------------------------------------------------------------------
// Answer cache (Chrome extension sync endpoint)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn answer_cache_list_returns_empty_on_fresh_db() {
    let (_dir, state) = make_state();
    let app = create_router(state);

    let req = Request::builder()
        .uri("/api/answer-cache")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let json = body_json(resp.into_body()).await;
    let entries = json.get("data").unwrap_or(&json);
    assert!(entries.is_array());
}

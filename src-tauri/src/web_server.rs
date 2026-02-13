//! Axum REST API server for Unhireable.
//! Exposes the same functionality as Tauri commands via HTTP endpoints.

use axum::{
    extract::{Path, Query, State as AxumState},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::db::models::{AnswerCacheEntry, Application, ApplicationStatus, Job, JobStatus};
use crate::db::queries::{AnswerCacheQueries, ApplicationQueries, JobQueries};
use crate::db::Database;
use crate::generator::UserProfile;
use crate::matching::{JobMatchResult, JobMatcher};
use crate::run_auto_apply_logic;
use crate::scraper;

/// Shared state for the web server
#[derive(Clone)]
pub struct WebAppState {
    pub db: Arc<Mutex<Option<Database>>>,
    pub app_dir: PathBuf,
}

impl WebAppState {
    pub fn new(db_path: &str) -> Self {
        let db = Database::new(db_path).ok();
        // Use a sensible default app directory
        let app_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        Self {
            db: Arc::new(Mutex::new(db)),
            app_dir,
        }
    }

    pub fn with_app_dir(db_path: &str, app_dir: PathBuf) -> Self {
        let db = Database::new(db_path).ok();
        Self {
            db: Arc::new(Mutex::new(db)),
            app_dir,
        }
    }
}

/// API error response
#[derive(Serialize)]
struct ApiError {
    error: String,
}

impl ApiError {
    fn new(msg: impl Into<String>) -> Self {
        Self { error: msg.into() }
    }
}

/// API success response wrapper
#[derive(Serialize)]
struct ApiResponse<T> {
    data: T,
}

// =============================================================================
// Jobs API
// =============================================================================

#[derive(Deserialize, Default)]
pub struct JobsQuery {
    status: Option<String>,
    query: Option<String>,
    page: Option<usize>,
    page_size: Option<usize>,
}

/// GET /api/jobs - List all jobs with optional filters
pub async fn list_jobs(
    AxumState(state): AxumState<WebAppState>,
    Query(params): Query<JobsQuery>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    let status = params
        .status
        .as_deref()
        .and_then(|s| s.parse::<JobStatus>().ok());

    let mut jobs = match conn.list_jobs(status) {
        Ok(jobs) => jobs,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(e.to_string())),
            )
                .into_response()
        }
    };

    // Apply search filter
    if let Some(query) = &params.query {
        let query_lower = query.to_lowercase();
        jobs.retain(|job| {
            job.title.to_lowercase().contains(&query_lower)
                || job.company.to_lowercase().contains(&query_lower)
        });
    }

    // Pagination
    if let Some(page_size) = params.page_size {
        let page = params.page.unwrap_or(1).max(1);
        let start = (page - 1) * page_size;
        jobs = jobs.into_iter().skip(start).take(page_size).collect();
    }

    (StatusCode::OK, Json(ApiResponse { data: jobs })).into_response()
}

/// GET /api/jobs/:id - Get a single job by ID
pub async fn get_job(
    AxumState(state): AxumState<WebAppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    match conn.get_job(id) {
        Ok(Some(job)) => (StatusCode::OK, Json(ApiResponse { data: job })).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(ApiError::new("Job not found"))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(e.to_string())),
        )
            .into_response(),
    }
}

/// POST /api/jobs - Create a new job
pub async fn create_job(
    AxumState(state): AxumState<WebAppState>,
    Json(mut job): Json<Job>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    match conn.create_job(&mut job) {
        Ok(_) => (StatusCode::CREATED, Json(ApiResponse { data: job })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(e.to_string())),
        )
            .into_response(),
    }
}

/// PUT /api/jobs/:id - Update a job
pub async fn update_job(
    AxumState(state): AxumState<WebAppState>,
    Path(id): Path<i64>,
    Json(mut job): Json<Job>,
) -> impl IntoResponse {
    job.id = Some(id);

    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    match conn.update_job(&job) {
        Ok(_) => (StatusCode::OK, Json(ApiResponse { data: job })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(e.to_string())),
        )
            .into_response(),
    }
}

/// DELETE /api/jobs/:id - Delete a job
pub async fn delete_job(
    AxumState(state): AxumState<WebAppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    match conn.delete_job(id) {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(e.to_string())),
        )
            .into_response(),
    }
}

// =============================================================================
// Applications API
// =============================================================================

#[derive(Deserialize, Default)]
pub struct ApplicationsQuery {
    status: Option<String>,
    job_id: Option<i64>,
}

/// GET /api/applications - List all applications
pub async fn list_applications(
    AxumState(state): AxumState<WebAppState>,
    Query(params): Query<ApplicationsQuery>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    let status = params
        .status
        .as_deref()
        .and_then(|s| s.parse::<ApplicationStatus>().ok());

    match conn.list_applications(params.job_id, status) {
        Ok(apps) => (StatusCode::OK, Json(ApiResponse { data: apps })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(e.to_string())),
        )
            .into_response(),
    }
}

/// GET /api/applications/:id - Get a single application
pub async fn get_application(
    AxumState(state): AxumState<WebAppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    match conn.get_application(id) {
        Ok(Some(app)) => (StatusCode::OK, Json(ApiResponse { data: app })).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Application not found")),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(e.to_string())),
        )
            .into_response(),
    }
}

/// POST /api/applications - Create a new application
pub async fn create_application(
    AxumState(state): AxumState<WebAppState>,
    Json(mut app): Json<Application>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    match conn.create_application(&mut app) {
        Ok(_) => (StatusCode::CREATED, Json(ApiResponse { data: app })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(e.to_string())),
        )
            .into_response(),
    }
}

/// PUT /api/applications/:id - Update an application
pub async fn update_application(
    AxumState(state): AxumState<WebAppState>,
    Path(id): Path<i64>,
    Json(mut app): Json<Application>,
) -> impl IntoResponse {
    app.id = Some(id);

    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    match conn.update_application(&app) {
        Ok(_) => (StatusCode::OK, Json(ApiResponse { data: app })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(e.to_string())),
        )
            .into_response(),
    }
}

// =============================================================================
// Stats API
// =============================================================================

#[derive(Serialize)]
pub struct DashboardStats {
    pub total_jobs: usize,
    pub total_applications: usize,
    pub pending_applications: usize,
    pub applied_count: usize,
    pub interviews_scheduled: usize,
}

/// GET /api/stats - Get dashboard statistics
pub async fn get_stats(AxumState(state): AxumState<WebAppState>) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();

    let total_jobs = conn.list_jobs(None).map(|j| j.len()).unwrap_or(0);
    let all_apps = conn.list_applications(None, None).unwrap_or_default();
    let total_applications = all_apps.len();

    let pending_applications = all_apps
        .iter()
        .filter(|a| a.status == ApplicationStatus::Preparing)
        .count();
    let applied_count = all_apps
        .iter()
        .filter(|a| a.status == ApplicationStatus::Submitted)
        .count();
    let interviews_scheduled = all_apps
        .iter()
        .filter(|a| a.status == ApplicationStatus::InterviewScheduled)
        .count();

    let stats = DashboardStats {
        total_jobs,
        total_applications,
        pending_applications,
        applied_count,
        interviews_scheduled,
    };

    (StatusCode::OK, Json(ApiResponse { data: stats })).into_response()
}

/// GET /api/health - Health check endpoint
pub async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

// =============================================================================
// Scrape API
// =============================================================================

#[derive(Deserialize)]
pub struct ScrapeRequest {
    sources: Vec<String>,
    query: String,
}

#[derive(Serialize)]
pub struct ScrapeResponse {
    jobs_found: usize,
    jobs_saved: usize,
}

/// POST /api/jobs/scrape - Scrape jobs from selected sources
pub async fn scrape_jobs_handler(
    AxumState(state): AxumState<WebAppState>,
    Json(req): Json<ScrapeRequest>,
) -> impl IntoResponse {
    tracing::info!(
        "🔍 Scraping jobs from sources: {:?}, query: '{}'",
        req.sources,
        req.query
    );

    let sources = req.sources.clone();
    let query = req.query.clone();

    // Run scraper in blocking task
    let scraper_result = task::spawn_blocking(move || {
        let scraper = scraper::ScraperManager::new();
        scraper.scrape_selected(&sources, &query)
    })
    .await;

    let jobs = match scraper_result {
        Ok(Ok(jobs)) => jobs,
        Ok(Err(e)) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(format!("Scraping failed: {}", e))),
            )
                .into_response()
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(format!("Task failed: {}", e))),
            )
                .into_response()
        }
    };

    let jobs_found = jobs.len();
    tracing::info!("✅ Scraped {} jobs", jobs_found);

    // Save to database
    let mut jobs_saved = 0;
    let db_guard = state.db.lock().await;
    if let Some(db) = &*db_guard {
        let conn = db.get_connection();
        for job in &jobs {
            // Check if job exists by URL
            let exists = conn.get_job_by_url(&job.url).ok().flatten().is_some();
            if !exists {
                let mut job_clone = job.clone();
                if conn.create_job(&mut job_clone).is_ok() {
                    jobs_saved += 1;
                }
            }
        }
    }
    drop(db_guard);

    tracing::info!("💾 Saved {} new jobs to database", jobs_saved);

    (
        StatusCode::OK,
        Json(ApiResponse {
            data: ScrapeResponse {
                jobs_found,
                jobs_saved,
            },
        }),
    )
        .into_response()
}

// =============================================================================
// Auto-Apply API
// =============================================================================

#[derive(Deserialize)]
pub struct AutoApplyRequest {
    query: String,
    max_applications: usize,
    dry_run: bool,
}

/// POST /api/apply/auto - Run auto-apply to matching jobs
pub async fn auto_apply_handler(
    AxumState(state): AxumState<WebAppState>,
    Json(req): Json<AutoApplyRequest>,
) -> impl IntoResponse {
    tracing::info!(
        "🚀 Auto-apply: query='{}', max={}, dry_run={}",
        req.query,
        req.max_applications,
        req.dry_run
    );

    let result = run_auto_apply_logic(
        state.db.clone(),
        state.app_dir.clone(),
        req.query,
        req.max_applications,
        req.dry_run,
    )
    .await;

    match result {
        Ok(result) => (StatusCode::OK, Json(ApiResponse { data: result })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(format!("Auto-apply failed: {}", e))),
        )
            .into_response(),
    }
}

// =============================================================================
// Auth API (for web mode - bypass for browser access)
// =============================================================================

#[derive(Serialize)]
pub struct AuthStatus {
    is_setup: bool,
    is_authenticated: bool,
}

/// GET /api/auth/status - Get auth status (always returns authenticated for web mode)
pub async fn auth_get_status() -> impl IntoResponse {
    // In web mode, we bypass auth and return authenticated
    Json(ApiResponse {
        data: AuthStatus {
            is_setup: true,
            is_authenticated: true,
        },
    })
}

#[derive(Deserialize)]
pub struct AuthSetupRequest {
    #[allow(dead_code)]
    email: Option<String>,
    #[allow(dead_code)]
    password: Option<String>,
}

/// POST /api/auth/setup - Setup auth (no-op for web mode)
pub async fn auth_setup(Json(_req): Json<AuthSetupRequest>) -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "success",
        "message": "Auth setup complete (web mode)"
    }))
}

// =============================================================================
// Direct Apply API (for testing with httpbin.org)
// =============================================================================

use crate::applicator::{ApplicationConfig, JobApplicator};
use crate::generator::{PersonalInfo, SkillsProfile};

/// POST /api/jobs/:id/apply - Apply to a specific job
/// Returns immediately with a pending status - browser automation runs in background
pub async fn apply_to_job_handler(
    axum::extract::State(state): axum::extract::State<WebAppState>,
    Path(id): Path<i64>,
) -> axum::response::Response {
    println!("📝 Direct apply request for job ID: {}", id);

    // Get job from database
    let db_guard = state.db.lock().await;
    let job = if let Some(db) = &*db_guard {
        let conn = db.get_connection();
        match conn.get_job(id) {
            Ok(Some(job)) => job,
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(ApiError::new("Job not found".to_string())),
                )
                    .into_response();
            }
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiError::new(format!("Database error: {}", e))),
                )
                    .into_response();
            }
        }
    } else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new("No database".to_string())),
        )
            .into_response();
    };
    drop(db_guard);

    // Use test profile for direct apply testing
    let profile = create_test_profile();

    // Look for resume file in standard locations
    let resume_path = std::path::Path::new("resume.pdf");
    let resume_path_str = if resume_path.exists() {
        Some(resume_path.to_str().unwrap_or("resume.pdf").to_string())
    } else {
        // Try absolute path
        let home_resume = dirs::home_dir()
            .map(|h| h.join("Documents/resume.pdf"))
            .filter(|p| p.exists());
        home_resume.and_then(|p| p.to_str().map(|s| s.to_string()))
    };

    println!("📄 Resume path: {:?}", resume_path_str);

    // Create applicator config
    let config = ApplicationConfig {
        mode: crate::applicator::ApplyMode::Autopilot,
        auto_submit: true,
        upload_resume: true,
        upload_cover_letter: false,
        resume_path: resume_path_str.clone(),
        cover_letter_path: None,
        wait_for_confirmation: false,
        timeout_secs: 90,
        use_smart_apply: false,
        ..Default::default()
    };

    // Run application synchronously for reliability (browser automation)
    println!(
        "🚀 Starting application for job: {} at {}",
        job.title, job.company
    );

    let applicator = JobApplicator::with_config(config);
    let resume_ref = resume_path_str.as_deref();

    let app_result = applicator
        .apply_to_job(&job, &profile, resume_ref, None)
        .await;

    // Persist the application result to database
    match app_result {
        Ok(result) => {
            println!("✅ Application completed: {:?}", result);

            // Save to database
            if let Some(job_id_val) = job.id {
                let db_guard = state.db.lock().await;
                if let Some(db) = &*db_guard {
                    let conn = db.get_connection();
                    let status = if result.success {
                        crate::db::models::ApplicationStatus::Submitted
                    } else {
                        crate::db::models::ApplicationStatus::Preparing
                    };
                    let mut application = crate::db::models::Application {
                        id: None,
                        job_id: job_id_val,
                        applied_at: result.applied_at,
                        status: status.clone(),
                        notes: Some(format!(
                            "ATS: {:?}. Message: {}",
                            result.ats_type, result.message
                        )),
                        created_at: None,
                        updated_at: None,
                        ..Default::default()
                    };
                    match conn.create_application(&mut application) {
                        Ok(_) => {
                            println!(
                                "💾 Application saved to database with id: {:?}",
                                application.id
                            );

                            // Return success response
                            return (
                                StatusCode::CREATED,
                                Json(serde_json::json!({
                                    "status": "success",
                                    "job_id": job_id_val,
                                    "job_title": job.title,
                                    "job_company": job.company,
                                    "application_id": application.id,
                                    "result": {
                                        "success": result.success,
                                        "message": result.message,
                                        "ats_type": format!("{:?}", result.ats_type)
                                    }
                                })),
                            )
                                .into_response();
                        }
                        Err(e) => {
                            eprintln!("❌ Failed to save application to database: {}", e);
                        }
                    }
                }
            }

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "status": "completed",
                    "job_id": job.id,
                    "result": {
                        "success": result.success,
                        "message": result.message
                    },
                    "note": "Application completed but may not have been saved to database"
                })),
            )
        }
        Err(e) => {
            println!("❌ Application failed: {}", e);

            // Save failed attempt to database
            if let Some(job_id_val) = job.id {
                let db_guard = state.db.lock().await;
                if let Some(db) = &*db_guard {
                    let conn = db.get_connection();
                    let mut application = crate::db::models::Application {
                        id: None,
                        job_id: job_id_val,
                        applied_at: None,
                        status: crate::db::models::ApplicationStatus::Preparing,
                        notes: Some(format!("Failed: {}", e)),
                        applied_via: None,
                        created_at: None,
                        updated_at: None,
                        ..Default::default()
                    };
                    let _ = conn.create_application(&mut application);
                    println!("💾 Failed application attempt saved to database");
                }
            }

            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "status": "failed",
                    "job_id": job.id,
                    "error": e.to_string()
                })),
            )
        }
    }
    .into_response()
}

/// Create a test profile for testing
fn create_test_profile() -> UserProfile {
    UserProfile {
        personal_info: PersonalInfo {
            name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            phone: Some("+1-555-0123".to_string()),
            location: Some("Remote".to_string()),
            linkedin: None,
            github: None,
            portfolio: None,
        },
        summary: "Test user for auto-apply testing".to_string(),
        skills: SkillsProfile {
            technical_skills: vec![],
            soft_skills: vec![],
            experience_years: std::collections::HashMap::new(),
            proficiency_levels: std::collections::HashMap::new(),
        },
        experience: vec![],
        education: vec![],
        projects: vec![],
    }
}

// =============================================================================
// User Profile API
// =============================================================================

/// GET /api/profile - Get the current user profile
pub async fn get_profile(
    axum::extract::State(state): axum::extract::State<WebAppState>,
) -> axum::response::Response {
    let db_guard = state.db.lock().await;
    if let Some(db) = &*db_guard {
        let conn = db.get_connection();
        match conn.query_row(
            "SELECT profile_data FROM user_profile WHERE id = 1",
            [],
            |row| row.get::<_, String>(0),
        ) {
            Ok(json_str) => match serde_json::from_str::<UserProfile>(&json_str) {
                Ok(profile) => {
                    (StatusCode::OK, Json(ApiResponse { data: profile })).into_response()
                }
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiError::new(format!("Failed to parse profile: {}", e))),
                )
                    .into_response(),
            },
            Err(_) => {
                // Try to load from user_profile.json file
                let profile_path = std::path::Path::new("personas/user_profile.json");
                if profile_path.exists() {
                    match std::fs::read_to_string(profile_path) {
                        Ok(content) => match serde_json::from_str::<UserProfile>(&content) {
                            Ok(profile) => {
                                return (StatusCode::OK, Json(ApiResponse { data: profile }))
                                    .into_response();
                            }
                            Err(_) => {}
                        },
                        Err(_) => {}
                    }
                }
                // Fallback to test profile
                let empty_profile = create_test_profile();
                (
                    StatusCode::OK,
                    Json(ApiResponse {
                        data: empty_profile,
                    }),
                )
                    .into_response()
            }
        }
    } else {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new("No database".to_string())),
        )
            .into_response()
    }
}

/// PUT /api/profile - Update the user profile
pub async fn update_profile(
    axum::extract::State(state): axum::extract::State<WebAppState>,
    Json(profile): Json<UserProfile>,
) -> axum::response::Response {
    let db_guard = state.db.lock().await;
    if let Some(db) = &*db_guard {
        let conn = db.get_connection();
        let json_str = match serde_json::to_string(&profile) {
            Ok(s) => s,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ApiError::new(format!("Failed to serialize profile: {}", e))),
                )
                    .into_response();
            }
        };

        let now = chrono::Utc::now().to_rfc3339();
        match conn.execute(
            "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, ?2)",
            rusqlite::params![json_str, now],
        ) {
            Ok(_) => {
                println!("✅ User profile updated: {}", profile.personal_info.name);
                (
                    StatusCode::OK,
                    Json(serde_json::json!({
                        "status": "success",
                        "message": "Profile updated successfully"
                    })),
                )
                    .into_response()
            }
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(format!("Failed to save profile: {}", e))),
            )
                .into_response(),
        }
    } else {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new("No database".to_string())),
        )
            .into_response()
    }
}

// =============================================================================
// Matching API
// =============================================================================

/// Request body for matching jobs
#[derive(Deserialize)]
pub struct MatchRequest {
    profile: UserProfile,
    min_score: Option<f64>,
    limit: Option<usize>,
}

/// POST /api/match - Match jobs against a user profile
pub async fn match_jobs_handler(
    AxumState(state): AxumState<WebAppState>,
    Json(req): Json<MatchRequest>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    let jobs = match conn.list_jobs(None) {
        Ok(jobs) => jobs,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(format!("Failed to load jobs: {}", e))),
            )
                .into_response()
        }
    };

    // Calculate match scores
    let matcher = JobMatcher::new();
    let mut results: Vec<JobMatchResult> = jobs
        .iter()
        .map(|job| matcher.calculate_match(job, &req.profile))
        .collect();

    // Filter by minimum score if provided
    if let Some(min) = req.min_score {
        results.retain(|r| r.match_score >= min);
    }

    // Sort by score descending
    results.sort_by(|a, b| {
        b.match_score
            .partial_cmp(&a.match_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Limit results
    let limit = req.limit.unwrap_or(50).min(100);
    results.truncate(limit);

    (StatusCode::OK, Json(ApiResponse { data: results })).into_response()
}

// =============================================================================
// Router Builder
// =============================================================================

/// Create the Axum router with all API routes
pub fn create_router(state: WebAppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health check
        .route("/api/health", get(health_check))
        // Auth (for web mode)
        .route("/api/auth/status", get(auth_get_status))
        .route("/api/auth/setup", post(auth_setup))
        // User Profile
        .route("/api/profile", get(get_profile).put(update_profile))
        // Stats
        .route("/api/stats", get(get_stats))
        // Jobs CRUD
        .route("/api/jobs", get(list_jobs).post(create_job))
        .route(
            "/api/jobs/:id",
            get(get_job).put(update_job).delete(delete_job),
        )
        // Scrape jobs
        .route("/api/jobs/scrape", post(scrape_jobs_handler))
        // Applications CRUD
        .route(
            "/api/applications",
            get(list_applications).post(create_application),
        )
        .route(
            "/api/applications/:id",
            get(get_application).put(update_application),
        )
        // Auto-apply
        .route("/api/apply/auto", post(auto_apply_handler))
        // Direct apply to a specific job
        .route("/api/jobs/:id/apply", post(apply_to_job_handler))
        // Job matching
        .route("/api/match", post(match_jobs_handler))
        // Answer cache (extension sync)
        .route(
            "/api/answer-cache",
            get(list_answer_cache_handler).post(sync_answer_cache_handler),
        )
        .route(
            "/api/answer-cache/:key",
            delete(delete_answer_cache_handler),
        )
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// =============================================================================
// Answer Cache Handlers (for Chrome extension sync)
// =============================================================================

/// GET /api/answer-cache - List cached answers (optionally filtered by persona)
async fn list_answer_cache_handler(
    AxumState(state): AxumState<WebAppState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    let persona_id = params.get("persona_id").map(|s| s.as_str());
    match conn.list_answer_cache(persona_id) {
        Ok(entries) => (StatusCode::OK, Json(ApiResponse { data: entries })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(&format!(
                "Failed to list answer cache: {}",
                e
            ))),
        )
            .into_response(),
    }
}

/// POST /api/answer-cache/sync - Bulk upsert answers from the extension
async fn sync_answer_cache_handler(
    AxumState(state): AxumState<WebAppState>,
    Json(entries): Json<Vec<AnswerCacheEntry>>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    let mut upserted = 0;
    let mut errors = Vec::new();

    for entry in &entries {
        match conn.upsert_answer_cache(entry) {
            Ok(()) => upserted += 1,
            Err(e) => errors.push(format!("{}: {}", entry.normalized_key, e)),
        }
    }

    let result = serde_json::json!({
        "upserted": upserted,
        "total": entries.len(),
        "errors": errors,
    });

    (StatusCode::OK, Json(ApiResponse { data: result })).into_response()
}

/// DELETE /api/answer-cache/:key - Delete a single cached answer
async fn delete_answer_cache_handler(
    AxumState(state): AxumState<WebAppState>,
    Path(key): Path<String>,
) -> impl IntoResponse {
    let db_guard = state.db.lock().await;
    let db = match db_guard.as_ref() {
        Some(db) => db,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new("Database not initialized")),
            )
                .into_response()
        }
    };

    let conn = db.get_connection();
    match conn.delete_answer_cache(&key) {
        Ok(()) => (
            StatusCode::OK,
            Json(ApiResponse {
                data: serde_json::json!({ "deleted": key }),
            }),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(&format!("Failed to delete: {}", e))),
        )
            .into_response(),
    }
}

/// Start the web server
pub async fn run_server(db_path: &str, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let state = WebAppState::new(db_path);
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("🚀 Unhireable REST API starting on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_error_creation() {
        let err = ApiError::new("test error");
        assert_eq!(err.error, "test error");
    }
}

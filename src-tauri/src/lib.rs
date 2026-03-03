// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::Arc;
use tauri::{Manager, State};
use tokio::{sync::Mutex, task};

// Import trait implementations
use crate::db::queries::{ActivityQueries, ApplicationQueries, CredentialQueries, JobQueries};

pub mod applicator;
pub mod automation;
pub mod cache;
pub mod commands;
pub mod db;
pub mod error;
pub mod events;
pub mod generator;
pub mod insights;
pub mod intelligence;
pub mod logging;
pub mod matching;
// PostgreSQL migration temporarily disabled due to dependency conflicts
// #[cfg(feature = "postgres")]
// pub mod migration;
pub mod notifications;
pub mod persona;
pub mod queue;
pub mod recommendations;
pub mod resume_analyzer;
pub mod scheduler;
pub mod scraper;
pub mod scraper_queue;
pub mod security;
pub mod vault;
pub mod web_server;

use crate::applicator::{ApplicationConfig, ApplicationResult, JobApplicator};
use crate::db::Database;
use crate::error::Result;
use crate::scraper::browser::BrowserScraper;

// Application state structure
pub struct AppState {
    pub(crate) db: Arc<Mutex<Option<Database>>>,
    pub(crate) scheduler: Arc<Mutex<Option<scheduler::JobScheduler>>>,
    pub(crate) app_dir: Arc<Mutex<Option<std::path::PathBuf>>>,
    pub(crate) event_bus: Arc<events::EventBus>,
    pub(crate) cache: Arc<cache::Cache<String, serde_json::Value>>,
    pub(crate) document_cache: Arc<Mutex<generator::DocumentCache>>,
    /// Priority queue for background scraping jobs
    pub(crate) queue_manager: Arc<queue::QueueManager>,
    /// Sliding-window rate limiter for Tauri commands that hit external services
    pub(crate) rate_limiter: Arc<security::RateLimiter>,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            db: Arc::new(Mutex::new(None)),
            scheduler: Arc::new(Mutex::new(None)),
            app_dir: Arc::new(Mutex::new(None)),
            event_bus: Arc::new(events::EventBus::new()),
            cache: Arc::new(cache::Cache::new(std::time::Duration::from_secs(3600))),
            document_cache: Arc::new(Mutex::new(generator::DocumentCache::new(100, Some(86400)))), // 100 entries, 24h TTL
            queue_manager: Arc::new(queue::QueueManager::new()),
            rate_limiter: Arc::new(security::RateLimiter::new(100, 60)),
        }
    }
}

// Initialize the application state
async fn setup_app_state(app: &mut tauri::App) -> Result<()> {
    // Initialize logging
    if std::env::var("RUST_LOG").is_err() {
        crate::logging::init_console_logging();
    } else {
        crate::logging::init_logging();
    }

    tracing::info!("Application starting up");

    // Get the app data directory (using "unhireable" as the app name)
    let app_dir = app.path().app_data_dir().map_err(|_| {
        crate::error::Error::Custom("Could not find application data directory".to_string())
    })?;

    // Create the directory if it doesn't exist
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)?;
    }

    // Initialize the database (SQLite only - PostgreSQL support disabled due to dependency conflicts)
    let db = {
        if std::env::var("DATABASE_URL").is_ok() {
            tracing::warn!("DATABASE_URL set but postgres feature not enabled, using SQLite");
        }
        tracing::info!("Using SQLite database");
        let db_path = app_dir.join("jobhunter.db");
        Database::new(db_path)?
    };

    // Get the state to set up event handlers
    let state: State<AppState> = app.state();

    // Initialize Intelligence Agent and Event Handler
    let intelligence_agent = Arc::new(intelligence::IntelligenceAgent::default());
    let matcher = Arc::new(matching::JobMatcher::new());
    let event_bus = state.event_bus.clone();
    let db_for_intelligence = Arc::clone(&state.db);

    let intelligence_handler = Arc::new(intelligence::IntelligenceEventHandler::new(
        intelligence_agent,
        matcher,
        state.cache.clone(),
        event_bus.clone(),
        db_for_intelligence,
    ));

    // Initialize Intelligence event handler (subscribes to JOB_CREATED)
    intelligence_handler.initialize().await?;
    tracing::info!("Intelligence Agent event handler initialized");

    // Start background scraper queue worker
    let scraping_queue = state.queue_manager.get_queue("scraping").await;
    let worker = Arc::new(scraper_queue::ScraperQueueWorker::new(
        scraping_queue,
        state.event_bus.clone(),
        Arc::clone(&state.db),
    ));
    worker.start().await?;
    tracing::info!("Scraper queue worker started");

    let event_bus = state.event_bus.clone();
    event_bus
        .subscribe(
            events::event_types::SCRAPER_COMPLETED.to_string(),
            |event| {
                tracing::info!("Scraper completed event: {:?}", event);
                Ok(())
            },
        )
        .await;

    // Subscribe to APPLICATION_CREATED for automatic document generation
    let document_event_bus = state.event_bus.clone();
    let db_clone = Arc::clone(&state.db);
    let cache = Arc::new(Mutex::new(generator::DocumentCache::new(100, Some(86400)))); // 100 entries, 24h TTL
    let handler_arc = Arc::new(generator::DocumentGenerationEventHandler::new(
        cache.clone(),
        document_event_bus.clone(),
    ));

    document_event_bus
        .subscribe(
            events::event_types::APPLICATION_CREATED.to_string(),
            move |event| {
                let handler = handler_arc.clone();
                let db = db_clone.clone();
                let event_owned = event.clone();

                // Spawn async task to handle document generation
                tokio::spawn(async move {
                    let db_for_application = db.clone();
                    let get_application = move |app_id: i64| -> anyhow::Result<
                        Option<crate::db::models::Application>,
                    > {
                        let db_clone = db_for_application.clone();
                        tokio::runtime::Handle::current().block_on(async {
                            let db = db_clone.lock().await;
                            if let Some(db) = &*db {
                                let conn = db.get_connection();
                                conn.get_application(app_id)
                                    .map_err(|e| anyhow::anyhow!("{}", e))
                            } else {
                                Err(anyhow::anyhow!("Database not initialized"))
                            }
                        })
                    };

                    let db_for_job = db.clone();
                    let get_job =
                        move |job_id: i64| -> anyhow::Result<Option<crate::db::models::Job>> {
                            let db_clone = db_for_job.clone();
                            tokio::runtime::Handle::current().block_on(async {
                                let db = db_clone.lock().await;
                                if let Some(db) = &*db {
                                    let conn = db.get_connection();
                                    conn.get_job(job_id).map_err(|e| anyhow::anyhow!("{}", e))
                                } else {
                                    Err(anyhow::anyhow!("Database not initialized"))
                                }
                            })
                        };

                    let db_for_profile = db.clone();
                    let get_profile = move || -> anyhow::Result<Option<generator::UserProfile>> {
                        let db_clone = db_for_profile.clone();
                        tokio::runtime::Handle::current().block_on(async {
                            let db = db_clone.lock().await;
                            if let Some(db) = &*db {
                                let conn = db.get_connection();
                                commands::user::load_user_profile_from_conn(&conn)
                                    .map_err(|e| anyhow::anyhow!("{}", e))
                            } else {
                                Err(anyhow::anyhow!("Database not initialized"))
                            }
                        })
                    };

                    let db_for_api = db.clone();
                    let get_api_key =
                        move || -> anyhow::Result<Option<String>> {
                            let db_clone = db_for_api.clone();
                            tokio::runtime::Handle::current().block_on(async {
                                let db = db_clone.lock().await;
                                if let Some(db) = &*db {
                                    let conn = db.get_connection();
                                    Ok(conn.get_credential("openai").ok().flatten().and_then(
                                        |cred| cred.tokens.as_deref().map(|s| s.to_string()),
                                    ))
                                } else {
                                    Err(anyhow::anyhow!("Database not initialized"))
                                }
                            })
                        };

                    if let Err(e) = handler
                        .handle_application_created(
                            &event_owned,
                            get_application,
                            get_job,
                            get_profile,
                            get_api_key,
                        )
                        .await
                    {
                        tracing::error!("Failed to handle APPLICATION_CREATED event: {}", e);
                    }
                });

                Ok(())
            },
        )
        .await;

    // Store everything in the app state
    let state: State<AppState> = app.state();
    *state.db.lock().await = Some(db);
    *state.app_dir.lock().await = Some(app_dir.clone());

    // Start the Axum REST API server so the Chrome extension can connect on port 3030
    let server_db_path = app_dir.join("jobhunter.db");
    let server_db_str = server_db_path.to_string_lossy().to_string();
    tokio::spawn(async move {
        let port: u16 = std::env::var("UNHIREABLE_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(3030);
        tracing::info!("Starting REST API server on port {}", port);
        if let Err(e) = crate::web_server::run_server(&server_db_str, port).await {
            tracing::error!("REST API server exited: {}", e);
        }
    });

    tracing::info!("Application state initialized successfully");
    Ok(())
}

// Helper function to log activity
fn log_activity(
    conn: &std::sync::MutexGuard<'_, rusqlite::Connection>,
    entity_type: &str,
    entity_id: i64,
    action: &str,
    description: Option<String>,
    metadata: Option<String>,
) -> Result<()> {
    let mut activity = db::models::Activity {
        id: None,
        entity_type: entity_type.to_string(),
        entity_id,
        action: action.to_string(),
        description,
        metadata,
        created_at: None,
    };
    conn.create_activity(&mut activity)?;
    Ok(())
}

// Generate sample/demo jobs for testing and fallback

// Recommendation & Insights Commands
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct AutomationHealthReport {
    profile_configured: bool,
    missing_fields: Vec<String>,
    resume_documents: usize,
    credential_platforms: Vec<String>,
    chromium_available: bool,
    playwright_available: bool,
}

#[tauri::command]
async fn automation_health_check(state: State<'_, AppState>) -> Result<AutomationHealthReport> {
    // Get app_dir path first (before database work)
    let app_dir_path = {
        let app_dir_guard = state.app_dir.lock().await;
        app_dir_guard.clone()
    };

    // Now do all database work
    let (profile_configured, missing_fields, db_resume_count, credential_platforms) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let profile = commands::user::load_user_profile_from_conn(&conn)?;
            let mut missing_fields = Vec::new();
            let mut profile_configured = false;

            if let Some(profile) = profile.as_ref() {
                profile_configured = true;
                if profile.personal_info.name.trim().is_empty() {
                    missing_fields.push("name".to_string());
                }
                if profile.personal_info.email.trim().is_empty() {
                    missing_fields.push("email".to_string());
                }
                if profile.summary.trim().is_empty() {
                    missing_fields.push("summary".to_string());
                }
            } else {
                missing_fields.push("profile".to_string());
            }

            // Count resume documents from database
            let db_resume_count = conn
                .query_row(
                    "SELECT COUNT(*) FROM documents WHERE document_type = 'resume'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap_or(0)
                .max(0) as usize;

            let credential_platforms = conn
                .list_credentials(true)?
                .into_iter()
                .map(|cred| cred.platform)
                .collect();

            (
                profile_configured,
                missing_fields,
                db_resume_count,
                credential_platforms,
            )
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    // Check for persona resume files in the file system (no await needed now)
    let mut file_resume_count = 0;
    if let Some(app_dir) = app_dir_path {
        let personas_dir = app_dir.join("personas");
        if personas_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&personas_dir) {
                for entry in entries.flatten() {
                    let persona_dir = entry.path();
                    if persona_dir.is_dir() {
                        // Check for common resume file names
                        let resume_files = [
                            persona_dir.join("resume.md"),
                            persona_dir.join("resume.pdf"),
                            persona_dir.join("resume.txt"),
                            persona_dir.join("resume.docx"),
                        ];
                        for resume_file in &resume_files {
                            if resume_file.exists() {
                                file_resume_count += 1;
                                break; // Count each persona once
                            }
                        }
                    }
                }
            }
        }
    }

    let resume_documents = db_resume_count + file_resume_count;

    Ok(AutomationHealthReport {
        profile_configured,
        missing_fields,
        resume_documents,
        credential_platforms,
        chromium_available: BrowserScraper::is_chromium_available(),
        playwright_available: BrowserScraper::is_playwright_available(),
    })
}

// Scheduler Commands

// Auto-apply command
#[derive(serde::Serialize)]
pub struct AutoApplyResult {
    pub jobs_scraped: usize,
    pub jobs_filtered: usize,
    pub applications_submitted: usize,
    pub applications_failed: usize,
    pub results: Vec<ApplicationResult>,
}

pub async fn run_auto_apply_logic(
    db: Arc<Mutex<Option<Database>>>,
    app_dir: std::path::PathBuf,
    query: String,
    max_applications: usize,
    dry_run: bool,
) -> Result<AutoApplyResult> {
    println!("🚀 Starting auto-apply process (Dry Run: {})", dry_run);

    // Step 1: Get user profile
    let db_guard = db.lock().await;
    let profile = if let Some(db) = &*db_guard {
        let conn = db.get_connection();
        let profile = commands::user::load_user_profile_from_conn(&conn)?;
        if let Some(profile) = profile {
            profile
        } else {
            return Err(anyhow::anyhow!(
                "User profile not found. Please configure your profile in Settings."
            )
            .into());
        }
    } else {
        return Err(anyhow::anyhow!("Database not initialized").into());
    };
    drop(db_guard); // Release lock early

    // Step 2: Scrape jobs (disable enrichment for speed - we'll filter first)
    println!("📡 Scraping jobs for: {}", query);

    // Disable auto-enrichment to speed up scraping - we'll filter jobs first
    let mut scraper_config = scraper::config::ScraperConfig::default();
    scraper_config.auto_enrich = false; // Skip enrichment to avoid getting stuck
    let scraper = scraper::ScraperManager::with_config(scraper_config);
    let jobs = task::spawn_blocking(move || scraper.scrape_all(&query))
        .await
        .map_err(|e| anyhow::anyhow!("Task join error: {}", e))?
        .map_err(|e| anyhow::anyhow!("Scraping failed: {}", e))?;

    let jobs_count = jobs.len();
    println!("✅ Scraped {} jobs from all sources", jobs_count);

    // Step 3: Filter jobs (remote, mid-senior, $30k+)
    let filtered_jobs: Vec<_> = jobs
        .into_iter()
        .filter(|job| {
            // Skip hh.kz jobs - they're mostly Russian jobs that don't match remote criteria
            if job.source.eq_ignore_ascii_case("hh.kz") {
                return false;
            }

            // Check if remote
            let is_remote = job
                .location
                .as_ref()
                .map(|loc| {
                    let loc_lower = loc.to_lowercase();
                    loc_lower.contains("remote") || loc_lower.contains("anywhere")
                })
                .unwrap_or(false)
                || job.title.to_lowercase().contains("remote");

            // Check if mid-senior level
            let is_mid_senior = job.title.to_lowercase().contains("senior")
                || job.title.to_lowercase().contains("staff")
                || job.title.to_lowercase().contains("lead")
                || job.title.to_lowercase().contains("engineer")
                || job.title.to_lowercase().contains("developer");

            // Check salary (if available) - at least $30k
            let salary_ok = job
                .salary
                .as_ref()
                .map(|s| {
                    // Extract numbers from salary string
                    let numbers: Vec<f64> = regex::Regex::new(r"\$?([\d,]+)")
                        .expect("Failed to compile salary regex pattern")
                        .find_iter(s)
                        .filter_map(|m| {
                            m.as_str()
                                .replace("$", "")
                                .replace(",", "")
                                .parse::<f64>()
                                .ok()
                        })
                        .collect();
                    numbers.is_empty() || numbers.iter().any(|&n| n >= 30000.0)
                })
                .unwrap_or(true); // If no salary info, assume OK

            is_remote && is_mid_senior && salary_ok
        })
        .take(max_applications)
        .collect();

    let filtered_count = filtered_jobs.len();
    println!("🎯 Filtered to {} relevant jobs", filtered_count);

    if filtered_count == 0 {
        println!("⚠️  No jobs to apply to after filtering");
        return Ok(AutoApplyResult {
            jobs_scraped: jobs_count,
            jobs_filtered: 0,
            applications_submitted: 0,
            applications_failed: 0,
            results: Vec::new(),
        });
    }

    // Step 4: Save jobs to database and apply
    println!("📋 Preparing to apply to {} jobs...", filtered_count);
    let mut applications_submitted = 0;
    let mut applications_failed = 0;
    let mut results = Vec::new();

    println!("📁 Getting application directory...");

    // Find resume file - look for any PDF in app dir
    let mut resume_path = app_dir.join("resume.pdf"); // Default
    let mut found_resume = false;

    // First check if specific file exists
    if resume_path.exists() {
        found_resume = true;
    } else {
        // Search for any PDF
        if let Ok(entries) = std::fs::read_dir(&app_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext.eq_ignore_ascii_case("pdf") {
                        resume_path = path;
                        found_resume = true;
                        break;
                    }
                }
            }
        }
    }

    if !found_resume {
        // Try dev environment fallback (if UNHIREABLE_DEV_RESUME_PATH is set)
        if let Ok(dev_resume_path) = std::env::var("UNHIREABLE_DEV_RESUME_PATH") {
            let project_resume = std::path::Path::new(&dev_resume_path);
            if project_resume.exists() {
                println!("📋 Copying resume from dev path to app directory...");
                let target_path = app_dir.join("resume.pdf");
                if let Err(e) = std::fs::copy(project_resume, &target_path) {
                    tracing::warn!("Failed to copy dev resume: {}", e);
                } else {
                    resume_path = target_path;
                    println!("✅ Resume copied successfully");
                    found_resume = true;
                }
            }
        }

        if !found_resume {
            return Err(anyhow::anyhow!(
                "No resume found. Please upload a PDF resume in Settings or set UNHIREABLE_DEV_RESUME_PATH for development."
            )
            .into());
        }
    }

    println!("✅ Using resume: {:?}", resume_path);
    let resume_path_str = resume_path.to_string_lossy().to_string();
    println!(
        "🚀 Starting application loop for {} jobs...",
        filtered_count
    );

    for (idx, job) in filtered_jobs.iter().enumerate() {
        println!(
            "📝 [{}/{}] Processing: {} at {}",
            idx + 1,
            filtered_count,
            job.title,
            job.company
        );
        // Save job to database first
        let job_id = {
            let db_guard = db.lock().await;
            if let Some(db) = &*db_guard {
                let conn = db.get_connection();

                // Check if job already exists
                match conn.get_job_by_url(&job.url) {
                    Ok(Some(existing_job)) => {
                        println!("⏭️  Job already exists: {}", job.title);
                        existing_job.id
                    }
                    Ok(None) => {
                        let mut new_job = job.clone();
                        match conn.create_job(&mut new_job) {
                            Ok(_) => {
                                println!("💾 Saved job to database: {}", new_job.title);
                                new_job.id
                            }
                            Err(e) => {
                                eprintln!("❌ Failed to save job: {}", e);
                                continue;
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("❌ Error checking job: {}", e);
                        continue;
                    }
                }
            } else {
                continue;
            }
        };

        if let Some(job_id_val) = job_id {
            // Apply to job
            println!("📝 Applying to: {} at {}", job.title, job.company);

            let config = ApplicationConfig {
                auto_submit: !dry_run, // Don't auto-submit in dry run
                upload_resume: true,
                upload_cover_letter: false, // Start without cover letter for simplicity
                resume_path: Some(resume_path_str.clone()),
                cover_letter_path: None,
                wait_for_confirmation: false,
                timeout_secs: 120,
                ..Default::default()
            };

            let applicator = JobApplicator::with_config(config);

            let result = if dry_run {
                println!("🧪 Dry Run: Simulating application to {}", job.title);
                // Simulate delay
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                ApplicationResult {
                    success: true,
                    application_id: None,
                    message: "Dry run simulation successful".to_string(),
                    applied_at: Some(chrono::Utc::now()),
                    ats_type: Some("DryRun".to_string()),
                    errors: vec![],
                }
            } else {
                match applicator
                    .apply_to_job(&job, &profile, Some(&resume_path_str), None)
                    .await
                {
                    Ok(res) => res,
                    Err(e) => ApplicationResult {
                        success: false,
                        application_id: None,
                        message: format!("Error: {}", e),
                        applied_at: None,
                        ats_type: None,
                        errors: vec![e.to_string()],
                    },
                }
            };

            if result.success {
                applications_submitted += 1;
                println!("✅ Successfully applied to: {}", job.title);

                // Create application record
                let db_guard = db.lock().await;
                if let Some(db) = &*db_guard {
                    let conn = db.get_connection();
                    let mut application = db::models::Application {
                        id: None,
                        job_id: job_id_val,
                        applied_at: Some(chrono::Utc::now()),
                        status: db::models::ApplicationStatus::Submitted,
                        notes: Some(format!(
                            "Auto-applied via RemoteOK. ATS: {:?}",
                            result.ats_type
                        )),
                        created_at: None,
                        updated_at: None,
                        ..Default::default()
                    };
                    if let Ok(_) = conn.create_application(&mut application) {
                        if let Some(app_id) = application.id {
                            let _ = log_activity(
                                &conn,
                                "application",
                                app_id,
                                "created",
                                Some(format!(
                                    "Auto-applied to '{}' at {}",
                                    job.title, job.company
                                )),
                                None,
                            );
                        }
                    }
                }
            } else {
                applications_failed += 1;
                println!("❌ Failed to apply to: {} - {}", job.title, result.message);
            }
            results.push(result);

            // Small delay between applications
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        }
    }

    println!(
        "🎉 Auto-apply complete! Submitted: {}, Failed: {}",
        applications_submitted, applications_failed
    );

    Ok(AutoApplyResult {
        jobs_scraped: jobs_count,
        jobs_filtered: filtered_count,
        applications_submitted,
        applications_failed,
        results,
    })
}

#[tauri::command]
async fn auto_apply_to_jobs(
    state: State<'_, AppState>,
    query: Option<String>,
    max_applications: Option<usize>,
    dry_run: Option<bool>,
) -> Result<AutoApplyResult> {
    let app_dir = state
        .app_dir
        .lock()
        .await
        .clone()
        .ok_or_else(|| anyhow::anyhow!("Application data directory not initialized"))?;

    run_auto_apply_logic(
        state.db.clone(),
        app_dir,
        query.unwrap_or_else(|| "remote senior backend engineer".to_string()),
        max_applications.unwrap_or(10),
        dry_run.unwrap_or(false),
    )
    .await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize application state
            let app_state = AppState::default();
            app.manage(app_state);

            // Set up the application
            tauri::async_runtime::block_on(async {
                if let Err(e) = setup_app_state(app).await {
                    eprintln!("Failed to set up application: {}", e);
                    std::process::exit(1);
                }
                Ok(())
            })
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            // Job commands
            commands::jobs::get_jobs,
            commands::jobs::get_job,
            commands::jobs::create_job,
            commands::jobs::update_job,
            commands::jobs::delete_job,
            commands::jobs::scrape_jobs,
            commands::jobs::scrape_jobs_selected,
            // Application commands
            commands::applications::get_applications,
            commands::applications::create_application,
            commands::applications::update_application,
            commands::applications::delete_application,
            // Contact commands
            commands::entities::get_contacts,
            commands::entities::create_contact,
            commands::entities::update_contact,
            commands::entities::delete_contact,
            // Interview commands
            commands::entities::get_interviews,
            commands::entities::create_interview,
            commands::entities::update_interview,
            commands::entities::delete_interview,
            // Document commands
            commands::entities::get_documents,
            commands::entities::create_document,
            commands::entities::update_document,
            commands::entities::delete_document,
            // Activity commands
            commands::user::get_activities,
            // Credential commands
            commands::user::get_credential,
            commands::user::create_credential,
            commands::user::update_credential,
            commands::user::list_credentials,
            commands::user::delete_credential,
            // User Profile commands
            commands::user::save_user_profile,
            commands::user::get_user_profile,
            // Authentication commands
            commands::user::auth_get_status,
            commands::user::auth_setup,
            commands::user::auth_login,
            commands::user::auth_logout,
            // Document Generation commands
            commands::documents::generate_resume,
            commands::documents::generate_cover_letter,
            commands::documents::generate_email_version,
            commands::documents::export_document_to_pdf,
            commands::documents::get_available_resume_templates,
            commands::documents::get_available_cover_letter_templates,
            commands::documents::analyze_job_for_profile,
            // Enhanced Generation Agent commands
            commands::documents::optimize_document_for_ats,
            commands::documents::check_ats_compatibility,
            commands::documents::score_document_quality,
            commands::documents::list_ai_providers,
            commands::documents::generate_resume_with_provider,
            commands::documents::create_document_version,
            commands::documents::get_document_versions,
            commands::documents::restore_document_version,
            // Job Matching commands
            commands::matching::calculate_job_match_score,
            commands::matching::match_jobs_for_profile,
            commands::matching::update_job_match_scores,
            // Recommendation & Insights commands
            commands::matching::get_recommended_jobs,
            commands::matching::get_trending_jobs,
            commands::matching::get_similar_jobs,
            commands::matching::track_job_interaction,
            commands::documents::get_resume_environment_status,
            commands::matching::get_market_insights,
            automation_health_check,
            // Email Notification commands
            commands::notifications::test_email_connection,
            commands::notifications::send_test_email,
            commands::notifications::send_job_match_email_with_result,
            commands::notifications::send_new_jobs_notification_email,
            commands::notifications::extract_emails_from_jobs,
            commands::notifications::create_contacts_from_jobs,
            // Desktop Notification commands
            commands::notifications::send_desktop_notification,
            commands::notifications::send_desktop_job_match,
            commands::notifications::send_desktop_new_jobs,
            commands::notifications::send_desktop_application_status,
            commands::notifications::send_desktop_application_success,
            commands::notifications::request_notification_permission,
            // Scheduler Commands
            commands::scheduler::get_scheduler_config,
            commands::scheduler::update_scheduler_config,
            commands::scheduler::start_scheduler,
            commands::scheduler::stop_scheduler,
            commands::scheduler::get_scheduler_status,
            // Persona commands
            commands::persona::list_personas_catalog,
            commands::persona::load_test_persona,
            commands::persona::persona_dry_run,
            // ATS Suggestions
            commands::system::get_ats_suggestions,
            // Resume Analysis
            commands::documents::analyze_resume,
            // Auto-apply command
            auto_apply_to_jobs,
            // Automation Pipeline commands
            commands::automation::init_automation,
            commands::automation::run_automation_pipeline,
            commands::automation::run_automation_with_config,
            commands::automation::get_automation_status,
            commands::automation::get_automation_config,
            commands::automation::update_automation_config,
            commands::automation::stop_automation,
            commands::automation::is_automation_running,
            commands::automation::quick_start_automation,
            commands::automation::get_default_automation_config,
            // Auto-pilot commands (full end-to-end automation)
            commands::automation::init_autopilot,
            commands::automation::start_autopilot,
            commands::automation::stop_autopilot,
            commands::automation::get_autopilot_status,
            commands::automation::get_autopilot_config,
            commands::automation::update_autopilot_config,
            commands::automation::autopilot_run_now,
            commands::automation::process_email,
            commands::automation::get_default_autopilot_config,
            commands::automation::dismiss_autopilot_alert,
            // Apply mode commands
            commands::automation::get_apply_modes,
            commands::automation::get_current_apply_mode,
            commands::automation::set_apply_mode,
            commands::automation::check_apply_compatibility,
            // Email monitoring commands
            commands::automation::check_emails,
            commands::automation::get_email_monitor_status,
            commands::automation::classify_email,
            // Testing commands
            commands::testing::run_system_tests,
            commands::testing::test_automation_pipeline,
            commands::testing::test_email_sending,
            commands::testing::test_classify_email,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

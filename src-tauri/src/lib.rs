// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::str::FromStr;
use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::Mutex;

// Import trait implementations
use crate::db::queries::{JobQueries, ContactQueries, InterviewQueries, DocumentQueries, ApplicationQueries, ActivityQueries, CredentialQueries};

pub mod db;
pub mod error;
pub mod scraper;
pub mod generator;

use crate::db::Database;
use crate::error::Result;

// Application state structure
#[derive(Default)]
pub struct AppState {
    db: Arc<Mutex<Option<Database>>>,
}

// Initialize the application state
async fn setup_app_state(app: &mut tauri::App) -> Result<()> {
    // Get the app data directory
    let app_dir = app.path().app_data_dir().map_err(|_| {
        crate::error::Error::Custom("Could not find application data directory".to_string())
    })?;

    // Create the directory if it doesn't exist
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)?;
    }

    // Initialize the database
    let db_path = app_dir.join("jobhunter.db");
    let db = Database::new(db_path)?;

    // Store the database in the app state
    let state: State<AppState> = app.state();
    *state.db.lock().await = Some(db);

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

// Job Commands
#[tauri::command]
async fn get_jobs(
    state: State<'_, AppState>,
    status: Option<String>,
    query: Option<String>,
    page: Option<usize>,
    page_size: Option<usize>,
) -> Result<Vec<db::models::Job>> {
    println!("get_jobs called with status={:?}, query={:?}, page={:?}, page_size={:?}", status, query, page, page_size);
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let status = status
            .as_deref()
            .and_then(|s| db::models::JobStatus::from_str(s).ok());
        
        println!("Fetching jobs from database with status filter: {:?}", status);
        let mut jobs = conn.list_jobs(status)
            .map_err(|e| {
                eprintln!("Error listing jobs: {}", e);
                e
            })?;
        
        println!("Found {} jobs in database", jobs.len());
        
        // Apply search query if provided
        if let Some(query) = query {
            let query_lower = query.to_lowercase();
            let initial_count = jobs.len();
            jobs.retain(|job| {
                job.title.to_lowercase().contains(&query_lower) ||
                job.company.to_lowercase().contains(&query_lower) ||
                job.description.as_ref().map_or(false, |d| d.to_lowercase().contains(&query_lower)) ||
                job.requirements.as_ref().map_or(false, |r| r.to_lowercase().contains(&query_lower))
            });
            println!("After search filter '{}': {} jobs (filtered from {})", query, jobs.len(), initial_count);
        }
        // Pagination - if no page_size specified, return all jobs
        let total_jobs = jobs.len();
        let result = if let Some(ps) = page_size {
            let p = page.unwrap_or(1).max(1);
            let start = (p - 1) * ps;
            let end = start + ps;
            if start >= total_jobs { 
                vec![] 
            } else { 
                jobs[start..total_jobs.min(end)].to_vec() 
            }
        } else {
            // No pagination - return all jobs
            jobs.clone()
        };
        println!("Returning {} jobs (out of {} total)", result.len(), total_jobs);
        Ok(result)
    } else {
        eprintln!("ERROR: Database not initialized in get_jobs");
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn get_job(state: State<'_, AppState>, id: i64) -> Result<Option<db::models::Job>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.get_job(id).map_err(Into::into)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn create_job(
    state: State<'_, AppState>,
    mut job: db::models::Job,
) -> Result<db::models::Job> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.create_job(&mut job)?;
        
        // Log activity
        if let Some(job_id) = job.id {
            let description = format!("Job '{}' at {} was created", job.title, job.company);
            log_activity(&conn, "job", job_id, "created", Some(description), None)?;
        }
        
        Ok(job)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn update_job(
    state: State<'_, AppState>,
    job: db::models::Job,
) -> Result<db::models::Job> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        
        // Get old job to check for status changes
        let old_job = if let Some(job_id) = job.id {
            conn.get_job(job_id).ok().flatten()
        } else {
            None
        };
        
        conn.update_job(&job)?;
        
        // Log activity
        if let Some(job_id) = job.id {
            let action = if let Some(old) = old_job {
                if old.status != job.status {
                    // Status changed
                    let metadata = serde_json::json!({
                        "old_status": old.status.to_string(),
                        "new_status": job.status.to_string()
                    }).to_string();
                    log_activity(&conn, "job", job_id, "status_changed", 
                        Some(format!("Job '{}' status changed from {} to {}", job.title, old.status, job.status)),
                        Some(metadata))?;
                    return Ok(job);
                }
                "updated"
            } else {
                "updated"
            };
            
            let description = format!("Job '{}' at {} was updated", job.title, job.company);
            log_activity(&conn, "job", job_id, action, Some(description), None)?;
        }
        
        Ok(job)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn delete_job(state: State<'_, AppState>, id: i64) -> Result<()> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        
        // Get job info before deleting for activity log
        let job_info = conn.get_job(id).ok().flatten();
        
        conn.delete_job(id)?;
        
        // Log activity
        if let Some(job) = job_info {
            let description = format!("Job '{}' at {} was deleted", job.title, job.company);
            log_activity(&conn, "job", id, "deleted", Some(description), None)?;
        }
        
        Ok(())
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn scrape_jobs(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<db::models::Job>> {
    println!("Starting scrape_jobs with query: '{}'", query);
    
    // Check for Firecrawl API key from environment or credentials
    let mut scraper = scraper::ScraperManager::new();
    
    // Try to get Firecrawl API key from credentials if available
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        if let Ok(Some(credential)) = conn.get_credential("firecrawl") {
            if let Some(api_key) = credential.tokens.as_deref() {
                // Parse JSON token if stored as JSON
                if let Ok(tokens) = serde_json::from_str::<serde_json::Value>(api_key) {
                    if let Some(key) = tokens.get("api_key").and_then(|v| v.as_str()) {
                        scraper.set_firecrawl_key(key.to_string());
                        println!("Firecrawl API key loaded from credentials");
                    }
                } else {
                    // Assume it's API key directly
                    scraper.set_firecrawl_key(api_key.to_string());
                    println!("Firecrawl API key loaded from credentials (direct)");
                }
            }
        }
    }
    drop(db);
    
    println!("Calling scraper.scrape_all...");
    let mut jobs = scraper.scrape_all(&query)
        .map_err(|e| {
            eprintln!("Scraper error: {}", e);
            anyhow::anyhow!("Scraping failed: {}", e)
        })?;
    
    println!("Scraped {} jobs, saving to database...", jobs.len());
    
    // Save scraped jobs to database
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let mut saved_count = 0;
        for job in &mut jobs {
            // Skip if job with same URL already exists
            match conn.get_job_by_url(&job.url) {
                Ok(Some(_)) => {
                    // Job already exists, skip
                    continue;
                }
                Ok(None) => {
                    // Job doesn't exist, create it
                    match conn.create_job(job) {
                        Ok(_) => {
                            saved_count += 1;
                            // Log activity for scraped jobs
                            if let Some(job_id) = job.id {
                                let description = format!("Job '{}' at {} was scraped from {}", job.title, job.company, job.source);
                                let _ = log_activity(&conn, "job", job_id, "created", Some(description), Some(format!(r#"{{"source": "scraped", "source_name": "{}"}}"#, job.source)));
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to save job {}: {}", job.title, e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error checking if job exists: {}", e);
                }
            }
        }
        println!("Saved {} new jobs to database", saved_count);
    }
    
    println!("Returning {} jobs", jobs.len());
    Ok(jobs)
}

#[tauri::command]
async fn scrape_jobs_selected(
    state: State<'_, AppState>,
    sources: Vec<String>,
    query: Option<String>,
) -> Result<Vec<db::models::Job>> {
    let query_str = query.as_deref().unwrap_or("");
    println!("Starting scrape_jobs_selected with sources: {:?}, query: '{}'", sources, query_str);
    
    // Check for Firecrawl API key from environment or credentials
    let mut scraper = scraper::ScraperManager::new();
    
    // Try to get Firecrawl API key from credentials if available
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        if let Ok(Some(credential)) = conn.get_credential("firecrawl") {
            if let Some(api_key) = credential.tokens.as_deref() {
                // Parse JSON token if stored as JSON
                if let Ok(tokens) = serde_json::from_str::<serde_json::Value>(api_key) {
                    if let Some(key) = tokens.get("api_key").and_then(|v| v.as_str()) {
                        scraper.set_firecrawl_key(key.to_string());
                        println!("Firecrawl API key loaded from credentials");
                    }
                } else {
                    // Assume it's the API key directly
                    scraper.set_firecrawl_key(api_key.to_string());
                    println!("Firecrawl API key loaded from credentials (direct)");
                }
            }
        }
    }
    drop(db);
    
    println!("Calling scraper.scrape_selected...");
    let mut jobs = scraper.scrape_selected(&sources, query_str)
        .map_err(|e| {
            eprintln!("Scraper error: {}", e);
            anyhow::anyhow!("Scraping failed: {}", e)
        })?;
    
    println!("Scraped {} jobs, saving to database...", jobs.len());
    
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let mut saved_count = 0;
        for job in &mut jobs {
            match conn.get_job_by_url(&job.url) {
                Ok(Some(_)) => {
                    // Job already exists, skip
                    continue;
                }
                Ok(None) => {
                    // Job doesn't exist, create it
                    match conn.create_job(job) {
                        Ok(_) => {
                            saved_count += 1;
                            // Log activity for scraped jobs
                            if let Some(job_id) = job.id {
                                let description = format!("Job '{}' at {} was scraped from {}", job.title, job.company, job.source);
                                let _ = log_activity(&conn, "job", job_id, "created", Some(description), Some(format!(r#"{{"source": "scraped", "source_name": "{}"}}"#, job.source)));
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to save job {}: {}", job.title, e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error checking if job exists: {}", e);
                }
            }
        }
        println!("Saved {} new jobs to database", saved_count);
    }
    
    println!("Returning {} jobs", jobs.len());
    Ok(jobs)
}

// Contact Commands
#[tauri::command]
async fn get_contacts(
    state: State<'_, AppState>,
    job_id: Option<i64>,
) -> Result<Vec<db::models::Contact>> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.list_contacts(job_id)?)
}

#[tauri::command]
async fn create_contact(
    state: State<'_, AppState>,
    mut contact: db::models::Contact,
) -> Result<db::models::Contact> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.create_contact(&mut contact)?;
    Ok(contact)
}

#[tauri::command]
async fn update_contact(
    state: State<'_, AppState>,
    contact: db::models::Contact,
) -> Result<db::models::Contact> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.update_contact(&contact)?;
    Ok(contact)
}

#[tauri::command]
async fn delete_contact(
    state: State<'_, AppState>,
    id: i64,
) -> Result<()> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.delete_contact(id)?)
}

// Interview Commands
#[tauri::command]
async fn get_interviews(
    state: State<'_, AppState>,
    application_id: Option<i64>,
) -> Result<Vec<db::models::Interview>> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.list_interviews(application_id)?)
}

#[tauri::command]
async fn create_interview(
    state: State<'_, AppState>,
    mut interview: db::models::Interview,
) -> Result<db::models::Interview> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.create_interview(&mut interview)?;
    Ok(interview)
}

#[tauri::command]
async fn update_interview(
    state: State<'_, AppState>,
    interview: db::models::Interview,
) -> Result<db::models::Interview> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.update_interview(&interview)?;
    Ok(interview)
}

#[tauri::command]
async fn delete_interview(
    state: State<'_, AppState>,
    id: i64,
) -> Result<()> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.delete_interview(id)?)
}

// Document Commands
#[tauri::command]
async fn get_documents(
    state: State<'_, AppState>,
    application_id: Option<i64>,
    document_type: Option<String>,
) -> Result<Vec<db::models::Document>> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    
    let doc_type = match document_type {
        Some(dt) => Some(db::models::DocumentType::from_str(&dt)?),
        None => None,
    };
    
    Ok(conn.list_documents(application_id, doc_type)?)
}

#[tauri::command]
async fn create_document(
    state: State<'_, AppState>,
    mut document: db::models::Document,
) -> Result<db::models::Document> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.create_document(&mut document)?;
    Ok(document)
}

#[tauri::command]
async fn update_document(
    state: State<'_, AppState>,
    document: db::models::Document,
) -> Result<db::models::Document> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.update_document(&document)?;
    Ok(document)
}

#[tauri::command]
async fn delete_document(
    state: State<'_, AppState>,
    id: i64,
) -> Result<()> {
    let db = state.db.lock().await;
    let db = db.as_ref().ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.delete_document(id)?)
}

// Application Commands
#[tauri::command]
async fn get_applications(
    state: State<'_, AppState>,
    job_id: Option<i64>,
    status: Option<String>,
) -> Result<Vec<db::models::Application>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let status = status
            .as_deref()
            .and_then(|s| db::models::ApplicationStatus::from_str(s).ok());
        conn.list_applications(job_id, status).map_err(Into::into)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn create_application(
    state: State<'_, AppState>,
    mut application: db::models::Application,
) -> Result<db::models::Application> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        
        // Get job info for activity description
        let job_info = conn.get_job(application.job_id).ok().flatten();
        
        conn.create_application(&mut application)?;
        
        // Log activity
        if let Some(app_id) = application.id {
            let description = if let Some(job) = job_info {
                format!("Application created for '{}' at {}", job.title, job.company)
            } else {
                format!("Application created (Job ID: {})", application.job_id)
            };
            log_activity(&conn, "application", app_id, "created", Some(description), None)?;
        }
        
        Ok(application)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn update_application(
    state: State<'_, AppState>,
    application: db::models::Application,
) -> Result<db::models::Application> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        
        // Get old application to check for status changes
        let old_application = if let Some(app_id) = application.id {
            conn.get_application(app_id).ok().flatten()
        } else {
            None
        };
        
        // Get job info for activity description
        let job_info = conn.get_job(application.job_id).ok().flatten();
        
        conn.update_application(&application)?;
        
        // Log activity
        if let Some(app_id) = application.id {
            let action = if let Some(old) = &old_application {
                if old.status != application.status {
                    // Status changed
                    let metadata = format!(r#"{{"old_status": "{}", "new_status": "{}"}}"#, old.status, application.status);
                    let description = if let Some(job) = &job_info {
                        format!("Application status changed from {} to {} for '{}' at {}", 
                            old.status, application.status, job.title, job.company)
                    } else {
                        format!("Application status changed from {} to {}", old.status, application.status)
                    };
                    log_activity(&conn, "application", app_id, "status_changed", Some(description), Some(metadata))?;
                    return Ok(application);
                }
                "updated"
            } else {
                "updated"
            };
            
            let description = if let Some(job) = job_info {
                format!("Application updated for '{}' at {}", job.title, job.company)
            } else {
                format!("Application updated (Job ID: {})", application.job_id)
            };
            log_activity(&conn, "application", app_id, action, Some(description), None)?;
        }
        
        Ok(application)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn delete_application(state: State<'_, AppState>, id: i64) -> Result<()> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        
        // Get application info before deleting for activity log
        let app_info = conn.get_application(id).ok().flatten();
        let job_info = if let Some(app) = &app_info {
            conn.get_job(app.job_id).ok().flatten()
        } else {
            None
        };
        
        conn.delete_application(id)?;
        
        // Log activity
        if let Some(_app) = app_info {
            let description = if let Some(job) = job_info {
                format!("Application deleted for '{}' at {}", job.title, job.company)
            } else {
                format!("Application deleted (ID: {})", id)
            };
            log_activity(&conn, "application", id, "deleted", Some(description), None)?;
        }
        
        Ok(())
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

// Activity Commands
#[tauri::command]
async fn get_activities(
    state: State<'_, AppState>,
    entity_type: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<db::models::Activity>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let entity_type_ref = entity_type.as_deref();
        conn.list_activities(entity_type_ref, limit).map_err(Into::into)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

// Credential Commands
#[tauri::command]
async fn get_credential(
    state: State<'_, AppState>,
    platform: String,
) -> Result<Option<db::models::Credential>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.get_credential(&platform).map_err(Into::into)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

// Document Generation Commands
#[tauri::command]
async fn generate_resume(
    state: State<'_, AppState>,
    profile: generator::UserProfile,
    job_id: i64,
    template_name: Option<String>,
    improve_with_ai: Option<bool>,
) -> Result<generator::GeneratedDocument> {
    let (job, api_key) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let job = conn.get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            // Get AI key from credentials if available
            let api_key = conn.get_credential("openai")
                .ok()
                .flatten()
                .and_then(|cred| cred.tokens.as_deref().map(|s| s.to_string()));
            
            (job, api_key)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    println!("Creating resume generator...");
    let mut resume_generator = generator::ResumeGenerator::new();
    if let Some(api_key) = &api_key {
        println!("Using OpenAI API for resume generation");
        resume_generator = resume_generator.with_ai_key(api_key.clone());
    } else {
        println!("No OpenAI API key - using basic job analysis");
    }

    let improve_with_ai = improve_with_ai.unwrap_or(false);
    println!("Generating resume (improve_with_ai={}, template={:?})...", improve_with_ai, template_name);
    
    match resume_generator.generate_resume(&profile, &job, template_name.as_deref(), improve_with_ai).await {
        Ok(document) => {
            println!("✅ Resume generated successfully! Word count: {}", document.metadata.word_count);
            Ok(document)
        }
        Err(e) => {
            eprintln!("❌ ERROR generating resume: {}", e);
            eprintln!("Error details: {:?}", e);
            Err(anyhow::anyhow!("Failed to generate resume: {}", e).into())
        }
    }
}

#[tauri::command]
async fn generate_cover_letter(
    state: State<'_, AppState>,
    profile: generator::UserProfile,
    job_id: i64,
    template_name: Option<String>,
    improve_with_ai: Option<bool>,
) -> Result<generator::GeneratedDocument> {
    let (job, api_key) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let job = conn.get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            // Get AI key from credentials if available
            let api_key = conn.get_credential("openai")
                .ok()
                .flatten()
                .and_then(|cred| cred.tokens.as_deref().map(|s| s.to_string()));
            
            (job, api_key)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let mut cover_letter_generator = generator::CoverLetterGenerator::new();
    if let Some(api_key) = api_key {
        cover_letter_generator = cover_letter_generator.with_ai_key(api_key);
    }

    let improve_with_ai = improve_with_ai.unwrap_or(false);
    cover_letter_generator.generate_cover_letter(&profile, &job, template_name.as_deref(), improve_with_ai).await
        .map_err(Into::into)
}

#[tauri::command]
async fn generate_email_version(
    state: State<'_, AppState>,
    profile: generator::UserProfile,
    job_id: i64,
    template_name: Option<String>,
    improve_with_ai: Option<bool>,
) -> Result<generator::GeneratedDocument> {
    let (job, api_key) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let job = conn.get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            // Get AI key from credentials if available
            let api_key = conn.get_credential("openai")
                .ok()
                .flatten()
                .and_then(|cred| cred.tokens.as_deref().map(|s| s.to_string()));
            
            (job, api_key)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let mut cover_letter_generator = generator::CoverLetterGenerator::new();
    if let Some(api_key) = api_key {
        cover_letter_generator = cover_letter_generator.with_ai_key(api_key);
    }

    let improve_with_ai = improve_with_ai.unwrap_or(false);
    cover_letter_generator.generate_email_version(&profile, &job, template_name.as_deref(), improve_with_ai).await
        .map_err(Into::into)
}

#[tauri::command]
async fn export_document_to_pdf(
    app_handle: tauri::AppHandle,
    document: generator::GeneratedDocument,
    output_path: String,
) -> Result<String> {
    let pdf_exporter = generator::PDFExporter::new();
    
    // Resolve the output path - if it's just a filename, save to app data directory
    let final_path = if output_path.starts_with('/') || output_path.contains('\\') || output_path.contains(':') {
        // Absolute path provided (Unix, Windows, or drive letter)
        std::path::PathBuf::from(&output_path)
    } else {
        // Just a filename - save to app data directory
        let app_dir = app_handle.path().app_data_dir()
            .map_err(|e| anyhow::anyhow!("Could not get app data directory: {}", e))?;
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| anyhow::anyhow!("Could not create app data directory: {}", e))?;
        app_dir.join(&output_path)
    };
    
    pdf_exporter.export_to_pdf(&document, &final_path)?;
    
    Ok(format!("Document exported to: {}", final_path.display()))
}

#[tauri::command]
async fn get_available_resume_templates() -> Result<Vec<String>> {
    let resume_generator = generator::ResumeGenerator::new();
    Ok(resume_generator.list_available_templates())
}

#[tauri::command]
async fn get_available_cover_letter_templates() -> Result<Vec<String>> {
    let cover_letter_generator = generator::CoverLetterGenerator::new();
    Ok(cover_letter_generator.list_available_templates())
}

#[tauri::command]
async fn analyze_job_for_profile(
    state: State<'_, AppState>,
    job_id: i64,
) -> Result<generator::JobAnalysis> {
    let (job, api_key) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let job = conn.get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            // Get AI key from credentials if available
            let api_key = conn.get_credential("openai")
                .ok()
                .flatten()
                .and_then(|cred| cred.tokens.as_deref().map(|s| s.to_string()));
            
            (job, api_key)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let mut ai_integration = generator::AIIntegration::new();
    if let Some(api_key) = api_key {
        ai_integration = ai_integration.with_api_key(api_key);
    }

    ai_integration.analyze_job(&job).await.map_err(Into::into)
}

#[tauri::command]
async fn create_credential(
    state: State<'_, AppState>,
    mut credential: db::models::Credential,
) -> Result<db::models::Credential> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.create_credential(&mut credential)?;
        Ok(credential)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn update_credential(
    state: State<'_, AppState>,
    credential: db::models::Credential,
) -> Result<db::models::Credential> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.update_credential(&credential)?;
        Ok(credential)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn list_credentials(
    state: State<'_, AppState>,
    active_only: bool,
) -> Result<Vec<db::models::Credential>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.list_credentials(active_only).map_err(Into::into)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
async fn delete_credential(
    state: State<'_, AppState>,
    platform: String,
) -> Result<()> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.delete_credential(&platform)?;
        Ok(())
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
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
        .invoke_handler(tauri::generate_handler![
            // Job commands
            get_jobs,
            get_job,
            create_job,
            update_job,
            delete_job,
            scrape_jobs,
            scrape_jobs_selected,
            
            // Application commands
            get_applications,
            create_application,
            update_application,
            delete_application,
            
            // Contact commands
            get_contacts,
            create_contact,
            update_contact,
            delete_contact,
            
            // Interview commands
            get_interviews,
            create_interview,
            update_interview,
            delete_interview,
            
            // Document commands
            get_documents,
            create_document,
            update_document,
            delete_document,
            
            // Activity commands
            get_activities,
            
            // Credential commands
            get_credential,
            create_credential,
            update_credential,
            list_credentials,
            delete_credential,
            
            // Document Generation commands
            generate_resume,
            generate_cover_letter,
            generate_email_version,
            export_document_to_pdf,
            get_available_resume_templates,
            get_available_cover_letter_templates,
            analyze_job_for_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use crate::db::models::{self, Job, JobStatus};
use crate::db::queries::{ActivityQueries, ContactQueries, CredentialQueries, JobQueries};
use crate::error::Result;
use crate::events;
use crate::notifications;
use crate::scraper;
use crate::AppState;
use std::str::FromStr;
use tauri::State;
use tokio::task;

// Helper function to log activity
// TODO: Move to a shared utility module
fn log_activity(
    conn: &std::sync::MutexGuard<'_, rusqlite::Connection>,
    entity_type: &str,
    entity_id: i64,
    action: &str,
    description: Option<String>,
    metadata: Option<String>,
) -> Result<()> {
    let mut activity = models::Activity {
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
fn generate_sample_jobs(query: &str) -> Vec<Job> {
    let base_jobs = vec![
        ("Senior Frontend Developer", "Tech Corp", "Remote", "$120k - $180k", "React, TypeScript, Next.js, Tailwind CSS. We're looking for an experienced frontend developer to join our team."),
        ("Full Stack Developer", "StartupXYZ", "San Francisco, CA", "$100k - $150k", "Node.js, React, PostgreSQL, AWS. Build amazing products with a passionate team."),
        ("Backend Engineer", "DataFlow Inc", "New York, NY", "$130k - $170k", "Python, Django, Docker, Kubernetes. Work on scalable backend systems."),
        ("DevOps Engineer", "CloudSystems", "Remote", "$140k - $190k", "AWS, Terraform, Kubernetes, CI/CD. Manage cloud infrastructure at scale."),
        ("Mobile Developer", "AppStudio", "Austin, TX", "$110k - $160k", "React Native, Swift, Kotlin. Build beautiful mobile applications."),
        ("Data Scientist", "AI Labs", "Boston, MA", "$125k - $175k", "Python, Machine Learning, TensorFlow, SQL. Work on cutting-edge AI projects."),
        ("Product Designer", "DesignCo", "Remote", "$90k - $140k", "Figma, User Research, Prototyping. Create delightful user experiences."),
        ("QA Engineer", "QualityTech", "Seattle, WA", "$85k - $120k", "Selenium, Jest, Cypress, Test Automation. Ensure product quality."),
    ];

    let query_lower = query.to_lowercase();
    base_jobs
        .into_iter()
        .filter(|(title, _, _, _, _)| {
            query_lower.is_empty()
                || title.to_lowercase().contains(&query_lower)
                || query_lower == "developer"
                || query_lower == "demo"
                || query_lower == "test"
        })
        .map(|(title, company, location, salary, description)| {
            Job {
                id: None,
                title: title.to_string(),
                company: company.to_string(),
                url: format!("https://example.com/jobs/{}", title.to_lowercase().replace(" ", "-")),
                description: Some(description.to_string()),
                requirements: Some(format!("Experience with modern web technologies. Strong problem-solving skills. Excellent communication.")),
                location: Some(location.to_string()),
                salary: Some(salary.to_string()),
                source: "demo".to_string(),
                status: JobStatus::Saved,
                match_score: None,
                created_at: None,
                updated_at: None,
                ..Default::default()
            }
        })
        .collect()
}

#[tauri::command]
pub async fn get_jobs(
    state: State<'_, AppState>,
    status: Option<String>,
    query: Option<String>,
    page: Option<usize>,
    page_size: Option<usize>,
) -> Result<Vec<Job>> {
    println!(
        "get_jobs called with status={:?}, query={:?}, page={:?}, page_size={:?}",
        status, query, page, page_size
    );

    // Create cache key
    let cache_key = format!(
        "jobs:{}:{}:{}:{}",
        status.as_deref().unwrap_or("all"),
        query.as_deref().unwrap_or(""),
        page.unwrap_or(0),
        page_size.unwrap_or(100)
    );

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        tracing::debug!("Cache hit for jobs query: {}", cache_key);
        if let Ok(jobs) = serde_json::from_value::<Vec<Job>>(cached) {
            return Ok(jobs);
        }
    }

    let result = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let status = status.as_deref().and_then(|s| JobStatus::from_str(s).ok());

            println!(
                "Fetching jobs from database with status filter: {:?}",
                status
            );
            let mut jobs = conn.list_jobs(status).map_err(|e| {
                eprintln!("Error listing jobs: {}", e);
                e
            })?;

            println!("Found {} jobs in database", jobs.len());

            // Apply search query if provided
            if let Some(query) = query {
                let query_lower = query.to_lowercase();
                let initial_count = jobs.len();
                jobs.retain(|job| {
                    job.title.to_lowercase().contains(&query_lower)
                        || job.company.to_lowercase().contains(&query_lower)
                        || job
                            .description
                            .as_ref()
                            .map_or(false, |d| d.to_lowercase().contains(&query_lower))
                        || job
                            .requirements
                            .as_ref()
                            .map_or(false, |r| r.to_lowercase().contains(&query_lower))
                });
                println!(
                    "After search filter '{}': {} jobs (filtered from {})",
                    query,
                    jobs.len(),
                    initial_count
                );
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
            println!(
                "Returning {} jobs (out of {} total)",
                result.len(),
                total_jobs
            );
            result
        } else {
            eprintln!("ERROR: Database not initialized in get_jobs");
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    // Store in cache (5 minute TTL)
    let cache_value = serde_json::to_value(&result)
        .map_err(|e| crate::error::Error::Custom(format!("JSON serialization error: {}", e)))?;
    let _ = state
        .cache
        .set(
            cache_key,
            cache_value,
            Some(std::time::Duration::from_secs(300)),
        )
        .await;

    Ok(result)
}

#[tauri::command]
pub async fn get_job(state: State<'_, AppState>, id: i64) -> Result<Option<Job>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.get_job(id).map_err(Into::into)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn create_job(state: State<'_, AppState>, mut job: Job) -> Result<Job> {
    // Input validation
    crate::security::InputValidator::validate_job_title(&job.title)?;
    crate::security::InputValidator::validate_company_name(&job.company)?;
    crate::security::InputValidator::validate_safe_url(&job.url)?;

    // Sanitize inputs
    job.title = crate::security::InputValidator::sanitize_input(&job.title);
    job.company = crate::security::InputValidator::sanitize_input(&job.company);

    let event_to_publish = {
        let db_guard = state.db.lock().await;
        let db = db_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
        let conn = db.get_connection();
        conn.create_job(&mut job)?;

        if let Some(job_id) = job.id {
            let description = format!("Job '{}' at {} was created", job.title, job.company);
            log_activity(&conn, "job", job_id, "created", Some(description), None)?;

            Some(events::Event {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: events::event_types::JOB_CREATED.to_string(),
                payload: serde_json::json!({
                    "job_id": job_id,
                    "title": job.title,
                    "company": job.company,
                    "source": job.source,
                }),
                timestamp: chrono::Utc::now(),
            })
        } else {
            None
        }
    };

    // Invalidate cache
    state.cache.clear().await; // Clear job list cache

    if let Some(event) = event_to_publish {
        if let Err(e) = state.event_bus.publish(event).await {
            tracing::warn!("Failed to publish JOB_CREATED event: {}", e);
        }
    }

    Ok(job)
}

#[tauri::command]
pub async fn update_job(state: State<'_, AppState>, job: Job) -> Result<Job> {
    let mut cache_keys: Vec<String> = Vec::new();
    let mut events_to_publish: Vec<events::Event> = Vec::new();

    {
        let db_guard = state.db.lock().await;
        let db = db_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
        let conn = db.get_connection();

        // Get old job to check for status changes
        let old_job = if let Some(job_id) = job.id {
            conn.get_job(job_id).ok().flatten()
        } else {
            None
        };

        conn.update_job(&job)?;

        if let Some(job_id) = job.id {
            cache_keys.push(format!("job:{}", job_id));

            let mut base_event = events::Event {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: events::event_types::JOB_UPDATED.to_string(),
                payload: serde_json::json!({
                    "job_id": job_id,
                    "title": job.title,
                    "company": job.company,
                    "source": job.source,
                }),
                timestamp: chrono::Utc::now(),
            };

            if let Some(old) = old_job {
                if old.status != job.status {
                    let metadata = serde_json::json!({
                        "old_status": old.status.to_string(),
                        "new_status": job.status.to_string()
                    })
                    .to_string();
                    log_activity(
                        &conn,
                        "job",
                        job_id,
                        "status_changed",
                        Some(format!(
                            "Job '{}' status changed from {} to {}",
                            job.title, old.status, job.status
                        )),
                        Some(metadata),
                    )?;

                    base_event = events::Event {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: events::event_types::JOB_UPDATED.to_string(),
                        payload: serde_json::json!({
                            "job_id": job_id,
                            "title": job.title,
                            "company": job.company,
                            "old_status": old.status.to_string(),
                            "new_status": job.status.to_string(),
                        }),
                        timestamp: chrono::Utc::now(),
                    };
                } else {
                    let description = format!("Job '{}' at {} was updated", job.title, job.company);
                    log_activity(&conn, "job", job_id, "updated", Some(description), None)?;
                }
            } else {
                let description = format!("Job '{}' at {} was updated", job.title, job.company);
                log_activity(&conn, "job", job_id, "updated", Some(description), None)?;
            }

            events_to_publish.push(base_event);
        }
    }

    for cache_key in cache_keys {
        let _ = state.cache.remove(&cache_key).await;
    }
    state.cache.clear().await; // Clear job list cache

    for event in events_to_publish {
        if let Err(e) = state.event_bus.publish(event).await {
            tracing::warn!("Failed to publish JOB_UPDATED event: {}", e);
        }
    }

    Ok(job)
}

#[tauri::command]
pub async fn delete_job(state: State<'_, AppState>, id: i64) -> Result<()> {
    let cache_key = {
        let db_guard = state.db.lock().await;
        let db = db_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
        let conn = db.get_connection();

        // Get job info before deleting for activity log
        let job_info = conn.get_job(id).ok().flatten();

        conn.delete_job(id)?;

        if let Some(job) = job_info {
            let description = format!("Job '{}' at {} was deleted", job.title, job.company);
            log_activity(&conn, "job", id, "deleted", Some(description), None)?;
        }

        Some(format!("job:{}", id))
    };

    if let Some(key) = cache_key {
        let _ = state.cache.remove(&key).await;
    }
    state.cache.clear().await; // Clear job list cache

    Ok(())
}

#[tauri::command]
pub async fn scrape_jobs(state: State<'_, AppState>, query: String) -> Result<Vec<Job>> {
    // Rate-limit: max 10 scrape calls per 60-second window per endpoint
    if !state.rate_limiter.check_rate_limit("scrape_jobs").await? {
        return Err(anyhow::anyhow!(
            "Too many scrape requests. Please wait a moment before trying again."
        )
        .into());
    }
    println!("Starting scrape_jobs with query: '{}'", query);

    // Publish SCRAPER_STARTED event
    let event_bus = state.event_bus.clone();
    let start_event = events::Event {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: events::event_types::SCRAPER_STARTED.to_string(),
        payload: serde_json::json!({
            "query": query,
            "timestamp": chrono::Utc::now(),
        }),
        timestamp: chrono::Utc::now(),
    };
    if let Err(e) = event_bus.publish(start_event).await {
        tracing::warn!("Failed to publish SCRAPER_STARTED event: {}", e);
    }

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

    // Check if this is a demo/test request
    let query_lower = query.to_lowercase();
    let is_demo = query_lower.contains("demo") || query_lower == "test" || query_lower.is_empty();

    let mut jobs = if is_demo {
        println!("🎯 Demo mode: Generating sample jobs");
        generate_sample_jobs(&query)
    } else {
        println!("🌐 Attempting to scrape jobs from real sources...");
        println!(
            "⚠️  Note: Real scraping may fail due to website structure changes or network issues."
        );
        println!("💡 Tip: Try 'demo' or 'test' as query to see sample jobs instead!");

        let query_clone = query.clone();
        let event_bus_clone = state.event_bus.clone();
        match task::spawn_blocking(move || scraper.scrape_all(&query_clone)).await {
            Ok(Ok(jobs)) => {
                println!(
                    "✅ Successfully scraped {} jobs from real sources",
                    jobs.len()
                );

                // Publish JOB_FOUND events for each job
                for job in &jobs {
                    let job_event = events::Event {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: events::event_types::JOB_FOUND.to_string(),
                        payload: serde_json::json!({
                            "job": {
                                "title": job.title,
                                "company": job.company,
                                "source": job.source,
                                "url": job.url,
                            },
                            "query": query,
                        }),
                        timestamp: chrono::Utc::now(),
                    };
                    let _ = event_bus_clone.publish(job_event).await;
                }
                jobs
            }
            Ok(Err(e)) => {
                eprintln!("❌ Scraping failed: {}", e);

                // Record metrics: scraper errors

                // Publish SCRAPER_ERROR event
                let error_event = events::Event {
                    id: uuid::Uuid::new_v4().to_string(),
                    event_type: events::event_types::SCRAPER_ERROR.to_string(),
                    payload: serde_json::json!({
                        "query": query,
                        "error": e.to_string(),
                        "timestamp": chrono::Utc::now(),
                    }),
                    timestamp: chrono::Utc::now(),
                };
                let _ = state.event_bus.publish(error_event).await;
                eprintln!("💡 Falling back to demo mode. Try using 'demo' query for sample jobs.");
                let sample_jobs = generate_sample_jobs(&query);
                println!("📦 Generated {} sample jobs as fallback", sample_jobs.len());
                sample_jobs
            }
            Err(join_err) => {
                eprintln!("❌ Scraping thread panicked: {}", join_err);

                // Publish SCRAPER_ERROR event
                let error_event = events::Event {
                    id: uuid::Uuid::new_v4().to_string(),
                    event_type: events::event_types::SCRAPER_ERROR.to_string(),
                    payload: serde_json::json!({
                        "query": query,
                        "error": format!("Thread panicked: {}", join_err),
                        "timestamp": chrono::Utc::now(),
                    }),
                    timestamp: chrono::Utc::now(),
                };
                let _ = state.event_bus.publish(error_event).await;
                let sample_jobs = generate_sample_jobs(&query);
                println!("📦 Generated {} sample jobs as fallback", sample_jobs.len());
                sample_jobs
            }
        }
    };

    println!("Scraped {} jobs, saving to database...", jobs.len());

    // Clone event_bus before db lock for event publishing
    let event_bus = state.event_bus.clone();
    let query_clone = query.clone();

    // Save scraped jobs to database and prepare completion event payload
    let completion_event = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let mut saved_count = 0;
            let mut new_saved_jobs = Vec::new(); // Track newly saved jobs for email extraction
            let mut sources_used = std::collections::HashSet::new();

            for job in &mut jobs {
                // Skip if job with same URL already exists
                match conn.get_job_by_url(&job.url) {
                    Ok(Some(_)) => continue,
                    Ok(None) => {
                        if conn.create_job(job).is_ok() {
                            saved_count += 1;
                            sources_used.insert(job.source.clone());

                            if let Some(job_id) = job.id {
                                let description = format!(
                                    "Job '{}' at {} was scraped from {}",
                                    job.title, job.company, job.source
                                );
                                let _ = log_activity(
                                    &conn,
                                    "job",
                                    job_id,
                                    "created",
                                    Some(description),
                                    Some(format!(
                                        r#"{{"source": "scraped", "source_name": "{}"}}"#,
                                        job.source
                                    )),
                                );

                                let job_event = events::Event {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    event_type: events::event_types::JOB_CREATED.to_string(),
                                    payload: serde_json::json!({
                                        "job_id": job_id,
                                        "title": job.title,
                                        "company": job.company,
                                        "source": job.source,
                                    }),
                                    timestamp: chrono::Utc::now(),
                                };
                                let event_bus_clone = event_bus.clone();
                                tokio::spawn(async move {
                                    if let Err(e) = event_bus_clone.publish(job_event).await {
                                        tracing::warn!(
                                            "Failed to publish JOB_CREATED event: {}",
                                            e
                                        );
                                    }
                                });

                                new_saved_jobs.push(job.clone());
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Error checking if job exists: {}", e);
                    }
                }
            }
            println!("Saved {} new jobs to database", saved_count);

            if !new_saved_jobs.is_empty() {
                let mut contacts_created = 0;
                let mut jobs_with_emails = 0;

                for job in &new_saved_jobs {
                    if let Some(job_id) = job.id {
                        let emails =
                            notifications::extract_job_emails(&job.description, &job.requirements);

                        if !emails.is_empty() {
                            jobs_with_emails += 1;
                            println!(
                                "📧 Found {} email(s) in job: {} at {}",
                                emails.len(),
                                job.title,
                                job.company
                            );

                            for email in emails {
                                if let Ok(existing_contacts) = conn.list_contacts(Some(job_id)) {
                                    if !existing_contacts
                                        .iter()
                                        .any(|c| c.email.as_deref() == Some(&email))
                                    {
                                        let mut contact = models::Contact {
                                            id: None,
                                            job_id,
                                            name: format!("Contact at {}", job.company),
                                            email: Some(email.clone()),
                                            phone: None,
                                            position: None,
                                            notes: Some(
                                                "Extracted from job description/requirements"
                                                    .to_string(),
                                            ),
                                            created_at: None,
                                            updated_at: None,
                                            ..Default::default()
                                        };

                                        if conn.create_contact(&mut contact).is_ok() {
                                            contacts_created += 1;
                                            println!(
                                                "  ✓ Created contact: {} for job {}",
                                                email, job_id
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if contacts_created > 0 {
                    println!(
                        "📧 Created {} contact(s) from {} job(s) with emails",
                        contacts_created, jobs_with_emails
                    );
                }
            }

            let final_saved_count = saved_count;
            let final_sources: Vec<String> = sources_used.into_iter().collect();

            events::Event {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: events::event_types::SCRAPER_COMPLETED.to_string(),
                payload: serde_json::json!({
                    "query": query_clone.clone(),
                    "jobs_found": jobs.len(),
                    "jobs_saved": final_saved_count,
                    "sources": final_sources,
                }),
                timestamp: chrono::Utc::now(),
            }
        } else {
            events::Event {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: events::event_types::SCRAPER_COMPLETED.to_string(),
                payload: serde_json::json!({
                    "query": query_clone,
                    "jobs_found": jobs.len(),
                    "jobs_saved": 0,
                    "sources": Vec::<String>::new(),
                }),
                timestamp: chrono::Utc::now(),
            }
        }
    };

    if let Err(e) = event_bus.publish(completion_event).await {
        tracing::warn!("Failed to publish SCRAPER_COMPLETED event: {}", e);
    }

    println!("Returning {} jobs", jobs.len());
    Ok(jobs)
}

#[tauri::command]
pub async fn scrape_jobs_selected(
    state: State<'_, AppState>,
    sources: Vec<String>,
    query: Option<String>,
) -> Result<Vec<Job>> {
    if !state.rate_limiter.check_rate_limit("scrape_jobs").await? {
        return Err(anyhow::anyhow!(
            "Too many scrape requests. Please wait a moment before trying again."
        )
        .into());
    }
    let query_str = query.as_deref().unwrap_or("");
    println!(
        "Starting scrape_jobs_selected with sources: {:?}, query: '{}'",
        sources, query_str
    );

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

    let query_string = query_str.to_string();
    let sources_clone = sources.clone();

    // Run scraper in blocking task
    let jobs = task::spawn_blocking(move || scraper.scrape_selected(&sources_clone, &query_string))
        .await
        .map_err(|e| anyhow::anyhow!("Scraper task failed: {}", e))??;

    println!("Scraped {} jobs from selected sources", jobs.len());

    // Save to database
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let mut saved_count = 0;

        for job in &jobs {
            // Check if job exists by URL
            let exists = conn.get_job_by_url(&job.url).ok().flatten().is_some();
            if !exists {
                let mut job_clone = job.clone();
                if let Ok(_) = conn.create_job(&mut job_clone) {
                    saved_count += 1;
                }
            }
        }
        println!("Saved {} new jobs to database", saved_count);
    }

    Ok(jobs)
}

#[tauri::command]
pub async fn discovery_qualify(state: State<'_, AppState>) -> Result<usize> {
    let brain = crate::intelligence::Brain::new(state.db.clone());
    brain.process_scouted_jobs().await.map_err(Into::into)
}

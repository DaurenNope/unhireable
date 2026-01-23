use crate::db::models::{Application, ApplicationStatus};
use crate::db::queries::{ActivityQueries, ApplicationQueries, JobQueries};
use crate::error::Result;
use crate::events;
use crate::AppState;
use std::str::FromStr;
use tauri::State;

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
    let mut activity = crate::db::models::Activity {
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

#[tauri::command]
pub async fn get_applications(
    state: State<'_, AppState>,
    job_id: Option<i64>,
    status: Option<String>,
) -> Result<Vec<Application>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let status = status
            .as_deref()
            .and_then(|s| ApplicationStatus::from_str(s).ok());
        conn.list_applications(job_id, status).map_err(Into::into)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn create_application(
    state: State<'_, AppState>,
    mut application: Application,
) -> Result<Application> {
    let event_to_publish = {
        let db_guard = state.db.lock().await;
        let db = db_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
        let conn = db.get_connection();

        // Get job info for activity description
        let job_info = conn.get_job(application.job_id).ok().flatten();

        conn.create_application(&mut application)?;

        if let Some(app_id) = application.id {
            let description = if let Some(job) = job_info {
                format!("Application created for '{}' at {}", job.title, job.company)
            } else {
                format!("Application created (Job ID: {})", application.job_id)
            };
            log_activity(
                &conn,
                "application",
                app_id,
                "created",
                Some(description),
                None,
            )?;

            Some(events::Event {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: events::event_types::APPLICATION_CREATED.to_string(),
                payload: serde_json::json!({
                    "application_id": app_id,
                    "job_id": application.job_id,
                    "status": format!("{:?}", application.status),
                }),
                timestamp: chrono::Utc::now(),
            })
        } else {
            None
        }
    };

    if let Some(event) = event_to_publish {
        if let Err(e) = state.event_bus.publish(event).await {
            tracing::warn!("Failed to publish APPLICATION_CREATED event: {}", e);
        }
    }

    Ok(application)
}

#[tauri::command]
pub async fn update_application(
    state: State<'_, AppState>,
    application: Application,
) -> Result<Application> {
    let events_to_publish = {
        let db_guard = state.db.lock().await;
        let db = db_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
        let conn = db.get_connection();

        let old_application = if let Some(app_id) = application.id {
            conn.get_application(app_id).ok().flatten()
        } else {
            None
        };

        let job_info = conn.get_job(application.job_id).ok().flatten();

        conn.update_application(&application)?;

        let mut events = Vec::new();

        if let Some(app_id) = application.id {
            if let Some(old) = &old_application {
                if old.status != application.status {
                    let metadata = format!(
                        r#"{{"old_status": "{}", "new_status": "{}"}}"#,
                        old.status, application.status
                    );
                    let description = if let Some(job) = &job_info {
                        format!(
                            "Application status changed from {} to {} for '{}' at {}",
                            old.status, application.status, job.title, job.company
                        )
                    } else {
                        format!(
                            "Application status changed from {} to {}",
                            old.status, application.status
                        )
                    };
                    log_activity(
                        &conn,
                        "application",
                        app_id,
                        "status_changed",
                        Some(description),
                        Some(metadata),
                    )?;

                    events.push(events::Event {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: events::event_types::APPLICATION_UPDATED.to_string(),
                        payload: serde_json::json!({
                            "application_id": app_id,
                            "job_id": application.job_id,
                            "old_status": format!("{:?}", old.status),
                            "new_status": format!("{:?}", application.status),
                        }),
                        timestamp: chrono::Utc::now(),
                    });
                } else {
                    let description = if let Some(job) = job_info {
                        format!("Application updated for '{}' at {}", job.title, job.company)
                    } else {
                        format!("Application updated (Job ID: {})", application.job_id)
                    };
                    log_activity(
                        &conn,
                        "application",
                        app_id,
                        "updated",
                        Some(description),
                        None,
                    )?;
                }
            }
        }

        events
    };

    for event in events_to_publish {
        if let Err(e) = state.event_bus.publish(event).await {
            tracing::warn!("Failed to publish APPLICATION_UPDATED event: {}", e);
        }
    }

    Ok(application)
}

#[tauri::command]
pub async fn delete_application(state: State<'_, AppState>, id: i64) -> Result<()> {
    {
        let db_guard = state.db.lock().await;
        let db = db_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
        let conn = db.get_connection();

        // Get application and job info for activity log
        let app_info = conn.get_application(id).ok().flatten();
        let job_info = if let Some(app) = &app_info {
            conn.get_job(app.job_id).ok().flatten()
        } else {
            None
        };

        conn.delete_application(id)?;

        let description = if let (Some(app), Some(job)) = (app_info, job_info) {
            format!(
                "Application deleted for '{}' at {} (Status: {})",
                job.title, job.company, app.status
            )
        } else {
            format!("Application deleted (ID: {})", id)
        };
        log_activity(&conn, "application", id, "deleted", Some(description), None)?;
    }

    Ok(())
}

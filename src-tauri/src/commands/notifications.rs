use crate::db;
use crate::db::queries::ContactQueries;
use crate::error::Result;
use crate::matching;
use crate::notifications;
use crate::AppState;
use tauri::State;

// Desktop Notification Commands
#[tauri::command]
pub async fn request_notification_permission(app: tauri::AppHandle) -> Result<bool> {
    Ok(notifications::DesktopNotificationService::request_permission(&app).await)
}

#[tauri::command]
pub async fn send_desktop_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    config: Option<notifications::DesktopNotificationConfig>,
) -> Result<()> {
    notifications::DesktopNotificationService::send(&app, &title, &body, config.as_ref()).await?;
    Ok(())
}

#[tauri::command]
pub async fn send_desktop_job_match(
    app: tauri::AppHandle,
    job_title: String,
    company: String,
    match_score: f64,
    config: Option<notifications::DesktopNotificationConfig>,
) -> Result<()> {
    notifications::DesktopNotificationService::send_job_match(
        &app,
        &job_title,
        &company,
        match_score,
        config.as_ref(),
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn send_desktop_new_jobs(
    app: tauri::AppHandle,
    count: usize,
    config: Option<notifications::DesktopNotificationConfig>,
) -> Result<()> {
    notifications::DesktopNotificationService::send_new_jobs(&app, count, config.as_ref()).await?;
    Ok(())
}

#[tauri::command]
pub async fn send_desktop_application_status(
    app: tauri::AppHandle,
    job_title: String,
    company: String,
    status: String,
    config: Option<notifications::DesktopNotificationConfig>,
) -> Result<()> {
    notifications::DesktopNotificationService::send_application_status(
        &app,
        &job_title,
        &company,
        &status,
        config.as_ref(),
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn send_desktop_application_success(
    app: tauri::AppHandle,
    job_title: String,
    company: String,
    config: Option<notifications::DesktopNotificationConfig>,
) -> Result<()> {
    notifications::DesktopNotificationService::send_application_success(
        &app,
        &job_title,
        &company,
        config.as_ref(),
    )
    .await?;
    Ok(())
}

// Email Notification Commands
#[tauri::command]
pub async fn test_email_connection(config: notifications::EmailConfig) -> Result<String> {
    let mut email_service = notifications::EmailService::new(config);
    email_service.initialize()?;
    Ok("Email connection test successful!".to_string())
}

#[tauri::command]
pub async fn send_test_email(config: notifications::EmailConfig, to: String) -> Result<String> {
    let mut email_service = notifications::EmailService::new(config);
    email_service.initialize()?;
    email_service.send_test_email(&to)?;
    Ok(format!("Test email sent successfully to {}", to))
}

#[tauri::command]
pub async fn send_job_match_email_with_result(
    config: notifications::EmailConfig,
    to: String,
    job: db::models::Job,
    match_result: matching::JobMatchResult,
) -> Result<String> {
    let mut email_service = notifications::EmailService::new(config);
    email_service.initialize()?;
    email_service.send_job_match_notification(&to, &job, &match_result)?;
    Ok(format!("Job match notification sent to {}", to))
}

#[tauri::command]
pub async fn send_new_jobs_notification_email(
    config: notifications::EmailConfig,
    to: String,
    jobs: Vec<db::models::Job>,
    match_results: Option<Vec<matching::JobMatchResult>>,
) -> Result<String> {
    let mut email_service = notifications::EmailService::new(config);
    email_service.initialize()?;

    let match_results_ref = match_results.as_ref().map(|v| v.as_slice());
    email_service.send_new_jobs_notification(&to, &jobs, match_results_ref)?;

    Ok(format!(
        "New jobs notification sent to {} for {} job(s)",
        to,
        jobs.len()
    ))
}

#[tauri::command]
pub async fn extract_emails_from_jobs(
    jobs: Vec<db::models::Job>,
) -> Result<Vec<(i64, Vec<String>)>> {
    // Extract emails from each job and return job_id -> emails mapping
    let mut result = Vec::new();

    for job in jobs {
        if let Some(job_id) = job.id {
            let emails = notifications::extract_job_emails(&job.description, &job.requirements);
            if !emails.is_empty() {
                result.push((job_id, emails));
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_contacts_from_jobs(
    state: State<'_, AppState>,
    jobs: Vec<db::models::Job>,
) -> Result<usize> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let mut contacts_created = 0;

        for job in jobs {
            if let Some(job_id) = job.id {
                // Extract emails from job
                let emails = notifications::extract_job_emails(&job.description, &job.requirements);

                // Create contact for each email found
                for email in emails {
                    // Check if contact already exists
                    let existing_contacts = conn.list_contacts(Some(job_id))?;
                    if !existing_contacts
                        .iter()
                        .any(|c| c.email.as_deref() == Some(&email))
                    {
                        let mut contact = db::models::Contact {
                            id: None,
                            job_id,
                            name: "Unknown".to_string(), // Default name
                            position: Some("Recruiter/Hiring Manager".to_string()),
                            email: Some(email),
                            phone: None,
                            notes: Some("Automatically extracted from job description".to_string()),
                            created_at: None,
                            updated_at: None,
                        };
                        conn.create_contact(&mut contact)?;
                        contacts_created += 1;
                    }
                }
            }
        }

        Ok(contacts_created)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

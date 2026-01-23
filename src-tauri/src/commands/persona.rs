use crate::applicator::{ApplicationConfig, JobApplicator};
use crate::error::Result;
use crate::persona;
use crate::AppState;
use tauri::State;

// Persona-related structs
#[derive(serde::Serialize)]
pub struct PersonaActivationPayload {
    pub slug: String,
    pub display_name: String,
    pub resume_path: String,
    pub cover_letter_path: String,
    pub saved_search_id: i64,
    pub saved_search_name: String,
}

#[derive(serde::Serialize)]
pub struct PersonaDryRunReport {
    pub slug: String,
    pub display_name: String,
    pub job_id: i64,
    pub job_title: String,
    pub success: bool,
    pub message: String,
    pub test_endpoint: String,
    pub resume_path: String,
    pub cover_letter_path: String,
    pub saved_search_id: i64,
    pub application_message: String,
    pub ats_type: Option<String>,
}

// Persona Commands
#[tauri::command]
pub async fn list_personas_catalog() -> Result<Vec<persona::PersonaSummary>> {
    Ok(persona::list_personas())
}

#[tauri::command]
pub async fn load_test_persona(
    state: State<'_, AppState>,
    slug: Option<String>,
) -> Result<PersonaActivationPayload> {
    let slug = slug.unwrap_or_else(|| persona::default_slug().to_string());
    let app_dir = state
        .app_dir
        .lock()
        .await
        .clone()
        .ok_or_else(|| anyhow::anyhow!("Application data directory not initialized"))?;

    let activation = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            persona::activate_persona(&conn, &app_dir, &slug)?
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    Ok(PersonaActivationPayload {
        slug: activation.slug,
        display_name: activation.display_name,
        resume_path: activation.resume_path.to_string_lossy().to_string(),
        cover_letter_path: activation.cover_letter_path.to_string_lossy().to_string(),
        saved_search_id: activation.saved_search_id,
        saved_search_name: activation.saved_search_name,
    })
}

#[tauri::command]
pub async fn persona_dry_run(
    state: State<'_, AppState>,
    slug: Option<String>,
    auto_submit: Option<bool>,
) -> Result<PersonaDryRunReport> {
    let slug = slug.unwrap_or_else(|| persona::default_slug().to_string());
    let auto_submit = auto_submit.unwrap_or(true);
    let app_dir = state
        .app_dir
        .lock()
        .await
        .clone()
        .ok_or_else(|| anyhow::anyhow!("Application data directory not initialized"))?;

    let (activation, job) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let setup = persona::prepare_dry_run(&conn, &app_dir, &slug)?;
            (setup.assets, setup.job)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let job_id = job
        .id
        .ok_or_else(|| anyhow::anyhow!("Test job missing ID"))?;
    let resume_path = activation.resume_path.to_string_lossy().to_string();
    let cover_letter_path = activation.cover_letter_path.to_string_lossy().to_string();
    let config = ApplicationConfig {
        auto_submit,
        upload_resume: true,
        upload_cover_letter: true,
        resume_path: Some(resume_path.clone()),
        cover_letter_path: Some(cover_letter_path.clone()),
        wait_for_confirmation: true,
        timeout_secs: 120,
        ..Default::default()
    };
    let applicator = JobApplicator::with_config(config);
    let application_result = applicator
        .apply_to_job(
            &job,
            &activation.profile,
            Some(resume_path.as_str()),
            Some(cover_letter_path.as_str()),
        )
        .await?;
    let application_message = application_result.message.clone();
    let summary_message = if application_result.success {
        format!("Dry-run completed for {}", activation.display_name)
    } else {
        format!(
            "Dry-run failed for {}: {}",
            activation.display_name, application_result.message
        )
    };

    Ok(PersonaDryRunReport {
        slug: activation.slug,
        display_name: activation.display_name,
        job_id,
        job_title: job.title,
        success: application_result.success,
        message: summary_message,
        test_endpoint: job.url,
        resume_path,
        cover_letter_path,
        saved_search_id: activation.saved_search_id,
        application_message,
        ats_type: application_result.ats_type,
    })
}

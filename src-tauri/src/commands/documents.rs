use crate::db::queries::{CredentialQueries, JobQueries};
use rusqlite::Connection;
use crate::error::Result;
use crate::generator;
use crate::resume_analyzer;
use crate::AppState;
use tauri::{Manager, State};

/// Retrieve the best available AI API key from credentials.
/// Checks Mistral → Gemini → OpenAI (in that order).
fn get_ai_api_key(
    conn: &std::sync::MutexGuard<'_, Connection>,
) -> Option<(String, &'static str, &'static str)> {
    for (platform, base_url, model) in [
        ("mistral", "https://api.mistral.ai/v1", "mistral-small-latest"),
        ("gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-1.5-flash"),
        ("openai", "https://api.openai.com/v1", "gpt-3.5-turbo"),
    ] {
        if let Some(key) = conn
            .get_credential(platform)
            .ok()
            .flatten()
            .and_then(|cred| cred.tokens.as_deref().map(|s| s.to_string()))
        {
            return Some((key, base_url, model));
        }
    }
    None
}

// Document Generation Commands
#[tauri::command]
pub async fn generate_resume(
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
            let job = conn
                .get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            let ai_cred = get_ai_api_key(&conn);
            (job, ai_cred)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    println!("Creating resume generator...");
    let mut resume_generator = generator::ResumeGenerator::new();
    if let Some((api_key, base_url, model)) = &api_key {
        println!("Using AI provider (base_url={}, model={}) for resume generation", base_url, model);
        resume_generator = resume_generator.with_ai_key(api_key.clone());
        let _ = (base_url, model); // used for logging; generator picks up env vars
    } else {
        println!("No AI API key configured - using basic job analysis");
    }

    let improve_with_ai = improve_with_ai.unwrap_or(false);
    println!(
        "Generating resume (improve_with_ai={}, template={:?})...",
        improve_with_ai, template_name
    );

    match resume_generator
        .generate_resume(&profile, &job, template_name.as_deref(), improve_with_ai)
        .await
    {
        Ok(document) => {
            println!(
                "✅ Resume generated successfully! Word count: {}",
                document.metadata.word_count
            );
            Ok(document)
        }
        Err(e) => {
            eprintln!("❌ ERROR generating resume: {}", e);
            Err(anyhow::anyhow!("Failed to generate resume: {}", e).into())
        }
    }
}

#[tauri::command]
pub async fn generate_cover_letter(
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
            let job = conn
                .get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            let ai_cred = get_ai_api_key(&conn);
            (job, ai_cred)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let mut cover_letter_generator = generator::CoverLetterGenerator::new();
    if let Some((api_key, _, _)) = api_key {
        cover_letter_generator = cover_letter_generator.with_ai_key(api_key);
    }

    let improve_with_ai = improve_with_ai.unwrap_or(false);

    match cover_letter_generator
        .generate_cover_letter(&profile, &job, template_name.as_deref(), improve_with_ai)
        .await
    {
        Ok(document) => Ok(document),
        Err(e) => Err(anyhow::anyhow!("Failed to generate cover letter: {}", e).into()),
    }
}

#[tauri::command]
pub async fn generate_email_version(
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
            let job = conn
                .get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            let ai_cred = get_ai_api_key(&conn);
            (job, ai_cred)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let mut cover_letter_generator = generator::CoverLetterGenerator::new();
    if let Some((api_key, _, _)) = api_key {
        cover_letter_generator = cover_letter_generator.with_ai_key(api_key);
    }

    let improve_with_ai = improve_with_ai.unwrap_or(false);

    match cover_letter_generator
        .generate_email_version(&profile, &job, template_name.as_deref(), improve_with_ai)
        .await
    {
        Ok(document) => Ok(document),
        Err(e) => Err(anyhow::anyhow!("Failed to generate email version: {}", e).into()),
    }
}

#[tauri::command]
pub async fn export_document_to_pdf(
    app_handle: tauri::AppHandle,
    document: generator::GeneratedDocument,
    output_path: String,
) -> Result<String> {
    let pdf_exporter = generator::PDFExporter::new();

    // Resolve the output path - if it's just a filename, save to app data directory
    let final_path = if output_path.starts_with('/')
        || output_path.contains('\\')
        || output_path.contains(':')
    {
        // Absolute path provided (Unix, Windows, or drive letter)
        std::path::PathBuf::from(&output_path)
    } else {
        // Just a filename - save to app data directory
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow::anyhow!("Could not get app data directory: {}", e))?;
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| anyhow::anyhow!("Could not create app data directory: {}", e))?;
        app_dir.join(&output_path)
    };

    pdf_exporter.export_to_pdf(&document, &final_path)?;

    Ok(format!("Document exported to: {}", final_path.display()))
}

#[tauri::command]
pub async fn get_available_resume_templates() -> Result<Vec<String>> {
    let resume_generator = generator::ResumeGenerator::new();
    Ok(resume_generator.list_available_templates())
}

#[tauri::command]
pub async fn get_available_cover_letter_templates() -> Result<Vec<String>> {
    let cover_letter_generator = generator::CoverLetterGenerator::new();
    Ok(cover_letter_generator.list_available_templates())
}

// Enhanced Generation Agent Commands

#[tauri::command]
pub async fn optimize_document_for_ats(
    content: String,
    job_analysis: generator::JobAnalysis,
    profile: generator::UserProfile,
) -> Result<generator::ATSOptimizationResult> {
    let optimizer = generator::ATSOptimizer::new();
    optimizer
        .optimize_for_ats(&content, &job_analysis, &profile)
        .map_err(Into::into)
}

#[tauri::command]
pub async fn check_ats_compatibility(content: String) -> Result<generator::ATSCompatibilityReport> {
    let optimizer = generator::ATSOptimizer::new();
    Ok(optimizer.check_ats_compatibility(&content))
}

#[tauri::command]
pub async fn score_document_quality(
    document: generator::GeneratedDocument,
    profile: generator::UserProfile,
    job_analysis: generator::JobAnalysis,
) -> Result<generator::QualityScore> {
    Ok(generator::QualityScorer::score_document(
        &document,
        &profile,
        &job_analysis,
    ))
}

#[tauri::command]
pub async fn list_ai_providers() -> Result<Vec<String>> {
    Ok(generator::AIIntegration::list_configured_providers())
}

#[tauri::command]
pub async fn generate_resume_with_provider(
    state: State<'_, AppState>,
    profile: generator::UserProfile,
    job_id: i64,
    template_name: Option<String>,
    improve_with_ai: Option<bool>,
    _provider: Option<String>,
) -> Result<generator::GeneratedDocument> {
    let (job, api_key) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let job = conn
                .get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            let ai_cred = get_ai_api_key(&conn);
            (job, ai_cred)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let mut resume_generator = generator::ResumeGenerator::new();
    if let Some((api_key, _, _)) = &api_key {
        resume_generator = resume_generator.with_ai_key(api_key.clone());
    }

    let improve_with_ai = improve_with_ai.unwrap_or(false);

    match resume_generator
        .generate_resume(&profile, &job, template_name.as_deref(), improve_with_ai)
        .await
    {
        Ok(document) => Ok(document),
        Err(e) => Err(anyhow::anyhow!("Failed to generate resume: {}", e).into()),
    }
}

#[tauri::command]
pub async fn create_document_version(
    document: generator::GeneratedDocument,
    document_id: Option<String>,
    notes: Option<String>,
    tags: Vec<String>,
    metadata: generator::VersionMetadata,
) -> Result<generator::DocumentVersion> {
    let mut version_control = generator::VersionControl::new();
    version_control
        .create_version(document, document_id, notes, tags, metadata)
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_document_versions(document_id: String) -> Result<Vec<generator::DocumentVersion>> {
    let version_control = generator::VersionControl::new();
    Ok(version_control
        .list_all_versions(&document_id)
        .into_iter()
        .cloned()
        .collect())
}

#[tauri::command]
pub async fn restore_document_version(
    document_id: String,
    version_number: u32,
) -> Result<generator::DocumentVersion> {
    let mut version_control = generator::VersionControl::new();
    version_control
        .restore_version(&document_id, version_number)
        .map_err(Into::into)
}

#[tauri::command]
pub async fn analyze_resume(
    pdf_path: String,
    job_target: Option<resume_analyzer::JobTargetInput>,
) -> Result<resume_analyzer::ResumeAnalysis> {
    use crate::resume_analyzer::{ResumeAnalyzer, ResumeParser};

    let text = ResumeParser::extract_text_from_pdf(&pdf_path)
        .map_err(|e| anyhow::anyhow!("Failed to extract text from PDF: {}", e))?;

    let parsed = ResumeParser::parse_resume_text(&text)
        .map_err(|e| anyhow::anyhow!("Failed to parse resume: {}", e))?;

    Ok(ResumeAnalyzer::analyze(parsed, job_target))
}

#[tauri::command]
pub async fn get_resume_environment_status() -> Result<resume_analyzer::AnalyzerDependencyStatus> {
    Ok(resume_analyzer::dependency_status())
}

#[tauri::command]
pub async fn analyze_job_for_profile(
    state: State<'_, AppState>,
    job_id: i64,
) -> Result<generator::JobAnalysis> {
    let (job, api_key) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let job = conn
                .get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

            let ai_cred = get_ai_api_key(&conn);
            (job, ai_cred)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let mut ai_integration = generator::AIIntegration::new();
    if let Some((key, _, _)) = api_key {
        ai_integration = ai_integration.with_api_key(key);
    }

    ai_integration.analyze_job(&job).await.map_err(Into::into)
}

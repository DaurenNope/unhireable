use crate::db::queries::{CredentialQueries, JobQueries};
use crate::error::Result;
use crate::generator;
use crate::metrics;
use crate::resume_analyzer;
use crate::AppState;
use tauri::{Manager, State};

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

            // Get AI key from credentials if available
            let api_key = conn
                .get_credential("openai")
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
    println!(
        "Generating resume (improve_with_ai={}, template={:?})...",
        improve_with_ai, template_name
    );

    // Record metrics: start timing
    let start_time = std::time::Instant::now();

    match resume_generator
        .generate_resume(&profile, &job, template_name.as_deref(), improve_with_ai)
        .await
    {
        Ok(document) => {
            let duration = start_time.elapsed().as_secs_f64();

            // Record success metrics
            metrics::DOCUMENTS_GENERATED_TOTAL.inc();
            metrics::DOCUMENT_GENERATION_DURATION.observe(duration);

            // Try to score document quality if possible
            let quality_score = generator::QualityScorer::score_document(
                &document,
                &profile,
                &generator::JobAnalysis {
                    extracted_keywords: vec![],
                    required_skills: vec![],
                    preferred_skills: vec![],
                    experience_level: "".to_string(),
                    company_tone: "".to_string(),
                    key_responsibilities: vec![],
                    match_score: 0.0,
                    job_title: job.title.clone(),
                    company: job.company.clone(),
                },
            );
            metrics::DOCUMENT_QUALITY_SCORE.observe(quality_score.overall_score);

            println!(
                "✅ Resume generated successfully! Word count: {}",
                document.metadata.word_count
            );
            Ok(document)
        }
        Err(e) => {
            // Record failure metrics
            metrics::DOCUMENT_GENERATION_FAILURES.inc();

            eprintln!("❌ ERROR generating resume: {}", e);
            eprintln!("Error details: {:?}", e);
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

            // Get AI key from credentials if available
            let api_key = conn
                .get_credential("openai")
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

    // Record metrics: start timing
    let start_time = std::time::Instant::now();

    match cover_letter_generator
        .generate_cover_letter(&profile, &job, template_name.as_deref(), improve_with_ai)
        .await
    {
        Ok(document) => {
            let duration = start_time.elapsed().as_secs_f64();

            // Record success metrics
            metrics::DOCUMENTS_GENERATED_TOTAL.inc();
            metrics::DOCUMENT_GENERATION_DURATION.observe(duration);

            Ok(document)
        }
        Err(e) => {
            // Record failure metrics
            metrics::DOCUMENT_GENERATION_FAILURES.inc();
            Err(anyhow::anyhow!("Failed to generate cover letter: {}", e).into())
        }
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

            // Get AI key from credentials if available
            let api_key = conn
                .get_credential("openai")
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

    // Record metrics: start timing
    let start_time = std::time::Instant::now();

    match cover_letter_generator
        .generate_email_version(&profile, &job, template_name.as_deref(), improve_with_ai)
        .await
    {
        Ok(document) => {
            let duration = start_time.elapsed().as_secs_f64();

            // Record success metrics
            metrics::DOCUMENTS_GENERATED_TOTAL.inc();
            metrics::DOCUMENT_GENERATION_DURATION.observe(duration);

            Ok(document)
        }
        Err(e) => {
            // Record failure metrics
            metrics::DOCUMENT_GENERATION_FAILURES.inc();
            Err(anyhow::anyhow!("Failed to generate email version: {}", e).into())
        }
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
    let ai = generator::MultiProviderAI::new();
    let providers = ai.list_available_providers();
    Ok(providers.iter().map(|p| format!("{:?}", p)).collect())
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

            let api_key = conn
                .get_credential("openai")
                .ok()
                .flatten()
                .and_then(|cred| cred.tokens.as_deref().map(|s| s.to_string()));

            (job, api_key)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let mut resume_generator = generator::ResumeGenerator::new();
    if let Some(api_key) = &api_key {
        resume_generator = resume_generator.with_ai_key(api_key.clone());
    }

    let improve_with_ai = improve_with_ai.unwrap_or(false);

    // Record metrics: start timing
    let start_time = std::time::Instant::now();

    match resume_generator
        .generate_resume(&profile, &job, template_name.as_deref(), improve_with_ai)
        .await
    {
        Ok(document) => {
            let duration = start_time.elapsed().as_secs_f64();

            // Record success metrics
            metrics::DOCUMENTS_GENERATED_TOTAL.inc();
            metrics::DOCUMENT_GENERATION_DURATION.observe(duration);

            Ok(document)
        }
        Err(e) => {
            // Record failure metrics
            metrics::DOCUMENT_GENERATION_FAILURES.inc();
            Err(anyhow::anyhow!("Failed to generate resume: {}", e).into())
        }
    }
}

#[tauri::command]
pub async fn generate_bulk_documents(
    state: State<'_, AppState>,
    request: generator::BulkGenerationRequest,
) -> Result<generator::BulkGenerationResult> {
    // Get API key first
    let api_key = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            conn.get_credential("openai")
                .ok()
                .flatten()
                .and_then(|cred| cred.tokens.as_deref().map(|s| s.to_string()))
        } else {
            None
        }
    };

    // Pre-fetch all jobs
    let jobs_map = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let mut map = std::collections::HashMap::new();
            for job_id in &request.job_ids {
                if let Ok(Some(job)) = conn.get_job(*job_id) {
                    map.insert(*job_id, job);
                }
            }
            map
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let get_job = move |job_id: i64| -> anyhow::Result<Option<crate::db::models::Job>> {
        Ok(jobs_map.get(&job_id).cloned())
    };

    let bulk_generator = generator::BulkGenerator::new();
    let api_key_shared = api_key.clone();

    Ok(bulk_generator
        .generate_bulk(request, get_job, move |profile, job, template, improve| {
            let api_key = api_key_shared.clone();
            let profile_owned = profile.clone();
            let job_owned = job.clone();
            let template_owned = template.map(|t| t.to_string());
            async move {
                let mut gen = generator::ResumeGenerator::new();
                if let Some(key) = api_key {
                    gen = gen.with_ai_key(key);
                }
                gen.generate_resume(
                    &profile_owned,
                    &job_owned,
                    template_owned.as_deref(),
                    improve,
                )
                .await
            }
        })
        .await)
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
pub async fn translate_document(
    content: String,
    from_language: String,
    to_language: String,
) -> Result<String> {
    let translator = generator::MultiLanguageTranslator::new();
    let from_lang = generator::Language::from_code(&from_language)
        .ok_or_else(|| anyhow::anyhow!("Invalid from language"))?;
    let to_lang = generator::Language::from_code(&to_language)
        .ok_or_else(|| anyhow::anyhow!("Invalid to language"))?;
    translator
        .translate_document(&content, &from_lang, &to_lang)
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_available_languages() -> Result<Vec<String>> {
    let translator = generator::MultiLanguageTranslator::new();
    Ok(translator
        .get_available_languages()
        .iter()
        .map(|l| l.code().to_string())
        .collect())
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

            // Get AI key from credentials if available
            let api_key = conn
                .get_credential("openai")
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

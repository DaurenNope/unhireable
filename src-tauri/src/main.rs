// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::{anyhow, Context};
use clap::{Arg, ArgAction, Command};
use unhireable_lib::{
    applicator::{ApplicationConfig, JobApplicator},
    db::{
        queries::{CredentialQueries, JobQueries},
        Database,
    },
    generator::{CoverLetterGenerator, PDFExporter, ResumeGenerator, UserProfile},
    matching::JobMatcher,
    persona, scraper,
};
use rusqlite::OptionalExtension;
use std::fs;
use std::path::{Path, PathBuf};

fn resolve_app_paths() -> anyhow::Result<(PathBuf, PathBuf)> {
    if let Ok(custom_db) = std::env::var("UNHIREABLE_DB_PATH") {
        let db_path = PathBuf::from(&custom_db);
        let app_dir = db_path
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .to_path_buf();
        Ok((app_dir, db_path))
    } else {
        let app_dir = dirs::data_dir()
            .ok_or_else(|| anyhow!("Could not find data directory"))?
            .join("unhireable");
        std::fs::create_dir_all(&app_dir)?;
        let db_path = app_dir.join("jobhunter.db");
        Ok((app_dir, db_path))
    }
}

fn apply_document_overrides(
    assets: &mut persona::PersonaAssets,
    resume_override: Option<&str>,
    cover_override: Option<&str>,
) -> anyhow::Result<()> {
    if let Some(path) = resume_override {
        let override_path = Path::new(path);
        assets.resume_path = copy_override_document(&assets.resume_path, override_path)
            .with_context(|| format!("Failed to apply resume override from {}", path))?;
        println!("  • Using custom resume: {}", assets.resume_path.display());
    }

    if let Some(path) = cover_override {
        let override_path = Path::new(path);
        assets.cover_letter_path = copy_override_document(&assets.cover_letter_path, override_path)
            .with_context(|| format!("Failed to apply cover letter override from {}", path))?;
        println!(
            "  • Using custom cover letter: {}",
            assets.cover_letter_path.display()
        );
    }

    Ok(())
}

fn copy_override_document(target_stub: &Path, source: &Path) -> anyhow::Result<PathBuf> {
    if !source.exists() {
        return Err(anyhow!("Override file not found: {}", source.display()));
    }

    let dest_dir = target_stub
        .parent()
        .ok_or_else(|| anyhow!("Persona directory missing"))?;
    let dest_name = source
        .file_name()
        .or_else(|| target_stub.file_name())
        .map(|name| name.to_os_string())
        .ok_or_else(|| anyhow!("Unable to determine override file name"))?;
    let dest_path = dest_dir.join(dest_name);
    fs::copy(source, &dest_path)?;
    Ok(dest_path)
}

fn main() -> anyhow::Result<()> {
    // Check if we're running under Tauri (detected by TAURI_* env vars or by checking args)
    // If so, skip CLI parsing and go straight to Tauri app
    let is_tauri = std::env::var("TAURI_PLATFORM").is_ok()
        || std::env::var("TAURI_DEBUG").is_ok()
        || std::env::args().any(|arg| arg.contains("tauri") || arg == "--no-default-features");
    
    if is_tauri {
        return Ok(unhireable_lib::run());
    }
    
    let matches = Command::new("unhireable")
        .version("0.1.0")
        .about("Unhireable - Neural Career System")
        .arg(Arg::new("query").help("Job search query").index(1))
        .arg(
            Arg::new("scrape")
                .long("scrape")
                .short('s')
                .help("Run scraper with query")
                .value_name("QUERY"),
        )
        .arg(
            Arg::new("sources")
                .long("sources")
                .short('r')
                .help("Specify sources to scrape from (comma-separated)")
                .value_name("SOURCES"),
        )
        .arg(
            Arg::new("apply")
                .long("apply")
                .help("Apply to an existing job by ID")
                .value_name("JOB_ID"),
        )
        .arg(
            Arg::new("auto_submit")
                .long("auto")
                .help("Auto-submit the application if possible")
                .num_args(0),
        )
        .arg(
            Arg::new("ai")
                .long("ai")
                .help("Use AI to improve generated documents (requires OpenAI key in credentials)")
                .num_args(0),
        )
        .arg(
            Arg::new("persona_list")
                .long("persona-list")
                .help("List available personas")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("persona_load")
                .long("persona-load")
                .help("Load persona profile, preferences, and assets")
                .value_name("SLUG")
                .num_args(0..=1),
        )
        .arg(
            Arg::new("persona_dry_run")
                .long("persona-dry-run")
                .help("Run persona dry-run (auto-submits to test endpoint)")
                .value_name("SLUG")
                .num_args(0..=1),
        )
        .arg(
            Arg::new("persona_manual")
                .long("persona-manual")
                .help("Run persona dry-run without auto-submit")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("persona_resume")
                .long("persona-resume")
                .help("Override persona resume with a custom file path")
                .value_name("PATH")
                .num_args(1),
        )
        .arg(
            Arg::new("persona_cover")
                .long("persona-cover")
                .help("Override persona cover letter with a custom file path")
                .value_name("PATH")
                .num_args(1),
        )
        .get_matches();

    if matches.get_flag("persona_list") {
        let personas = persona::list_personas();
        println!("Available personas:");
        for persona in personas {
            println!(
                "• {} ({}) — {}",
                persona.display_name, persona.slug, persona.description
            );
        }
        return Ok(());
    }

    let resume_override = matches.get_one::<String>("persona_resume").cloned();
    let cover_override = matches.get_one::<String>("persona_cover").cloned();

    if matches.contains_id("persona_load") {
        let slug = matches
            .get_one::<String>("persona_load")
            .cloned()
            .unwrap_or_else(|| persona::default_slug().to_string());
        let (app_dir, db_path) = resolve_app_paths()?;
        let db = Database::new(db_path)?;
        let conn = db.get_connection();
        let mut activation = persona::activate_persona(&conn, &app_dir, &slug)?;
        apply_document_overrides(
            &mut activation,
            resume_override.as_deref(),
            cover_override.as_deref(),
        )?;
        println!(
            "Persona '{}' loaded ({})",
            activation.display_name, activation.slug
        );
        println!("  Resume: {}", activation.resume_path.display());
        println!("  Cover letter: {}", activation.cover_letter_path.display());
        println!(
            "  Saved search '{}' (ID: {})",
            activation.saved_search_name, activation.saved_search_id
        );
        return Ok(());
    }

    if matches.contains_id("persona_dry_run") {
        let slug = matches
            .get_one::<String>("persona_dry_run")
            .cloned()
            .unwrap_or_else(|| persona::default_slug().to_string());
        let auto_submit = !matches.get_flag("persona_manual");
        let (app_dir, db_path) = resolve_app_paths()?;
        let db = Database::new(db_path)?;
        let mut setup = {
            let conn = db.get_connection();
            persona::prepare_dry_run(&conn, &app_dir, &slug)?
        };
        apply_document_overrides(
            &mut setup.assets,
            resume_override.as_deref(),
            cover_override.as_deref(),
        )?;
        let persona::PersonaDryRunSetup { assets, job } = setup;
        let job_id = job.id.ok_or_else(|| anyhow!("Test job missing ID"))?;
        let resume_path = assets.resume_path.to_string_lossy().to_string();
        let cover_letter_path = assets.cover_letter_path.to_string_lossy().to_string();

        println!(
            "Persona dry-run staged for '{}' ({})",
            assets.display_name, assets.slug
        );
        println!("  Job [{}]: {}", job_id, job.title);
        println!("  Resume: {}", assets.resume_path.display());
        println!("  Cover letter: {}", assets.cover_letter_path.display());
        println!("  Test endpoint: {}", job.url);
        println!(
            "  Auto-submit: {}",
            if auto_submit {
                "enabled (simulated via test endpoint)"
            } else {
                "disabled (documents staged only)"
            }
        );

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
        let rt = tokio::runtime::Runtime::new()?;
        let result = rt.block_on(applicator.apply_to_job(
            &job,
            &assets.profile,
            Some(resume_path.as_str()),
            Some(cover_letter_path.as_str()),
        ))?;

        println!(
            "Dry-run result: success={} | message={}",
            result.success, result.message
        );
        if let Some(ats_type) = result.ats_type {
            println!("  ATS/Test handler: {}", ats_type);
        }
        if !result.errors.is_empty() {
            println!("  Errors: {:?}", result.errors);
        }
        return Ok(());
    }

    // Dev helper: apply to an existing job by ID with optional AI + auto submit
    if let Some(job_id_str) = matches.get_one::<String>("apply") {
        let job_id: i64 = job_id_str.parse().expect("JOB_ID must be an integer");
        let use_ai = matches.contains_id("ai");
        let auto_submit = matches.contains_id("auto_submit");

        let (app_dir, db_path) = resolve_app_paths()?;
        let db = Database::new(db_path)?;
        let conn = db.get_connection();

        // Load job
        let job = conn
            .get_job(job_id)?
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Job not found"))?;
        println!("Applying to job: {} at {}", job.title, job.company);

        // Load user profile (id=1)
        let profile_json: Option<String> = conn
            .query_row(
                "SELECT profile_data FROM user_profile WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .ok();
        let profile: UserProfile = profile_json
            .as_deref()
            .map(|s| serde_json::from_str(s).expect("Invalid profile JSON"))
            .expect("No user profile found. Save your profile first.");

        // Load best available AI key: Mistral → Gemini → OpenAI
        let ai_key: Option<String> = ["mistral", "gemini", "openai"].iter().find_map(|platform| {
            conn.get_credential(platform).ok().flatten()
                .and_then(|cred| cred.tokens)
        });

        // Generators
        let mut resume_gen = ResumeGenerator::new();
        let mut cover_gen = CoverLetterGenerator::new();
        if let Some(key) = ai_key.clone() {
            resume_gen = resume_gen.with_ai_key(key.clone());
            cover_gen = cover_gen.with_ai_key(key);
        }

        // Generate documents
        let rt = tokio::runtime::Runtime::new()?;
        let resume_doc = rt.block_on(resume_gen.generate_resume(&profile, &job, None, use_ai))?;
        let cover_doc =
            rt.block_on(cover_gen.generate_cover_letter(&profile, &job, None, use_ai))?;

        // Export to files under app data documents/
        let documents_dir = app_dir.join("documents");
        std::fs::create_dir_all(&documents_dir)?;
        let exporter = PDFExporter::new();
        let resume_filename = exporter.generate_filename(&resume_doc);
        let cover_filename = exporter.generate_filename(&cover_doc);
        let resume_path = documents_dir.join(resume_filename);
        let cover_path = documents_dir.join(cover_filename);
        exporter.export_to_pdf(&resume_doc, &resume_path)?;
        exporter.export_to_pdf(&cover_doc, &cover_path)?;
        println!("Generated resume: {}", resume_path.display());
        println!("Generated cover letter: {}", cover_path.display());

        // Apply using applicator
        let config = ApplicationConfig {
            auto_submit,
            upload_resume: true,
            upload_cover_letter: true,
            resume_path: Some(resume_path.to_string_lossy().to_string()),
            cover_letter_path: Some(cover_path.to_string_lossy().to_string()),
            wait_for_confirmation: true,
            timeout_secs: 120,
            ..Default::default()
        };
        let applicator = JobApplicator::with_config(config);
        let result = rt.block_on(applicator.apply_to_job(
            &job,
            &profile,
            Some(resume_path.to_str().unwrap()),
            Some(cover_path.to_str().unwrap()),
        ))?;

        println!(
            "Apply result: success={}, message={}",
            result.success, result.message
        );
        return Ok(());
    }

    // If query is provided as positional argument, run scraper and save to DB
    if let Some(query) = matches.get_one::<String>("query") {
        println!("Scraping jobs for: {}", query);

        let (_app_dir, db_path) = resolve_app_paths()?;
        let db = Database::new(db_path)?;

        // Get sources if specified
        let sources: Vec<String> = matches
            .get_one::<String>("sources")
            .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_default();

        let manager = scraper::ScraperManager::new();
        let jobs_result = if sources.is_empty() {
            manager.scrape_all(query.as_str())
        } else {
            manager.scrape_selected(&sources, query.as_str())
        };

        match jobs_result {
            Ok(mut jobs) => {
                println!("Found {} jobs. Saving to database...", jobs.len());
                let conn = db.get_connection();

                let mut saved_profile: Option<UserProfile> = None;
                match conn
                    .query_row(
                        "SELECT profile_data FROM user_profile WHERE id = 1",
                        [],
                        |row| row.get::<_, String>(0),
                    )
                    .optional()
                {
                    Ok(Some(profile_json)) => match serde_json::from_str(&profile_json) {
                        Ok(profile) => {
                            saved_profile = Some(profile);
                        }
                        Err(err) => {
                            eprintln!("⚠️  Failed to parse saved user profile: {}", err);
                        }
                    },
                    Ok(None) => {
                        println!(
                            "ℹ️  No saved user profile found; match scores will remain unset."
                        );
                    }
                    Err(err) => {
                        eprintln!("⚠️  Failed to load user profile: {}", err);
                    }
                }
                let matcher = saved_profile.as_ref().map(|_| JobMatcher::new());

                let mut saved_count = 0;
                for job in &mut jobs {
                    match conn.get_job_by_url(&job.url) {
                        Ok(Some(_)) => continue,
                        Ok(None) => {
                            if let Err(e) = conn.create_job(job) {
                                eprintln!("Failed to save job {}: {}", job.title, e);
                                continue;
                            }
                            if let (Some(profile), Some(matcher)) =
                                (saved_profile.as_ref(), matcher.as_ref())
                            {
                                let result = matcher.calculate_match(job, profile);
                                job.match_score = Some(result.match_score);
                                if let Err(err) = conn.update_job(job) {
                                    eprintln!(
                                        "⚠️  Failed to persist match score for {}: {}",
                                        job.title, err
                                    );
                                }
                            }
                            saved_count += 1;
                        }
                        Err(e) => {
                            eprintln!("Error checking if job {} exists: {}", job.title, e);
                        }
                    }
                }
                println!("Saved {} new jobs to database.", saved_count);
                for job in &jobs {
                    println!("• {} at {} ({})", job.title, job.company, job.source);
                }
            }
            Err(e) => {
                eprintln!("Error scraping jobs: {}", e);
            }
        }
        return Ok(());
    }

    // If --scrape flag is provided, run scraper and save to DB
    if let Some(query) = matches.get_one::<String>("scrape") {
        println!("Scraping jobs for: {}", query);

        let (_app_dir, db_path) = resolve_app_paths()?;
        let db = Database::new(db_path)?;

        // Get sources if specified
        let sources: Vec<String> = matches
            .get_one::<String>("sources")
            .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_default();

        let manager = scraper::ScraperManager::new();
        let jobs_result = if sources.is_empty() {
            manager.scrape_all(query.as_str())
        } else {
            manager.scrape_selected(&sources, query.as_str())
        };

        match jobs_result {
            Ok(mut jobs) => {
                println!("Found {} jobs. Saving to database...", jobs.len());
                let conn = db.get_connection();

                let mut saved_profile: Option<UserProfile> = None;
                match conn
                    .query_row(
                        "SELECT profile_data FROM user_profile WHERE id = 1",
                        [],
                        |row| row.get::<_, String>(0),
                    )
                    .optional()
                {
                    Ok(Some(profile_json)) => match serde_json::from_str(&profile_json) {
                        Ok(profile) => {
                            saved_profile = Some(profile);
                        }
                        Err(err) => {
                            eprintln!("⚠️  Failed to parse saved user profile: {}", err);
                        }
                    },
                    Ok(None) => {
                        println!(
                            "ℹ️  No saved user profile found; match scores will remain unset."
                        );
                    }
                    Err(err) => {
                        eprintln!("⚠️  Failed to load user profile: {}", err);
                    }
                }
                let matcher = saved_profile.as_ref().map(|_| JobMatcher::new());

                let mut saved_count = 0;
                for job in &mut jobs {
                    match conn.get_job_by_url(&job.url) {
                        Ok(Some(_)) => continue,
                        Ok(None) => {
                            if let Err(e) = conn.create_job(job) {
                                eprintln!("Failed to save job {}: {}", job.title, e);
                                continue;
                            }
                            if let (Some(profile), Some(matcher)) =
                                (saved_profile.as_ref(), matcher.as_ref())
                            {
                                let result = matcher.calculate_match(job, profile);
                                job.match_score = Some(result.match_score);
                                if let Err(err) = conn.update_job(job) {
                                    eprintln!(
                                        "⚠️  Failed to persist match score for {}: {}",
                                        job.title, err
                                    );
                                }
                            }
                            saved_count += 1;
                        }
                        Err(e) => {
                            eprintln!("Error checking if job {} exists: {}", job.title, e);
                        }
                    }
                }
                println!("Saved {} new jobs to database.", saved_count);
                for job in &jobs {
                    println!("• {} at {} ({})", job.title, job.company, job.source);
                }
            }
            Err(e) => {
                eprintln!("Error scraping jobs: {}", e);
            }
        }
        return Ok(());
    }

    // If no scraper arguments, run the Tauri app
    Ok(unhireable_lib::run())
}

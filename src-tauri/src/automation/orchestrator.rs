//! Automation Orchestrator - The main brain of the automation system
//!
//! This orchestrates the full job hunting pipeline:
//! Discovery → Matching → Filtering → Document Generation → Application → Notification

use crate::applicator::JobApplicator;
use crate::automation::config::AutomationConfig;
use crate::automation::pipeline::{
    ApplicationSummary, JobSummary, PipelineResult, PipelineStage, ProcessedJob, StageResult,
};
use crate::automation::status::AutomationStatus;
use crate::db::models::{Application, ApplicationStatus, Job};
use crate::db::queries::{ApplicationQueries, CredentialQueries, JobQueries};
use crate::db::Database;
use crate::generator::{CoverLetterGenerator, ResumeGenerator, UserProfile};
use crate::matching::JobMatcher;
use crate::scraper::ScraperManager;
use anyhow::Result;
use chrono::Utc;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

/// The main automation orchestrator
pub struct AutomationOrchestrator {
    config: Arc<Mutex<AutomationConfig>>,
    status: Arc<Mutex<AutomationStatus>>,
    db: Arc<Mutex<Option<Database>>>,
    app_dir: Arc<Mutex<Option<std::path::PathBuf>>>,
    stop_signal: Arc<Mutex<bool>>,
}

impl AutomationOrchestrator {
    pub fn new(
        config: AutomationConfig,
        db: Arc<Mutex<Option<Database>>>,
        app_dir: Arc<Mutex<Option<std::path::PathBuf>>>,
    ) -> Self {
        Self {
            config: Arc::new(Mutex::new(config)),
            status: Arc::new(Mutex::new(AutomationStatus::default())),
            db,
            app_dir,
            stop_signal: Arc::new(Mutex::new(false)),
        }
    }

    /// Run the full automation pipeline once
    pub async fn run_pipeline(&self, profile: &UserProfile) -> Result<PipelineResult> {
        let start_time = Instant::now();
        let mut result = PipelineResult::new();

        // Mark as started
        {
            let mut status = self.status.lock().await;
            status.mark_started();
        }

        let config = self.config.lock().await.clone();

        println!("\n{}", "=".repeat(60));
        println!("🤖 UNHIREABLE AUTOMATION PIPELINE STARTING");
        println!("{}\n", "=".repeat(60));

        // Stage 1: Discovery
        let jobs = match self.stage_discovery(&config).await {
            Ok((jobs, stage_result)) => {
                result.add_stage_result(stage_result);
                jobs
            }
            Err(e) => {
                result.add_error("discovery", &e.to_string(), None, false);
                self.finalize_run(&mut result, start_time).await;
                return Ok(result);
            }
        };

        if jobs.is_empty() {
            println!("📭 No new jobs found. Pipeline complete.");
            self.finalize_run(&mut result, start_time).await;
            return Ok(result);
        }

        // Stage 2: Matching
        let matched_jobs = match self.stage_matching(jobs, profile, &config).await {
            Ok((jobs, stage_result)) => {
                result.add_stage_result(stage_result);
                jobs
            }
            Err(e) => {
                result.add_error("matching", &e.to_string(), None, true);
                self.finalize_run(&mut result, start_time).await;
                return Ok(result);
            }
        };

        // Stage 3: Filtering
        let filtered_jobs = match self.stage_filtering(matched_jobs, &config).await {
            Ok((jobs, stage_result)) => {
                result.add_stage_result(stage_result);
                jobs
            }
            Err(e) => {
                result.add_error("filtering", &e.to_string(), None, true);
                self.finalize_run(&mut result, start_time).await;
                return Ok(result);
            }
        };

        // Add discovered jobs to result
        for pj in &filtered_jobs {
            result.jobs_discovered.push(JobSummary {
                id: pj.job.id.unwrap_or(0),
                title: pj.job.title.clone(),
                company: pj.job.company.clone(),
                source: pj.job.source.clone(),
                match_score: pj.match_score,
                url: pj.job.url.clone(),
            });
        }

        if filtered_jobs.is_empty() {
            println!("📭 No jobs passed filtering. Pipeline complete.");
            self.finalize_run(&mut result, start_time).await;
            return Ok(result);
        }

        // Stage 4: Document Generation
        let jobs_with_docs = match self
            .stage_document_generation(filtered_jobs, profile, &config)
            .await
        {
            Ok((jobs, stage_result)) => {
                result.add_stage_result(stage_result);
                jobs
            }
            Err(e) => {
                result.add_error("document_generation", &e.to_string(), None, true);
                self.finalize_run(&mut result, start_time).await;
                return Ok(result);
            }
        };

        // Stage 5: Application
        let applied_jobs = match self
            .stage_application(jobs_with_docs, profile, &config)
            .await
        {
            Ok((jobs, stage_result)) => {
                result.add_stage_result(stage_result);
                jobs
            }
            Err(e) => {
                result.add_error("application", &e.to_string(), None, true);
                self.finalize_run(&mut result, start_time).await;
                return Ok(result);
            }
        };

        // Add application results
        for pj in &applied_jobs {
            if let Some(app_result) = &pj.application_result {
                result.jobs_applied.push(app_result.clone());
            }
        }

        // Stage 6: Notification
        if let Err(e) = self.stage_notification(&result, &config).await {
            result.add_error("notification", &e.to_string(), None, true);
        }

        self.finalize_run(&mut result, start_time).await;

        println!("\n{}", "=".repeat(60));
        println!("✅ PIPELINE COMPLETE: {}", result.summary());
        println!("{}\n", "=".repeat(60));

        Ok(result)
    }

    /// Stage 1: Discover jobs from configured sources
    async fn stage_discovery(&self, config: &AutomationConfig) -> Result<(Vec<Job>, StageResult)> {
        let stage_start = Instant::now();

        {
            let mut status = self.status.lock().await;
            status.set_stage(PipelineStage::Discovery.as_str());
        }

        println!("{}", PipelineStage::Discovery.description());

        let mut all_jobs = Vec::new();
        let mut scraper = ScraperManager::new();

        // Get Firecrawl API key if available
        {
            let db_guard = self.db.lock().await;
            if let Some(db) = db_guard.as_ref() {
                let conn = db.get_connection();
                if let Ok(Some(credential)) = conn.get_credential("firecrawl") {
                    if let Some(api_key) = credential.tokens.as_deref() {
                        scraper.set_firecrawl_key(api_key.to_string());
                    }
                }
            }
        }

        // Scrape each query
        for query in &config.search.queries {
            println!("   🔍 Searching: '{}'", query);

            let query_clone = query.clone();
            let sources = config.search.sources.clone();

            let jobs_result = tokio::task::spawn_blocking(move || {
                let scraper = ScraperManager::new();
                if sources.is_empty() {
                    scraper.scrape_all(&query_clone)
                } else {
                    scraper.scrape_selected(&sources, &query_clone)
                }
            })
            .await;

            match jobs_result {
                Ok(Ok(jobs)) => {
                    println!("   ✅ Found {} jobs for '{}'", jobs.len(), query);
                    all_jobs.extend(jobs);
                }
                Ok(Err(e)) => {
                    println!("   ⚠️ Error scraping '{}': {}", query, e);
                }
                Err(e) => {
                    println!("   ⚠️ Task error for '{}': {}", query, e);
                }
            }

            // Rate limiting between queries
            if config.rate_limits.respect_rate_limits {
                tokio::time::sleep(tokio::time::Duration::from_secs(
                    config.rate_limits.source_delay_secs,
                ))
                .await;
            }
        }

        // Deduplicate by URL
        let mut seen_urls = std::collections::HashSet::new();
        all_jobs.retain(|job| seen_urls.insert(job.url.clone()));

        // Limit jobs per run
        if all_jobs.len() > config.search.max_jobs_per_run {
            all_jobs.truncate(config.search.max_jobs_per_run);
        }

        // Save jobs to database
        let saved_count = self.save_jobs_to_db(&all_jobs).await;

        let stage_result = StageResult {
            stage: PipelineStage::Discovery.as_str().to_string(),
            success: true,
            items_processed: all_jobs.len(),
            items_passed: saved_count,
            duration_secs: stage_start.elapsed().as_secs_f64(),
            message: Some(format!(
                "Discovered {} jobs, saved {} new to database",
                all_jobs.len(),
                saved_count
            )),
        };

        println!(
            "   📊 Discovery complete: {} jobs found, {} saved",
            all_jobs.len(),
            saved_count
        );

        Ok((all_jobs, stage_result))
    }

    /// Stage 2: Calculate match scores for jobs
    async fn stage_matching(
        &self,
        jobs: Vec<Job>,
        profile: &UserProfile,
        config: &AutomationConfig,
    ) -> Result<(Vec<ProcessedJob>, StageResult)> {
        let stage_start = Instant::now();

        {
            let mut status = self.status.lock().await;
            status.set_stage(PipelineStage::Matching.as_str());
        }

        println!("{}", PipelineStage::Matching.description());

        let matcher = JobMatcher::new();
        let mut processed_jobs = Vec::new();

        for job in jobs {
            let match_result = matcher.calculate_match(&job, profile);
            let mut processed = ProcessedJob::new(job);
            processed.match_score = match_result.match_score;

            // Update match score in database
            if let Some(job_id) = processed.job.id {
                self.update_job_match_score(job_id, match_result.match_score)
                    .await;
            }

            processed_jobs.push(processed);
        }

        // Sort by match score (highest first)
        processed_jobs.sort_by(|a, b| b.match_score.partial_cmp(&a.match_score).unwrap());

        let above_threshold = processed_jobs
            .iter()
            .filter(|j| j.match_score >= config.filters.min_match_score)
            .count();

        let stage_result = StageResult {
            stage: PipelineStage::Matching.as_str().to_string(),
            success: true,
            items_processed: processed_jobs.len(),
            items_passed: above_threshold,
            duration_secs: stage_start.elapsed().as_secs_f64(),
            message: Some(format!(
                "{} jobs above {}% match threshold",
                above_threshold, config.filters.min_match_score
            )),
        };

        println!(
            "   📊 Matching complete: {} jobs scored, {} above threshold",
            processed_jobs.len(),
            above_threshold
        );

        Ok((processed_jobs, stage_result))
    }

    /// Stage 3: Filter jobs based on criteria
    async fn stage_filtering(
        &self,
        jobs: Vec<ProcessedJob>,
        config: &AutomationConfig,
    ) -> Result<(Vec<ProcessedJob>, StageResult)> {
        let stage_start = Instant::now();

        {
            let mut status = self.status.lock().await;
            status.set_stage(PipelineStage::Filtering.as_str());
        }

        println!("{}", PipelineStage::Filtering.description());

        let filters = &config.filters;
        let mut filtered_jobs = Vec::new();
        let total_jobs = jobs.len();

        for mut job in jobs {
            // Match score filter
            if job.match_score < filters.min_match_score {
                job.fail_filter(&format!(
                    "Match score {:.0}% below threshold {}%",
                    job.match_score, filters.min_match_score
                ));
                continue;
            }

            // Remote only filter
            if filters.remote_only {
                let is_remote = job
                    .job
                    .location
                    .as_ref()
                    .map(|loc| {
                        let loc_lower = loc.to_lowercase();
                        loc_lower.contains("remote") || loc_lower.contains("anywhere")
                    })
                    .unwrap_or(false);

                if !is_remote {
                    job.fail_filter("Not a remote position");
                    continue;
                }
            }

            // Excluded keywords filter
            let title_lower = job.job.title.to_lowercase();
            let desc_lower = job
                .job
                .description
                .as_ref()
                .map(|d| d.to_lowercase())
                .unwrap_or_default();

            let has_excluded = filters.excluded_keywords.iter().any(|kw| {
                let kw_lower = kw.to_lowercase();
                title_lower.contains(&kw_lower) || desc_lower.contains(&kw_lower)
            });

            if has_excluded {
                job.fail_filter("Contains excluded keyword");
                continue;
            }

            // Required keywords filter (if any specified)
            if !filters.required_keywords.is_empty() {
                let has_required = filters.required_keywords.iter().any(|kw| {
                    let kw_lower = kw.to_lowercase();
                    title_lower.contains(&kw_lower) || desc_lower.contains(&kw_lower)
                });

                if !has_required {
                    job.fail_filter("Missing required keyword");
                    continue;
                }
            }

            // Excluded companies filter
            let company_lower = job.job.company.to_lowercase();
            let is_excluded_company = filters
                .excluded_companies
                .iter()
                .any(|c| company_lower.contains(&c.to_lowercase()));

            if is_excluded_company {
                job.fail_filter("Company is in excluded list");
                continue;
            }

            // Skip already applied
            if config.application.skip_already_applied {
                if self.has_already_applied(&job.job).await {
                    job.fail_filter("Already applied to this job");
                    continue;
                }
            }

            // Salary filter (if salary info available)
            if let Some(min_salary) = filters.min_salary {
                if let Some(salary_str) = &job.job.salary {
                    if let Some(salary) = self.parse_salary(salary_str) {
                        if salary < min_salary as f64 {
                            job.fail_filter(&format!("Salary below minimum ${}", min_salary));
                            continue;
                        }
                    }
                }
            }

            filtered_jobs.push(job);
        }

        // Limit to max applications per run
        if filtered_jobs.len() > config.application.max_applications_per_run {
            filtered_jobs.truncate(config.application.max_applications_per_run);
        }

        let stage_result = StageResult {
            stage: PipelineStage::Filtering.as_str().to_string(),
            success: true,
            items_processed: total_jobs,
            items_passed: filtered_jobs.len(),
            duration_secs: stage_start.elapsed().as_secs_f64(),
            message: Some(format!("{} jobs passed all filters", filtered_jobs.len())),
        };

        println!(
            "   📊 Filtering complete: {} jobs passed filters",
            filtered_jobs.len()
        );

        Ok((filtered_jobs, stage_result))
    }

    /// Stage 4: Generate documents for filtered jobs
    async fn stage_document_generation(
        &self,
        mut jobs: Vec<ProcessedJob>,
        profile: &UserProfile,
        config: &AutomationConfig,
    ) -> Result<(Vec<ProcessedJob>, StageResult)> {
        let stage_start = Instant::now();

        {
            let mut status = self.status.lock().await;
            status.set_stage(PipelineStage::DocumentGeneration.as_str());
        }

        println!("{}", PipelineStage::DocumentGeneration.description());

        let jobs_count = jobs.len();

        if !config.documents.generate_resume && !config.documents.generate_cover_letter {
            println!("   ⏭️ Document generation disabled, skipping");
            return Ok((
                jobs,
                StageResult {
                    stage: PipelineStage::DocumentGeneration.as_str().to_string(),
                    success: true,
                    items_processed: 0,
                    items_passed: jobs_count,
                    duration_secs: stage_start.elapsed().as_secs_f64(),
                    message: Some("Document generation disabled".to_string()),
                },
            ));
        }

        // Get AI API key if available
        let api_key = self.get_ai_api_key().await;
        let app_dir = self.app_dir.lock().await.clone();

        let mut docs_generated = 0;

        for job in &mut jobs {
            println!(
                "   📄 Generating docs for: {} at {}",
                job.job.title, job.job.company
            );

            // Generate resume
            if config.documents.generate_resume {
                let mut resume_gen = ResumeGenerator::new();
                if let Some(ref key) = api_key {
                    if config.documents.use_ai_enhancement {
                        resume_gen = resume_gen.with_ai_key(key.clone());
                    }
                }

                match resume_gen
                    .generate_resume(
                        profile,
                        &job.job,
                        Some(&config.documents.resume_template),
                        config.documents.use_ai_enhancement && api_key.is_some(),
                    )
                    .await
                {
                    Ok(_doc) => {
                        // Export to PDF if configured
                        if config.documents.export_to_pdf {
                            if let Some(ref dir) = app_dir {
                                let pdf_path = dir.join(format!(
                                    "resume_{}_{}.pdf",
                                    job.job.company.replace(' ', "_"),
                                    job.job.id.unwrap_or(0)
                                ));
                                // Note: PDF export would happen here
                                job.resume_path = Some(pdf_path.to_string_lossy().to_string());
                            }
                        }
                        docs_generated += 1;
                    }
                    Err(e) => {
                        println!("   ⚠️ Resume generation failed: {}", e);
                    }
                }
            }

            // Generate cover letter
            if config.documents.generate_cover_letter {
                let mut cl_gen = CoverLetterGenerator::new();
                if let Some(ref key) = api_key {
                    if config.documents.use_ai_enhancement {
                        cl_gen = cl_gen.with_ai_key(key.clone());
                    }
                }

                match cl_gen
                    .generate_cover_letter(
                        profile,
                        &job.job,
                        Some(&config.documents.cover_letter_template),
                        config.documents.use_ai_enhancement && api_key.is_some(),
                    )
                    .await
                {
                    Ok(_doc) => {
                        if config.documents.export_to_pdf {
                            if let Some(ref dir) = app_dir {
                                let pdf_path = dir.join(format!(
                                    "cover_letter_{}_{}.pdf",
                                    job.job.company.replace(' ', "_"),
                                    job.job.id.unwrap_or(0)
                                ));
                                job.cover_letter_path =
                                    Some(pdf_path.to_string_lossy().to_string());
                            }
                        }
                        docs_generated += 1;
                    }
                    Err(e) => {
                        println!("   ⚠️ Cover letter generation failed: {}", e);
                    }
                }
            }
        }

        let stage_result = StageResult {
            stage: PipelineStage::DocumentGeneration.as_str().to_string(),
            success: true,
            items_processed: jobs_count,
            items_passed: jobs_count,
            duration_secs: stage_start.elapsed().as_secs_f64(),
            message: Some(format!("{} documents generated", docs_generated)),
        };

        println!(
            "   📊 Document generation complete: {} docs created",
            docs_generated
        );

        Ok((jobs, stage_result))
    }

    /// Stage 5: Apply to jobs
    async fn stage_application(
        &self,
        mut jobs: Vec<ProcessedJob>,
        profile: &UserProfile,
        config: &AutomationConfig,
    ) -> Result<(Vec<ProcessedJob>, StageResult)> {
        let stage_start = Instant::now();

        {
            let mut status = self.status.lock().await;
            status.set_stage(PipelineStage::Application.as_str());
        }

        println!("{}", PipelineStage::Application.description());

        if config.application.dry_run {
            println!("   🧪 DRY RUN MODE - No applications will be submitted");
        }

        let mut successful = 0;
        let mut failed = 0;
        let total_jobs = jobs.len();

        for (idx, job) in jobs.iter_mut().enumerate() {
            // Check stop signal
            if *self.stop_signal.lock().await {
                println!("   🛑 Stop signal received, halting applications");
                break;
            }

            println!(
                "   📝 [{}/{}] Applying to: {} at {}",
                idx + 1,
                total_jobs,
                job.job.title,
                job.job.company
            );

            let app_config = crate::applicator::ApplicationConfig {
                auto_submit: config.application.auto_submit && !config.application.dry_run,
                upload_resume: true,
                upload_cover_letter: config.documents.generate_cover_letter,
                resume_path: job.resume_path.clone(),
                cover_letter_path: job.cover_letter_path.clone(),
                wait_for_confirmation: false,
                timeout_secs: 120,
                ..Default::default()
            };

            let applicator = JobApplicator::with_config(app_config);

            let result = if config.application.dry_run {
                // Simulate application in dry run mode
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                Ok(crate::applicator::ApplicationResult {
                    success: true,
                    application_id: None,
                    message: "Dry run - application simulated".to_string(),
                    applied_at: Some(Utc::now()),
                    ats_type: Some("DryRun".to_string()),
                    errors: vec![],
                })
            } else {
                applicator
                    .apply_to_job(
                        &job.job,
                        profile,
                        job.resume_path.as_deref(),
                        job.cover_letter_path.as_deref(),
                    )
                    .await
            };

            match result {
                Ok(app_result) => {
                    job.application_result = Some(ApplicationSummary {
                        job_id: job.job.id.unwrap_or(0),
                        job_title: job.job.title.clone(),
                        company: job.job.company.clone(),
                        success: app_result.success,
                        ats_type: app_result.ats_type.clone(),
                        message: app_result.message.clone(),
                    });

                    if app_result.success {
                        successful += 1;
                        println!("   ✅ Application successful");

                        // Record in database
                        self.record_application(&job.job, &app_result).await;
                    } else {
                        failed += 1;
                        println!("   ❌ Application failed: {}", app_result.message);
                    }
                }
                Err(e) => {
                    failed += 1;
                    println!("   ❌ Application error: {}", e);
                    job.application_result = Some(ApplicationSummary {
                        job_id: job.job.id.unwrap_or(0),
                        job_title: job.job.title.clone(),
                        company: job.job.company.clone(),
                        success: false,
                        ats_type: None,
                        message: e.to_string(),
                    });
                }
            }

            // Delay between applications
            if idx < total_jobs - 1 {
                let delay = config.application.delay_between_applications;
                println!("   ⏳ Waiting {}s before next application...", delay);
                tokio::time::sleep(tokio::time::Duration::from_secs(delay)).await;
            }
        }

        let stage_result = StageResult {
            stage: PipelineStage::Application.as_str().to_string(),
            success: failed == 0 || successful > 0,
            items_processed: total_jobs,
            items_passed: successful,
            duration_secs: stage_start.elapsed().as_secs_f64(),
            message: Some(format!(
                "{} successful, {} failed{}",
                successful,
                failed,
                if config.application.dry_run {
                    " (dry run)"
                } else {
                    ""
                }
            )),
        };

        println!(
            "   📊 Applications complete: {} successful, {} failed",
            successful, failed
        );

        Ok((jobs, stage_result))
    }

    /// Stage 6: Send notifications
    async fn stage_notification(
        &self,
        result: &PipelineResult,
        config: &AutomationConfig,
    ) -> Result<()> {
        {
            let mut status = self.status.lock().await;
            status.set_stage(PipelineStage::Notification.as_str());
        }

        println!("{}", PipelineStage::Notification.description());

        let notif_config = &config.notifications;

        if !notif_config.desktop_notifications && !notif_config.email_notifications {
            println!("   ⏭️ Notifications disabled");
            return Ok(());
        }

        let successful_apps = result.jobs_applied.iter().filter(|a| a.success).count();
        let new_jobs = result.jobs_discovered.len();

        // Desktop notification
        if notif_config.desktop_notifications {
            let _title = "Unhireable Automation Complete";
            let body = format!(
                "Found {} jobs, applied to {} ({} successful)",
                new_jobs,
                result.jobs_applied.len(),
                successful_apps
            );
            println!("   🔔 Desktop notification: {}", body);
            // Note: Actual desktop notification would be sent via Tauri
        }

        // Email notification
        if notif_config.email_notifications {
            if let Some(email) = &notif_config.notification_email {
                println!("   📧 Email notification would be sent to: {}", email);
                // Note: Actual email would be sent via EmailService
            }
        }

        println!("   📊 Notifications complete");

        Ok(())
    }

    /// Finalize the automation run
    async fn finalize_run(&self, result: &mut PipelineResult, start_time: Instant) {
        result.duration_secs = start_time.elapsed().as_secs_f64();

        let mut status = self.status.lock().await;
        status.mark_completed();

        if let Some(ref mut run) = status.current_run {
            run.jobs_scraped = result.jobs_discovered.len();
            run.applications_attempted = result.jobs_applied.len();
            run.applications_successful = result.jobs_applied.iter().filter(|a| a.success).count();
            run.applications_failed = result.jobs_applied.iter().filter(|a| !a.success).count();
            run.duration_secs = result.duration_secs;
        }
    }

    // Helper methods

    async fn save_jobs_to_db(&self, jobs: &[Job]) -> usize {
        let db_guard = self.db.lock().await;
        if let Some(db) = db_guard.as_ref() {
            let conn = db.get_connection();
            let mut saved = 0;
            for job in jobs {
                // Check if job already exists
                if conn.get_job_by_url(&job.url).unwrap_or(None).is_none() {
                    let mut job_clone = job.clone();
                    if conn.create_job(&mut job_clone).is_ok() {
                        saved += 1;
                    }
                }
            }
            saved
        } else {
            0
        }
    }

    async fn update_job_match_score(&self, job_id: i64, score: f64) {
        let db_guard = self.db.lock().await;
        if let Some(db) = db_guard.as_ref() {
            let conn = db.get_connection();
            if let Ok(Some(mut job)) = conn.get_job(job_id) {
                job.match_score = Some(score);
                let _ = conn.update_job(&job);
            }
        }
    }

    async fn has_already_applied(&self, job: &Job) -> bool {
        let db_guard = self.db.lock().await;
        if let Some(db) = db_guard.as_ref() {
            let conn = db.get_connection();
            if let Some(job_id) = job.id {
                if let Ok(apps) = conn.list_applications(Some(job_id), None) {
                    return !apps.is_empty();
                }
            }
        }
        false
    }

    async fn get_ai_api_key(&self) -> Option<String> {
        let db_guard = self.db.lock().await;
        if let Some(db) = db_guard.as_ref() {
            let conn = db.get_connection();
            if let Ok(Some(cred)) = conn.get_credential("openai") {
                return cred.tokens.as_deref().map(|s| s.to_string());
            }
        }
        None
    }

    async fn record_application(&self, job: &Job, result: &crate::applicator::ApplicationResult) {
        let db_guard = self.db.lock().await;
        if let Some(db) = db_guard.as_ref() {
            let conn = db.get_connection();
            if let Some(job_id) = job.id {
                let mut application = Application {
                    id: None,
                    job_id,
                    applied_at: result.applied_at,
                    status: if result.success {
                        ApplicationStatus::Submitted
                    } else {
                        ApplicationStatus::Preparing
                    },
                    notes: Some(format!(
                        "Auto-applied via automation. ATS: {:?}. Message: {}",
                        result.ats_type, result.message
                    )),
                    created_at: None,
                    updated_at: None,
                    ..Default::default()
                };
                let _ = conn.create_application(&mut application);
            }
        }
    }

    fn parse_salary(&self, salary_str: &str) -> Option<f64> {
        // Simple salary parser - extracts first number found
        let re = regex::Regex::new(r"\$?([\d,]+)").ok()?;
        re.captures(salary_str)
            .and_then(|cap| cap.get(1))
            .and_then(|m| m.as_str().replace(',', "").parse::<f64>().ok())
    }

    /// Get current automation status
    pub async fn get_status(&self) -> AutomationStatus {
        self.status.lock().await.clone()
    }

    /// Get current configuration
    pub async fn get_config(&self) -> AutomationConfig {
        self.config.lock().await.clone()
    }

    /// Update configuration
    pub async fn update_config(&self, config: AutomationConfig) {
        *self.config.lock().await = config;
    }

    /// Request stop
    pub async fn request_stop(&self) {
        *self.stop_signal.lock().await = true;
    }

    /// Check if running
    pub async fn is_running(&self) -> bool {
        self.status.lock().await.running
    }
}

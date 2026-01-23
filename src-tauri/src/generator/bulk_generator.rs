use crate::db::models::Job;
use crate::generator::{GeneratedDocument, GenerationResult, UserProfile};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkGenerationRequest {
    pub job_ids: Vec<i64>,
    pub profile: UserProfile,
    pub template_name: Option<String>,
    pub improve_with_ai: bool,
    pub max_concurrent: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkGenerationResult {
    pub total: usize,
    pub successful: usize,
    pub failed: usize,
    pub results: Vec<JobGenerationResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobGenerationResult {
    pub job_id: i64,
    pub job_title: String,
    pub company: String,
    pub success: bool,
    pub document: Option<GeneratedDocument>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

pub struct BulkGenerator {
    // This will be used with a closure passed to generate_bulk
}

impl BulkGenerator {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn generate_bulk<F, Fut>(
        &self,
        request: BulkGenerationRequest,
        get_job: impl Fn(i64) -> Result<Option<Job>> + Send + Sync + Clone + 'static,
        generator_fn: F,
    ) -> BulkGenerationResult
    where
        F: Fn(&UserProfile, &Job, Option<&str>, bool) -> Fut + Send + Sync + Clone + 'static,
        Fut: std::future::Future<Output = GenerationResult> + Send,
    {
        let max_concurrent = request.max_concurrent.unwrap_or(5);
        let semaphore = Arc::new(Semaphore::new(max_concurrent));
        let mut results = Vec::new();

        let mut handles = Vec::new();

        for job_id in request.job_ids {
            let generator_fn = generator_fn.clone();
            let profile = request.profile.clone();
            let template_name = request.template_name.clone();
            let improve_with_ai = request.improve_with_ai;
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let get_job_fn = get_job.clone();

            let handle = tokio::spawn(async move {
                let start_time = std::time::Instant::now();
                
                let job_result = match get_job_fn(job_id) {
                    Ok(Some(job)) => {
                        let result = generator_fn(&profile, &job, template_name.as_deref(), improve_with_ai).await;
                        
                        match result {
                            Ok(document) => JobGenerationResult {
                                job_id,
                                job_title: job.title.clone(),
                                company: job.company.clone(),
                                success: true,
                                document: Some(document),
                                error: None,
                                duration_ms: start_time.elapsed().as_millis() as u64,
                            },
                            Err(e) => JobGenerationResult {
                                job_id,
                                job_title: job.title.clone(),
                                company: job.company.clone(),
                                success: false,
                                document: None,
                                error: Some(e.to_string()),
                                duration_ms: start_time.elapsed().as_millis() as u64,
                            },
                        }
                    }
                    Ok(None) => JobGenerationResult {
                        job_id,
                        job_title: "Unknown".to_string(),
                        company: "Unknown".to_string(),
                        success: false,
                        document: None,
                        error: Some(format!("Job {} not found", job_id)),
                        duration_ms: start_time.elapsed().as_millis() as u64,
                    },
                    Err(e) => JobGenerationResult {
                        job_id,
                        job_title: "Unknown".to_string(),
                        company: "Unknown".to_string(),
                        success: false,
                        document: None,
                        error: Some(e.to_string()),
                        duration_ms: start_time.elapsed().as_millis() as u64,
                    },
                };

                drop(permit);
                job_result
            });

            handles.push(handle);
        }

        // Wait for all tasks to complete
        for handle in handles {
            if let Ok(result) = handle.await {
                results.push(result);
            }
        }

        let successful = results.iter().filter(|r| r.success).count();
        let failed = results.len() - successful;

        BulkGenerationResult {
            total: results.len(),
            successful,
            failed,
            results,
        }
    }
}

impl Default for BulkGenerator {
    fn default() -> Self {
        Self::new()
    }
}


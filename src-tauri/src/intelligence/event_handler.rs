/// Event handler for Intelligence Agent
/// Handles event-driven job matching

use crate::db::queries::JobQueries;
use crate::error::Result;
use crate::events::{Event, EventBus, event_types};
use crate::intelligence::IntelligenceAgent;
use crate::matching::JobMatcher;
use crate::generator::UserProfile;
use crate::cache::Cache;
use crate::metrics;
use anyhow::Context;
use chrono::Utc;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::time::Instant;

/// Event handler for Intelligence Agent operations
pub struct IntelligenceEventHandler {
    intelligence_agent: Arc<IntelligenceAgent>,
    matcher: Arc<JobMatcher>,
    match_cache: Arc<Cache<String, serde_json::Value>>,
    event_bus: Arc<EventBus>,
    db: Arc<Mutex<Option<crate::db::Database>>>,
}

impl IntelligenceEventHandler {
    /// Create new event handler
    pub fn new(
        intelligence_agent: Arc<IntelligenceAgent>,
        matcher: Arc<JobMatcher>,
        cache: Arc<Cache<String, serde_json::Value>>,
        event_bus: Arc<EventBus>,
        db: Arc<Mutex<Option<crate::db::Database>>>,
    ) -> Self {
        Self {
            intelligence_agent,
            matcher,
            match_cache: cache,
            event_bus,
            db,
        }
    }

    /// Initialize event subscriptions
    pub async fn initialize(&self) -> Result<()> {
        // Subscribe to JOB_CREATED events
        let agent_clone = self.intelligence_agent.clone();
        let matcher_clone = self.matcher.clone();
        let cache_clone = self.match_cache.clone();
        let db_clone = self.db.clone();
        let event_bus_clone = self.event_bus.clone();

        self.event_bus
            .subscribe(event_types::JOB_CREATED.to_string(), move |event| {
                let agent = agent_clone.clone();
                let matcher = matcher_clone.clone();
                let cache = cache_clone.clone();
                let db = db_clone.clone();
                let event_bus = event_bus_clone.clone();

                // Spawn async task to handle job matching
                let event_clone = event.clone();
                tokio::spawn(async move {
                    if let Err(e) = Self::handle_job_created(
                        event_clone,
                        agent,
                        matcher,
                        cache,
                        db,
                        event_bus,
                    ).await {
                        tracing::error!("Error handling job created event: {}", e);
                    }
                });

                Ok(())
            })
            .await;

        tracing::info!("Intelligence Agent event handlers initialized");
        Ok(())
    }

    /// Handle JOB_CREATED event
    async fn handle_job_created(
        event: Event,
        intelligence_agent: Arc<IntelligenceAgent>,
        matcher: Arc<JobMatcher>,
        cache: Arc<Cache<String, serde_json::Value>>,
        db: Arc<Mutex<Option<crate::db::Database>>>,
        event_bus: Arc<EventBus>,
    ) -> Result<()> {
        let start_time = Instant::now();
        
        // Extract job ID from event payload
        let job_id = event.payload
            .get("job_id")
            .and_then(|v| v.as_i64())
            .context("Missing job_id in event payload")?;

        // Check cache first
        let cache_key = format!("match_score:{}", job_id);
        if let Some(cached_value) = cache.get(&cache_key).await {
            if let Some(cached_score) = cached_value.as_f64() {
                metrics::CACHE_HITS.inc();
                tracing::debug!("Using cached match score for job {}: {}", job_id, cached_score);
                
                // Publish JOB_MATCHED event with cached score
                let matched_event = Event {
                    id: uuid::Uuid::new_v4().to_string(),
                    event_type: event_types::JOB_MATCHED.to_string(),
                    payload: json!({
                        "job_id": job_id,
                        "match_score": cached_score,
                        "cached": true,
                    }),
                    timestamp: Utc::now(),
                };
                event_bus.publish(matched_event).await?;
                
                // Also publish MATCH_CALCULATED for backward compatibility
                let calculated_event = Event {
                    id: uuid::Uuid::new_v4().to_string(),
                    event_type: event_types::MATCH_CALCULATED.to_string(),
                    payload: json!({
                        "job_id": job_id,
                        "match_score": cached_score,
                        "cached": true,
                    }),
                    timestamp: Utc::now(),
                };
                event_bus.publish(calculated_event).await?;
                
                metrics::CACHE_HITS.inc();
                metrics::MATCH_CALCULATIONS_TOTAL.inc();
                metrics::MATCH_CALCULATION_DURATION.observe(start_time.elapsed().as_secs_f64());
                
                return Ok(());
            }
        }
        
        metrics::CACHE_MISSES.inc();

        // Get job from database
        let job = {
            let db_guard = db.lock().await;
            let db_instance = db_guard
                .as_ref()
                .context("Database not initialized")?;
            let conn = db_instance.get_connection();
            let job = conn
                .get_job(job_id)?
                .context(format!("Job {} not found", job_id))?;
            job
        };

        // Get user profile for matching
        let profile = Self::get_user_profile().ok();

        // Calculate match score using Intelligence Agent (if available) or local matcher
        let match_score = if let Some(profile) = &profile {
            // Try Intelligence Agent first
            let job_text = format!(
                "{}\n{}\n{}",
                job.title,
                job.description.as_deref().unwrap_or(""),
                job.requirements.as_deref().unwrap_or("")
            );

            // Extract skills from profile
            let skills: Vec<String> = profile.skills.technical_skills.clone();
            let total_years: u32 = profile.skills.experience_years.values().sum();
            let experience_years = Some(total_years as f64);

            // Try Intelligence Agent API
            let api_start = Instant::now();
            metrics::INTELLIGENCE_API_CALLS.inc();
            
            match intelligence_agent
                .calculate_match(
                    &job_text,
                    None, // Resume text not available in UserProfile
                    Some(&skills),
                    experience_years,
                    job.location.as_deref(),
                )
                .await
            {
                Ok(response) => {
                    metrics::INTELLIGENCE_API_DURATION.observe(api_start.elapsed().as_secs_f64());
                    response.match_score
                }
                Err(e) => {
                    metrics::INTELLIGENCE_API_ERRORS.inc();
                    metrics::INTELLIGENCE_API_DURATION.observe(api_start.elapsed().as_secs_f64());
                    tracing::warn!(
                        "Intelligence Agent unavailable, using local matcher: {}",
                        e
                    );
                    // Fallback to local matcher
                    let match_result = matcher.calculate_match(&job, profile);
                    match_result.match_score
                }
            }
        } else {
            // No profile, use a default score
            0.0
        };

        // Cache the match score
        cache.set(cache_key.clone(), json!(match_score), None).await?;

        // Update job in database with match score
        {
            let db_guard = db.lock().await;
            let db_instance = db_guard
                .as_ref()
                .context("Database not initialized")?;
            let conn = db_instance.get_connection();

            let mut updated_job = job.clone();
            updated_job.match_score = Some(match_score);
            conn.update_job(&updated_job)?;
        }

        // Publish JOB_MATCHED event
        let matched_event = Event {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: event_types::JOB_MATCHED.to_string(),
            payload: json!({
                "job_id": job_id,
                "match_score": match_score,
                "cached": false,
            }),
            timestamp: Utc::now(),
        };
        event_bus.publish(matched_event).await?;
        
        // Also publish MATCH_CALCULATED for backward compatibility
        let calculated_event = Event {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: event_types::MATCH_CALCULATED.to_string(),
            payload: json!({
                "job_id": job_id,
                "match_score": match_score,
                "cached": false,
            }),
            timestamp: Utc::now(),
        };
        event_bus.publish(calculated_event).await?;

        // Record metrics
        metrics::MATCH_CALCULATIONS_TOTAL.inc();
        metrics::MATCH_CALCULATION_DURATION.observe(start_time.elapsed().as_secs_f64());

        tracing::info!(
            "Calculated match score for job {}: {} (took {:?})",
            job_id,
            match_score,
            start_time.elapsed()
        );

        Ok(())
    }

    /// Handle batch job matching
    pub async fn handle_batch_matching(
        &self,
        job_ids: Vec<i64>,
    ) -> Result<()> {
        let start_time = Instant::now();
        
        tracing::info!("Starting batch matching for {} jobs", job_ids.len());

        let jobs = {
            let db_guard = self.db.lock().await;
            let db_instance = db_guard
                .as_ref()
                .context("Database not initialized")?;
            let conn = db_instance.get_connection();
            let jobs: Vec<_> = job_ids
                .iter()
                .filter_map(|id| conn.get_job(*id).ok().flatten())
                .collect();
            jobs
        };

        let mut tasks = Vec::new();
        for job in jobs {
            let agent = self.intelligence_agent.clone();
            let matcher = self.matcher.clone();
            let task_cache = self.match_cache.clone();
            let event_bus = self.event_bus.clone();
            let db = self.db.clone();

            let task = tokio::spawn(async move {
                let event = Event {
                    id: uuid::Uuid::new_v4().to_string(),
                    event_type: event_types::JOB_CREATED.to_string(),
                    payload: json!({
                        "job_id": job.id,
                    }),
                    timestamp: Utc::now(),
                };

                Self::handle_job_created(
                    event,
                    agent,
                    matcher,
                    task_cache,
                    db,
                    event_bus,
                ).await
            });

            tasks.push(task);
        }

        // Wait for all tasks to complete
        for task in tasks {
            match task.await {
                Ok(Ok(_)) => {}
                Ok(Err(e)) => {
                    tracing::error!("Error in batch matching task: {}", e);
                }
                Err(e) => {
                    tracing::error!("Task join error: {}", e);
                }
            }
        }

        metrics::BATCH_MATCH_DURATION.observe(start_time.elapsed().as_secs_f64());
        
        tracing::info!(
            "Completed batch matching for {} jobs (took {:?})",
            job_ids.len(),
            start_time.elapsed()
        );

        Ok(())
    }

    /// Get user profile from database
    fn get_user_profile() -> Result<UserProfile> {
        // Try to get profile from persona or resume analyzer
        // For now, return a basic profile structure
        // This should be enhanced to actually load user profile from persona
        use crate::generator::{PersonalInfo, SkillsProfile};
        use std::collections::HashMap;
        
        Ok(UserProfile {
            personal_info: PersonalInfo {
                name: "User".to_string(),
                email: "user@example.com".to_string(),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                portfolio: None,
            },
            summary: "Experienced professional".to_string(),
            skills: SkillsProfile {
                technical_skills: vec![],
                soft_skills: vec![],
                experience_years: HashMap::new(),
                proficiency_levels: HashMap::new(),
            },
            experience: vec![],
            education: vec![],
            projects: vec![],
        })
    }
}


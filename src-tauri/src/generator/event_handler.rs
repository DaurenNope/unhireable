use crate::db::models::{Application, Job};
use crate::events::{Event, EventBus};
use crate::generator::{DocumentCache, ResumeGenerator, UserProfile};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct DocumentGenerationEventHandler {
    cache: Arc<Mutex<DocumentCache>>,
    event_bus: Arc<EventBus>,
}

impl DocumentGenerationEventHandler {
    pub fn new(cache: Arc<Mutex<DocumentCache>>, event_bus: Arc<EventBus>) -> Self {
        Self { cache, event_bus }
    }

    pub async fn handle_application_created(
        &self,
        event: &Event,
        get_application: impl Fn(i64) -> Result<Option<Application>>,
        get_job: impl Fn(i64) -> Result<Option<Job>>,
        get_profile: impl Fn() -> Result<Option<UserProfile>>,
        get_api_key: impl Fn() -> Result<Option<String>>,
    ) -> Result<()> {
        let application_id = event
            .payload
            .get("application_id")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow::anyhow!("Missing application_id in event"))?;

        let job_id = event
            .payload
            .get("job_id")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow::anyhow!("Missing job_id in event"))?;

        // Get application, job, and profile
        let _application = get_application(application_id)?
            .ok_or_else(|| anyhow::anyhow!("Application not found"))?;
        let job = get_job(job_id)?
            .ok_or_else(|| anyhow::anyhow!("Job not found"))?;
        let profile = get_profile()?
            .ok_or_else(|| anyhow::anyhow!("User profile not found"))?;

        // Generate cache key
        let profile_hash = format!("{:x}", {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            serde_json::to_string(&profile).unwrap_or_default().hash(&mut hasher);
            hasher.finish()
        });

        let cache_key = DocumentCache::generate_key(&profile_hash, job_id, "resume_modern", true);

        // Check cache first
        let mut cache = self.cache.lock().await;
        if let Some(_cached_doc) = cache.get(&cache_key) {
            // Publish DOCUMENT_GENERATED event with cached document
            let doc_event = Event {
                id: Uuid::new_v4().to_string(),
                event_type: crate::events::event_types::DOCUMENT_GENERATED.to_string(),
                payload: serde_json::json!({
                    "application_id": application_id,
                    "job_id": job_id,
                    "document_type": "resume",
                    "cached": true,
                    "document_id": cache_key,
                }),
                timestamp: chrono::Utc::now(),
            };
            self.event_bus.publish(doc_event).await?;
            return Ok(());
        }
        drop(cache);

        // Generate documents
        let api_key = get_api_key()?;
        let mut resume_generator = ResumeGenerator::new();
        if let Some(key) = &api_key {
            resume_generator = resume_generator.with_ai_key(key.clone());
        }

        match resume_generator
            .generate_resume(&profile, &job, Some("resume_modern"), true)
            .await
        {
            Ok(document) => {
                // Cache the document
                let mut cache = self.cache.lock().await;
                cache.set(cache_key.clone(), document.clone(), Some(86400))?; // 24 hours TTL
                drop(cache);

                // Publish DOCUMENT_GENERATED event
                let doc_event = Event {
                    id: Uuid::new_v4().to_string(),
                    event_type: crate::events::event_types::DOCUMENT_GENERATED.to_string(),
                    payload: serde_json::json!({
                        "application_id": application_id,
                        "job_id": job_id,
                        "document_type": "resume",
                        "cached": false,
                        "document_id": cache_key,
                        "word_count": document.metadata.word_count,
                        "template_used": document.metadata.template_used,
                    }),
                    timestamp: chrono::Utc::now(),
                };
                self.event_bus.publish(doc_event).await?;
                Ok(())
            }
            Err(e) => {
                // Publish DOCUMENT_GENERATION_FAILED event
                let error_event = Event {
                    id: Uuid::new_v4().to_string(),
                    event_type: crate::events::event_types::DOCUMENT_GENERATION_FAILED.to_string(),
                    payload: serde_json::json!({
                        "application_id": application_id,
                        "job_id": job_id,
                        "error": e.to_string(),
                    }),
                    timestamp: chrono::Utc::now(),
                };
                self.event_bus.publish(error_event).await?;
                Err(anyhow::anyhow!("Document generation failed: {}", e))
            }
        }
    }
}









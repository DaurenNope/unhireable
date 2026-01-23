use crate::generator::BulkGenerationRequest;
use crate::queue::{QueueJob, QueueManager};
use crate::events::{Event, EventBus};
use anyhow::Result;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub struct BulkGenerationQueueProcessor {
    queue_manager: Arc<QueueManager>,
    event_bus: Arc<EventBus>,
}

impl BulkGenerationQueueProcessor {
    pub fn new(queue_manager: Arc<QueueManager>, event_bus: Arc<EventBus>) -> Self {
        Self {
            queue_manager,
            event_bus,
        }
    }

    pub async fn enqueue_bulk_generation(
        &self,
        request: BulkGenerationRequest,
    ) -> Result<String> {
        let queue = self.queue_manager.get_queue("document_generation").await;
        let job_id = Uuid::new_v4().to_string();
        
        let job = QueueJob {
            id: job_id.clone(),
            job_type: "bulk_document_generation".to_string(),
            payload: json!(request),
            priority: 5, // Medium priority
            created_at: chrono::Utc::now(),
        };
        
        queue.enqueue(job).await?;
        
        // Start processing if not already running
        self.start_processor().await;
        
        Ok(job_id)
    }

    pub async fn start_processor(&self) {
        let queue_manager = Arc::clone(&self.queue_manager);
        let event_bus = Arc::clone(&self.event_bus);
        
        tokio::spawn(async move {
            let queue = queue_manager.get_queue("document_generation").await;
            
            loop {
                if let Some(job) = queue.dequeue().await {
                    if let Err(e) = Self::process_job(&job, &event_bus).await {
                        tracing::error!("Failed to process bulk generation job {}: {}", job.id, e);
                        
                        // Publish failure event
                        let error_event = Event {
                            id: Uuid::new_v4().to_string(),
                            event_type: "bulk_generation.failed".to_string(),
                            payload: json!({
                                "job_id": job.id,
                                "error": e.to_string(),
                            }),
                            timestamp: chrono::Utc::now(),
                        };
                        let _ = event_bus.publish(error_event).await;
                    }
                } else {
                    // No jobs, wait a bit before checking again
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            }
        });
    }

    async fn process_job(job: &QueueJob, event_bus: &EventBus) -> Result<()> {
        let request: BulkGenerationRequest = serde_json::from_value(job.payload.clone())?;
        
        // Publish progress event
        let progress_event = Event {
            id: Uuid::new_v4().to_string(),
            event_type: "bulk_generation.started".to_string(),
            payload: json!({
                "job_id": job.id,
                "total_jobs": request.job_ids.len(),
            }),
            timestamp: chrono::Utc::now(),
        };
        event_bus.publish(progress_event).await?;
        
        // Process generation (simplified - would need actual implementation)
        // This is a placeholder - actual implementation would use BulkGenerator
        
        // Publish completion event
        let completion_event = Event {
            id: Uuid::new_v4().to_string(),
            event_type: "bulk_generation.completed".to_string(),
            payload: json!({
                "job_id": job.id,
                "total_jobs": request.job_ids.len(),
            }),
            timestamp: chrono::Utc::now(),
        };
        event_bus.publish(completion_event).await?;
        
        Ok(())
    }
}









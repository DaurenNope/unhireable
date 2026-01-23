use crate::queue::{Queue, QueueJob, QueueManager};
use crate::events::{Event, EventBus, event_types};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct ScraperQueueWorker {
    queue: Queue,
    event_bus: Arc<EventBus>,
    processing: Arc<Mutex<bool>>,
}

impl ScraperQueueWorker {
    pub fn new(queue: Queue, event_bus: Arc<EventBus>) -> Self {
        ScraperQueueWorker {
            queue,
            event_bus,
            processing: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(&self) -> Result<()> {
        let mut processing = self.processing.lock().await;
        if *processing {
            return Ok(()); // Already processing
        }
        *processing = true;
        drop(processing);

        loop {
            if let Some(job) = self.queue.dequeue().await {
                tracing::info!("Processing scraping job: {}", job.id);
                
                // Publish event for job processing start
                let start_event = Event {
                    id: uuid::Uuid::new_v4().to_string(),
                    event_type: event_types::SCRAPER_STARTED.to_string(),
                    payload: job.payload.clone(),
                    timestamp: chrono::Utc::now(),
                };
                
                // Handle event publishing errors
                if let Err(e) = self.event_bus.publish(start_event).await {
                    tracing::warn!("Failed to publish SCRAPER_STARTED event for job {}: {}", job.id, e);
                }

                // Process the job with proper error handling
                match self.process_job(&job).await {
                    Ok(_) => {
                        tracing::info!("Successfully processed scraping job: {}", job.id);
                        
                        // Publish completion event
                        let completion_event = Event {
                            id: uuid::Uuid::new_v4().to_string(),
                            event_type: event_types::SCRAPER_COMPLETED.to_string(),
                            payload: serde_json::json!({
                                "job_id": job.id,
                                "status": "success"
                            }),
                            timestamp: chrono::Utc::now(),
                        };
                        
                        if let Err(e) = self.event_bus.publish(completion_event).await {
                            tracing::warn!("Failed to publish SCRAPER_COMPLETED event for job {}: {}", job.id, e);
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to process scraping job {}: {}", job.id, e);
                        
                        // Publish error event
                        let error_event = Event {
                            id: uuid::Uuid::new_v4().to_string(),
                            event_type: event_types::SCRAPER_ERROR.to_string(),
                            payload: serde_json::json!({
                                "job_id": job.id,
                                "error": e.to_string(),
                                "status": "error"
                            }),
                            timestamp: chrono::Utc::now(),
                        };
                        
                        if let Err(pub_err) = self.event_bus.publish(error_event).await {
                            tracing::warn!("Failed to publish SCRAPER_ERROR event for job {}: {}", job.id, pub_err);
                        }
                        
                        // Optionally: re-enqueue job with lower priority for retry
                        // For now, we'll just log the error and continue
                    }
                }
            } else {
                // No jobs in queue, wait a bit
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }

            // Check if we should stop
            let processing = self.processing.lock().await;
            if !*processing {
                break;
            }
        }

        Ok(())
    }

    pub async fn stop(&self) {
        let mut processing = self.processing.lock().await;
        *processing = false;
    }

    /// Process a single scraping job
    async fn process_job(&self, job: &QueueJob) -> Result<()> {
        tracing::info!("Job payload: {:?}", job.payload);
        
        // Extract query and sources from payload
        let query = job.payload
            .get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing 'query' in job payload"))?;
        
        let sources: Option<Vec<String>> = job.payload
            .get("sources")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            });

        // In a real implementation, you would:
        // 1. Call the scraper with the extracted query and sources
        // 2. Handle the results (save to database, etc.)
        // 3. Return success or error
        
        // For now, we'll just validate the payload structure
        tracing::debug!("Processing scraping job with query: '{}', sources: {:?}", query, sources);
        
        // TODO: Implement actual scraping logic here
        // let scraper = crate::scraper::ScraperManager::new();
        // let jobs = if let Some(sources) = sources {
        //     scraper.scrape_selected(&sources, query)?
        // } else {
        //     scraper.scrape_all(query)?
        // };
        // // Save jobs to database, etc.
        
        Ok(())
    }
}

pub async fn enqueue_scraping_job(
    queue_manager: Arc<QueueManager>,
    query: String,
    sources: Option<Vec<String>>,
    priority: u8,
) -> Result<String> {
    let queue = queue_manager.get_queue("scraping").await;
    
    let job = QueueJob {
        id: uuid::Uuid::new_v4().to_string(),
        job_type: "scrape".to_string(),
        payload: serde_json::json!({
            "query": query,
            "sources": sources,
            "timestamp": chrono::Utc::now(),
        }),
        priority,
        created_at: chrono::Utc::now(),
    };
    
    let job_id = job.id.clone();
    queue.enqueue(job).await?;
    
    Ok(job_id)
}









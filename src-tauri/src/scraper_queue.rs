use crate::db::Database;
use crate::db::queries::JobQueries;
use crate::events::{Event, EventBus, event_types};
use crate::queue::{Queue, QueueJob, QueueManager};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct ScraperQueueWorker {
    queue: Queue,
    event_bus: Arc<EventBus>,
    db: Arc<Mutex<Option<Database>>>,
    processing: Arc<Mutex<bool>>,
}

impl ScraperQueueWorker {
    pub fn new(queue: Queue, event_bus: Arc<EventBus>, db: Arc<Mutex<Option<Database>>>) -> Self {
        ScraperQueueWorker {
            queue,
            event_bus,
            db,
            processing: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(self: Arc<Self>) -> Result<()> {
        let mut processing = self.processing.lock().await;
        if *processing {
            return Ok(());
        }
        *processing = true;
        drop(processing);

        let worker = self.clone();
        tokio::spawn(async move {
            loop {
                if let Some(job) = worker.queue.dequeue().await {
                    tracing::info!("Processing scraping job: {}", job.id);

                    let start_event = Event {
                        id: uuid::Uuid::new_v4().to_string(),
                        event_type: event_types::SCRAPER_STARTED.to_string(),
                        payload: job.payload.clone(),
                        timestamp: chrono::Utc::now(),
                    };
                    if let Err(e) = worker.event_bus.publish(start_event).await {
                        tracing::warn!("Failed to publish SCRAPER_STARTED: {}", e);
                    }

                    match worker.process_job(&job).await {
                        Ok(count) => {
                            tracing::info!("Scraping job {} saved {} jobs", job.id, count);
                            let completion_event = Event {
                                id: uuid::Uuid::new_v4().to_string(),
                                event_type: event_types::SCRAPER_COMPLETED.to_string(),
                                payload: serde_json::json!({
                                    "job_id": job.id,
                                    "jobs_found": count,
                                    "status": "success"
                                }),
                                timestamp: chrono::Utc::now(),
                            };
                            if let Err(e) = worker.event_bus.publish(completion_event).await {
                                tracing::warn!("Failed to publish SCRAPER_COMPLETED: {}", e);
                            }
                        }
                        Err(e) => {
                            tracing::error!("Scraping job {} failed: {}", job.id, e);
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
                            if let Err(e) = worker.event_bus.publish(error_event).await {
                                tracing::warn!("Failed to publish SCRAPER_ERROR: {}", e);
                            }
                        }
                    }
                } else {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }

                let processing = worker.processing.lock().await;
                if !*processing {
                    break;
                }
            }
        });

        Ok(())
    }

    pub async fn stop(&self) {
        let mut processing = self.processing.lock().await;
        *processing = false;
    }

    async fn process_job(&self, job: &QueueJob) -> Result<usize> {
        let query = job
            .payload
            .get("query")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let sources: Option<Vec<String>> = job
            .payload
            .get("sources")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            });

        tracing::info!("Background scrape: query='{}', sources={:?}", query, sources);

        let scraper = crate::scraper::ScraperManager::new();
        let jobs = tokio::task::spawn_blocking(move || {
            if let Some(sources) = sources {
                scraper.scrape_selected(&sources, &query)
            } else {
                scraper.scrape_all(&query)
            }
        })
        .await
        .map_err(|e| anyhow::anyhow!("Task join error: {}", e))??;

        let mut saved_count = 0;
        let db_guard = self.db.lock().await;
        if let Some(db) = &*db_guard {
            let conn = db.get_connection();
            for mut scraped_job in jobs {
                match conn.get_job_by_url(&scraped_job.url) {
                    Ok(Some(_)) => {}
                    _ => {
                        if conn.create_job(&mut scraped_job).is_ok() {
                            saved_count += 1;
                        }
                    }
                }
            }
        }

        Ok(saved_count)
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

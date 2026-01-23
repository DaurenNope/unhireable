use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

pub type EventHandler = Box<dyn Fn(&Event) -> Result<()> + Send + Sync>;

pub struct EventBus {
    handlers: Arc<Mutex<HashMap<String, Vec<EventHandler>>>>,
    events: Arc<Mutex<Vec<Event>>>,
}

impl EventBus {
    pub fn new() -> Self {
        EventBus {
            handlers: Arc::new(Mutex::new(HashMap::new())),
            events: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn subscribe<F>(&self, event_type: String, handler: F)
    where
        F: Fn(&Event) -> Result<()> + Send + Sync + 'static,
    {
        let mut handlers = self.handlers.lock().await;
        handlers
            .entry(event_type)
            .or_insert_with(Vec::new)
            .push(Box::new(handler));
    }

    pub async fn publish(&self, event: Event) -> Result<()> {
        // Store event
        {
            let mut events = self.events.lock().await;
            events.push(event.clone());
        }

        // Notify handlers
        let handlers = self.handlers.lock().await;
        if let Some(handlers_for_type) = handlers.get(&event.event_type) {
            for handler in handlers_for_type {
                handler(&event)?;
            }
        }

        Ok(())
    }

    pub async fn get_events(&self, event_type: Option<String>) -> Vec<Event> {
        let events = self.events.lock().await;
        if let Some(et) = event_type {
            events
                .iter()
                .filter(|e| e.event_type == et)
                .cloned()
                .collect()
        } else {
            events.clone()
        }
    }
}

// Common event types
pub mod event_types {
    pub const JOB_CREATED: &str = "job.created";
    pub const JOB_UPDATED: &str = "job.updated";
    pub const JOB_DELETED: &str = "job.deleted";
    pub const JOB_FOUND: &str = "job.found";
    pub const APPLICATION_CREATED: &str = "application.created";
    pub const APPLICATION_UPDATED: &str = "application.updated";
    pub const DOCUMENT_GENERATED: &str = "document.generated";
    pub const DOCUMENT_GENERATION_FAILED: &str = "document.generation_failed";
    pub const PROFILE_UPDATED: &str = "profile.updated";
    pub const SCRAPER_STARTED: &str = "scraper.started";
    pub const SCRAPER_COMPLETED: &str = "scraper.completed";
    pub const SCRAPER_ERROR: &str = "scraper.error";
    pub const MATCH_CALCULATED: &str = "match.calculated";
    pub const JOB_MATCHED: &str = "job.matched";
    pub const NOTIFICATION_SENT: &str = "notification.sent";
    pub const RECOMMENDATIONS_UPDATED: &str = "recommendations.updated";
}







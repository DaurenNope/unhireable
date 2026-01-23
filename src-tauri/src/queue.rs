use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueJob {
    pub id: String,
    pub job_type: String,
    pub payload: serde_json::Value,
    pub priority: u8,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone)]
#[allow(dead_code)] // processing field reserved for future use
pub struct Queue {
    jobs: Arc<Mutex<VecDeque<QueueJob>>>,
    processing: Arc<Mutex<bool>>,
}

impl Queue {
    pub fn new() -> Self {
        Queue {
            jobs: Arc::new(Mutex::new(VecDeque::new())),
            processing: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn enqueue(&self, job: QueueJob) -> Result<()> {
        let mut jobs = self.jobs.lock().await;

        // Insert based on priority (higher priority first)
        if let Some(idx) = jobs
            .iter()
            .position(|existing_job| job.priority > existing_job.priority)
        {
            jobs.insert(idx, job);
        } else {
            jobs.push_back(job);
        }

        Ok(())
    }

    pub async fn dequeue(&self) -> Option<QueueJob> {
        let mut jobs = self.jobs.lock().await;
        jobs.pop_front()
    }

    pub async fn peek(&self) -> Option<QueueJob> {
        let jobs = self.jobs.lock().await;
        jobs.front().cloned()
    }

    pub async fn size(&self) -> usize {
        let jobs = self.jobs.lock().await;
        jobs.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.size().await == 0
    }

    pub async fn clear(&self) {
        let mut jobs = self.jobs.lock().await;
        jobs.clear();
    }
}

pub struct QueueManager {
    queues: Arc<Mutex<std::collections::HashMap<String, Queue>>>,
}

impl QueueManager {
    pub fn new() -> Self {
        QueueManager {
            queues: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub async fn get_queue(&self, name: &str) -> Queue {
        let mut queues = self.queues.lock().await;
        queues
            .entry(name.to_string())
            .or_insert_with(Queue::new)
            .clone()
    }

    pub async fn create_queue(&self, name: String) -> Queue {
        let mut queues = self.queues.lock().await;
        let queue = Queue::new();
        queues.insert(name, queue.clone());
        queue
    }
}







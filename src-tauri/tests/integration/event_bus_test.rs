// Integration tests for event bus pub/sub functionality

use jobez_lib::events::{Event, EventBus};
use jobez_lib::events::event_types;
use serde_json::json;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::time::{sleep, Duration};

#[tokio::test]
async fn test_event_bus_pub_sub() {
    let event_bus = Arc::new(EventBus::new());
    let received = Arc::new(AtomicBool::new(false));
    let received_clone = received.clone();
    
    event_bus.subscribe(event_types::JOB_CREATED.to_string(), move |_event| {
        received_clone.store(true, Ordering::Relaxed);
        Ok(())
    }).await;
    
    let event = Event {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: event_types::JOB_CREATED.to_string(),
        payload: json!({
            "job_id": 1,
            "title": "Test Job",
        }),
        timestamp: chrono::Utc::now(),
    };
    
    event_bus.publish(event).await.expect("Failed to publish event");
    
    // Wait a bit for processing
    sleep(Duration::from_millis(10)).await;
    
    assert!(received.load(Ordering::Relaxed), "Event should have been received");
}

#[tokio::test]
async fn test_event_bus_multiple_subscribers() {
    let event_bus = Arc::new(EventBus::new());
    let received1 = Arc::new(AtomicBool::new(false));
    let received2 = Arc::new(AtomicBool::new(false));
    
    let received1_clone = received1.clone();
    let received2_clone = received2.clone();
    
    event_bus.subscribe(event_types::JOB_CREATED.to_string(), move |_event| {
        received1_clone.store(true, Ordering::Relaxed);
        Ok(())
    }).await;
    
    event_bus.subscribe(event_types::JOB_CREATED.to_string(), move |_event| {
        received2_clone.store(true, Ordering::Relaxed);
        Ok(())
    }).await;
    
    let event = Event {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: event_types::JOB_CREATED.to_string(),
        payload: json!({
            "job_id": 1,
            "title": "Test Job",
        }),
        timestamp: chrono::Utc::now(),
    };
    
    event_bus.publish(event).await.expect("Failed to publish event");
    
    // Wait a bit for processing
    sleep(Duration::from_millis(10)).await;
    
    assert!(received1.load(Ordering::Relaxed), "First subscriber should have received event");
    assert!(received2.load(Ordering::Relaxed), "Second subscriber should have received event");
}

#[tokio::test]
async fn test_event_bus_multiple_event_types() {
    let event_bus = Arc::new(EventBus::new());
    let job_created_received = Arc::new(AtomicBool::new(false));
    let job_updated_received = Arc::new(AtomicBool::new(false));
    
    let job_created_clone = job_created_received.clone();
    let job_updated_clone = job_updated_received.clone();
    
    event_bus.subscribe(event_types::JOB_CREATED.to_string(), move |_event| {
        job_created_clone.store(true, Ordering::Relaxed);
        Ok(())
    }).await;
    
    event_bus.subscribe(event_types::JOB_UPDATED.to_string(), move |_event| {
        job_updated_clone.store(true, Ordering::Relaxed);
        Ok(())
    }).await;
    
    // Publish JOB_CREATED
    let event1 = Event {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: event_types::JOB_CREATED.to_string(),
        payload: json!({
            "job_id": 1,
        }),
        timestamp: chrono::Utc::now(),
    };
    event_bus.publish(event1).await.expect("Failed to publish event");
    
    // Publish JOB_UPDATED
    let event2 = Event {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: event_types::JOB_UPDATED.to_string(),
        payload: json!({
            "job_id": 1,
        }),
        timestamp: chrono::Utc::now(),
    };
    event_bus.publish(event2).await.expect("Failed to publish event");
    
    // Wait a bit for processing
    sleep(Duration::from_millis(10)).await;
    
    assert!(job_created_received.load(Ordering::Relaxed), "JOB_CREATED event should have been received");
    assert!(job_updated_received.load(Ordering::Relaxed), "JOB_UPDATED event should have been received");
}


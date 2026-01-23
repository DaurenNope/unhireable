// Unit tests for event system

use unhireable_lib::events::{Event, event_types};
use serde_json::json;
use chrono::Utc;

#[test]
fn test_event_creation() {
    let event = Event {
        id: "test-id".to_string(),
        event_type: event_types::JOB_CREATED.to_string(),
        payload: json!({
            "job_id": 1,
            "title": "Test Job",
        }),
        timestamp: Utc::now(),
    };

    assert_eq!(event.id, "test-id");
    assert_eq!(event.event_type, event_types::JOB_CREATED);
    assert_eq!(event.payload["job_id"], 1);
}

#[test]
fn test_event_types_constants() {
    // Test that event type constants are accessible
    assert_eq!(event_types::JOB_CREATED, "job.created");
    assert_eq!(event_types::JOB_UPDATED, "job.updated");
    assert_eq!(event_types::JOB_DELETED, "job.deleted");
    assert_eq!(event_types::APPLICATION_CREATED, "application.created");
    assert_eq!(event_types::APPLICATION_UPDATED, "application.updated");
    assert_eq!(event_types::DOCUMENT_GENERATED, "document.generated");
    assert_eq!(event_types::SCRAPER_STARTED, "scraper.started");
    assert_eq!(event_types::SCRAPER_COMPLETED, "scraper.completed");
    assert_eq!(event_types::SCRAPER_ERROR, "scraper.error");
}

#[test]
fn test_event_serialization() {
    let event = Event {
        id: "test-id".to_string(),
        event_type: event_types::JOB_CREATED.to_string(),
        payload: json!({
            "job_id": 1,
            "title": "Test Job",
        }),
        timestamp: Utc::now(),
    };

    // Test that event can be serialized to JSON
    let json_result = serde_json::to_string(&event);
    assert!(json_result.is_ok(), "Event should be serializable to JSON");
    
    let json_str = json_result.unwrap();
    assert!(json_str.contains("test-id"), "Serialized JSON should contain event ID");
    assert!(json_str.contains("job.created"), "Serialized JSON should contain event type");
}

#[test]
fn test_event_deserialization() {
    let json_str = r#"{
        "id": "test-id",
        "event_type": "job.created",
        "payload": {"job_id": 1, "title": "Test Job"},
        "timestamp": "2024-01-01T00:00:00Z"
    }"#;

    let event_result: Result<Event, _> = serde_json::from_str(json_str);
    assert!(event_result.is_ok(), "Event should be deserializable from JSON");
    
    let event = event_result.unwrap();
    assert_eq!(event.id, "test-id");
    assert_eq!(event.event_type, "job.created");
}









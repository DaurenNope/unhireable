# Infrastructure Integration Guide

This guide explains how to integrate the new infrastructure components into your application.

## Overview

The following infrastructure components have been added:

1. **PostgreSQL Database Support** - Alternative to SQLite
2. **Redis Session Management** - Persistent session storage
3. **Structured Logging** - JSON-formatted logs with tracing
4. **Prometheus Metrics** - Application metrics collection
5. **Event Bus** - Pub/sub event system
6. **Flow Engine** - Workflow orchestration
7. **Cache System** - In-memory caching with TTL
8. **Queue System** - Priority-based job queues
9. **Channel Abstraction** - Inter-service communication
10. **Security Components** - Rate limiting, input validation, secrets management

## Integration Status

### ✅ Completed
- All infrastructure modules created
- AppState updated with new components
- Logging and metrics initialization
- Docker setup with PostgreSQL and Redis
- CI/CD pipelines
- Security hardening components

### 🔄 In Progress
- Full PostgreSQL integration (currently falls back to SQLite)
- Event bus integration in application code
- Flow engine workflow definitions
- Cache usage in hot paths

## Usage Examples

### Using the Event Bus

```rust
use jobez_lib::{events, AppState};
use tauri::State;

#[tauri::command]
async fn create_job_with_event(
    state: State<'_, AppState>,
    title: String,
    company: String,
) -> Result<()> {
    // Create job...
    let job = create_job(...);
    
    // Publish event
    let event = events::Event {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: events::event_types::JOB_CREATED.to_string(),
        payload: serde_json::json!({
            "job_id": job.id,
            "title": job.title,
        }),
        timestamp: chrono::Utc::now(),
    };
    
    state.event_bus.publish(event).await?;
    Ok(())
}
```

### Using the Cache

```rust
#[tauri::command]
async fn get_cached_jobs(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Job>> {
    // Check cache first
    let cache_key = format!("jobs:{}", query);
    if let Some(cached) = state.cache.get(&cache_key).await {
        return Ok(serde_json::from_value(cached)?);
    }
    
    // Fetch from database
    let jobs = fetch_jobs_from_db(&query).await?;
    
    // Store in cache
    state.cache.set(
        cache_key,
        serde_json::to_value(&jobs)?,
        Some(std::time::Duration::from_secs(300)), // 5 minutes
    ).await?;
    
    Ok(jobs)
}
```

### Using Rate Limiting

```rust
#[tauri::command]
async fn scrape_jobs_rate_limited(
    state: State<'_, AppState>,
    query: String,
    ip_address: String,
) -> Result<Vec<Job>> {
    // Check rate limit
    if !state.rate_limiter.check_rate_limit(&ip_address).await? {
        return Err(anyhow::anyhow!("Rate limit exceeded").into());
    }
    
    // Proceed with scraping
    scrape_jobs(query).await
}
```

### Using the Queue System

```rust
#[tauri::command]
async fn enqueue_job_processing(
    state: State<'_, AppState>,
    job_id: i64,
) -> Result<()> {
    let queue = state.queue_manager.get_queue("job_processing").await;
    
    let queue_job = queue::QueueJob {
        id: uuid::Uuid::new_v4().to_string(),
        job_type: "process_job".to_string(),
        payload: serde_json::json!({ "job_id": job_id }),
        priority: 5,
        created_at: chrono::Utc::now(),
    };
    
    queue.enqueue(queue_job).await?;
    Ok(())
}
```

### Using the Flow Engine

```rust
use jobez_lib::{flow_engine, AppState};

async fn setup_job_scraping_flow(state: State<'_, AppState>) -> Result<()> {
    let flow = flow_engine::Flow {
        id: "job_scraping".to_string(),
        name: "Job Scraping Workflow".to_string(),
        nodes: vec![
            flow_engine::FlowNode {
                id: "scrape".to_string(),
                step: flow_engine::FlowStep::ScrapeJobs,
                dependencies: vec![],
                config: serde_json::json!({}),
            },
            flow_engine::FlowNode {
                id: "match".to_string(),
                step: flow_engine::FlowStep::MatchJobs,
                dependencies: vec!["scrape".to_string()],
                config: serde_json::json!({}),
            },
        ],
        enabled: true,
    };
    
    state.flow_engine.register_flow(flow).await?;
    Ok(())
}
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://jobez:password@localhost:5432/jobez  # Optional, defaults to SQLite

# Redis
REDIS_URL=redis://localhost:6379  # Optional, sessions will be in-memory if not set

# Logging
RUST_LOG=info  # Optional, defaults to info
```

## Migration from SQLite to PostgreSQL

Use the migration utility:

```rust
use jobez_lib::migration;

migration::migrate_sqlite_to_postgres(
    Path::new("/path/to/jobhunter.db"),
    "postgresql://jobez:password@localhost:5432/jobez",
).await?;
```

## Next Steps

1. **Integrate Event Bus**: Add event publishing to key operations (job creation, scraping completion, etc.)
2. **Add Caching**: Cache frequently accessed data (job lists, user profiles, etc.)
3. **Use Queue System**: Move long-running operations to background queues
4. **Define Workflows**: Create flow definitions for common operations
5. **Add Metrics**: Instrument key operations with Prometheus metrics
6. **Complete PostgreSQL Integration**: Finish PostgreSQL query implementations

## Testing

Run the test suite:

```bash
# Start infrastructure services
docker-compose up -d

# Run tests
cd src-tauri
cargo test

# Run with PostgreSQL
DATABASE_URL=postgresql://jobez:jobez_dev_password@localhost:5432/jobez cargo test
```

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Metrics Endpoint**: `/metrics` (when implemented)

## Troubleshooting

### PostgreSQL Connection Issues
- Ensure PostgreSQL is running: `docker-compose ps`
- Check connection string format
- Verify database exists: `psql -h localhost -U jobez -d jobez`

### Redis Connection Issues
- Ensure Redis is running: `docker-compose ps`
- Test connection: `redis-cli -h localhost -p 6379 ping`

### Logging Not Working
- Set `RUST_LOG` environment variable
- Check console output for errors
- Verify tracing is initialized before use














# Event System Documentation

The Unhireable application uses an event-driven architecture for real-time updates and cross-module communication.

## Event Types

### Job Events

#### `job.created`
Published when a new job is created.

**Payload:**
```json
{
  "job_id": 123,
  "title": "Senior Developer",
  "company": "Tech Corp",
  "source": "linkedin"
}
```

---

#### `job.updated`
Published when a job is updated.

**Payload:**
```json
{
  "job_id": 123,
  "changes": {
    "status": "applied",
    "match_score": 85.5
  }
}
```

---

#### `job.deleted`
Published when a job is deleted.

**Payload:**
```json
{
  "job_id": 123
}
```

---

#### `job.found`
Published when a new job is found during scraping.

**Payload:**
```json
{
  "job_id": 123,
  "title": "Senior Developer",
  "company": "Tech Corp",
  "source": "linkedin"
}
```

---

### Application Events

#### `application.created`
Published when a new application is created.

**Payload:**
```json
{
  "application_id": 456,
  "job_id": 123,
  "status": "pending"
}
```

---

#### `application.updated`
Published when an application is updated.

**Payload:**
```json
{
  "application_id": 456,
  "changes": {
    "status": "interviewing"
  }
}
```

---

### Document Events

#### `document.generated`
Published when a document is successfully generated.

**Payload:**
```json
{
  "document_id": 789,
  "type": "resume",
  "job_id": 123,
  "template": "resume_modern"
}
```

---

#### `document.generation_failed`
Published when document generation fails.

**Payload:**
```json
{
  "job_id": 123,
  "type": "resume",
  "error": "AI API unavailable"
}
```

---

### Profile Events

#### `profile.updated`
Published when the user profile is updated.

**Payload:**
```json
{
  "profile_id": 1,
  "changes": ["skills", "experience"]
}
```

---

### Scraper Events

#### `scraper.started`
Published when job scraping starts.

**Payload:**
```json
{
  "query": "React developer",
  "sources": ["linkedin", "wellfound"]
}
```

---

#### `scraper.completed`
Published when job scraping completes.

**Payload:**
```json
{
  "query": "React developer",
  "jobs_found": 25,
  "sources_used": ["linkedin", "wellfound"],
  "errors": []
}
```

---

#### `scraper.error`
Published when a scraper error occurs.

**Payload:**
```json
{
  "source": "linkedin",
  "error": "Rate limit exceeded"
}
```

---

### Matching Events

#### `match.calculated`
Published when a match score is calculated.

**Payload:**
```json
{
  "job_id": 123,
  "match_score": 85.5,
  "skills_match": 90.0
}
```

---

#### `job.matched`
Published when a job matches user criteria.

**Payload:**
```json
{
  "job_id": 123,
  "match_score": 85.5,
  "quality": "excellent"
}
```

---

### Notification Events

#### `notification.sent`
Published when a notification is sent.

**Payload:**
```json
{
  "type": "email",
  "recipient": "user@example.com",
  "subject": "New Job Match"
}
```

---

### Recommendation Events

#### `recommendations.updated`
Published when recommendations are updated.

**Payload:**
```json
{
  "recommendation_count": 10,
  "top_score": 92.5
}
```

---

## Subscribing to Events

Events are automatically published by the backend. The frontend can listen to events using Tauri's event system:

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen to job created events
const unlisten = await listen('job.created', (event) => {
  console.log('New job created:', event.payload);
  // Update UI, show notification, etc.
});

// Clean up listener
unlisten();
```

---

## Event Flow

1. **Action occurs** (e.g., job created, application updated)
2. **Event published** to EventBus
3. **Subscribers notified** (event handlers, frontend listeners)
4. **Actions triggered** (notifications, cache updates, analytics)

---

**Last Updated:** 2024









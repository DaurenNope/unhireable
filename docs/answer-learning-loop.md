# Answer Learning Loop — Design

## Policy (implemented)

- **No fallbacks** — If we have no pattern, cache, or LLM answer, we ask the user. If user skips, field stays empty.
- **Pre-seed** — Common questions (name, email, years, consent, etc.) in patterns. Only add new ones when user provides an answer.
- **LLM for company-specific** — "What interests you?" etc. use LLM with job description + profile. Prompt engineered to avoid generic phrases.

## Previous State (before removal)

### What gets updated when

| Event | answer_cache (DB) | answer_patterns (DB) | unknownFieldsBacklog (local only) |
|-------|-------------------|----------------------|-----------------------------------|
| **User provides answer** (modal) | ✅ save + sync | ❌ | ❌ |
| **LLM provides answer** | ✅ save + sync | ❌ | ❌ |
| **Fallback used** (generic answer) | ❌ | ❌ | ❌ (not even logged) |
| **User skips** (modal) | ❌ | ❌ | ❌ |

### Gaps

1. **Fallback case** — When we use a generic fallback, we never save. Next time we see "What's your favorite color?" we go through the same flow again. No learning.

2. **Unknown fields** — `unknownFieldsBacklog` lives in `chrome.storage.local` only. Not synced to backend. Lost on clear storage / different device.

3. **Pattern promotion** — Cache entries (e.g. "Years in Python" → "5" used 20 times) are never suggested as patterns. User has to manually add in Settings.

4. **Sync cadence** — We sync answer_cache after each save. Good. But we never pull on extension load for fields we might have learned on another device/session. We have `pullFromBackend()` on load — ✓.

---

## Proposed Learning Loop

### 1. Discovered fields (new table)

When we encounter a field with **no pattern, no cache**:

- Before asking user / LLM / fallback: log to `discovered_fields`
- Fields: `question`, `field_type`, `options` (JSON), `persona_id`, `seen_count`, `last_seen`
- Sync to backend (POST /api/discovered-fields or batch with answer-cache)
- Settings: "Discovered fields" tab — list of questions we've seen, "Add as pattern" action

### 2. Save fallback to cache? (optional, risky)

- **Option A**: Don't save fallback. Generic answers might be wrong. Just log to discovered.
- **Option B**: Save fallback with `source: 'fallback'`. Next time we cache-hit with that generic. Risky for wrong answers.
- **Recommendation**: Option A. Log to discovered only.

### 3. When user provides answer

- ✅ Save to answer_cache (already done)
- ✅ Sync to backend (already done)
- **New**: Optionally log to discovered with "resolved" flag so we don't keep suggesting it. Or: once in cache, we don't need it in discovered.

### 4. Pattern suggestions (v2)

- When cache entry has `hit_count >= N` and answer is literal or from profile, suggest "Add as pattern" in Settings.
- User confirms → create pattern, optionally remove from cache (or keep both).

---

## Implementation Order

1. **Discovered fields table + API** — Log fields we couldn't resolve, sync to backend.
2. **Settings UI** — "Discovered fields" list, "Add as pattern" (opens pattern editor with prefill).
3. **Log on fallback** — When we use fallback, add to discovered (and sync).
4. **Log on user skip** — When user skips modal, add to discovered.
5. **(Later)** Pattern suggestions from high-hit cache entries.

---

## Data Flow (Target)

```
Field seen
    │
    ├─ Pattern match? ──────────────────────────► Use it (no DB update)
    │
    ├─ Cache hit? ──────────────────────────────► Use it (no DB update)
    │
    ├─ LLM answer? ─────────────────────────────► Use it → save to cache → sync
    │
    ├─ User provides? ──────────────────────────► Use it → save to cache → sync
    │
    ├─ User skips? ─────────────────────────────► Use fallback → log to discovered → sync
    │
    └─ Fallback? ───────────────────────────────► Use it → log to discovered → sync
```

---

## Open Questions

1. **Discovered fields schema** — One row per (question_normalized, persona_id)? Or allow duplicates and aggregate seen_count?
2. **Sync** — Batch discovered with answer-cache sync, or separate endpoint?
3. **Cleanup** — When user adds pattern for a discovered field, remove from discovered?

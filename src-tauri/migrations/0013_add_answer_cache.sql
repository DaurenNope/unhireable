-- Answer cache: stores form field answers across ATS adapters
-- Used by the Chrome extension to persist and share answers

CREATE TABLE IF NOT EXISTS answer_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    normalized_key TEXT NOT NULL UNIQUE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    field_type TEXT,
    source TEXT,
    confidence TEXT,
    hit_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_answer_cache_key ON answer_cache(normalized_key);

-- Answer patterns: user-customizable mapping of form questions to profile/literal values
-- One row per persona; patterns_json stores full array. Users can create/edit without code changes.

CREATE TABLE IF NOT EXISTS answer_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL DEFAULT 'default' UNIQUE,
    patterns_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_answer_patterns_persona ON answer_patterns(persona_id);

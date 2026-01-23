CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    sources TEXT NOT NULL, -- JSON array of source IDs: ["remotive", "remoteok", "wellfound", "greenhouse"]
    filters TEXT, -- JSON object: {"remote_only": true, "min_match_score": 60, "status": "all", "skill_filter": "react"}
    alert_frequency TEXT NOT NULL DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'never'
    min_match_score INTEGER DEFAULT 60,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    last_run_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_enabled
    ON saved_searches (enabled, alert_frequency);

CREATE INDEX IF NOT EXISTS idx_saved_searches_last_run
    ON saved_searches (last_run_at);


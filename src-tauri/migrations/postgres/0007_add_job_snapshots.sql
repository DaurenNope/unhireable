CREATE TABLE IF NOT EXISTS job_snapshots (
    id BIGSERIAL PRIMARY KEY,
    captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timeframe_days INTEGER NOT NULL,
    total_jobs INTEGER NOT NULL,
    remote_count INTEGER NOT NULL,
    onsite_count INTEGER NOT NULL,
    skill_counts TEXT NOT NULL,
    role_counts TEXT NOT NULL,
    company_counts TEXT NOT NULL,
    source_counts TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_snapshots_captured_at
    ON job_snapshots (captured_at DESC);














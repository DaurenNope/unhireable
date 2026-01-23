-- Behavior tracking for recommendation system
-- Tracks user interactions with jobs to improve recommendations

CREATE TABLE IF NOT EXISTS job_interactions (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL,
    interaction_type TEXT NOT NULL, -- 'view', 'save', 'apply', 'dismiss', 'ignore'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_job_interactions_job_id ON job_interactions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_interactions_type ON job_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_job_interactions_created_at ON job_interactions(created_at);

-- Job similarity cache (for similar jobs recommendations)
CREATE TABLE IF NOT EXISTS job_similarity (
    id BIGSERIAL PRIMARY KEY,
    job_id_1 BIGINT NOT NULL,
    job_id_2 BIGINT NOT NULL,
    similarity_score REAL NOT NULL, -- 0.0 to 1.0
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id_1) REFERENCES jobs (id) ON DELETE CASCADE,
    FOREIGN KEY (job_id_2) REFERENCES jobs (id) ON DELETE CASCADE,
    UNIQUE(job_id_1, job_id_2)
);

CREATE INDEX IF NOT EXISTS idx_job_similarity_job_1 ON job_similarity(job_id_1);
CREATE INDEX IF NOT EXISTS idx_job_similarity_job_2 ON job_similarity(job_id_2);
CREATE INDEX IF NOT EXISTS idx_job_similarity_score ON job_similarity(similarity_score);














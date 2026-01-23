-- Add activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'job', 'application', 'contact', 'interview', 'document'
    entity_id BIGINT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed'
    description TEXT,
    metadata TEXT, -- JSON string for additional data (e.g., old_status, new_status)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);














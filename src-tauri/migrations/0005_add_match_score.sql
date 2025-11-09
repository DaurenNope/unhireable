-- Add match_score column to jobs table
-- This column stores the calculated match score (0.0 to 100.0) for the job
-- NULL means the score hasn't been calculated yet
-- Note: This migration is handled idempotently in Rust code to check if column exists first

ALTER TABLE jobs ADD COLUMN match_score REAL;

-- Create index for match_score for faster sorting and filtering
CREATE INDEX IF NOT EXISTS idx_jobs_match_score ON jobs(match_score);


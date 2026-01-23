-- Add match_score column to jobs table
-- This column stores the calculated match score (0.0 to 100.0) for the job
-- NULL means the score hasn't been calculated yet

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'match_score'
    ) THEN
        ALTER TABLE jobs ADD COLUMN match_score REAL;
    END IF;
END $$;

-- Create index for match_score for faster sorting and filtering
CREATE INDEX IF NOT EXISTS idx_jobs_match_score ON jobs(match_score);














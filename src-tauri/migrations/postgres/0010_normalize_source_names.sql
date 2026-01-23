-- Normalize source names to lowercase
-- This migration updates all existing source names to lowercase for consistency

UPDATE jobs SET source = LOWER(source) WHERE source != LOWER(source);














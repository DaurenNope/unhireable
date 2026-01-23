-- Normalize source names to lowercase for consistency
-- This fixes issues like "RemoteOK" vs "remoteok" creating duplicate sources

UPDATE jobs SET source = LOWER(source) WHERE source != LOWER(source);

-- Map common variations to standard names
UPDATE jobs SET source = 'remoteok' WHERE LOWER(source) IN ('remoteok', 'remote_ok', 'remote-ok');
UPDATE jobs SET source = 'wellfound' WHERE LOWER(source) IN ('wellfound', 'wellfound.com', 'angel.co', 'angellist');
UPDATE jobs SET source = 'greenhouse' WHERE LOWER(source) IN ('greenhouse', 'greenhouse.io', 'boards.greenhouse.io');
UPDATE jobs SET source = 'remotive' WHERE LOWER(source) IN ('remotive', 'remotive.com');
UPDATE jobs SET source = 'indeed' WHERE LOWER(source) IN ('indeed', 'indeed.com');
UPDATE jobs SET source = 'hh.ru' WHERE LOWER(source) IN ('hh.ru', 'hhru');
UPDATE jobs SET source = 'hh.kz' WHERE LOWER(source) IN ('hh.kz', 'hhkz');
UPDATE jobs SET source = 'linkedin' WHERE LOWER(source) IN ('linkedin', 'linkedin.com');
UPDATE jobs SET source = 'stackoverflow' WHERE LOWER(source) IN ('stackoverflow', 'stack overflow', 'stackoverflow.com');
UPDATE jobs SET source = 'dice' WHERE LOWER(source) IN ('dice', 'dice.com');
UPDATE jobs SET source = 'glassdoor' WHERE LOWER(source) IN ('glassdoor', 'glassdoor.com');
UPDATE jobs SET source = 'ziprecruiter' WHERE LOWER(source) IN ('ziprecruiter', 'zip recruiter', 'ziprecruiter.com');
UPDATE jobs SET source = 'weworkremotely' WHERE LOWER(source) IN ('weworkremotely', 'we work remotely', 'weworkremotely.com', 'wwr');
UPDATE jobs SET source = 'remote.co' WHERE LOWER(source) IN ('remote.co', 'remoteco', 'remote co');
UPDATE jobs SET source = 'workatastartup' WHERE LOWER(source) IN ('workatastartup', 'work at a startup');


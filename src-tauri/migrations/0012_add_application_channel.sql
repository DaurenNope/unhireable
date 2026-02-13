-- Add contact_email to jobs table for email-based applications
ALTER TABLE jobs ADD COLUMN contact_email TEXT;

-- Add applied_via to applications table to track application channel
-- Values: 'linkedin', 'ats', 'email', 'direct'
ALTER TABLE applications ADD COLUMN applied_via TEXT DEFAULT 'direct';

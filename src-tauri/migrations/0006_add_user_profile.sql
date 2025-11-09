-- Add user_profile table to store user profile data
CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_data TEXT NOT NULL, -- JSON string of UserProfile
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profile_updated_at ON user_profile(updated_at);

-- Insert default empty profile if none exists
INSERT OR IGNORE INTO user_profile (id, profile_data) 
VALUES (1, '{"personal_info":{"name":"","email":"","phone":null,"location":null,"linkedin":null,"github":null,"portfolio":null},"summary":"","skills":{"technical_skills":[],"soft_skills":[],"experience_years":{},"proficiency_levels":{}},"experience":[],"education":[],"projects":[]}');


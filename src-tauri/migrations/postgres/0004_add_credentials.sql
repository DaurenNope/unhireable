-- Add credentials table for platform authentication
CREATE TABLE IF NOT EXISTS credentials (
    id BIGSERIAL PRIMARY KEY,
    platform TEXT NOT NULL UNIQUE, -- 'linkedin', 'wellfound', 'hhkz', etc.
    username TEXT,
    email TEXT,
    encrypted_password TEXT, -- Encrypted password (base64 encoded encrypted data)
    cookies TEXT, -- JSON string of cookies/session data
    tokens TEXT, -- JSON string of OAuth tokens or API keys
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_credentials_platform ON credentials(platform);
CREATE INDEX IF NOT EXISTS idx_credentials_is_active ON credentials(is_active);














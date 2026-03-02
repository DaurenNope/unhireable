//! Secure credential vault using the OS keychain.
//!
//! On macOS this uses the system Keychain, on Windows the Credential Manager,
//! and on Linux the Secret Service (libsecret / GNOME Keyring).
//!
//! Sensitive fields (`tokens`, `encrypted_password`, `cookies`) are never written
//! to the SQLite database. Only non-sensitive metadata is persisted there.

use anyhow::{Context, Result};
use keyring::Entry;

const APP_SERVICE: &str = "unhireable";

fn entry(platform: &str, field: &str) -> Result<Entry> {
    let account = format!("{}:{}", platform, field);
    Entry::new(APP_SERVICE, &account)
        .with_context(|| format!("Failed to create keychain entry for {}", account))
}

/// Store a secret value in the OS keychain.
/// `platform`  — e.g. "openai", "linkedin"
/// `field`     — "tokens", "password", or "cookies"
pub fn store(platform: &str, field: &str, secret: &str) -> Result<()> {
    entry(platform, field)?
        .set_password(secret)
        .with_context(|| format!("Failed to store keychain secret for {platform}:{field}"))
}

/// Retrieve a secret value from the OS keychain.
/// Returns `None` if no entry exists for this platform/field.
pub fn load(platform: &str, field: &str) -> Result<Option<String>> {
    match entry(platform, field)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(anyhow::anyhow!(
            "Failed to load keychain secret for {platform}:{field}: {e}"
        )),
    }
}

/// Delete a secret from the OS keychain (called on credential deletion).
pub fn delete(platform: &str, field: &str) -> Result<()> {
    match entry(platform, field)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // already gone
        Err(e) => Err(anyhow::anyhow!(
            "Failed to delete keychain secret for {platform}:{field}: {e}"
        )),
    }
}

/// Remove all keychain secrets for a platform (tokens + password + cookies).
pub fn delete_all(platform: &str) -> Result<()> {
    for field in &["tokens", "password", "cookies"] {
        delete(platform, field)?;
    }
    Ok(())
}

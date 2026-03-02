use crate::db::models::{Activity, Credential};
use crate::db::queries::{ActivityQueries, AuthQueries, CredentialQueries};
use crate::error::Result;
use crate::events;
use crate::generator::UserProfile;
use crate::security;
use crate::AppState;
use rusqlite::params;
use tauri::State;

// ========== Activity Commands ==========

#[tauri::command]
pub async fn get_activities(
    state: State<'_, AppState>,
    entity_type: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<Activity>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let entity_type_ref = entity_type.as_deref();
        conn.list_activities(entity_type_ref, limit)
            .map_err(Into::into)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

// ========== Credential Commands ==========

/// Populate the sensitive fields of a credential by reading from the OS keychain.
fn load_secrets(cred: &mut Credential) -> anyhow::Result<()> {
    cred.tokens = crate::vault::load(&cred.platform, "tokens")?;
    cred.encrypted_password = crate::vault::load(&cred.platform, "password")?;
    cred.cookies = crate::vault::load(&cred.platform, "cookies")?;
    Ok(())
}

/// Persist the sensitive fields of a credential to the OS keychain and clear them
/// from the struct so they are never written to SQLite.
fn store_secrets(cred: &mut Credential) -> anyhow::Result<()> {
    if let Some(ref tokens) = cred.tokens.clone() {
        crate::vault::store(&cred.platform, "tokens", tokens)?;
        cred.tokens = None; // do not persist in DB
    }
    if let Some(ref pw) = cred.encrypted_password.clone() {
        crate::vault::store(&cred.platform, "password", pw)?;
        cred.encrypted_password = None;
    }
    if let Some(ref cookies) = cred.cookies.clone() {
        crate::vault::store(&cred.platform, "cookies", cookies)?;
        cred.cookies = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_credential(
    state: State<'_, AppState>,
    platform: String,
) -> Result<Option<Credential>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let mut cred_opt = conn.get_credential(&platform)?;
        if let Some(ref mut cred) = cred_opt {
            load_secrets(cred)?;
        }
        Ok(cred_opt)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn create_credential(
    state: State<'_, AppState>,
    mut credential: Credential,
) -> Result<Credential> {
    crate::security::InputValidator::validate_string(&credential.platform, 100)?;
    crate::security::InputValidator::validate_sql_injection(&credential.platform)?;
    credential.platform = crate::security::InputValidator::sanitize_input(&credential.platform);

    // Move secrets to OS keychain before writing to DB
    store_secrets(&mut credential)?;

    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.create_credential(&mut credential)?;
        // Reload secrets so the returned struct has them populated
        load_secrets(&mut credential)?;
        Ok(credential)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn update_credential(
    state: State<'_, AppState>,
    mut credential: Credential,
) -> Result<Credential> {
    // Move secrets to OS keychain before writing to DB
    store_secrets(&mut credential)?;

    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.update_credential(&credential)?;
        load_secrets(&mut credential)?;
        Ok(credential)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn list_credentials(
    state: State<'_, AppState>,
    active_only: bool,
) -> Result<Vec<Credential>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let mut creds = conn.list_credentials(active_only)?;
        for cred in &mut creds {
            let _ = load_secrets(cred); // best-effort; log errors but don't fail the list
        }
        Ok(creds)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn delete_credential(state: State<'_, AppState>, platform: String) -> Result<()> {
    // Remove from keychain first
    crate::vault::delete_all(&platform)?;

    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        conn.delete_credential(&platform)?;
        Ok(())
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

// ========== User Profile Commands ==========

pub fn load_user_profile_from_conn(
    conn: &std::sync::MutexGuard<'_, rusqlite::Connection>,
) -> Result<Option<UserProfile>> {
    match conn.query_row(
        "SELECT profile_data FROM user_profile WHERE id = 1",
        [],
        |row| {
            let profile_json: String = row.get(0)?;
            Ok(profile_json)
        },
    ) {
        Ok(profile_json) => {
            let profile: UserProfile = serde_json::from_str(&profile_json)
                .map_err(|e| anyhow::anyhow!("Failed to parse profile: {}", e))?;
            Ok(Some(profile))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(anyhow::anyhow!("Failed to get user profile: {}", e).into()),
    }
}

#[tauri::command]
pub async fn save_user_profile(state: State<'_, AppState>, profile: UserProfile) -> Result<()> {
    {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let profile_json = serde_json::to_string(&profile)
                .map_err(|e| anyhow::anyhow!("Failed to serialize profile: {}", e))?;

            conn.execute(
                "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, ?2)",
                params![profile_json, chrono::Utc::now()],
            )?;

            println!("✅ User profile saved to database");
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    }

    {
        let mut cache = state.document_cache.lock().await;
        cache.clear();
        println!("✅ Document cache invalidated");
    }

    let event_bus = state.event_bus.clone();
    let event = events::Event {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: events::event_types::PROFILE_UPDATED.to_string(),
        payload: serde_json::json!({
            "profile_updated": true,
            "timestamp": chrono::Utc::now(),
        }),
        timestamp: chrono::Utc::now(),
    };
    if let Err(e) = event_bus.publish(event).await {
        eprintln!("Failed to publish PROFILE_UPDATED event: {}", e);
    }

    Ok(())
}

#[tauri::command]
pub async fn get_user_profile(state: State<'_, AppState>) -> Result<Option<UserProfile>> {
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        load_user_profile_from_conn(&conn)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

// ========== Authentication Commands ==========

#[derive(serde::Serialize)]
pub struct AuthStatusPayload {
    pub configured: bool,
    pub authenticated: bool,
    pub email: Option<String>,
    pub last_login_at: Option<String>,
}

#[tauri::command]
pub async fn auth_get_status(state: State<'_, AppState>) -> Result<AuthStatusPayload> {
    // Check if database is initialized - return default if not ready yet
    let db_guard = state.db.lock().await;
    let Some(db) = db_guard.as_ref() else {
        // Database not initialized yet - return default unconfigured status
        return Ok(AuthStatusPayload {
            configured: false,
            authenticated: false,
            email: None,
            last_login_at: None,
        });
    };

    // Get connection and query auth
    let conn = db.get_connection();
    let auth_record = match conn.get_user_auth() {
        Ok(record) => record,
        Err(_) => {
            // If query fails, return default unconfigured status
            return Ok(AuthStatusPayload {
                configured: false,
                authenticated: false,
                email: None,
                last_login_at: None,
            });
        }
    };

    let email = auth_record.as_ref().and_then(|a| a.email.clone());
    let last_login = auth_record
        .as_ref()
        .and_then(|a| a.last_login_at.map(|ts| ts.to_rfc3339()));
    let configured = auth_record.is_some();

    // Drop connection guard before returning
    drop(conn);
    drop(db_guard);

    // For now, we'll assume authenticated if configured (no session management yet)
    Ok(AuthStatusPayload {
        configured,
        authenticated: configured, // Simple: if configured, consider authenticated
        email,
        last_login_at: last_login,
    })
}

#[tauri::command]
pub async fn auth_setup(
    state: State<'_, AppState>,
    email: Option<String>,
    password: String,
) -> Result<()> {
    if password.trim().len() < 6 {
        return Err(anyhow::anyhow!("Password must be at least 6 characters").into());
    }

    let hashed = security::SecretsManager::default().hash_password(&password)?;

    {
        let db_guard = state.db.lock().await;
        if let Some(db) = &*db_guard {
            let conn = db.get_connection();
            if conn.get_user_auth()?.is_some() {
                drop(conn);
                return Err(anyhow::anyhow!("Authentication already configured").into());
            }

            conn.create_user_auth(email.as_deref(), &hashed)?;
            drop(conn);
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn auth_login(state: State<'_, AppState>, password: String) -> Result<()> {
    let hashed = security::SecretsManager::default().hash_password(&password)?;

    {
        let db_guard = state.db.lock().await;
        if let Some(db) = &*db_guard {
            let conn = db.get_connection();
            let auth_record = conn
                .get_user_auth()?
                .ok_or_else(|| anyhow::anyhow!("Authentication not configured"))?;

            if hashed != auth_record.password_hash {
                drop(conn);
                return Err(anyhow::anyhow!("Invalid password").into());
            }

            conn.update_user_auth_last_login()?;
            drop(conn);
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn auth_logout(_state: State<'_, AppState>) -> Result<()> {
    // For now, logout is a no-op since we're using simple authentication
    // In the future, this could clear session tokens
    Ok(())
}

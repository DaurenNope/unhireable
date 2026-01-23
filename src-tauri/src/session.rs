use anyhow::Result;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user_id: Option<i64>,
    pub data: serde_json::Value,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

pub struct SessionManager {
    client: Arc<redis::Client>,
    default_ttl_seconds: u64,
}

impl SessionManager {
    pub fn new(redis_url: &str, default_ttl_seconds: u64) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        Ok(SessionManager {
            client: Arc::new(client),
            default_ttl_seconds,
        })
    }

    pub async fn create_session(
        &self,
        user_id: Option<i64>,
        data: serde_json::Value,
        ttl_seconds: Option<u64>,
    ) -> Result<Session> {
        let session_id = Uuid::new_v4().to_string();
        let ttl = ttl_seconds.unwrap_or(self.default_ttl_seconds);
        let expires_at = chrono::Utc::now() + chrono::Duration::seconds(ttl as i64);

        let session = Session {
            id: session_id.clone(),
            user_id,
            data,
            expires_at,
        };

        let mut conn = self.client.get_async_connection().await?;
        let session_json = serde_json::to_string(&session)?;
        
        conn.set_ex::<_, _, ()>(&session_id, session_json, ttl).await?;

        Ok(session)
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Option<Session>> {
        let mut conn = self.client.get_async_connection().await?;
        let session_json: Option<String> = conn.get(session_id).await?;

        match session_json {
            Some(json) => {
                let session: Session = serde_json::from_str(&json)?;
                Ok(Some(session))
            }
            None => Ok(None),
        }
    }

    pub async fn update_session(
        &self,
        session_id: &str,
        data: serde_json::Value,
        ttl_seconds: Option<u64>,
    ) -> Result<()> {
        let mut conn = self.client.get_async_connection().await?;
        
        // Get existing session
        let session_json: Option<String> = conn.get(session_id).await?;
        if let Some(json) = session_json {
            let mut session: Session = serde_json::from_str(&json)?;
            session.data = data;
            
            let ttl = ttl_seconds.unwrap_or(self.default_ttl_seconds);
            session.expires_at = chrono::Utc::now() + chrono::Duration::seconds(ttl as i64);
            
            let updated_json = serde_json::to_string(&session)?;
            conn.set_ex::<_, _, ()>(session_id, updated_json, ttl).await?;
        }

        Ok(())
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<()> {
        let mut conn = self.client.get_async_connection().await?;
        conn.del::<&str, ()>(session_id).await?;
        Ok(())
    }

    pub async fn extend_session(&self, session_id: &str, ttl_seconds: u64) -> Result<()> {
        let mut conn = self.client.get_async_connection().await?;
        conn.expire::<_, ()>(session_id, ttl_seconds as i64).await?;
        Ok(())
    }

    pub async fn get_user_sessions(&self, user_id: i64) -> Result<Vec<Session>> {
        // This is a simplified implementation
        // In production, you'd want to maintain a set of session IDs per user
        let mut conn = self.client.get_async_connection().await?;
        let pattern = format!("session:*:user:{}", user_id);
        let keys: Vec<String> = conn.keys(&pattern).await?;
        
        let mut sessions = Vec::new();
        for key in keys {
            if let Some(session_json) = conn.get::<String, Option<String>>(key).await? {
                if let Ok(session) = serde_json::from_str::<Session>(&session_json) {
                    sessions.push(session);
                }
            }
        }

        Ok(sessions)
    }
}












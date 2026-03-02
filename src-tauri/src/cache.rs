use anyhow::Result;
use std::collections::HashMap;
use std::hash::Hash;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

struct CacheEntry<T> {
    value: T,
    expires_at: Instant,
}

pub struct Cache<K, V> {
    entries: Arc<Mutex<HashMap<K, CacheEntry<V>>>>,
    default_ttl: Duration,
}

impl<K, V> Cache<K, V>
where
    K: Hash + Eq + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    pub fn new(default_ttl: Duration) -> Self {
        Cache {
            entries: Arc::new(Mutex::new(HashMap::new())),
            default_ttl,
        }
    }

    pub async fn get(&self, key: &K) -> Option<V> {
        let mut entries = self.entries.lock().await;
        if let Some(entry) = entries.get(key) {
            if entry.expires_at > Instant::now() {
                // Record cache hit
                return Some(entry.value.clone());
            } else {
                entries.remove(key);
            }
        }
        // Record cache miss
        None
    }

    pub async fn set(&self, key: K, value: V, ttl: Option<Duration>) -> Result<()> {
        let ttl = ttl.unwrap_or(self.default_ttl);
        let expires_at = Instant::now() + ttl;
        
        let mut entries = self.entries.lock().await;
        entries.insert(key, CacheEntry { value, expires_at });
        
        Ok(())
    }

    pub async fn remove(&self, key: &K) -> Option<V> {
        let mut entries = self.entries.lock().await;
        entries.remove(key).map(|e| e.value)
    }

    pub async fn clear(&self) {
        let mut entries = self.entries.lock().await;
        entries.clear();
    }

    pub async fn cleanup_expired(&self) {
        let now = Instant::now();
        let mut entries = self.entries.lock().await;
        entries.retain(|_, entry| entry.expires_at > now);
    }
}







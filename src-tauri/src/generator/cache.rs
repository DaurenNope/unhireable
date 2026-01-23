use crate::generator::GeneratedDocument;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub key: String,
    pub document: GeneratedDocument,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub access_count: u64,
    pub last_accessed: DateTime<Utc>,
}

pub struct DocumentCache {
    entries: HashMap<String, CacheEntry>,
    max_size: usize,
    default_ttl_seconds: Option<u64>,
}

impl DocumentCache {
    pub fn new(max_size: usize, default_ttl_seconds: Option<u64>) -> Self {
        Self {
            entries: HashMap::new(),
            max_size,
            default_ttl_seconds,
        }
    }

    pub fn generate_key(
        profile_hash: &str,
        job_id: i64,
        template_name: &str,
        improve_with_ai: bool,
    ) -> String {
        let mut hasher = DefaultHasher::new();
        profile_hash.hash(&mut hasher);
        job_id.hash(&mut hasher);
        template_name.hash(&mut hasher);
        improve_with_ai.hash(&mut hasher);
        format!("doc_{:x}", hasher.finish())
    }

    pub fn get(&mut self, key: &str) -> Option<&GeneratedDocument> {
        let should_remove = if let Some(entry) = self.entries.get(key) {
            // Check expiration
            if let Some(expires_at) = entry.expires_at {
                Utc::now() > expires_at
            } else {
                false
            }
        } else {
            false
        };
        
        if should_remove {
            self.entries.remove(key);
            return None;
        }
        
        if let Some(entry) = self.entries.get_mut(key) {
            entry.access_count += 1;
            entry.last_accessed = Utc::now();
            Some(&entry.document)
        } else {
            None
        }
    }

    pub fn set(
        &mut self,
        key: String,
        document: GeneratedDocument,
        ttl_seconds: Option<u64>,
    ) -> Result<()> {
        // Evict if at capacity
        if self.entries.len() >= self.max_size {
            self.evict_oldest();
        }

        let ttl = ttl_seconds.or(self.default_ttl_seconds);
        let expires_at = ttl.map(|seconds| Utc::now() + chrono::Duration::seconds(seconds as i64));

        let entry = CacheEntry {
            key: key.clone(),
            document,
            created_at: Utc::now(),
            expires_at,
            access_count: 0,
            last_accessed: Utc::now(),
        };

        self.entries.insert(key, entry);
        Ok(())
    }

    pub fn invalidate(&mut self, key: &str) {
        self.entries.remove(key);
    }

    pub fn invalidate_by_job(&mut self, job_id: i64) {
        self.entries.retain(|k, _| !k.contains(&format!("job_{}", job_id)));
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    pub fn get_stats(&self) -> CacheStats {
        let total_size = self.entries.len();
        let total_accesses: u64 = self.entries.values().map(|e| e.access_count).sum();
        let avg_accesses = if total_size > 0 {
            total_accesses as f64 / total_size as f64
        } else {
            0.0
        };

        CacheStats {
            total_entries: total_size,
            max_size: self.max_size,
            total_accesses,
            avg_accesses_per_entry: avg_accesses,
            hit_rate: 0.0, // Would need to track hits/misses separately
        }
    }

    fn evict_oldest(&mut self) {
        if self.entries.is_empty() {
            return;
        }

        // Find the least recently used entry
        let oldest_key = self
            .entries
            .iter()
            .min_by_key(|(_, entry)| entry.last_accessed)
            .map(|(key, _)| key.clone());

        if let Some(key) = oldest_key {
            self.entries.remove(&key);
        }
    }

    pub fn cleanup_expired(&mut self) {
        let now = Utc::now();
        self.entries.retain(|_, entry| {
            entry.expires_at.map_or(true, |expires_at| now <= expires_at)
        });
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_entries: usize,
    pub max_size: usize,
    pub total_accesses: u64,
    pub avg_accesses_per_entry: f64,
    pub hit_rate: f64,
}

impl Default for DocumentCache {
    fn default() -> Self {
        Self::new(100, Some(3600)) // 100 entries, 1 hour TTL
    }
}


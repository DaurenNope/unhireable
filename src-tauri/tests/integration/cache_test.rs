// Integration tests for cache operations

use unhireable_lib::cache::Cache;
use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;

#[tokio::test]
async fn test_cache_set_and_get() {
    let cache: Cache<String, serde_json::Value> = Cache::new(Duration::from_secs(60));
    
    let key = "test_key".to_string();
    let value = json!({"test": "data"});
    
    cache.set(key.clone(), value.clone(), None).await.expect("Failed to set cache");
    
    let retrieved = cache.get(&key).await;
    assert!(retrieved.is_some(), "Should retrieve cached value");
    assert_eq!(retrieved.unwrap(), value, "Retrieved value should match");
}

#[tokio::test]
async fn test_cache_expiration() {
    let cache: Cache<String, serde_json::Value> = Cache::new(Duration::from_millis(100));
    
    let key = "expiring_key".to_string();
    let value = json!({"test": "data"});
    
    cache.set(key.clone(), value, None).await.expect("Failed to set cache");
    
    // Wait for expiration
    sleep(Duration::from_millis(150)).await;
    
    let retrieved = cache.get(&key).await;
    assert!(retrieved.is_none(), "Expired cache entry should not be retrieved");
}

#[tokio::test]
async fn test_cache_remove() {
    let cache: Cache<String, serde_json::Value> = Cache::new(Duration::from_secs(60));
    
    let key = "removable_key".to_string();
    let value = json!({"test": "data"});
    
    cache.set(key.clone(), value, None).await.expect("Failed to set cache");
    
    // Verify it exists
    assert!(cache.get(&key).await.is_some(), "Key should exist before removal");
    
    // Remove it
    cache.remove(&key).await;
    
    // Verify it's gone
    assert!(cache.get(&key).await.is_none(), "Key should not exist after removal");
}

#[tokio::test]
async fn test_cache_clear() {
    let cache: Cache<String, serde_json::Value> = Cache::new(Duration::from_secs(60));
    
    // Add multiple entries
    for i in 0..5 {
        let key = format!("key_{}", i);
        let value = json!({"index": i});
        cache.set(key, value, None).await.expect("Failed to set cache");
    }
    
    // Verify entries exist
    assert!(cache.get(&"key_0".to_string()).await.is_some(), "Entry should exist");
    
    // Clear cache
    cache.clear().await;
    
    // Verify all entries are gone
    for i in 0..5 {
        let key = format!("key_{}", i);
        assert!(cache.get(&key).await.is_none(), "Entry {} should not exist after clear", i);
    }
}

#[tokio::test]
async fn test_cache_custom_ttl() {
    let cache: Cache<String, serde_json::Value> = Cache::new(Duration::from_secs(60));
    
    let key = "custom_ttl_key".to_string();
    let value = json!({"test": "data"});
    
    // Set with custom short TTL
    cache.set(key.clone(), value, Some(Duration::from_millis(50))).await.expect("Failed to set cache");
    
    // Should exist immediately
    assert!(cache.get(&key).await.is_some(), "Entry should exist immediately");
    
    // Wait for expiration
    sleep(Duration::from_millis(100)).await;
    
    // Should be expired
    assert!(cache.get(&key).await.is_none(), "Entry with custom TTL should expire");
}









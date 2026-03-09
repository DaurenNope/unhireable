use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub mod models;
pub mod queries;
// PostgreSQL support temporarily disabled due to dependency conflicts
// #[cfg(feature = "postgres")]
// pub mod postgres;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let mut conn = Connection::open(path)?;

        // Enable foreign key support
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Run migrations
        Self::run_migrations(&mut conn)?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    fn run_migrations(conn: &mut Connection) -> Result<()> {
        // Get the migrations directory relative to the crate root
        let crate_root = env!("CARGO_MANIFEST_DIR");
        let migrations_dir = std::path::Path::new(crate_root).join("migrations");

        if migrations_dir.exists() {
            let mut migration_files: Vec<_> = std::fs::read_dir(&migrations_dir)?
                .filter_map(Result::ok)
                .filter(|entry| {
                    let path = entry.path();
                    path.extension().map_or(false, |ext| ext == "sql")
                })
                .collect();

            migration_files.sort_by_key(|entry| entry.file_name());

            // Check if match_score column exists (for migration 0005)
            let match_score_exists = {
                let mut stmt = conn.prepare("PRAGMA table_info(jobs)")?;
                let mut rows = stmt.query_map([], |row| {
                    let name: String = row.get(1)?;
                    Ok(name)
                })?;
                rows.any(|r| r.map(|name| name == "match_score").unwrap_or(false))
            };

            // Check if user_profile table exists (for migration 0006)
            let user_profile_exists = {
                let mut stmt = conn.prepare(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='user_profile'",
                )?;
                stmt.query_row([], |row| {
                    let _: String = row.get(0)?;
                    Ok(())
                })
                .is_ok()
            };

            // Check if saved_searches table exists (for migration 0008)
            let saved_searches_exists = {
                let mut stmt = conn.prepare(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='saved_searches'",
                )?;
                stmt.query_row([], |row| {
                    let _: String = row.get(0)?;
                    Ok(())
                })
                .is_ok()
            };

            // Check if job_interactions table exists (for migration 0009)
            let behavior_tracking_exists = {
                let mut stmt = conn.prepare(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='job_interactions'",
                )?;
                stmt.query_row([], |row| {
                    let _: String = row.get(0)?;
                    Ok(())
                })
                .is_ok()
            };

            // Check if user_auth table exists (for migration 0011)
            let user_auth_exists = {
                let mut stmt = conn.prepare(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='user_auth'",
                )?;
                stmt.query_row([], |row| {
                    let _: String = row.get(0)?;
                    Ok(())
                })
                .is_ok()
            };

            // Check if answer_cache table exists (for migration 0013)
            let answer_cache_exists = {
                let mut stmt = conn.prepare(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='answer_cache'",
                )?;
                stmt.query_row([], |row| {
                    let _: String = row.get(0)?;
                    Ok(())
                })
                .is_ok()
            };

            // Check if answer_patterns table exists (for migration 0014)
            let answer_patterns_exists = {
                let mut stmt = conn.prepare(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='answer_patterns'",
                )?;
                stmt.query_row([], |row| {
                    let _: String = row.get(0)?;
                    Ok(())
                })
                .is_ok()
            };

            for entry in migration_files {
                let migration_sql = std::fs::read_to_string(entry.path())?;
                let file_name = entry.file_name().to_string_lossy().to_string();

                // Skip migration 0005 if match_score column already exists
                if file_name.contains("0005_add_match_score") && match_score_exists {
                    println!("Skipping migration {} - column already exists", file_name);
                    continue;
                }

                // Skip migration 0006 if user_profile table already exists
                if file_name.contains("0006_add_user_profile") && user_profile_exists {
                    println!("Skipping migration {} - table already exists", file_name);
                    continue;
                }

                // Skip migration 0008 if saved_searches table already exists
                if file_name.contains("0008_add_saved_searches") && saved_searches_exists {
                    println!("Skipping migration {} - table already exists", file_name);
                    continue;
                }

                // Skip migration 0009 if behavior tracking tables already exist
                if file_name.contains("0009_add_behavior_tracking") && behavior_tracking_exists {
                    println!("Skipping migration {} - tables already exist", file_name);
                    continue;
                }

                // Skip migration 0010 if source names are already normalized (check by sampling)
                if file_name.contains("0010_normalize_source_names") {
                    let source_normalized = {
                        let mut stmt = conn.prepare(
                            "SELECT COUNT(*) FROM jobs WHERE source != LOWER(source) LIMIT 1",
                        )?;
                        let count: i64 = stmt.query_row([], |row| row.get(0))?;
                        count == 0
                    };
                    if source_normalized {
                        println!(
                            "Skipping migration {} - source names already normalized",
                            file_name
                        );
                        continue;
                    }
                }

                // Skip migration 0011 if user_auth table already exists
                if file_name.contains("0011_add_user_auth") && user_auth_exists {
                    println!("Skipping migration {} - table already exists", file_name);
                    continue;
                }

                // Skip migration 0013 if answer_cache table already exists
                if file_name.contains("0013_add_answer_cache") && answer_cache_exists {
                    println!("Skipping migration {} - table already exists", file_name);
                    continue;
                }

                // Skip migration 0014 if answer_patterns table already exists
                if file_name.contains("0014_add_answer_patterns") && answer_patterns_exists {
                    println!("Skipping migration {} - table already exists", file_name);
                    continue;
                }

                // Execute migration with error handling for duplicate column/table errors
                match conn.execute_batch(&migration_sql) {
                    Ok(_) => {
                        println!("Applied migration: {}", file_name);
                    }
                    Err(e) => {
                        let error_msg = e.to_string();
                        // If it's a duplicate column/table error, skip it
                        if (file_name.contains("0005_add_match_score")
                            && error_msg.contains("duplicate column name: match_score"))
                            || (file_name.contains("0006_add_user_profile")
                                && error_msg.contains("table user_profile already exists"))
                            || (file_name.contains("0014_add_answer_patterns")
                                && error_msg.contains("table answer_patterns already exists"))
                        {
                            println!("Skipping migration {} - already exists", file_name);
                            continue;
                        }
                        // For other errors, return them
                        return Err(anyhow::anyhow!("Migration {} failed: {}", file_name, e));
                    }
                }
            }
        } else {
            // If migrations directory doesn't exist, create tables directly
            // This is a fallback for development
            let tx = conn.transaction()?;

            // Run initial schema
            tx.execute_batch(include_str!("../../migrations/0001_initial_schema.sql"))?;

            // Run additional migrations if they exist
            let migration2_path = std::path::Path::new(crate_root)
                .join("migrations/0002_add_contacts_interviews_documents.sql");
            if migration2_path.exists() {
                let migration2_sql = std::fs::read_to_string(&migration2_path)?;
                tx.execute_batch(&migration2_sql)?;
            }

            let migration3_path =
                std::path::Path::new(crate_root).join("migrations/0003_add_activity_log.sql");
            if migration3_path.exists() {
                let migration3_sql = std::fs::read_to_string(&migration3_path)?;
                tx.execute_batch(&migration3_sql)?;
            }

            let migration4_path =
                std::path::Path::new(crate_root).join("migrations/0004_add_credentials.sql");
            if migration4_path.exists() {
                let migration4_sql = std::fs::read_to_string(&migration4_path)?;
                tx.execute_batch(&migration4_sql)?;
            }

            let migration5_path =
                std::path::Path::new(crate_root).join("migrations/0005_add_match_score.sql");
            if migration5_path.exists() {
                let migration5_sql = std::fs::read_to_string(&migration5_path)?;
                // Check if match_score column exists before adding
                let match_score_exists = {
                    let mut stmt = tx.prepare("PRAGMA table_info(jobs)")?;
                    let mut rows = stmt.query_map([], |row| {
                        let name: String = row.get(1)?;
                        Ok(name)
                    })?;
                    rows.any(|r| r.map(|name| name == "match_score").unwrap_or(false))
                };
                if !match_score_exists {
                    tx.execute_batch(&migration5_sql)?;
                }
            }

            let migration6_path =
                std::path::Path::new(crate_root).join("migrations/0006_add_user_profile.sql");
            if migration6_path.exists() {
                let migration6_sql = std::fs::read_to_string(&migration6_path)?;
                // Check if user_profile table exists before adding
                let user_profile_exists = {
                    let mut stmt = tx.prepare(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name='user_profile'",
                    )?;
                    stmt.query_row([], |row| {
                        let _: String = row.get(0)?;
                        Ok(())
                    })
                    .is_ok()
                };
                if !user_profile_exists {
                    tx.execute_batch(&migration6_sql)?;
                }
            }

            tx.commit()?;
        }

        Ok(())
    }

    pub fn get_connection(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::AnswerCacheEntry;
    use crate::db::queries::AnswerCacheQueries;
    use tempfile::tempdir;

    #[test]
    fn test_database_creation() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).unwrap();

        // Verify the database was created and has the jobs table
        let conn = db.get_connection();
        let table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='jobs'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_exists, 1);
    }

    #[test]
    fn test_answer_cache_table_created() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).unwrap();
        let conn = db.get_connection();

        let table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='answer_cache'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(
            table_exists, 1,
            "answer_cache table should exist after migrations"
        );
    }

    #[test]
    fn test_answer_cache_upsert_and_list() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).unwrap();
        let conn = db.get_connection();

        // Insert an entry
        let entry = AnswerCacheEntry {
            id: None,
            normalized_key: "years_of_experience".to_string(),
            question: "How many years of experience do you have?".to_string(),
            answer: "5".to_string(),
            field_type: Some("text".to_string()),
            source: Some("pattern".to_string()),
            confidence: Some("high".to_string()),
            hit_count: 1,
            persona_id: None,
            created_at: None,
            updated_at: None,
        };

        conn.upsert_answer_cache(&entry).unwrap();

        // List and verify
        let entries = conn.list_answer_cache(None).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].normalized_key, "years_of_experience");
        assert_eq!(entries[0].answer, "5");
        assert_eq!(
            entries[0].question,
            "How many years of experience do you have?"
        );
        assert_eq!(entries[0].field_type.as_deref(), Some("text"));
        assert_eq!(entries[0].source.as_deref(), Some("pattern"));
        assert_eq!(entries[0].confidence.as_deref(), Some("high"));
        assert!(
            entries[0].created_at.is_some(),
            "created_at should be auto-set"
        );
        assert!(
            entries[0].updated_at.is_some(),
            "updated_at should be auto-set"
        );
    }

    #[test]
    fn test_answer_cache_upsert_conflict_increments_hit_count() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).unwrap();
        let conn = db.get_connection();

        let entry = AnswerCacheEntry {
            id: None,
            normalized_key: "sponsor_visa".to_string(),
            question: "Do you require sponsorship?".to_string(),
            answer: "No".to_string(),
            field_type: Some("select".to_string()),
            source: Some("llm".to_string()),
            confidence: Some("medium".to_string()),
            hit_count: 1,
            persona_id: None,
            created_at: None,
            updated_at: None,
        };

        // Insert twice with same key
        conn.upsert_answer_cache(&entry).unwrap();
        conn.upsert_answer_cache(&entry).unwrap();

        let entries = conn.list_answer_cache(None).unwrap();
        assert_eq!(entries.len(), 1, "should still be one entry after conflict");
        assert_eq!(
            entries[0].hit_count, 2,
            "hit_count should be incremented on conflict"
        );
    }

    #[test]
    fn test_answer_cache_delete() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).unwrap();
        let conn = db.get_connection();

        // Insert two entries
        for key in &["key_a", "key_b"] {
            conn.upsert_answer_cache(&AnswerCacheEntry {
                normalized_key: key.to_string(),
                question: format!("Question for {}", key),
                answer: "Answer".to_string(),
                ..Default::default()
            })
            .unwrap();
        }

        assert_eq!(conn.list_answer_cache(None).unwrap().len(), 2);

        // Delete one
        conn.delete_answer_cache("key_a").unwrap();

        let remaining = conn.list_answer_cache(None).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].normalized_key, "key_b");
    }

    #[test]
    fn test_answer_cache_bulk_upsert() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).unwrap();
        let conn = db.get_connection();

        // Simulate a bulk sync (like the POST /api/answer-cache endpoint)
        let entries: Vec<AnswerCacheEntry> = (0..20)
            .map(|i| AnswerCacheEntry {
                normalized_key: format!("bulk_key_{}", i),
                question: format!("Bulk question {}", i),
                answer: format!("Answer {}", i),
                field_type: Some("text".to_string()),
                source: Some("llm".to_string()),
                confidence: Some("medium".to_string()),
                hit_count: 1,
                ..Default::default()
            })
            .collect();

        let mut upserted = 0;
        for entry in &entries {
            conn.upsert_answer_cache(entry).unwrap();
            upserted += 1;
        }

        assert_eq!(upserted, 20);
        assert_eq!(conn.list_answer_cache(None).unwrap().len(), 20);

        // Re-sync all (conflict path) — should not create duplicates
        for entry in &entries {
            conn.upsert_answer_cache(entry).unwrap();
        }

        let all = conn.list_answer_cache(None).unwrap();
        assert_eq!(all.len(), 20, "no duplicates after re-sync");
        assert!(
            all.iter().all(|e| e.hit_count == 2),
            "all hit_counts should be 2 after re-sync"
        );
    }
}

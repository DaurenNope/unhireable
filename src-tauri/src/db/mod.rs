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
}

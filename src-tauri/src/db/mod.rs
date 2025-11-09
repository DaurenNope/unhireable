use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub mod models;
pub mod queries;

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
            
            for entry in migration_files {
                let migration_sql = std::fs::read_to_string(entry.path())?;
                let file_name = entry.file_name().to_string_lossy().to_string();
                
                // Skip migration 0005 if match_score column already exists
                if file_name.contains("0005_add_match_score") && match_score_exists {
                    println!("Skipping migration {} - column already exists", file_name);
                    continue;
                }
                
                // Execute migration with error handling for duplicate column errors
                match conn.execute_batch(&migration_sql) {
                    Ok(_) => {
                        println!("Applied migration: {}", file_name);
                    }
                    Err(e) => {
                        // If it's a duplicate column error and we're adding match_score, skip it
                        if file_name.contains("0005_add_match_score") 
                            && e.to_string().contains("duplicate column name: match_score") {
                            println!("Skipping migration {} - column already exists", file_name);
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
            let migration2_path = std::path::Path::new(crate_root).join("migrations/0002_add_contacts_interviews_documents.sql");
            if migration2_path.exists() {
                let migration2_sql = std::fs::read_to_string(&migration2_path)?;
                tx.execute_batch(&migration2_sql)?;
            }
            
            let migration3_path = std::path::Path::new(crate_root).join("migrations/0003_add_activity_log.sql");
            if migration3_path.exists() {
                let migration3_sql = std::fs::read_to_string(&migration3_path)?;
                tx.execute_batch(&migration3_sql)?;
            }
            
            let migration4_path = std::path::Path::new(crate_root).join("migrations/0004_add_credentials.sql");
            if migration4_path.exists() {
                let migration4_sql = std::fs::read_to_string(&migration4_path)?;
                tx.execute_batch(&migration4_sql)?;
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

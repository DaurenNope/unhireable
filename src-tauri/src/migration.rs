#[cfg(feature = "postgres")]
use anyhow::Result;
#[cfg(feature = "postgres")]
use crate::db::Database;
#[cfg(feature = "postgres")]
use rusqlite::Connection;
#[cfg(feature = "postgres")]
use std::path::Path;

/// Migrate data from SQLite to PostgreSQL
/// This is a helper function for migrating existing SQLite databases to PostgreSQL
#[cfg(feature = "postgres")]
pub async fn migrate_sqlite_to_postgres(
    sqlite_path: &Path,
    postgres_url: &str,
) -> Result<()> {
    tracing::info!("Starting migration from SQLite to PostgreSQL");
    
    // Open SQLite database
    let sqlite_db = Database::new(sqlite_path)?;
    let sqlite_conn = sqlite_db.get_connection();
    
    // Connect to PostgreSQL
    let pg_pool = sqlx::PgPool::connect(postgres_url).await?;
    
    // Migrate jobs
    tracing::info!("Migrating jobs...");
    let jobs: Vec<(i64, String, String, String, Option<String>, Option<String>, Option<String>, Option<String>, String, String, Option<f64>, String, String)> = 
        sqlite_conn.prepare("SELECT id, title, company, url, description, requirements, location, salary, source, status, match_score, created_at, updated_at FROM jobs")?
            .query_map([], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                    row.get(10)?,
                    row.get(11)?,
                    row.get(12)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
    
    for job in jobs {
        sqlx::query(
            r#"
            INSERT INTO jobs (id, title, company, url, description, requirements, location, salary, source, status, match_score, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (url) DO NOTHING
            "#
        )
        .bind(job.0 as i64)
        .bind(&job.1)
        .bind(&job.2)
        .bind(&job.3)
        .bind(&job.4)
        .bind(&job.5)
        .bind(&job.6)
        .bind(&job.7)
        .bind(&job.8)
        .bind(&job.9)
        .bind(job.10)
        .bind(&job.11)
        .bind(&job.12)
        .execute(&pg_pool)
        .await?;
    }
    
    tracing::info!("Migration completed successfully");
    Ok(())
}







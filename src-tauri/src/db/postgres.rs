use anyhow::Result;
use sqlx::{PgPool, Postgres, Pool};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct PostgresDatabase {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresDatabase {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPool::connect(database_url).await?;
        
        // Run migrations
        Self::run_migrations(&pool).await?;
        
        Ok(PostgresDatabase {
            pool: Arc::new(pool),
        })
    }

    async fn run_migrations(pool: &Pool<Postgres>) -> Result<()> {
        let crate_root = env!("CARGO_MANIFEST_DIR");
        let migrations_dir = std::path::Path::new(crate_root).join("migrations/postgres");

        if migrations_dir.exists() {
            let mut migration_files: Vec<_> = std::fs::read_dir(&migrations_dir)?
                .filter_map(Result::ok)
                .filter(|entry| {
                    let path = entry.path();
                    path.extension().map_or(false, |ext| ext == "sql")
                })
                .collect();

            migration_files.sort_by_key(|entry| entry.file_name());

            for entry in migration_files {
                let migration_sql = std::fs::read_to_string(entry.path())?;
                let file_name = entry.file_name().to_string_lossy().to_string();

                sqlx::query(&migration_sql).execute(pool).await?;
                println!("Applied PostgreSQL migration: {}", file_name);
            }
        }

        Ok(())
    }

    pub fn get_pool(&self) -> Arc<Pool<Postgres>> {
        self.pool.clone()
    }
}


//! Unhireable REST API Server
//!
//! Standalone HTTP server exposing the Unhireable job automation features.
//! Run with: cargo run --bin server

use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "unhireable-server")]
#[command(about = "Unhireable REST API Server", long_about = None)]
struct Args {
    /// Port to run the server on
    #[arg(short, long, default_value = "3030")]
    port: u16,

    /// Path to the SQLite database
    #[arg(short, long)]
    database: Option<PathBuf>,
}

fn get_default_db_path() -> PathBuf {
    // Try to use the standard app data directory
    if let Some(data_dir) = dirs::data_dir() {
        let app_dir = data_dir.join("com.unhireable.app");
        if !app_dir.exists() {
            let _ = std::fs::create_dir_all(&app_dir);
        }
        // Use jobhunter.db to match Tauri's database
        return app_dir.join("jobhunter.db");
    }

    // Fallback to current directory
    PathBuf::from("jobhunter.db")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let args = Args::parse();
    let db_path = args.database.unwrap_or_else(get_default_db_path);

    println!(
        r#"
   __  __      __   _                __   __   
  / / / /___  / /_ (_)______  ____ _/ /  / /__ 
 / / / / __ \/ __ \/ / ___/ / __ `/ /  / / _ \
/ /_/ / / / / / / / / /  / /_/ / /_ / /  __/
\____/_/ /_/_/ /_/_/_/   \__,_/_.__|/_/\___/ 
                                              
    🚀 REST API Server v{}
    "#,
        env!("CARGO_PKG_VERSION")
    );

    println!("📁 Database: {}", db_path.display());
    println!("🌐 Server:   http://localhost:{}", args.port);
    println!("\n📡 Available endpoints:");
    println!("   GET  /api/health        - Health check");
    println!("   GET  /api/stats         - Dashboard statistics");
    println!("   GET  /api/jobs          - List jobs");
    println!("   POST /api/jobs          - Create job");
    println!("   GET  /api/jobs/:id      - Get job");
    println!("   PUT  /api/jobs/:id      - Update job");
    println!("   DELETE /api/jobs/:id    - Delete job");
    println!("   GET  /api/applications  - List applications");
    println!("   POST /api/applications  - Create application");
    println!("   GET  /api/applications/:id - Get application");
    println!("   PUT  /api/applications/:id - Update application");
    println!();

    unhireable_lib::web_server::run_server(db_path.to_string_lossy().as_ref(), args.port).await?;

    Ok(())
}

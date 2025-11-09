// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::{Arg, Command};
use jobez_lib::{scraper::ScraperManager, db::{Database, queries::JobQueries}};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let matches = Command::new("unhireable")
        .version("0.1.0")
        .about("Unhireable - Neural Career System")
        .arg(
            Arg::new("query")
                .help("Job search query")
                .index(1)
        )
        .arg(
            Arg::new("scrape")
                .long("scrape")
                .short('s')
                .help("Run scraper with query")
                .value_name("QUERY")
        )
        .arg(
            Arg::new("sources")
                .long("sources")
                .short('r')
                .help("Specify sources to scrape from (comma-separated)")
                .value_name("SOURCES")
        )
        .get_matches();

    // If query is provided as positional argument, run scraper and save to DB
    if let Some(query) = matches.get_one::<String>("query") {
        println!("Scraping jobs for: {}", query);
        let scraper = ScraperManager::new();

        // Initialize database
        let app_dir = dirs::data_dir()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Could not find data directory"))?
            .join("unhireable");
        std::fs::create_dir_all(&app_dir)?;
        let db_path = app_dir.join("jobhunter.db");
        let db = Database::new(db_path)?;

        match scraper.scrape_all(query) {
        Ok(jobs) => {
            println!("Found {} jobs. Saving to database...", jobs.len());
            let mut saved_count = 0;
            for job in &jobs {
                if db.get_connection().get_job_by_url(&job.url)?.is_none() {
                    let mut job_clone = job.clone();
                    db.get_connection().create_job(&mut job_clone)?;
                    saved_count += 1;
                }
            }
            println!("Saved {} new jobs to database.", saved_count);
            for job in &jobs {
                println!("• {} at {} ({})", job.title, job.company, job.source);
            }
        }
        Err(e) => {
            eprintln!("Error scraping jobs: {}", e);
        }
    }
    return Ok(());
    }

    // If --scrape flag is provided, run scraper and save to DB
    if let Some(query) = matches.get_one::<String>("scrape") {
        println!("Scraping jobs for: {}", query);
        let scraper = ScraperManager::new();

        // Initialize database
        let app_dir = dirs::data_dir()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Could not find data directory"))?
            .join("unhireable");
        std::fs::create_dir_all(&app_dir)?;
        let db_path = app_dir.join("jobhunter.db");
        let db = Database::new(db_path)?;

        match scraper.scrape_all(query) {
            Ok(jobs) => {
                println!("Found {} jobs. Saving to database...", jobs.len());
                let mut saved_count = 0;
                for job in &jobs {
                    if db.get_connection().get_job_by_url(&job.url)?.is_none() {
                        let mut job_clone = job.clone();
                        db.get_connection().create_job(&mut job_clone)?;
                        saved_count += 1;
                    }
                }
                println!("Saved {} new jobs to database.", saved_count);
                for job in &jobs {
                    println!("• {} at {} ({})", job.title, job.company, job.source);
                }
            }
            Err(e) => {
                eprintln!("Error scraping jobs: {}", e);
            }
        }
        return Ok(());
    }

    // If no scraper arguments, run the Tauri app
    Ok(jobez_lib::run())
}

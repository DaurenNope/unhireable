//! Find a fresh job with Lever or Greenhouse ATS

use unhireable_lib::scraper::ScraperManager;
use unhireable_lib::applicator::AtsDetector;

fn main() {
    println!("🔍 Searching for fresh jobs with Lever/Greenhouse ATS...");
    println!("");
    
    let scraper = ScraperManager::new();
    
    // Scrape from multiple sources
    let sources = vec![
        "remoteok".to_string(),
        "remotive".to_string(),
        "themuse".to_string(),
    ];
    
    let jobs = match scraper.scrape_selected(&sources, "software engineer") {
        Ok(j) => j,
        Err(e) => {
            println!("Error: {}", e);
            return;
        }
    };
    
    println!("📊 Found {} total jobs, checking ATS types...", jobs.len());
    println!("");
    
    let mut lever_jobs = Vec::new();
    let mut greenhouse_jobs = Vec::new();
    
    for job in &jobs {
        if job.url.contains("lever.co") {
            lever_jobs.push(job);
        } else if job.url.contains("greenhouse.io") || job.url.contains("boards.greenhouse") {
            greenhouse_jobs.push(job);
        }
    }
    
    println!("═══════════════════════════════════════════════════════════════");
    println!("🟢 LEVER JOBS ({})", lever_jobs.len());
    println!("═══════════════════════════════════════════════════════════════");
    for (i, job) in lever_jobs.iter().take(5).enumerate() {
        println!("{}. {} @ {}", i+1, job.title, job.company);
        println!("   URL: {}", job.url);
        println!("");
    }
    
    println!("═══════════════════════════════════════════════════════════════");
    println!("🟢 GREENHOUSE JOBS ({})", greenhouse_jobs.len());
    println!("═══════════════════════════════════════════════════════════════");
    for (i, job) in greenhouse_jobs.iter().take(5).enumerate() {
        println!("{}. {} @ {}", i+1, job.title, job.company);
        println!("   URL: {}", job.url);
        println!("");
    }
    
    // Print all URLs for quick use
    println!("═══════════════════════════════════════════════════════════════");
    println!("QUICK COPY - First working URLs:");
    println!("═══════════════════════════════════════════════════════════════");
    if let Some(job) = lever_jobs.first() {
        println!("LEVER: {}", job.url);
    }
    if let Some(job) = greenhouse_jobs.first() {
        println!("GREENHOUSE: {}", job.url);
    }
}

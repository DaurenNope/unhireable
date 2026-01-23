//! Quick Dice scraper test

use unhireable_lib::scraper::ScraperManager;

fn main() {
    println!("Testing Dice scraper...\n");
    
    let scraper = ScraperManager::new();
    let result = scraper.scrape_selected(&["dice".to_string()], "developer");
    
    match result {
        Ok(jobs) => {
            println!("\n✅ Found {} jobs from Dice", jobs.len());
            for (i, job) in jobs.iter().take(5).enumerate() {
                println!("\n{}. {}", i + 1, job.title);
                println!("   Company: {}", job.company);
                println!("   URL: {}", job.url);
            }
        }
        Err(e) => {
            println!("❌ Error: {}", e);
        }
    }
}

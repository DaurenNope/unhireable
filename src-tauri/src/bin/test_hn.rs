//! Quick scraper test for personalized job search

use unhireable_lib::scraper::{hackernews, JobScraper};

fn main() {
    println!("🔍 Testing HackerNews Who's Hiring scraper...\n");

    // Test HackerNews with AI/remote query
    match hackernews::HackerNewsScraper.scrape("AI remote") {
        Ok(jobs) => {
            println!("✅ Found {} jobs from HackerNews\n", jobs.len());

            // Show first 5 jobs
            for (i, job) in jobs.iter().take(5).enumerate() {
                println!("{}. {}", i + 1, job.title);
                println!("   Company: {}", job.company);
                println!("   Location: {}", job.location.as_deref().unwrap_or("N/A"));
                println!("   URL: {}", job.url);
                println!();
            }
        }
        Err(e) => {
            eprintln!("❌ Error: {}", e);
        }
    }
}

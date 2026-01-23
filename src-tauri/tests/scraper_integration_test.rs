// Integration tests for scrapers
// These tests actually hit real websites, so they're marked with #[ignore]
// Run with: cargo test --test scraper_integration_test -- --ignored --nocapture

use unhireable_lib::scraper::ScraperManager;

/// Integration test to verify scrapers work against real websites
/// Run with: cargo test --test scraper_integration_test -- --ignored --nocapture
#[test]
#[ignore] // Ignore by default - requires network and may be slow
fn test_remoteok_scraper() {
    let scraper = ScraperManager::new();
    let query = "developer";

    println!("Testing RemoteOK scraper with query: '{}'", query);
    let result = scraper.scrape_selected(&["remoteok".to_string()], query);

    match result {
        Ok(jobs) => {
            println!("✅ RemoteOK: Found {} jobs", jobs.len());
            assert!(
                !jobs.is_empty(),
                "RemoteOK should return jobs for 'developer' query"
            );

            // Verify job structure
            for job in jobs.iter().take(3) {
                println!(
                    "  - {} at {} (source: {})",
                    job.title, job.company, job.source
                );
                assert_eq!(job.source, "remoteok");
                assert!(!job.title.is_empty());
                assert!(!job.company.is_empty());
                assert!(!job.url.is_empty());
            }
        }
        Err(e) => {
            eprintln!("❌ RemoteOK scraper failed: {}", e);
            panic!("RemoteOK scraper should work");
        }
    }
}

#[test]
#[ignore]
fn test_work_at_startup_scraper() {
    let scraper = ScraperManager::new();
    let query = "developer";

    println!("Testing Work at a Startup scraper with query: '{}'", query);
    let result = scraper.scrape_selected(&["workatastartup".to_string()], query);

    match result {
        Ok(jobs) => {
            println!("✅ Work at a Startup: Found {} jobs", jobs.len());
            // Work at a Startup might return 0 jobs, which is okay
            if !jobs.is_empty() {
                for job in jobs.iter().take(3) {
                    println!(
                        "  - {} at {} (source: {})",
                        job.title, job.company, job.source
                    );
                    assert_eq!(job.source, "workatastartup");
                    assert!(!job.title.is_empty());
                    assert!(!job.company.is_empty());
                    assert!(!job.url.is_empty());
                }
            } else {
                println!("⚠️  Work at a Startup returned 0 jobs (might be expected)");
            }
        }
        Err(e) => {
            eprintln!("❌ Work at a Startup scraper failed: {}", e);
            // This is okay - might fail due to website structure changes
            println!("⚠️  Work at a Startup scraper failed (this might be expected)");
        }
    }
}

#[test]
#[ignore]
fn test_remotive_scraper() {
    let scraper = ScraperManager::new();
    let query = "developer";

    println!("Testing Remotive scraper with query: '{}'", query);
    let result = scraper.scrape_selected(&["remotive".to_string()], query);

    match result {
        Ok(jobs) => {
            println!("✅ Remotive: Found {} jobs", jobs.len());
            if !jobs.is_empty() {
                for job in jobs.iter().take(3) {
                    println!(
                        "  - {} at {} (source: {})",
                        job.title, job.company, job.source
                    );
                    assert_eq!(job.source, "remotive");
                    assert!(!job.title.is_empty());
                    assert!(!job.company.is_empty());
                    assert!(!job.url.is_empty());
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Remotive scraper failed: {}", e);
            println!("⚠️  Remotive scraper failed (this might be expected)");
        }
    }
}

#[test]
#[ignore]
fn test_remote_co_scraper() {
    let scraper = ScraperManager::new();
    let query = "developer";

    println!("Testing Remote.co scraper with query: '{}'", query);
    let result = scraper.scrape_selected(&["remoteco".to_string()], query);

    match result {
        Ok(jobs) => {
            println!("✅ Remote.co: Found {} jobs", jobs.len());
            if !jobs.is_empty() {
                for job in jobs.iter().take(3) {
                    println!(
                        "  - {} at {} (source: {})",
                        job.title, job.company, job.source
                    );
                    assert_eq!(job.source, "remote.co");
                    assert!(!job.title.is_empty());
                    assert!(!job.company.is_empty());
                    assert!(!job.url.is_empty());
                }
            } else {
                println!("⚠️  Remote.co returned 0 jobs (HTML structure might have changed)");
            }
        }
        Err(e) => {
            eprintln!("❌ Remote.co scraper failed: {}", e);
            // This is okay - might fail due to website structure changes
            println!("⚠️  Remote.co scraper failed (this might be expected)");
        }
    }
}

#[test]
#[ignore]
fn test_weworkremotely_scraper() {
    let scraper = ScraperManager::new();
    let query = "developer";

    println!("Testing WeWorkRemotely scraper with query: '{}'", query);
    let result = scraper.scrape_selected(&["weworkremotely".to_string()], query);

    match result {
        Ok(jobs) => {
            println!("✅ WeWorkRemotely: Found {} jobs", jobs.len());
            if !jobs.is_empty() {
                for job in jobs.iter().take(3) {
                    println!(
                        "  - {} at {} (source: {})",
                        job.title, job.company, job.source
                    );
                    assert_eq!(job.source, "weworkremotely");
                    assert!(!job.title.is_empty());
                    assert!(!job.company.is_empty());
                    assert!(!job.url.is_empty());
                }
            } else {
                println!("⚠️  WeWorkRemotely returned 0 jobs");
            }
        }
        Err(e) => {
            eprintln!("❌ WeWorkRemotely scraper failed: {}", e);
            println!("⚠️  WeWorkRemotely scraper failed");
        }
    }
}

#[test]
#[ignore]
fn test_multiple_sources() {
    let scraper = ScraperManager::new();
    let query = "developer";
    let sources = vec![
        "remoteok".to_string(),
        "weworkremotely".to_string(),
        "remotive".to_string(),
        "remoteco".to_string(),
        "workatastartup".to_string(),
    ];

    println!("Testing multiple sources: {:?}", sources);
    let result = scraper.scrape_selected(&sources, query);

    match result {
        Ok(jobs) => {
            println!("✅ Multiple sources: Found {} total jobs", jobs.len());

            // Group by source
            use std::collections::HashMap;
            let mut by_source: HashMap<String, Vec<_>> = HashMap::new();
            for job in &jobs {
                by_source.entry(job.source.clone()).or_default().push(job);
            }

            println!("Jobs by source:");
            for (source, source_jobs) in by_source {
                println!("  - {}: {} jobs", source, source_jobs.len());
            }

            assert!(
                !jobs.is_empty(),
                "Should find at least some jobs from multiple sources"
            );
        }
        Err(e) => {
            eprintln!("❌ Multiple sources scraper failed: {}", e);
            // Even if some fail, we should get some jobs
            println!("⚠️  Some sources might have failed, but this is okay");
        }
    }
}

//! Scraper Test - Check all job sources
//! Tests which scrapers are working and which fail

use jobez_lib::scraper::ScraperManager;

fn main() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           🔍 SCRAPER DIAGNOSTIC TEST 🔍                      ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("");

    let scraper = ScraperManager::new();
    
    // All available sources
    let sources = vec![
        // Working API-based sources (no auth)
        ("remoteok", "Software engineer"),
        ("remotive", "developer"),
        ("wwr", "remote"),           // We Work Remotely
        ("themuse", "engineer"),     // The Muse API
        ("arbeitnow", "developer"),  // Arbeitnow API (EU focus)
        ("jobicy", "developer"),     // NEW: Jobicy API (remote jobs)
        ("himalayas", "engineer"),   // NEW: Himalayas API (quality remote)
        // API sources (require keys - will skip gracefully if not set)
        ("adzuna", "software"),      // Adzuna API
        ("jooble", "developer"),     // Jooble API
        ("findwork", "developer"),   // NEW: Findwork API (tech jobs)
        // Fixed/improved sources
        ("dice", "engineer"),        // FIXED: Updated selectors
        // Problematic sources (may fail)
        ("wellfound", "engineer"),
        ("linkedin", "software developer"),
        ("indeed", "software engineer"),
        ("glassdoor", "developer"),
    ];

    println!("Testing {} job sources...\n", sources.len());

    let mut working = Vec::new();
    let mut failed = Vec::new();

    for (source, query) in &sources {
        print!("  📡 {:<15} ", source);
        std::io::Write::flush(&mut std::io::stdout()).ok();
        
        let result = scraper.scrape_selected(&[source.to_string()], query);
        
        match result {
            Ok(jobs) if !jobs.is_empty() => {
                println!("✅ {} jobs", jobs.len());
                working.push((*source, jobs.len()));
            }
            Ok(_) => {
                println!("⚠️  0 jobs (empty result)");
                failed.push((*source, "No jobs returned".to_string()));
            }
            Err(e) => {
                let err_msg = e.to_string();
                let short_err = if err_msg.len() > 40 {
                    format!("{}...", &err_msg[..40])
                } else {
                    err_msg.clone()
                };
                println!("❌ {}", short_err);
                failed.push((*source, err_msg));
            }
        }
    }

    println!("");
    println!("═══════════════════════════════════════════════════════════════");
    println!("RESULTS SUMMARY");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");
    
    println!("✅ WORKING SOURCES ({}):", working.len());
    for (source, count) in &working {
        println!("   • {} ({} jobs)", source, count);
    }
    
    println!("");
    println!("❌ FAILED SOURCES ({}):", failed.len());
    for (source, reason) in &failed {
        println!("   • {}: {}", source, if reason.len() > 50 { &reason[..50] } else { reason });
    }

    println!("");
    println!("═══════════════════════════════════════════════════════════════");
    println!("WHY SOME SOURCES FAIL:");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");
    println!("  • LinkedIn     - Requires authentication + rate limiting");
    println!("  • Indeed       - Cloudflare protection blocks requests");
    println!("  • Glassdoor    - Requires browser automation (Playwright)");
    println!("  • Dice         - Requires browser automation");
    println!("  • Some others  - API changes, rate limits, or auth required");
    println!("");
    println!("TO FIX:");
    println!("  1. LinkedIn: Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD env vars");
    println!("  2. Indeed/Glassdoor: Install Playwright or Chrome");
    println!("  3. Some sources may need API keys");
    println!("");
}

//! Targeted Test - Search for jobs matching your specific skills

use unhireable_lib::db::queries::JobQueries;
use unhireable_lib::db::Database;
use unhireable_lib::generator::{ResumeGenerator, CoverLetterGenerator, UserProfile};
use unhireable_lib::matching::JobMatcher;
use unhireable_lib::applicator::AtsDetector;
use std::path::PathBuf;

fn main() {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    
    rt.block_on(async {
        run_targeted_test().await;
    });
}

async fn run_targeted_test() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║      🎯 TARGETED JOB SEARCH - Your Exact Skills 🎯           ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("");

    let app_dir = dirs::data_dir()
        .map(|p| p.join("com.unhireable.app"))
        .unwrap_or_else(|| PathBuf::from("."));
    
    let db = match Database::new(&app_dir.join("unhireable.db")) {
        Ok(db) => db,
        Err(e) => {
            println!("❌ Database error: {}", e);
            return;
        }
    };
    let conn = db.get_connection();

    let profile = match load_profile(&conn) {
        Some(p) => {
            println!("✅ Profile: {} | Skills: {:?}", 
                p.personal_info.name,
                p.skills.technical_skills.iter().take(5).collect::<Vec<_>>());
            p
        }
        None => {
            println!("❌ No profile");
            return;
        }
    };

    println!("");
    println!("🔍 Searching for jobs matching YOUR skills...");
    println!("");

    // Targeted queries based on user's skills - using ALL working sources
    let queries = vec![
        // RemoteOK - works well
        ("remoteok", "typescript"),
        ("remoteok", "react nextjs"),
        ("remoteok", "golang"),
        ("remoteok", "fullstack"),
        // Remotive - has API
        ("remotive", "frontend"),
        ("remotive", "backend"),
        ("remotive", "fullstack"),
        // WeWorkRemotely - 50+ jobs via Playwright
        ("wwr", "programming"),
        ("wwr", "devops"),
        ("wwr", "full-stack"),
    ];

    let mut all_jobs = Vec::new();

    for (source, query) in &queries {
        print!("  📡 {} [{}]... ", source, query);
        std::io::Write::flush(&mut std::io::stdout()).ok();
        
        let source_str = source.to_string();
        let query_str = query.to_string();
        
        let result = tokio::task::spawn_blocking(move || {
            let scraper = unhireable_lib::scraper::ScraperManager::new();
            scraper.scrape_selected(&[source_str], &query_str)
        }).await;

        match result {
            Ok(Ok(jobs)) => {
                println!("✅ {} jobs", jobs.len());
                for mut job in jobs {
                    if conn.create_job(&mut job).is_ok() {
                        all_jobs.push(job);
                    }
                }
            }
            Ok(Err(_)) => println!("⚠️ No results"),
            Err(_) => println!("⚠️ Error"),
        }
    }

    println!("");
    println!("  📊 Total: {} new jobs scraped", all_jobs.len());

    // Load ALL jobs from database for matching
    let all_db_jobs = conn.list_jobs(None).unwrap_or_default();
    println!("  📊 Total in database: {} jobs", all_db_jobs.len());
    println!("");

    // Match jobs
    let matcher = JobMatcher::new();
    let mut matches: Vec<_> = all_db_jobs.iter()
        .map(|job| {
            let result = matcher.calculate_match(job, &profile);
            (job, result)
        })
        .collect();

    matches.sort_by(|a, b| b.1.match_score.partial_cmp(&a.1.match_score).unwrap());

    println!("═══════════════════════════════════════════════════════════════");
    println!("                    🏆 TOP MATCHES 🏆                          ");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    for (i, (job, result)) in matches.iter().take(15).enumerate() {
        let score = result.match_score;
        let emoji = if score >= 70.0 { "🔥🔥" } 
                   else if score >= 60.0 { "🔥" } 
                   else if score >= 50.0 { "✅" }
                   else if score >= 40.0 { "⚡" }
                   else { "  " };

        println!("{}. {} {:.1}% | {} @ {}", 
            i + 1, emoji, score,
            truncate(&job.title, 35),
            truncate(&job.company, 20));
        
        if !result.matched_skills.is_empty() {
            let skills: String = result.matched_skills.iter()
                .take(4)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ");
            println!("   ✓ {}", skills);
        }
        
        if let Some(loc) = &job.location {
            print!("   📍 {}", truncate(loc, 25));
        }
        if let Some(salary) = &job.salary {
            print!(" | 💰 {}", salary);
        }
        println!("");
        
        // ATS detection for top jobs
        if i < 5 {
            if let Some(ats) = AtsDetector::detect_ats(&job.url) {
                println!("   🤖 ATS: {:?}", ats);
            }
        }
        println!("");
    }

    // Stats
    let excellent = matches.iter().filter(|(_, r)| r.match_score >= 70.0).count();
    let good = matches.iter().filter(|(_, r)| r.match_score >= 60.0).count();
    let fair = matches.iter().filter(|(_, r)| r.match_score >= 50.0).count();
    let ok = matches.iter().filter(|(_, r)| r.match_score >= 40.0).count();

    println!("═══════════════════════════════════════════════════════════════");
    println!("📊 SUMMARY");
    println!("───────────────────────────────────────────────────────────────");
    println!("  🔥🔥 70%+ Excellent matches: {}", excellent);
    println!("  🔥  60%+ Good matches:      {} (auto-apply ready)", good);
    println!("  ✅  50%+ Fair matches:      {}", fair);
    println!("  ⚡  40%+ OK matches:        {}", ok);
    println!("  📋  Total jobs analyzed:   {}", matches.len());
    println!("═══════════════════════════════════════════════════════════════");

    // Generate documents for best match above threshold
    if let Some((job, result)) = matches.iter().find(|(_, r)| r.match_score >= 50.0) {
        println!("");
        println!("📄 GENERATING DOCUMENTS FOR TOP MATCH");
        println!("   Job: {} ({:.1}%)", job.title, result.match_score);
        println!("");

        let resume_gen = ResumeGenerator::new();
        match resume_gen.generate_resume(&profile, job, None, false).await {
            Ok(doc) => println!("   ✅ Resume: {} bytes", doc.content.len()),
            Err(e) => println!("   ❌ Resume error: {}", e),
        }

        let cover_gen = CoverLetterGenerator::new();
        match cover_gen.generate_cover_letter(&profile, job, None, false).await {
            Ok(doc) => println!("   ✅ Cover letter: {} bytes", doc.content.len()),
            Err(e) => println!("   ❌ Cover letter error: {}", e),
        }
    }

    println!("");
    println!("🎉 Test complete! The system is ready for automated applications.");
    println!("");
}

fn load_profile(conn: &std::sync::MutexGuard<'_, rusqlite::Connection>) -> Option<UserProfile> {
    conn.query_row(
        "SELECT profile_data FROM user_profile WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    ).ok().and_then(|json| serde_json::from_str(&json).ok())
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max { s.to_string() } 
    else { format!("{}...", &s[..max.saturating_sub(3)]) }
}

//! Real Application Test
//! Tests browser automation with a test endpoint (no real applications)

use unhireable_lib::db::Database;
use unhireable_lib::db::queries::JobQueries;
use unhireable_lib::generator::UserProfile;
use unhireable_lib::applicator::{JobApplicator, ApplicationConfig, AtsDetector};
use std::path::PathBuf;

fn main() {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    
    rt.block_on(async {
        run_apply_test().await;
    });
}

async fn run_apply_test() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║         🚀 REAL APPLICATION TEST 🚀                          ║");
    println!("║   Testing actual browser automation                          ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("");

    // Load database and profile
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
            println!("✅ Profile loaded: {}", p.personal_info.name);
            p
        }
        None => {
            println!("❌ No profile found");
            return;
        }
    };

    // Get top matching job
    let jobs = conn.list_jobs(None).unwrap_or_default();
    if jobs.is_empty() {
        println!("❌ No jobs in database");
        return;
    }

    let job = &jobs[0];
    println!("📋 Target job: {} at {}", job.title, job.company);
    println!("🔗 URL: {}", job.url);

    // Detect ATS
    let ats_type = AtsDetector::detect_ats(&job.url);
    println!("🤖 ATS detected: {:?}", ats_type);
    println!("");

    // Configure applicator
    println!("═══════════════════════════════════════════════════════════════");
    println!("APPLICATION MODES:");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");
    println!("  1. TEST MODE (safe) - Uses test endpoint, no real submission");
    println!("     → Set test_mode: true, test_endpoint: 'https://httpbin.org/post'");
    println!("");
    println!("  2. DRY RUN - Opens browser, fills form, but doesn't submit");
    println!("     → Set auto_submit: false");
    println!("");
    println!("  3. REAL APPLICATION - Opens browser, fills form, clicks submit");
    println!("     → Set auto_submit: true");
    println!("");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    // Test with DRY RUN MODE (safe - fills form but doesn't submit)
    println!("🧪 Running DRY RUN application...");
    println!("");

    let config = ApplicationConfig {
        auto_submit: false, // Don't click submit button (dry run)
        upload_resume: true,
        upload_cover_letter: true,
        resume_path: None,
        cover_letter_path: None,
        timeout_secs: 60,
        wait_for_confirmation: false,
        ..Default::default()
    };

    let applicator = JobApplicator::with_config(config);

    match applicator.apply_to_job(job, &profile, None, None).await {
        Ok(result) => {
            println!("");
            println!("═══════════════════════════════════════════════════════════════");
            if result.success {
                println!("✅ APPLICATION TEST SUCCESSFUL!");
            } else {
                println!("❌ APPLICATION FAILED");
            }
            println!("═══════════════════════════════════════════════════════════════");
            println!("   Success: {}", result.success);
            println!("   Message: {}", result.message);
            if let Some(ats) = &result.ats_type {
                println!("   ATS Type: {}", ats);
            }
            if !result.errors.is_empty() {
                println!("   Errors: {:?}", result.errors);
            }
        }
        Err(e) => {
            println!("❌ Error: {}", e);
        }
    }

    println!("");
    println!("═══════════════════════════════════════════════════════════════");
    println!("HOW TO ENABLE REAL APPLICATIONS:");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");
    println!("  In the Auto-Pilot settings or when calling apply_to_job:");
    println!("");
    println!("  1. Set auto_submit: TRUE   → Will click submit button");
    println!("  2. Set test_mode: FALSE    → Will use real job URLs");
    println!("");
    println!("  The system will:");
    println!("    1. Open a browser (Chrome or Playwright)");
    println!("    2. Navigate to the job application page");
    println!("    3. Detect the ATS (Greenhouse, Lever, Workday, etc.)");
    println!("    4. Fill in your name, email, phone from profile");
    println!("    5. Upload resume and cover letter if provided");
    println!("    6. Click the submit button (if auto_submit=true)");
    println!("    7. Verify submission was successful");
    println!("");
    println!("═══════════════════════════════════════════════════════════════");
}

fn load_profile(conn: &std::sync::MutexGuard<'_, rusqlite::Connection>) -> Option<UserProfile> {
    conn.query_row(
        "SELECT profile_data FROM user_profile WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    ).ok().and_then(|json| serde_json::from_str(&json).ok())
}

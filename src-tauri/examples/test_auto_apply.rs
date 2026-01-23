use unhireable_lib::db::Database;
use unhireable_lib::generator::{
    EducationEntry, ExperienceEntry, PersonalInfo, SkillsProfile, UserProfile,
};
use unhireable_lib::run_auto_apply_logic;
use rusqlite::params;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() {
    println!("🚀 Testing Auto-Apply with User's Resume\n");

    // 1. Connect to the actual database
    let db_path = dirs::home_dir()
        .expect("Could not find home directory")
        .join("Library/Application Support/com.unhireable.app/jobhunter.db");

    println!("📁 Database path: {:?}", db_path);

    if !db_path.exists() {
        eprintln!("❌ Database not found at {:?}", db_path);
        return;
    }

    let db = Database::new(&db_path).expect("Failed to open database");
    let db = Arc::new(Mutex::new(Some(db)));

    // 2. Set up app directory with the user's resume
    let app_dir = db_path.parent().unwrap().to_path_buf();
    let resume_source = std::path::Path::new(
        "/Users/mac/Documents/Development/unhireable/labs/resources/maksut-beksultan-cv.pdf",
    );
    let resume_dest = app_dir.join("resume.pdf");

    if resume_source.exists() {
        std::fs::copy(resume_source, &resume_dest).expect("Failed to copy resume");
        println!("✅ Copied resume to: {:?}", resume_dest);
    } else {
        eprintln!("⚠️  Resume not found at {:?}", resume_source);
    }

    // 3. Check if user profile exists
    let has_profile = {
        let db_guard = db.lock().await;
        if let Some(db) = &*db_guard {
            let conn = db.get_connection();
            conn.query_row(
                "SELECT COUNT(*) FROM user_profile WHERE id = 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap_or(0)
                > 0
        } else {
            false
        }
    };

    if !has_profile {
        println!("⚠️  No user profile found. Creating a test profile...");

        let profile = UserProfile {
            personal_info: PersonalInfo {
                name: "Maksut Beksultan".to_string(),
                email: "maksut@example.com".to_string(),
                phone: Some("+1234567890".to_string()),
                location: Some("Remote".to_string()),
                linkedin: None,
                github: None,
                portfolio: None,
            },
            summary: "Experienced Software Engineer".to_string(),
            skills: SkillsProfile {
                technical_skills: vec![
                    "Rust".to_string(),
                    "TypeScript".to_string(),
                    "Python".to_string(),
                ],
                soft_skills: vec!["Communication".to_string(), "Leadership".to_string()],
                experience_years: HashMap::new(),
                proficiency_levels: HashMap::new(),
            },
            experience: vec![ExperienceEntry {
                company: "Tech Company".to_string(),
                position: "Senior Software Engineer".to_string(),
                duration: "3 years".to_string(),
                description: vec!["Built scalable systems".to_string()],
                technologies: vec!["Rust".to_string(), "TypeScript".to_string()],
            }],
            education: vec![EducationEntry {
                institution: "University".to_string(),
                degree: "BS Computer Science".to_string(),
                year: "2020".to_string(),
                details: None,
            }],
            projects: vec![],
        };

        let profile_json = serde_json::to_string(&profile).unwrap();
        let db_guard = db.lock().await;
        if let Some(db) = &*db_guard {
            let conn = db.get_connection();
            conn.execute(
                "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, ?2)",
                params![profile_json, chrono::Utc::now()],
            )
            .expect("Failed to insert profile");
            println!("✅ Created test profile");
        }
    } else {
        println!("✅ User profile exists");
    }

    // 4. Run auto-apply in DRY RUN mode
    println!("\n🧪 Starting Auto-Apply in DRY RUN mode...");
    println!("   Query: 'remote senior backend engineer'");
    println!("   Max Applications: 5");
    println!("   Dry Run: true\n");

    match run_auto_apply_logic(
        db.clone(),
        app_dir.clone(),
        "remote senior backend engineer".to_string(),
        5,
        true, // dry_run
    )
    .await
    {
        Ok(result) => {
            println!("\n✅ Auto-Apply Completed Successfully!\n");
            println!("📊 Results:");
            println!("   Jobs Scraped: {}", result.jobs_scraped);
            println!("   Jobs Filtered: {}", result.jobs_filtered);
            println!(
                "   Applications Submitted (simulated): {}",
                result.applications_submitted
            );
            println!("   Applications Failed: {}", result.applications_failed);

            if result.applications_submitted > 0 {
                println!(
                    "\n✅ SUCCESS: Dry run completed and simulated {} applications!",
                    result.applications_submitted
                );
            } else if result.jobs_filtered == 0 {
                println!("\n⚠️  No jobs matched the filter criteria (remote, mid-senior, $30k+)");
            } else {
                println!("\n⚠️  Jobs were filtered but no applications were simulated");
            }
        }
        Err(e) => {
            eprintln!("\n❌ Auto-Apply Failed: {}", e);
        }
    }
}

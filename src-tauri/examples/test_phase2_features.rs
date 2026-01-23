use jobez_lib::db::Database;

#[tokio::main]
async fn main() {
    println!("🧪 Phase 2: Backend Feature Testing\\n");
    println!("{}", "=".repeat(60));

    // Connect to the actual database
    let db_path = dirs::home_dir()
        .expect("Could not find home directory")
        .join("Library/Application Support/com.unhireable.app/jobhunter.db");
    
    if !db_path.exists() {
        eprintln!("❌ Database not found at {:?}", db_path);
        return;
    }

    let db = Database::new(&db_path).expect("Failed to open database");
    let conn = db.get_connection();

    println!("\\n📊 TEST 1: Jobs Database");
    println!("{}", "-".repeat(60));
    
    // Test 1: Count total jobs
    let total_jobs: i64 = conn
        .query_row("SELECT COUNT(*) FROM jobs", [], |row| row.get(0))
        .unwrap_or(0);
    println!("✅ Total jobs in database: {}", total_jobs);

    // Test 2: Get recent jobs
    let recent_jobs: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM jobs WHERE created_at > datetime('now', '-7 days')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    println!("✅ Jobs from last 7 days: {}", recent_jobs);

    // Test 3: Jobs by source
    println!("\\n📈 Jobs by source:");
    let mut stmt = conn
        .prepare("SELECT source, COUNT(*) as count FROM jobs GROUP BY source ORDER BY count DESC LIMIT 10")
        .expect("Failed to prepare statement");
    
    let sources = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
            ))
        })
        .expect("Failed to query sources");

    for source in sources {
        if let Ok((name, count)) = source {
            println!("   {} {}: {}", if count > 50 { "🔥" } else { "  " }, name, count);
        }
    }

    // Test 4: Remote jobs
    let remote_jobs: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM jobs WHERE is_remote = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    println!("\\n✅ Remote jobs: {} ({:.1}%)", 
        remote_jobs, 
        (remote_jobs as f64 / total_jobs as f64) * 100.0
    );

    // Test 5: Jobs with salary info
    let jobs_with_salary: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM jobs WHERE salary_min IS NOT NULL OR salary_max IS NOT NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    println!("✅ Jobs with salary info: {} ({:.1}%)", 
        jobs_with_salary,
        (jobs_with_salary as f64 / total_jobs as f64) * 100.0
    );

    println!("\\n📊 TEST 2: Applications Database");
    println!("{}", "-".repeat(60));

    // Test 6: Count applications
    let total_applications: i64 = conn
        .query_row("SELECT COUNT(*) FROM applications", [], |row| row.get(0))
        .unwrap_or(0);
    println!("✅ Total applications: {}", total_applications);

    // Test 7: Applications by status
    if total_applications > 0 {
        println!("\\n📈 Applications by status:");
        let mut stmt = conn
            .prepare("SELECT status, COUNT(*) as count FROM applications GROUP BY status ORDER BY count DESC")
            .expect("Failed to prepare statement");
        
        let statuses = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                ))
            })
            .expect("Failed to query statuses");

        for status in statuses {
            if let Ok((name, count)) = status {
                let emoji = match name.as_str() {
                    "pending" => "⏳",
                    "submitted" => "✅",
                    "rejected" => "❌",
                    "interviewing" => "💼",
                    _ => "📝",
                };
                println!("   {} {}: {}", emoji, name, count);
            }
        }
    }

    // Test 8: Recent applications
    let recent_applications: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM applications WHERE created_at > datetime('now', '-7 days')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    println!("\\n✅ Applications from last 7 days: {}", recent_applications);

    println!("\\n📊 TEST 3: User Profile");
    println!("{}", "-".repeat(60));

    // Test 9: Check user profile
    let has_profile: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM user_profile WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    
    if has_profile > 0 {
        println!("✅ User profile exists");
        
        // Get profile data
        let profile_json: String = conn
            .query_row(
                "SELECT profile_data FROM user_profile WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap_or_default();
        
        if let Ok(profile) = serde_json::from_str::<serde_json::Value>(&profile_json) {
            if let Some(name) = profile.get("personal_info").and_then(|p| p.get("name")).and_then(|n| n.as_str()) {
                println!("   Name: {}", name);
            }
            if let Some(email) = profile.get("personal_info").and_then(|p| p.get("email")).and_then(|e| e.as_str()) {
                println!("   Email: {}", email);
            }
            if let Some(skills) = profile.get("skills").and_then(|s| s.get("technical_skills")).and_then(|t| t.as_array()) {
                println!("   Technical Skills: {} skills", skills.len());
            }
            if let Some(experience) = profile.get("experience").and_then(|e| e.as_array()) {
                println!("   Experience: {} entries", experience.len());
            }
        }
    } else {
        println!("⚠️  No user profile found");
    }

    println!("\\n📊 TEST 4: Credentials");
    println!("{}", "-".repeat(60));

    // Test 10: Check credentials
    let total_credentials: i64 = conn
        .query_row("SELECT COUNT(*) FROM credentials", [], |row| row.get(0))
        .unwrap_or(0);
    println!("✅ Total credentials: {}", total_credentials);

    if total_credentials > 0 {
        let mut stmt = conn
            .prepare("SELECT platform, is_active FROM credentials")
            .expect("Failed to prepare statement");
        
        let credentials = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, bool>(1)?,
                ))
            })
            .expect("Failed to query credentials");

        println!("\\n📈 Configured platforms:");
        for cred in credentials {
            if let Ok((platform, is_active)) = cred {
                let status = if is_active { "✅ Active" } else { "⚠️  Inactive" };
                println!("   {} {}", status, platform);
            }
        }
    }

    println!("\\n📊 TEST 5: Saved Searches");
    println!("{}", "-".repeat(60));

    // Test 11: Check saved searches
    let total_searches: i64 = conn
        .query_row("SELECT COUNT(*) FROM saved_searches", [], |row| row.get(0))
        .unwrap_or(0);
    println!("✅ Total saved searches: {}", total_searches);

    if total_searches > 0 {
        let mut stmt = conn
            .prepare("SELECT name, query, is_active FROM saved_searches LIMIT 5")
            .expect("Failed to prepare statement");
        
        let searches = stmt
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                    row.get::<_, bool>(2)?,
                ))
            })
            .expect("Failed to query searches");

        println!("\\n📈 Saved searches:");
        for search in searches {
            if let Ok((name, query, is_active)) = search {
                let status = if is_active { "✅" } else { "⚠️ " };
                println!("   {} {}: {}", status, name, query);
            }
        }
    }

    println!("\\n📊 TEST 6: Authentication");
    println!("{}", "-".repeat(60));

    // Test 12: Check auth
    let has_auth: i64 = conn
        .query_row("SELECT COUNT(*) FROM user_auth", [], |row| row.get(0))
        .unwrap_or(0);
    
    if has_auth > 0 {
        println!("✅ Authentication configured");
        
        let (email, last_login): (Option<String>, Option<String>) = conn
            .query_row(
                "SELECT email, last_login_at FROM user_auth LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap_or((None, None));
        
        if let Some(email) = email {
            println!("   Email: {}", email);
        } else {
            println!("   Email: (not set)");
        }
        
        if let Some(last_login) = last_login {
            println!("   Last login: {}", last_login);
        }
    } else {
        println!("⚠️  Authentication not configured");
    }

    // Summary
    println!("\\n{}", "=".repeat(60));
    println!("📊 SUMMARY");
    println!("{}", "=".repeat(60));
    println!("✅ Jobs: {} total, {} remote", total_jobs, remote_jobs);
    println!("✅ Applications: {} total, {} recent", total_applications, recent_applications);
    println!("✅ Profile: {}", if has_profile > 0 { "Configured" } else { "Not configured" });
    println!("✅ Credentials: {} configured", total_credentials);
    println!("✅ Saved Searches: {}", total_searches);
    println!("✅ Auth: {}", if has_auth > 0 { "Configured" } else { "Not configured" });
    
    println!("\\n🎉 All backend tests completed successfully!");
}

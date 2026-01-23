//! Reliability Filter Test
//! Tests the smart auto-apply system with real job URLs

use jobez_lib::applicator::{
    get_reliability, is_safe_for_auto_apply, AutoApplyInfo, AtsDetector, SmartApplyConfig,
};

fn main() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║        🎯 SMART AUTO-APPLY RELIABILITY TEST 🎯               ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("");

    // Real job URLs from different ATS systems
    let test_urls = vec![
        // HIGH RELIABILITY - Should auto-apply
        ("https://boards.greenhouse.io/openai/jobs/123456", "OpenAI - Greenhouse"),
        ("https://jobs.lever.co/stripe/abc123", "Stripe - Lever"),
        ("https://jobs.ashbyhq.com/notion/xyz789", "Notion - AshbyHQ"),
        ("https://apply.workable.com/figma/j/ABC123/", "Figma - Workable"),
        
        // MEDIUM RELIABILITY - Should auto-apply with caution
        ("https://jobs.smartrecruiters.com/company/job123", "SmartRecruiters"),
        ("https://company.recruitee.com/o/software-engineer", "Recruitee"),
        ("https://app.jazz.co/apply/job123", "JazzHR"),
        
        // LOW RELIABILITY - May skip or create draft
        ("https://jobs.jobvite.com/company/job/abc", "Jobvite"),
        ("https://bullhorn.com/jobs/123", "Bullhorn"),
        
        // VERY LOW RELIABILITY - Should NOT auto-apply
        ("https://company.wd5.myworkdayjobs.com/job/123", "Workday"),
        ("https://www.linkedin.com/jobs/view/123456", "LinkedIn"),
        ("https://icims.com/jobs/software-engineer", "ICIMS"),
        ("https://company.taleo.net/careersection/job123", "Oracle Taleo"),
        
        // UNKNOWN - Generic job page
        ("https://company.com/careers/software-engineer", "Unknown/Generic"),
        ("https://remoteok.com/remote-jobs/123456", "RemoteOK (source site)"),
    ];

    println!("Testing {} job URLs...\n", test_urls.len());
    println!("{:<50} {:<20} {:<8} {:<6}", "URL (truncated)", "ATS Type", "Tier", "Safe?");
    println!("{}", "─".repeat(90));

    let mut safe_count = 0;
    let mut unsafe_count = 0;

    for (url, description) in &test_urls {
        let info = AutoApplyInfo::analyze(url);
        
        let url_short = if url.len() > 45 {
            format!("{}...", &url[..42])
        } else {
            url.to_string()
        };

        let ats_display = info.ats_type.as_deref().unwrap_or("Unknown");
        let tier_display = format!("{:?}", info.tier);
        let safe_icon = if info.safe_for_auto_apply { "✅" } else { "❌" };

        println!(
            "{:<50} {:<20} {:<8} {}",
            url_short, ats_display, tier_display, safe_icon
        );

        if info.safe_for_auto_apply {
            safe_count += 1;
        } else {
            unsafe_count += 1;
        }
    }

    println!("{}", "─".repeat(90));
    println!("\n");

    // Summary
    println!("═══════════════════════════════════════════════════════════════");
    println!("SUMMARY");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");
    println!("  ✅ Safe for auto-apply:     {} jobs", safe_count);
    println!("  ❌ Not safe (manual only):  {} jobs", unsafe_count);
    println!("");

    // Show smart config behavior
    println!("═══════════════════════════════════════════════════════════════");
    println!("SMART APPLY CONFIG DEMO");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    let config = SmartApplyConfig::default();
    println!("Default config:");
    println!("  • Minimum tier: {:?}", config.minimum_tier);
    println!("  • Max daily applications: {}", config.max_daily_applications);
    println!("  • Delay between apps: {}s", config.delay_between_applications);
    println!("  • Skip ATS types: {:?}", config.skip_ats_types);
    println!("  • Force allow: {:?}", config.force_allow_ats_types);
    println!("");

    // Test decision making
    println!("Decision examples:");
    let test_decisions = vec![
        "https://boards.greenhouse.io/company/jobs/123",
        "https://company.wd5.myworkdayjobs.com/job/456",
        "https://www.linkedin.com/jobs/view/789",
        "https://jobs.lever.co/company/abc",
    ];

    for url in test_decisions {
        let (should_apply, reason) = config.should_auto_apply(url);
        let icon = if should_apply { "✅" } else { "❌" };
        let url_short = if url.len() > 40 { &url[..40] } else { url };
        println!("  {} {} → {}", icon, url_short, reason);
    }

    println!("");
    println!("═══════════════════════════════════════════════════════════════");
    println!("RELIABILITY TIERS EXPLAINED");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");
    println!("  HIGH (85%):     API integration or very consistent forms");
    println!("                  → Greenhouse, Lever, AshbyHQ, Workable");
    println!("");
    println!("  MEDIUM (60%):   Reasonably consistent, good success rate");
    println!("                  → SmartRecruiters, Recruitee, JazzHR, etc.");
    println!("");
    println!("  LOW (35%):      Complex forms, may need manual review");
    println!("                  → Jobvite, Bullhorn, ADP");
    println!("");
    println!("  VERY LOW (15%): Heavy anti-automation, multi-page, auth required");
    println!("                  → Workday, LinkedIn, ICIMS, Taleo");
    println!("");
    println!("  UNKNOWN (40%):  Generic job page, results vary");
    println!("");
}

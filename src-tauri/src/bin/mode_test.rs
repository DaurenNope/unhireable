//! Mode Test - Demonstrates all 3 application modes
//! Manual, Semi-Auto, and Full Autopilot

use jobez_lib::applicator::{
    ApplyMode, ApplicationConfig, JobApplicator, PreApplyCheck, ReliabilityTier,
};
use jobez_lib::db::models::{Job, JobStatus};

fn main() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║          🎛️  APPLICATION MODE TEST 🎛️                        ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("");

    // Demonstrate the 3 modes
    println!("═══════════════════════════════════════════════════════════════");
    println!("THE THREE APPLICATION MODES");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    let modes = [ApplyMode::Manual, ApplyMode::SemiAuto, ApplyMode::Autopilot];

    for mode in &modes {
        println!("{} {} MODE", mode.icon(), mode.name().to_uppercase());
        println!("   {}", mode.description());
        println!("   • Headless browser: {}", if mode.is_headless() { "Yes" } else { "No (visible)" });
        println!("   • Auto-submit: {}", if mode.auto_submit() { "Yes" } else { "No" });
        println!("   • Requires confirmation: {}", if mode.requires_confirmation() { "Yes" } else { "No" });
        println!("   • Minimum reliability: {:?}", mode.minimum_reliability());
        println!("");
    }

    // Test different job URLs with each mode
    println!("═══════════════════════════════════════════════════════════════");
    println!("MODE COMPATIBILITY CHECK");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    let test_urls = vec![
        ("https://boards.greenhouse.io/company/jobs/123", "Greenhouse"),
        ("https://jobs.lever.co/company/abc", "Lever"),
        ("https://company.wd5.myworkdayjobs.com/job/456", "Workday"),
        ("https://www.linkedin.com/jobs/view/789", "LinkedIn"),
        ("https://company.com/careers/job", "Unknown"),
    ];

    println!("{:<20} {:<12} {:<12} {:<12}", "ATS", "Manual", "Semi-Auto", "Autopilot");
    println!("{}", "─".repeat(60));

    for (url, name) in &test_urls {
        let manual = PreApplyCheck::check(url, ApplyMode::Manual);
        let semi = PreApplyCheck::check(url, ApplyMode::SemiAuto);
        let auto = PreApplyCheck::check(url, ApplyMode::Autopilot);

        println!(
            "{:<20} {:<12} {:<12} {:<12}",
            name,
            if manual.can_proceed { "✅" } else { "❌" },
            if semi.can_proceed { "✅" } else { "❌" },
            if auto.can_proceed { "✅" } else { "❌" },
        );
    }

    println!("");
    println!("═══════════════════════════════════════════════════════════════");
    println!("CONFIGURATION EXAMPLES");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    // Manual mode config
    println!("📋 MANUAL MODE CONFIG:");
    let manual_config = ApplicationConfig::from_mode(ApplyMode::Manual);
    println!("   mode: {:?}", manual_config.mode);
    println!("   auto_submit: {}", manual_config.auto_submit);
    println!("   wait_for_confirmation: {}", manual_config.wait_for_confirmation);
    println!("");

    // Semi-auto mode config
    println!("⚡ SEMI-AUTO MODE CONFIG:");
    let semi_config = ApplicationConfig::from_mode(ApplyMode::SemiAuto);
    println!("   mode: {:?}", semi_config.mode);
    println!("   auto_submit: {}", semi_config.auto_submit);
    println!("   wait_for_confirmation: {}", semi_config.wait_for_confirmation);
    println!("");

    // Autopilot mode config
    println!("🚀 AUTOPILOT MODE CONFIG:");
    let auto_config = ApplicationConfig::from_mode(ApplyMode::Autopilot);
    println!("   mode: {:?}", auto_config.mode);
    println!("   auto_submit: {}", auto_config.auto_submit);
    println!("   wait_for_confirmation: {}", auto_config.wait_for_confirmation);
    println!("");

    println!("═══════════════════════════════════════════════════════════════");
    println!("HOW EACH MODE WORKS");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    println!("👁️  MANUAL MODE:");
    println!("   1. Browser opens VISIBLE (not headless)");
    println!("   2. Form is filled automatically");
    println!("   3. You review the filled form");
    println!("   4. YOU click the Submit button");
    println!("   Best for: Important jobs, testing, unfamiliar ATS");
    println!("");

    println!("⚡ SEMI-AUTO MODE:");
    println!("   1. Browser runs headless (invisible)");
    println!("   2. Form is filled automatically");
    println!("   3. Desktop notification sent for approval");
    println!("   4. You click Approve/Reject in notification");
    println!("   5. If approved, submit button is clicked");
    println!("   Best for: Daily use with oversight");
    println!("");

    println!("🚀 AUTOPILOT MODE:");
    println!("   1. Browser runs headless (invisible)");
    println!("   2. Form is filled automatically");
    println!("   3. Submit button clicked automatically");
    println!("   4. Only works on HIGH reliability ATS");
    println!("   Best for: Bulk applications to Greenhouse/Lever jobs");
    println!("");

    println!("═══════════════════════════════════════════════════════════════");
    println!("RELIABILITY REQUIREMENTS");
    println!("═══════════════════════════════════════════════════════════════");
    println!("");

    println!("{:<12} {:<15} {:<40}", "Mode", "Min Tier", "Allowed ATS");
    println!("{}", "─".repeat(70));
    println!("{:<12} {:<15} {:<40}", "Manual", "VeryLow", "All (including Workday, LinkedIn)");
    println!("{:<12} {:<15} {:<40}", "Semi-Auto", "Low", "Most ATS (excluding worst offenders)");
    println!("{:<12} {:<15} {:<40}", "Autopilot", "Medium", "Reliable only (Greenhouse, Lever, etc.)");
    println!("");
}

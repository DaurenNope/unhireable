use std::collections::HashMap;
use unhireable_lib::applicator::ats_detector::{AtsDetector, AtsType};
use unhireable_lib::applicator::form_filler::FormFiller;
use unhireable_lib::generator::{PersonalInfo, SkillsProfile, UserProfile};

#[tokio::main]
async fn main() {
    println!("🧪 REAL FORM FILLER TEST - HEADED BROWSER\n");
    println!("This will open a VISIBLE browser and fill a real job application form.\n");

    // Test profile
    let profile = UserProfile {
        personal_info: PersonalInfo {
            name: "John Doe".to_string(),
            email: "john.doe@example.com".to_string(),
            phone: Some("+1 555 123 4567".to_string()),
            location: Some("San Francisco, CA".to_string()),
            linkedin: Some("https://linkedin.com/in/johndoe".to_string()),
            github: Some("https://github.com/johndoe".to_string()),
            portfolio: Some("https://johndoe.dev".to_string()),
        },
        summary: "Experienced Software Engineer".to_string(),
        skills: SkillsProfile {
            technical_skills: vec![
                "Rust".to_string(),
                "TypeScript".to_string(),
                "Python".to_string(),
            ],
            soft_skills: vec!["Communication".to_string()],
            experience_years: HashMap::new(),
            proficiency_levels: HashMap::new(),
        },
        experience: vec![],
        education: vec![],
        projects: vec![],
        preferences: None,
    };

    // Test URLs - pick one with a real application form
    let test_urls = vec![
        // Greenhouse test form
        (
            "https://boards.greenhouse.io/discord/jobs/7790209002",
            AtsType::Greenhouse,
        ),
        // Lever test form
        // ("https://jobs.lever.co/stripe", AtsType::Lever),
    ];

    for (url, expected_ats) in test_urls {
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        println!("🌐 Testing URL: {}", url);
        println!("🔍 Expected ATS: {:?}", expected_ats);

        // Detect ATS
        let detected = AtsDetector::detect_ats(url);
        println!("🎯 Detected ATS: {:?}", detected);

        // Create form filler with:
        // - auto_submit = true (makes browser visible)
        // - screenshots = true
        // - wait_for_confirmation = true
        let filler = FormFiller::new()
            .with_auto_submit(false) // Don't actually submit, just fill
            .with_screenshots(true)
            .with_timeout(120);

        println!("\n🚀 Launching VISIBLE browser to fill form...");
        println!("👀 WATCH YOUR SCREEN - browser window will appear!\n");

        // Actually run the form filler
        match filler.fill_application(
            url, &profile, None, // no resume for this test
            None, // no cover letter
            detected,
        ) {
            Ok(()) => {
                println!("\n✅ Form fill completed successfully!");
                println!("📸 Screenshots saved to ./screenshots/");
            }
            Err(e) => {
                println!("\n❌ Form fill failed: {}", e);
            }
        }

        println!("\n");
    }

    println!("🎉 Test complete! Check the screenshots folder for proof.");
}

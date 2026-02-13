// End-to-end test for job matching workflow
use chrono::Utc;
use std::collections::HashMap;
use unhireable_lib::db::models::{Job, JobStatus};
use unhireable_lib::generator::{ExperienceEntry, PersonalInfo, SkillsProfile, UserProfile};
use unhireable_lib::matching::JobMatcher;

#[test]
fn test_end_to_end_job_matching_workflow() {
    println!("\n🧪 Testing End-to-End Job Matching Workflow\n");

    // Step 1: Create a user profile
    println!("📝 Step 1: Creating user profile...");
    let profile = UserProfile {
        personal_info: PersonalInfo {
            name: "Jane Developer".to_string(),
            email: "jane@example.com".to_string(),
            phone: None,
            location: Some("San Francisco, CA".to_string()),
            linkedin: None,
            github: None,
            portfolio: None,
        },
        summary:
            "Full-stack developer with 6 years of experience in React, TypeScript, and Node.js"
                .to_string(),
        skills: SkillsProfile {
            technical_skills: vec![
                "React".to_string(),
                "TypeScript".to_string(),
                "Node.js".to_string(),
                "JavaScript".to_string(),
                "Docker".to_string(),
                "AWS".to_string(),
            ],
            soft_skills: vec!["Leadership".to_string(), "Communication".to_string()],
            experience_years: {
                let mut map = HashMap::new();
                map.insert("React".to_string(), 6);
                map.insert("TypeScript".to_string(), 5);
                map.insert("Node.js".to_string(), 4);
                map
            },
            proficiency_levels: HashMap::new(),
        },
        experience: vec![ExperienceEntry {
            company: "Tech Corp".to_string(),
            position: "Senior Frontend Developer".to_string(),
            duration: "4 years".to_string(),
            description: vec![
                "Led React development team".to_string(),
                "Built microservices with Node.js".to_string(),
            ],
            technologies: vec![
                "React".to_string(),
                "TypeScript".to_string(),
                "Node.js".to_string(),
                "Docker".to_string(),
            ],
        }],
        education: vec![],
        projects: vec!["React project with AWS deployment".to_string()],
    };
    println!("✅ User profile created");

    // Step 2: Create multiple job postings
    println!("\n📋 Step 2: Creating job postings...");
    let jobs = vec![
        Job {
            id: Some(1),
            title: "Senior React Developer".to_string(),
            company: "Awesome Tech".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some(
                "We are looking for a senior React developer with TypeScript experience. \
                 Must know Node.js, Docker, and REST APIs. Remote work available. \
                 5+ years of experience required."
                    .to_string(),
            ),
            requirements: Some(
                "Experience with React, TypeScript, Node.js required. \
                 Docker experience preferred. AWS knowledge is a plus."
                    .to_string(),
            ),
            location: Some("Remote".to_string()),
            salary: None,
            source: "hh.kz".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
            ..Default::default()
        },
        Job {
            id: Some(2),
            title: "Junior Python Developer".to_string(),
            company: "Startup Inc".to_string(),
            url: "https://example.com/job/2".to_string(),
            description: Some("Entry-level Python developer position".to_string()),
            requirements: Some("Python, Django experience".to_string()),
            location: Some("New York, NY".to_string()),
            salary: None,
            source: "linkedin".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
            ..Default::default()
        },
        Job {
            id: Some(3),
            title: "Frontend Developer".to_string(),
            company: "Web Agency".to_string(),
            url: "https://example.com/job/3".to_string(),
            description: Some(
                "Mid-level frontend developer needed. React experience required. \
                 TypeScript preferred."
                    .to_string(),
            ),
            requirements: Some("React, JavaScript, TypeScript".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            source: "wellfound".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
            ..Default::default()
        },
    ];
    println!("✅ Created {} job postings", jobs.len());

    // Step 3: Match jobs to profile
    println!("\n🔍 Step 3: Matching jobs to profile...");
    let matcher = JobMatcher::new();
    let results = matcher.match_jobs(&jobs, &profile);
    println!("✅ Matched {} jobs", results.len());

    // Step 4: Display results
    println!("\n📊 Step 4: Match Results:\n");
    for (i, result) in results.iter().enumerate() {
        let quality = result.get_match_quality();
        println!(
            "Job {}: {} at {}",
            i + 1,
            result.job.title,
            result.job.company
        );
        println!("  Match Score: {:.1}% ({:?})", result.match_score, quality);
        println!("  Skills Match: {:.1}%", result.skills_match);
        println!("  Experience Match: {:.1}%", result.experience_match);
        println!("  Location Match: {:.1}%", result.location_match);
        println!("  Matched Skills: {:?}", result.matched_skills);
        if !result.missing_skills.is_empty() {
            println!("  Missing Skills: {:?}", result.missing_skills);
        }
        println!("  Experience Level: {}", result.experience_level);
        println!();
    }

    // Step 5: Filter by minimum score
    println!("🎯 Step 5: Filtering jobs with match score >= 60%...");
    let filtered = matcher.filter_by_score(&results, 60.0);
    println!("✅ Found {} jobs with score >= 60%", filtered.len());

    // Step 6: Assertions
    println!("\n✅ Step 6: Validating results...");
    assert_eq!(results.len(), 3, "Should have 3 match results");
    assert!(
        results[0].match_score >= results[1].match_score,
        "Results should be sorted by score"
    );
    assert!(
        results[0].match_score >= results[2].match_score,
        "Results should be sorted by score"
    );

    // Senior React job should score highest
    assert!(
        results[0].match_score > 60.0,
        "Senior React job should score > 60%"
    );
    assert!(
        results[0].matched_skills.len() >= 3,
        "Should match at least 3 skills"
    );

    // Python job should score lower
    let python_job_index = results
        .iter()
        .position(|r| r.job.title.contains("Python"))
        .unwrap();
    assert!(
        results[python_job_index].match_score < 50.0,
        "Python job should score < 50%"
    );

    // Filtered results should only include high-scoring jobs
    assert!(
        filtered.len() <= results.len(),
        "Filtered results should be subset"
    );
    assert!(
        filtered.iter().all(|r| r.match_score >= 60.0),
        "All filtered results should meet minimum score"
    );

    println!("✅ All validations passed!");
    println!("\n🎉 End-to-end test completed successfully!\n");
}

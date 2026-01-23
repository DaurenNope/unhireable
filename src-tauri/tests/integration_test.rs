// Integration tests for job matching
use chrono::Utc;
use jobez_lib::db::models::{Job, JobStatus};
use jobez_lib::generator::{ExperienceEntry, PersonalInfo, SkillsProfile, UserProfile};
use jobez_lib::matching::JobMatcher;
use std::collections::HashMap;

fn create_test_job() -> Job {
    Job {
        id: Some(1),
        title: "Senior React Developer".to_string(),
        company: "Tech Corp".to_string(),
        url: "https://example.com/job/1".to_string(),
        description: Some(
            "We are looking for a senior React developer with TypeScript experience. \
             Must know Node.js, Docker, and REST APIs. Remote work available. \
             5+ years of experience required."
                .to_string(),
        ),
        requirements: Some(
            "Experience with React, TypeScript, Node.js required. \
             Docker experience preferred. Strong problem-solving skills."
                .to_string(),
        ),
        location: Some("Remote".to_string()),
        salary: None,
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: None,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    }
}

fn create_test_profile() -> UserProfile {
    UserProfile {
        personal_info: PersonalInfo {
            name: "John Doe".to_string(),
            email: "john@example.com".to_string(),
            phone: None,
            location: Some("San Francisco, CA".to_string()),
            linkedin: None,
            github: None,
            portfolio: None,
        },
        summary: "Experienced React developer with 5 years of experience".to_string(),
        skills: SkillsProfile {
            technical_skills: vec![
                "React".to_string(),
                "TypeScript".to_string(),
                "Node.js".to_string(),
                "JavaScript".to_string(),
            ],
            soft_skills: vec!["Communication".to_string(), "Problem-solving".to_string()],
            experience_years: {
                let mut map = HashMap::new();
                map.insert("React".to_string(), 5);
                map.insert("TypeScript".to_string(), 4);
                map.insert("Node.js".to_string(), 3);
                map
            },
            proficiency_levels: HashMap::new(),
        },
        experience: vec![ExperienceEntry {
            company: "Previous Corp".to_string(),
            position: "Senior Frontend Developer".to_string(),
            duration: "3 years".to_string(),
            description: vec![
                "Built React applications".to_string(),
                "Worked with TypeScript and Node.js".to_string(),
            ],
            technologies: vec![
                "React".to_string(),
                "TypeScript".to_string(),
                "Node.js".to_string(),
            ],
        }],
        education: vec![],
        projects: vec!["React project with AWS".to_string()],
    }
}

#[test]
fn test_job_match_integration() {
    let matcher = JobMatcher::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let result = matcher.calculate_match(&job, &profile);

    // Assertions
    assert!(
        result.match_score > 0.0,
        "Match score should be greater than 0"
    );
    assert!(
        result.match_score <= 100.0,
        "Match score should be less than or equal to 100"
    );
    assert!(
        result.skills_match > 0.0,
        "Skills match should be greater than 0"
    );
    assert!(
        !result.matched_skills.is_empty(),
        "Should have matched skills"
    );
    assert_eq!(result.job_id, Some(1), "Job ID should match");
    assert_eq!(
        result.experience_level, "senior",
        "Experience level should be senior"
    );

    // Check that React, TypeScript, and Node.js are matched
    assert!(result
        .matched_skills
        .iter()
        .any(|s| s.to_lowercase().contains("react")));
    assert!(result
        .matched_skills
        .iter()
        .any(|s| s.to_lowercase().contains("typescript")));
    assert!(result
        .matched_skills
        .iter()
        .any(|s| s.to_lowercase().contains("node")));

    // Check match quality
    let quality = result.get_match_quality();
    assert!(
        matches!(quality, jobez_lib::matching::MatchQuality::Good)
            || matches!(quality, jobez_lib::matching::MatchQuality::Excellent),
        "Match quality should be Good or Excellent for this profile"
    );

    println!("✅ Integration test passed!");
    println!("   Match Score: {}%", result.match_score);
    println!("   Skills Match: {}%", result.skills_match);
    println!("   Matched Skills: {:?}", result.matched_skills);
    println!("   Match Quality: {:?}", quality);
}

#[test]
fn test_multiple_jobs_matching() {
    let matcher = JobMatcher::new();
    let profile = create_test_profile();

    let jobs = vec![
        create_test_job(),
        Job {
            id: Some(2),
            title: "Junior Python Developer".to_string(),
            company: "Startup Inc".to_string(),
            url: "https://example.com/job/2".to_string(),
            description: Some("Entry-level Python developer position".to_string()),
            requirements: Some("Python, Django experience".to_string()),
            location: Some("New York, NY".to_string()),
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        },
    ];

    let results = matcher.match_jobs(&jobs, &profile);

    assert_eq!(results.len(), 2, "Should have 2 match results");
    assert!(
        results[0].match_score >= results[1].match_score,
        "Results should be sorted by score"
    );
    assert!(
        results[0].match_score > results[1].match_score,
        "React job should score higher than Python job"
    );

    println!("✅ Multiple jobs test passed!");
    println!("   Job 1 (React): {}%", results[0].match_score);
    println!("   Job 2 (Python): {}%", results[1].match_score);
}

#[test]
fn test_filter_by_score() {
    let matcher = JobMatcher::new();
    let profile = create_test_profile();

    let jobs = vec![
        create_test_job(), // Should match well
        Job {
            id: Some(3),
            title: "PHP Developer".to_string(),
            company: "Old Corp".to_string(),
            url: "https://example.com/job/3".to_string(),
            description: Some("PHP developer needed".to_string()),
            requirements: Some("PHP, MySQL".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        },
    ];

    let results = matcher.match_jobs(&jobs, &profile);
    let filtered = matcher.filter_by_score(&results, 50.0);

    assert!(
        filtered.len() <= results.len(),
        "Filtered results should be subset"
    );
    assert!(
        filtered.iter().all(|r| r.match_score >= 50.0),
        "All filtered results should meet minimum score"
    );

    println!("✅ Filter by score test passed!");
    println!("   Total results: {}", results.len());
    println!("   Filtered results (>=50%): {}", filtered.len());
}

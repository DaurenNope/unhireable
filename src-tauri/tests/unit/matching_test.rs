// Unit tests for job matching modules

use unhireable_lib::matching::{JobMatcher, MatchWeights};
use unhireable_lib::db::models::{Job, JobStatus};
use unhireable_lib::generator::UserProfile;
use chrono::Utc;
use std::collections::HashMap;
use unhireable_lib::generator::{PersonalInfo, SkillsProfile, ExperienceEntry};

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

#[test]
fn test_job_matcher_creation() {
    let matcher = JobMatcher::new();
    // Just test that it can be created
    assert!(true);
}

#[test]
fn test_job_matcher_with_custom_weights() {
    let weights = MatchWeights {
        skills_weight: 0.6,
        experience_weight: 0.2,
        location_weight: 0.15,
        title_weight: 0.05,
    };
    let matcher = JobMatcher::with_weights(weights);
    // Just test that it can be created with custom weights
    assert!(true);
}

#[test]
fn test_match_score_range() {
    let matcher = JobMatcher::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let result = matcher.calculate_match(&job, &profile);

    assert!(
        result.match_score >= 0.0 && result.match_score <= 100.0,
        "Match score should be between 0 and 100, got {}",
        result.match_score
    );
}

#[test]
fn test_skills_match_calculation() {
    let matcher = JobMatcher::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let result = matcher.calculate_match(&job, &profile);

    assert!(
        result.skills_match >= 0.0 && result.skills_match <= 100.0,
        "Skills match should be between 0 and 100"
    );
    assert!(
        !result.matched_skills.is_empty(),
        "Should have matched skills for a well-matching profile"
    );
}

#[test]
fn test_experience_level_detection() {
    let matcher = JobMatcher::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let result = matcher.calculate_match(&job, &profile);

    assert!(
        !result.experience_level.is_empty(),
        "Experience level should be detected"
    );
    assert_eq!(
        result.experience_level, "senior",
        "Should detect senior level from job description"
    );
}

#[test]
fn test_location_match_calculation() {
    let matcher = JobMatcher::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let result = matcher.calculate_match(&job, &profile);

    assert!(
        result.location_match >= 0.0 && result.location_match <= 100.0,
        "Location match should be between 0 and 100"
    );
}

#[test]
fn test_match_reasons_generation() {
    let matcher = JobMatcher::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let result = matcher.calculate_match(&job, &profile);

    assert!(
        !result.match_reasons.is_empty(),
        "Should generate match reasons"
    );
}

#[test]
fn test_batch_matching_sorting() {
    let matcher = JobMatcher::new();
    let profile = create_test_profile();

    let jobs = vec![
        Job {
            id: Some(1),
            title: "Python Developer".to_string(),
            company: "Python Corp".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("Python developer needed".to_string()),
            requirements: Some("Python, Django".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        },
        create_test_job(), // React job should score higher
    ];

    let results = matcher.match_jobs(&jobs, &profile);

    assert_eq!(results.len(), 2, "Should match all jobs");
    assert!(
        results[0].match_score >= results[1].match_score,
        "Results should be sorted by score (descending)"
    );
    assert!(
        results[0].match_score > results[1].match_score,
        "React job should score higher than Python job for this profile"
    );
}

#[test]
fn test_filter_by_score() {
    let matcher = JobMatcher::new();
    let profile = create_test_profile();

    let jobs = vec![
        create_test_job(),
        Job {
            id: Some(2),
            title: "PHP Developer".to_string(),
            company: "Old Corp".to_string(),
            url: "https://example.com/job/2".to_string(),
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
        "Filtered results should be a subset"
    );
    
    if !filtered.is_empty() {
        assert!(
            filtered.iter().all(|r| r.match_score >= 50.0),
            "All filtered results should meet minimum score"
        );
    }
}









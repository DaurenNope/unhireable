// E2E tests for job matching workflow

use unhireable_lib::matching::JobMatcher;
use unhireable_lib::db::models::{Job, JobStatus};
use chrono::Utc;
use std::collections::HashMap;
use unhireable_lib::generator::{UserProfile, PersonalInfo, SkillsProfile, ExperienceEntry};

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

fn create_test_jobs() -> Vec<Job> {
    vec![
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
        },
        Job {
            id: Some(2),
            title: "Python Developer".to_string(),
            company: "Python Corp".to_string(),
            url: "https://example.com/job/2".to_string(),
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
        Job {
            id: Some(3),
            title: "Frontend Developer (React)".to_string(),
            company: "StartupXYZ".to_string(),
            url: "https://example.com/job/3".to_string(),
            description: Some(
                "Looking for a frontend developer with React experience. \
                 TypeScript is a plus."
                    .to_string(),
            ),
            requirements: Some("React, JavaScript, HTML, CSS".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        },
    ]
}

#[test]
fn test_complete_matching_workflow() {
    let matcher = JobMatcher::new();
    let profile = create_test_profile();
    let jobs = create_test_jobs();

    // Step 1: Match all jobs
    let results = matcher.match_jobs(&jobs, &profile);

    assert_eq!(results.len(), 3, "Should match all 3 jobs");
    
    // Step 2: Verify results are sorted by score (descending)
    for i in 1..results.len() {
        assert!(
            results[i-1].match_score >= results[i].match_score,
            "Results should be sorted by score (descending)"
        );
    }
    
    // Step 3: Verify React jobs score higher than Python job
    let react_jobs: Vec<_> = results.iter()
        .filter(|r| r.job.title.contains("React") || r.job.title.contains("react"))
        .collect();
    let python_job = results.iter()
        .find(|r| r.job.title.contains("Python"))
        .expect("Should find Python job");
    
    assert!(
        react_jobs.iter().any(|r| r.match_score > python_job.match_score),
        "React jobs should score higher than Python job for this profile"
    );
    
    // Step 4: Filter by minimum score
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
    
    // Step 5: Verify match quality assessment
    for result in &results {
        let quality = result.get_match_quality();
        match quality {
            unhireable_lib::matching::MatchQuality::Excellent => {
                assert!(result.match_score >= 80.0, "Excellent should be >= 80%");
            }
            unhireable_lib::matching::MatchQuality::Good => {
                assert!(result.match_score >= 60.0 && result.match_score < 80.0, 
                       "Good should be 60-79%");
            }
            unhireable_lib::matching::MatchQuality::Fair => {
                assert!(result.match_score >= 40.0 && result.match_score < 60.0, 
                       "Fair should be 40-59%");
            }
            unhireable_lib::matching::MatchQuality::Poor => {
                assert!(result.match_score < 40.0, "Poor should be < 40%");
            }
        }
    }
}

#[test]
fn test_matching_with_job_specific_requirements() {
    let matcher = JobMatcher::new();
    let profile = create_test_profile();

    // Test with job that has very specific requirements
    let specific_job = Job {
        id: Some(4),
        title: "React + TypeScript Expert".to_string(),
        company: "Expert Corp".to_string(),
        url: "https://example.com/job/4".to_string(),
        description: Some(
            "We need an expert in React and TypeScript. \
             Must have 5+ years of React experience. \
             Node.js experience is essential."
                .to_string(),
        ),
        requirements: Some(
            "Required: React (5+ years), TypeScript (4+ years), Node.js. \
             Preferred: Docker, AWS, REST APIs."
                .to_string(),
        ),
        location: Some("Remote".to_string()),
        salary: None,
        source: "test".to_string(),
        status: JobStatus::Saved,
        match_score: None,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    };

    let result = matcher.calculate_match(&specific_job, &profile);

    // This job should score very high for this profile
    assert!(
        result.match_score >= 70.0,
        "Job with matching requirements should score high (>= 70%), got {}",
        result.match_score
    );
    
    // Verify skills matching
    assert!(
        result.skills_match >= 70.0,
        "Skills match should be high for well-matching job"
    );
    
    // Verify matched skills include React and TypeScript
    let matched_lower: Vec<String> = result.matched_skills.iter()
        .map(|s| s.to_lowercase())
        .collect();
    assert!(
        matched_lower.iter().any(|s| s.contains("react")),
        "Should match React skill"
    );
    assert!(
        matched_lower.iter().any(|s| s.contains("typescript") || s.contains("type")),
        "Should match TypeScript skill"
    );
}









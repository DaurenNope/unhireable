// E2E tests for document generation workflow

use jobez_lib::generator::{ResumeGenerator, CoverLetterGenerator};
use jobez_lib::db::models::{Job, JobStatus};
use chrono::Utc;

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

fn create_test_profile() -> jobez_lib::generator::UserProfile {
    use jobez_lib::generator::{PersonalInfo, SkillsProfile, ExperienceEntry};
    use std::collections::HashMap;
    
    jobez_lib::generator::UserProfile {
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

#[tokio::test]
async fn test_complete_resume_generation_workflow() {
    let generator = ResumeGenerator::new();
    let job = create_test_job();
    let profile = create_test_profile();

    // Generate resume
    let result = generator
        .generate_resume(&profile, &job, Some("resume_modern"), false)
        .await;

    assert!(result.is_ok(), "Resume generation should succeed");
    let document = result.unwrap();
    
    // Verify document structure
    assert!(!document.content.is_empty(), "Resume content should not be empty");
    assert_eq!(document.metadata.job_title, job.title);
    assert_eq!(document.metadata.company, job.company);
    assert!(document.metadata.word_count > 0, "Resume should have word count");
    assert_eq!(document.metadata.template_used, "resume_modern");
    
    // Verify content contains expected elements
    let content = document.content.to_lowercase();
    assert!(content.contains(&profile.personal_info.name.to_lowercase()), 
            "Resume should contain name");
    assert!(content.contains("react") || content.contains("typescript"), 
            "Resume should contain relevant skills");
}

#[tokio::test]
async fn test_complete_cover_letter_generation_workflow() {
    let generator = CoverLetterGenerator::new();
    let job = create_test_job();
    let profile = create_test_profile();

    // Generate cover letter
    let result = generator
        .generate_cover_letter(&profile, &job, Some("cover_letter_professional"), false)
        .await;

    assert!(result.is_ok(), "Cover letter generation should succeed");
    let document = result.unwrap();
    
    // Verify document structure
    assert!(!document.content.is_empty(), "Cover letter content should not be empty");
    assert_eq!(document.metadata.job_title, job.title);
    assert_eq!(document.metadata.company, job.company);
    assert!(document.metadata.word_count > 0, "Cover letter should have word count");
    assert_eq!(document.metadata.template_used, "cover_letter_professional");
    
    // Verify content contains expected elements
    let content = document.content.to_lowercase();
    assert!(content.contains(&profile.personal_info.name.to_lowercase()), 
            "Cover letter should contain name");
    assert!(content.contains(&job.company.to_lowercase()), 
            "Cover letter should mention company");
}

#[tokio::test]
async fn test_document_generation_for_multiple_jobs() {
    let resume_generator = ResumeGenerator::new();
    let cover_letter_generator = CoverLetterGenerator::new();
    let profile = create_test_profile();

    let jobs = vec![
        create_test_job(),
        Job {
            id: Some(2),
            title: "Full Stack Developer".to_string(),
            company: "StartupXYZ".to_string(),
            url: "https://example.com/job/2".to_string(),
            description: Some("Full stack developer position".to_string()),
            requirements: Some("React, Node.js, PostgreSQL".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        },
    ];

    // Generate documents for each job
    for job in &jobs {
        // Generate resume
        let resume_result = resume_generator
            .generate_resume(&profile, job, Some("resume_modern"), false)
            .await;
        assert!(resume_result.is_ok(), "Resume generation should succeed for {}", job.title);
        
        // Generate cover letter
        let cover_letter_result = cover_letter_generator
            .generate_cover_letter(&profile, job, Some("cover_letter_professional"), false)
            .await;
        assert!(cover_letter_result.is_ok(), "Cover letter generation should succeed for {}", job.title);
        
        // Verify documents are job-specific
        let resume = resume_result.unwrap();
        let cover_letter = cover_letter_result.unwrap();
        
        assert_eq!(resume.metadata.job_title, job.title);
        assert_eq!(resume.metadata.company, job.company);
        assert_eq!(cover_letter.metadata.job_title, job.title);
        assert_eq!(cover_letter.metadata.company, job.company);
    }
}









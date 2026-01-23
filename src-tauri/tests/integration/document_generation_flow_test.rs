// Integration tests for document generation flow

use unhireable_lib::db::models::Job;
use unhireable_lib::generator::{ResumeGenerator, CoverLetterGenerator, UserProfile};
use unhireable_lib::db::models::JobStatus;
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

fn create_test_profile() -> UserProfile {
    use unhireable_lib::generator::{PersonalInfo, SkillsProfile, ExperienceEntry};
    use std::collections::HashMap;
    
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

#[tokio::test]
async fn test_resume_generation_flow() {
    let generator = ResumeGenerator::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let result = generator
        .generate_resume(&profile, &job, Some("resume_modern"), false)
        .await;

    assert!(result.is_ok(), "Resume generation should succeed");
    let document = result.unwrap();
    
    assert!(!document.content.is_empty(), "Resume content should not be empty");
    assert_eq!(document.format, unhireable_lib::generator::DocumentFormat::Markdown);
    assert!(!document.metadata.title.is_empty(), "Resume should have a title");
    assert!(document.metadata.word_count > 0, "Resume should have word count");
}

#[tokio::test]
async fn test_cover_letter_generation_flow() {
    let generator = CoverLetterGenerator::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let result = generator
        .generate_cover_letter(&profile, &job, Some("cover_letter_professional"), false)
        .await;

    assert!(result.is_ok(), "Cover letter generation should succeed");
    let document = result.unwrap();
    
    assert!(!document.content.is_empty(), "Cover letter content should not be empty");
    assert_eq!(document.format, unhireable_lib::generator::DocumentFormat::Markdown);
    assert!(!document.metadata.title.is_empty(), "Cover letter should have a title");
    assert!(document.metadata.word_count > 0, "Cover letter should have word count");
}

#[tokio::test]
async fn test_document_generation_with_multiple_templates() {
    let resume_generator = ResumeGenerator::new();
    let cover_letter_generator = CoverLetterGenerator::new();
    let job = create_test_job();
    let profile = create_test_profile();

    let resume_templates = vec!["resume_modern", "resume_classic", "resume_technical"];
    let cover_letter_templates = vec!["cover_letter_professional", "cover_letter_formal"];

    // Test all resume templates
    for template in resume_templates {
        let result = resume_generator
            .generate_resume(&profile, &job, Some(template), false)
            .await;
        assert!(result.is_ok(), "Resume generation with template {} should succeed", template);
    }

    // Test all cover letter templates
    for template in cover_letter_templates {
        let result = cover_letter_generator
            .generate_cover_letter(&profile, &job, Some(template), false)
            .await;
        assert!(result.is_ok(), "Cover letter generation with template {} should succeed", template);
    }
}









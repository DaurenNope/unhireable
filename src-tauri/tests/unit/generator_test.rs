// Unit tests for document generation modules

use jobez_lib::generator::{ResumeGenerator, CoverLetterGenerator, TemplateManager};
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

#[test]
fn test_resume_generator_creation() {
    let generator = ResumeGenerator::new();
    // Just test that it can be created
    assert!(true);
}

#[test]
fn test_resume_generator_template_listing() {
    let generator = ResumeGenerator::new();
    let templates = generator.list_available_templates();
    
    assert!(!templates.is_empty(), "Should have at least one template");
    assert!(templates.contains(&"resume_modern".to_string()), "Should include resume_modern template");
}

#[test]
fn test_cover_letter_generator_creation() {
    let generator = CoverLetterGenerator::new();
    // Just test that it can be created
    assert!(true);
}

#[test]
fn test_cover_letter_generator_template_listing() {
    let generator = CoverLetterGenerator::new();
    let templates = generator.list_available_templates();
    
    assert!(!templates.is_empty(), "Should have at least one template");
    assert!(templates.contains(&"cover_letter_professional".to_string()), "Should include cover_letter_professional template");
}

#[test]
fn test_template_manager_creation() {
    let manager = TemplateManager::default();
    // Just test that it can be created
    assert!(true);
}

#[tokio::test]
async fn test_resume_generation_basic_analysis() {
    let generator = ResumeGenerator::new();
    let job = create_test_job();
    let profile = create_test_profile();

    // Test with basic analysis (no AI)
    let result = generator
        .generate_resume(&profile, &job, Some("resume_modern"), false)
        .await;

    assert!(result.is_ok(), "Resume generation should succeed");
    let document = result.unwrap();
    
    assert!(!document.content.is_empty(), "Resume content should not be empty");
    assert_eq!(document.metadata.job_title, job.title);
    assert_eq!(document.metadata.company, job.company);
}

#[tokio::test]
async fn test_cover_letter_generation_basic_analysis() {
    let generator = CoverLetterGenerator::new();
    let job = create_test_job();
    let profile = create_test_profile();

    // Test with basic analysis (no AI)
    let result = generator
        .generate_cover_letter(&profile, &job, Some("cover_letter_professional"), false)
        .await;

    assert!(result.is_ok(), "Cover letter generation should succeed");
    let document = result.unwrap();
    
    assert!(!document.content.is_empty(), "Cover letter content should not be empty");
    assert_eq!(document.metadata.job_title, job.title);
    assert_eq!(document.metadata.company, job.company);
}









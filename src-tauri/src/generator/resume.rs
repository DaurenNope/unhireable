use crate::db::models::Job;
use crate::generator::{
    GeneratedDocument, DocumentFormat, DocumentMetadata, 
    UserProfile, JobAnalysis, GenerationResult, TemplateManager, AIIntegration
};
use anyhow::Result;

pub struct ResumeGenerator {
    template_manager: TemplateManager,
    ai_integration: AIIntegration,
}

impl ResumeGenerator {
    pub fn new() -> Self {
        Self {
            template_manager: TemplateManager::default(),
            ai_integration: AIIntegration::default(),
        }
    }

    pub fn with_ai_key(mut self, api_key: String) -> Self {
        self.ai_integration = self.ai_integration.with_api_key(api_key);
        self
    }

    pub async fn generate_resume(
        &self,
        profile: &UserProfile,
        job: &Job,
        template_name: Option<&str>,
        improve_with_ai: bool,
    ) -> GenerationResult {
        // Analyze the job first
        let job_analysis = self.ai_integration.analyze_job(job).await?;

        // Improve profile with AI if requested
        let final_profile = if improve_with_ai {
            self.ai_integration.improve_profile(profile, &job_analysis).await?
        } else {
            profile.clone()
        };

        // Generate resume content
        let template_name = template_name.unwrap_or("resume_modern");
        let content = self.template_manager.render_resume(&final_profile, &job_analysis, template_name)?;

        // Calculate word count
        let word_count = content.split_whitespace().count();

        // Create metadata
        let metadata = DocumentMetadata {
            title: format!("Resume - {} for {}", final_profile.personal_info.name, job.title),
            job_title: job.title.clone(),
            company: job.company.clone(),
            generated_at: chrono::Utc::now(),
            template_used: template_name.to_string(),
            word_count,
        };

        Ok(GeneratedDocument {
            content,
            format: DocumentFormat::Markdown,
            metadata,
        })
    }

    pub async fn generate_resume_with_analysis(
        &self,
        profile: &UserProfile,
        job_analysis: &JobAnalysis,
        template_name: Option<&str>,
    ) -> GenerationResult {
        // Generate resume content with pre-computed analysis
        let template_name = template_name.unwrap_or("resume_modern");
        let content = self.template_manager.render_resume(profile, job_analysis, template_name)?;

        // Calculate word count
        let word_count = content.split_whitespace().count();

        // Create metadata
        let metadata = DocumentMetadata {
            title: format!("Resume - {} for {}", profile.personal_info.name, job_analysis.job_title),
            job_title: job_analysis.job_title.clone(),
            company: job_analysis.company.clone(),
            generated_at: chrono::Utc::now(),
            template_used: template_name.to_string(),
            word_count,
        };

        Ok(GeneratedDocument {
            content,
            format: DocumentFormat::Markdown,
            metadata,
        })
    }

    pub fn list_available_templates(&self) -> Vec<String> {
        self.template_manager.list_templates()
            .into_iter()
            .filter(|name| name.starts_with("resume_"))
            .collect()
    }

    pub fn add_custom_template(&mut self, name: String, template: String) -> Result<()> {
        self.template_manager.add_custom_template(name, template)
    }
}

impl Default for ResumeGenerator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::generator::{
        PersonalInfo, SkillsProfile, ExperienceEntry, EducationEntry
    };

    fn create_test_profile() -> UserProfile {
        UserProfile {
            personal_info: PersonalInfo {
                name: "John Doe".to_string(),
                email: "john.doe@example.com".to_string(),
                phone: Some("+1-555-0123".to_string()),
                location: Some("San Francisco, CA".to_string()),
                linkedin: Some("linkedin.com/in/johndoe".to_string()),
                github: Some("github.com/johndoe".to_string()),
                portfolio: Some("johndoe.dev".to_string()),
            },
            summary: "Experienced software developer with 5+ years in web development".to_string(),
            skills: SkillsProfile {
                technical_skills: vec![
                    "React".to_string(),
                    "TypeScript".to_string(),
                    "Node.js".to_string(),
                    "PostgreSQL".to_string(),
                ],
                soft_skills: vec![
                    "Communication".to_string(),
                    "Teamwork".to_string(),
                    "Problem-solving".to_string(),
                ],
                experience_years: std::collections::HashMap::new(),
                proficiency_levels: std::collections::HashMap::new(),
            },
            experience: vec![
                ExperienceEntry {
                    company: "Tech Corp".to_string(),
                    position: "Senior Developer".to_string(),
                    duration: "2020-2023".to_string(),
                    description: vec![
                        "Led development of flagship product".to_string(),
                        "Mentored junior developers".to_string(),
                    ],
                    technologies: vec!["React".to_string(), "Node.js".to_string()],
                },
            ],
            education: vec![
                EducationEntry {
                    institution: "University of Technology".to_string(),
                    degree: "Bachelor of Computer Science".to_string(),
                    year: "2019".to_string(),
                    details: Some("Graduated with honors".to_string()),
                },
            ],
            projects: vec![
                "E-commerce platform with React and Node.js".to_string(),
            ],
        }
    }

    fn create_test_job() -> Job {
        Job {
            id: Some(1),
            title: "Senior React Developer".to_string(),
            company: "StartupXYZ".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("We are looking for a senior React developer...".to_string()),
            requirements: Some("5+ years of React experience, TypeScript, Node.js".to_string()),
            location: Some("Remote".to_string()),
            salary: Some("$120,000-$150,000".to_string()),
            source: "linkedin".to_string(),
            status: crate::db::models::JobStatus::Saved,
            created_at: Some(chrono::Utc::now()),
            updated_at: Some(chrono::Utc::now()),
        }
    }

    #[tokio::test]
    async fn test_resume_generation() {
        let generator = ResumeGenerator::new();
        let profile = create_test_profile();
        let job = create_test_job();

        let result = generator.generate_resume(&profile, &job, None, false).await;
        assert!(result.is_ok());

        let document = result.unwrap();
        assert!(!document.content.is_empty());
        assert_eq!(document.format, DocumentFormat::Markdown);
        assert_eq!(document.metadata.job_title, "Senior React Developer");
        assert_eq!(document.metadata.company, "StartupXYZ");
    }

    #[tokio::test]
    async fn test_template_listing() {
        let generator = ResumeGenerator::new();
        let templates = generator.list_available_templates();
        assert!(!templates.is_empty());
        assert!(templates.iter().any(|t| t.contains("modern")));
    }
}

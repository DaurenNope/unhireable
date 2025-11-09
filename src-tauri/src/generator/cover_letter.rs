use crate::db::models::Job;
use crate::generator::{
    GeneratedDocument, DocumentFormat, DocumentMetadata,
    UserProfile, JobAnalysis, GenerationResult, TemplateManager, AIIntegration
};
use anyhow::Result;

pub struct CoverLetterGenerator {
    template_manager: TemplateManager,
    ai_integration: AIIntegration,
}

impl CoverLetterGenerator {
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

    pub async fn generate_cover_letter(
        &self,
        profile: &UserProfile,
        job: &Job,
        template_name: Option<&str>,
        improve_with_ai: bool,
    ) -> GenerationResult {
        // Analyze the job first (with fallback to basic analysis)
        let job_analysis = match self.ai_integration.analyze_job(job).await {
            Ok(analysis) => analysis,
            Err(e) => {
                eprintln!("AI job analysis failed: {}, using basic analysis", e);
                self.ai_integration.basic_job_analysis(job)
            }
        };

        // Improve profile with AI if requested and API key is available
        let final_profile = if improve_with_ai && self.ai_integration.has_api_key() {
            match self.ai_integration.improve_profile(profile, &job_analysis).await {
                Ok(improved) => improved,
                Err(e) => {
                    eprintln!("AI profile improvement failed: {}, using original profile", e);
                    profile.clone()
                }
            }
        } else {
            profile.clone()
        };

        // Generate cover letter content (always works, uses templates)
        let template_name = template_name.unwrap_or("cover_letter_professional");
        let content = self.template_manager.render_cover_letter(&final_profile, &job_analysis, template_name)?;

        // Calculate word count
        let word_count = content.split_whitespace().count();

        // Create metadata
        let metadata = DocumentMetadata {
            title: format!("Cover Letter - {} for {}", final_profile.personal_info.name, job.title),
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

    pub async fn generate_cover_letter_with_analysis(
        &self,
        profile: &UserProfile,
        job_analysis: &JobAnalysis,
        template_name: Option<&str>,
    ) -> GenerationResult {
        // Generate cover letter content with pre-computed analysis
        let template_name = template_name.unwrap_or("cover_letter_professional");
        let content = self.template_manager.render_cover_letter(profile, job_analysis, template_name)?;

        // Calculate word count
        let word_count = content.split_whitespace().count();

        // Create metadata
        let metadata = DocumentMetadata {
            title: format!("Cover Letter - {} for {}", profile.personal_info.name, job_analysis.job_title),
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
            .filter(|name| name.starts_with("cover_letter_"))
            .collect()
    }

    pub fn add_custom_template(&mut self, name: String, template: String) -> Result<()> {
        self.template_manager.add_custom_template(name, template)
    }

    pub async fn generate_email_version(
        &self,
        profile: &UserProfile,
        job: &Job,
        template_name: Option<&str>,
        improve_with_ai: bool,
    ) -> GenerationResult {
        // Generate the cover letter first
        let cover_letter = self.generate_cover_letter(profile, job, template_name, improve_with_ai).await?;
        
        // Convert to email format (more concise, email-friendly)
        let email_content = self.convert_to_email_format(&cover_letter.content);

        // Create metadata
        let metadata = DocumentMetadata {
            title: format!("Email - {} for {}", profile.personal_info.name, job.title),
            job_title: job.title.clone(),
            company: job.company.clone(),
            generated_at: chrono::Utc::now(),
            template_used: template_name.unwrap_or("cover_letter_professional").to_string(),
            word_count: email_content.split_whitespace().count(),
        };

        Ok(GeneratedDocument {
            content: email_content,
            format: DocumentFormat::Text,
            metadata,
        })
    }

    fn convert_to_email_format(&self, cover_letter_content: &str) -> String {
        let lines: Vec<&str> = cover_letter_content.lines().collect();
        let mut email_lines = Vec::new();
        let mut in_body = false;

        for line in lines {
            let trimmed = line.trim();
            
            // Skip header sections and convert to email format
            if trimmed.starts_with("# ") || trimmed.starts_with("## ") {
                continue;
            }
            
            if trimmed.is_empty() && !in_body {
                in_body = true;
                continue;
            }
            
            if in_body {
                // Convert formal letter to email format
                let email_line = if trimmed.starts_with("Dear Hiring Manager,") {
                    "Hi there,".to_string()
                } else if trimmed.starts_with("Sincerely,") || trimmed.starts_with("Best,") {
                    "Thanks,".to_string()
                } else {
                    trimmed.to_string()
                };
                
                if !email_line.is_empty() {
                    email_lines.push(email_line);
                }
            }
        }

        email_lines.join("\n")
    }
}

impl Default for CoverLetterGenerator {
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
                name: "Jane Smith".to_string(),
                email: "jane.smith@example.com".to_string(),
                phone: Some("+1-555-0123".to_string()),
                location: Some("New York, NY".to_string()),
                linkedin: Some("linkedin.com/in/janesmith".to_string()),
                github: Some("github.com/janesmith".to_string()),
                portfolio: Some("janesmith.dev".to_string()),
            },
            summary: "Creative front-end developer with 3+ years of experience".to_string(),
            skills: SkillsProfile {
                technical_skills: vec![
                    "React".to_string(),
                    "TypeScript".to_string(),
                    "CSS".to_string(),
                    "Vue.js".to_string(),
                ],
                soft_skills: vec![
                    "Creativity".to_string(),
                    "Communication".to_string(),
                    "Attention to detail".to_string(),
                ],
                experience_years: std::collections::HashMap::new(),
                proficiency_levels: std::collections::HashMap::new(),
            },
            experience: vec![
                ExperienceEntry {
                    company: "Design Agency".to_string(),
                    position: "Front-end Developer".to_string(),
                    duration: "2021-2023".to_string(),
                    description: vec![
                        "Developed responsive web applications".to_string(),
                        "Collaborated with design team".to_string(),
                    ],
                    technologies: vec!["React".to_string(), "CSS".to_string()],
                },
            ],
            education: vec![
                EducationEntry {
                    institution: "Design School".to_string(),
                    degree: "Bachelor of Design".to_string(),
                    year: "2021".to_string(),
                    details: Some("Focused on UI/UX design".to_string()),
                },
            ],
            projects: vec![
                "Portfolio website with React animations".to_string(),
            ],
        }
    }

    fn create_test_job() -> Job {
        Job {
            id: Some(1),
            title: "Front-end Developer".to_string(),
            company: "CreativeStudio".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("Looking for a creative front-end developer...".to_string()),
            requirements: Some("React experience, design sense, CSS skills".to_string()),
            location: Some("Remote".to_string()),
            salary: Some("$80,000-$100,000".to_string()),
            source: "wellfound".to_string(),
            status: crate::db::models::JobStatus::Saved,
            match_score: None,
            created_at: Some(chrono::Utc::now()),
            updated_at: Some(chrono::Utc::now()),
        }
    }

    #[tokio::test]
    async fn test_cover_letter_generation() {
        let generator = CoverLetterGenerator::new();
        let profile = create_test_profile();
        let job = create_test_job();

        let result = generator.generate_cover_letter(&profile, &job, None, false).await;
        assert!(result.is_ok());

        let document = result.unwrap();
        assert!(!document.content.is_empty());
        assert_eq!(document.format, DocumentFormat::Markdown);
        assert_eq!(document.metadata.job_title, "Front-end Developer");
        assert_eq!(document.metadata.company, "CreativeStudio");
    }

    #[tokio::test]
    async fn test_email_generation() {
        let generator = CoverLetterGenerator::new();
        let profile = create_test_profile();
        let job = create_test_job();

        let result = generator.generate_email_version(&profile, &job, None, false).await;
        assert!(result.is_ok());

        let document = result.unwrap();
        assert!(!document.content.is_empty());
        assert_eq!(document.format, DocumentFormat::Text);
    }

    #[tokio::test]
    async fn test_template_listing() {
        let generator = CoverLetterGenerator::new();
        let templates = generator.list_available_templates();
        assert!(!templates.is_empty());
        assert!(templates.iter().any(|t| t.contains("professional")));
    }
}

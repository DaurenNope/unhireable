use crate::db::models::Job;
use crate::generator::{
    AIIntegration, DocumentFormat, DocumentMetadata, GeneratedDocument, GenerationResult,
    JobAnalysis, TemplateManager, UserProfile,
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
            match self
                .ai_integration
                .improve_profile(profile, &job_analysis)
                .await
            {
                Ok(improved) => improved,
                Err(e) => {
                    eprintln!(
                        "AI profile improvement failed: {}, using original profile",
                        e
                    );
                    profile.clone()
                }
            }
        } else {
            profile.clone()
        };

        // Generate resume content (always works, uses templates)
        let template_name = template_name.unwrap_or("resume_modern");
        let content =
            self.template_manager
                .render_resume(&final_profile, &job_analysis, template_name)?;

        // Calculate word count
        let word_count = content.split_whitespace().count();

        // Create metadata
        let metadata = DocumentMetadata {
            title: format!(
                "Resume - {} for {}",
                final_profile.personal_info.name, job.title
            ),
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
        let content = self
            .template_manager
            .render_resume(profile, job_analysis, template_name)?;

        // Calculate word count
        let word_count = content.split_whitespace().count();

        // Create metadata
        let metadata = DocumentMetadata {
            title: format!(
                "Resume - {} for {}",
                profile.personal_info.name, job_analysis.job_title
            ),
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
        self.template_manager
            .list_templates()
            .into_iter()
            .filter(|name| name.starts_with("resume_"))
            .collect()
    }

    pub fn add_custom_template(&mut self, name: String, template: String) -> Result<()> {
        self.template_manager.add_custom_template(name, template)
    }

    /// Preview a template with sample data
    pub async fn preview_template(&self, template_name: &str) -> Result<GeneratedDocument> {
        // Create sample profile for preview
        let sample_profile = UserProfile {
            personal_info: crate::generator::PersonalInfo {
                name: "John Doe".to_string(),
                email: "john.doe@example.com".to_string(),
                phone: Some("+1 (555) 123-4567".to_string()),
                location: Some("San Francisco, CA".to_string()),
                linkedin: Some("linkedin.com/in/johndoe".to_string()),
                github: Some("github.com/johndoe".to_string()),
                portfolio: Some("johndoe.dev".to_string()),
            },
            summary: "Experienced software engineer with 5+ years of expertise in full-stack development, cloud architecture, and team leadership. Passionate about building scalable applications and mentoring junior developers.".to_string(),
            skills: crate::generator::SkillsProfile {
                technical_skills: vec![
                    "React".to_string(),
                    "TypeScript".to_string(),
                    "Node.js".to_string(),
                    "Python".to_string(),
                    "AWS".to_string(),
                    "Docker".to_string(),
                    "PostgreSQL".to_string(),
                ],
                soft_skills: vec![
                    "Leadership".to_string(),
                    "Communication".to_string(),
                    "Problem Solving".to_string(),
                ],
                experience_years: std::collections::HashMap::new(),
                proficiency_levels: std::collections::HashMap::new(),
            },
            experience: vec![
                crate::generator::ExperienceEntry {
                    company: "Tech Corp".to_string(),
                    position: "Senior Software Engineer".to_string(),
                    duration: "2020 - Present".to_string(),
                    description: vec![
                        "Led development of microservices architecture serving 1M+ users".to_string(),
                        "Mentored team of 5 junior developers".to_string(),
                        "Reduced system latency by 40% through optimization".to_string(),
                    ],
                    technologies: vec!["React", "Node.js", "AWS", "Docker"].into_iter().map(String::from).collect(),
                },
            ],
            education: vec![
                crate::generator::EducationEntry {
                    institution: "University of Technology".to_string(),
                    degree: "B.S. Computer Science".to_string(),
                    year: "2018".to_string(),
                    details: Some("Magna Cum Laude".to_string()),
                },
            ],
            projects: vec![
                "Open-source library with 10K+ GitHub stars".to_string(),
                "E-commerce platform handling $1M+ in transactions".to_string(),
            ],
        };

        // Create sample job analysis
        let sample_job_analysis = JobAnalysis {
            extracted_keywords: vec!["React", "TypeScript", "Node.js", "AWS"]
                .into_iter()
                .map(String::from)
                .collect(),
            required_skills: vec!["React", "TypeScript", "Node.js"]
                .into_iter()
                .map(String::from)
                .collect(),
            preferred_skills: vec!["AWS", "Docker"]
                .into_iter()
                .map(String::from)
                .collect(),
            experience_level: "Senior".to_string(),
            company_tone: "Professional and innovative".to_string(),
            key_responsibilities: vec![
                "Build scalable web applications".to_string(),
                "Lead technical initiatives".to_string(),
            ],
            match_score: 85.0,
            job_title: "Senior Full Stack Developer".to_string(),
            company: "Innovation Labs".to_string(),
        };

        // Generate preview content
        let content = self.template_manager.render_resume(
            &sample_profile,
            &sample_job_analysis,
            template_name,
        )?;

        let word_count = content.split_whitespace().count();

        Ok(GeneratedDocument {
            content,
            format: DocumentFormat::Markdown,
            metadata: DocumentMetadata {
                title: format!("Preview - {}", template_name),
                job_title: sample_job_analysis.job_title,
                company: sample_job_analysis.company,
                generated_at: chrono::Utc::now(),
                template_used: template_name.to_string(),
                word_count,
            },
        })
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
    use crate::generator::{EducationEntry, ExperienceEntry, PersonalInfo, SkillsProfile};

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
            experience: vec![ExperienceEntry {
                company: "Tech Corp".to_string(),
                position: "Senior Developer".to_string(),
                duration: "2020-2023".to_string(),
                description: vec![
                    "Led development of flagship product".to_string(),
                    "Mentored junior developers".to_string(),
                ],
                technologies: vec!["React".to_string(), "Node.js".to_string()],
            }],
            education: vec![EducationEntry {
                institution: "University of Technology".to_string(),
                degree: "Bachelor of Computer Science".to_string(),
                year: "2019".to_string(),
                details: Some("Graduated with honors".to_string()),
            }],
            projects: vec!["E-commerce platform with React and Node.js".to_string()],
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
            match_score: None,
            created_at: Some(chrono::Utc::now()),
            updated_at: Some(chrono::Utc::now()),
            ..Default::default()
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

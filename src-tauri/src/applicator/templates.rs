use crate::applicator::{ApplicationConfig, RetryConfig};
use crate::db::models::Job;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Application template for reusable application configurations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationTemplate {
    /// Template ID
    pub id: String,
    /// Template name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// ATS type this template is designed for
    pub ats_type: Option<String>,
    /// Company name pattern (for matching)
    pub company_pattern: Option<String>,
    /// Application configuration
    pub config: ApplicationConfig,
    /// Retry configuration
    pub retry_config: Option<RetryConfig>,
    /// Workflow ID to use (if applicable)
    pub workflow_id: Option<String>,
    /// Default resume path (optional)
    pub default_resume_path: Option<String>,
    /// Default cover letter path (optional)
    pub default_cover_letter_path: Option<String>,
    /// Template variables (key-value pairs for customization)
    pub variables: HashMap<String, serde_json::Value>,
    /// Whether template is enabled
    pub enabled: bool,
    /// Metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

impl ApplicationTemplate {
    /// Create a new template
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            description: None,
            ats_type: None,
            company_pattern: None,
            config: ApplicationConfig::default(),
            retry_config: None,
            workflow_id: None,
            default_resume_path: None,
            default_cover_letter_path: None,
            variables: HashMap::new(),
            enabled: true,
            metadata: HashMap::new(),
        }
    }

    /// Check if this template matches a job
    pub fn matches_job(&self, job: &Job) -> bool {
        if !self.enabled {
            return false;
        }

        // Check ATS type match
        if let Some(template_ats) = &self.ats_type {
            let job_ats =
                crate::applicator::AtsDetector::detect_ats(&job.url).map(|a| format!("{:?}", a));
            if let Some(job_ats_str) = job_ats {
                if !job_ats_str.eq_ignore_ascii_case(template_ats) {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Check company pattern match
        if let Some(pattern) = &self.company_pattern {
            if !job.company.to_lowercase().contains(&pattern.to_lowercase()) {
                return false;
            }
        }

        true
    }

    /// Apply template variables to configuration
    pub fn apply_variables(&mut self, variables: &HashMap<String, serde_json::Value>) {
        self.variables.extend(variables.clone());

        // Apply variables to config
        if let Some(resume_path) = variables.get("resume_path").and_then(|v| v.as_str()) {
            self.config.resume_path = Some(resume_path.to_string());
        }

        if let Some(cover_letter_path) = variables.get("cover_letter_path").and_then(|v| v.as_str())
        {
            self.config.cover_letter_path = Some(cover_letter_path.to_string());
        }

        if let Some(auto_submit) = variables.get("auto_submit").and_then(|v| v.as_bool()) {
            self.config.auto_submit = auto_submit;
        }

        if let Some(timeout) = variables.get("timeout_secs").and_then(|v| v.as_u64()) {
            self.config.timeout_secs = timeout;
        }
    }
}

/// Template manager for managing application templates
pub struct TemplateManager {
    templates: Vec<ApplicationTemplate>,
}

impl TemplateManager {
    /// Create a new template manager
    pub fn new() -> Self {
        Self {
            templates: Vec::new(),
        }
    }

    /// Create template manager with default templates
    pub fn with_defaults() -> Self {
        let mut manager = Self::new();

        // Greenhouse template
        let mut greenhouse_template = ApplicationTemplate::new(
            "greenhouse-default".to_string(),
            "Greenhouse Default".to_string(),
        );
        greenhouse_template.description = Some("Default template for Greenhouse ATS".to_string());
        greenhouse_template.ats_type = Some("Greenhouse".to_string());
        greenhouse_template.config.auto_submit = false;
        greenhouse_template.config.timeout_secs = 120;
        manager.add_template(greenhouse_template);

        // Lever template
        let mut lever_template =
            ApplicationTemplate::new("lever-default".to_string(), "Lever Default".to_string());
        lever_template.description = Some("Default template for Lever ATS".to_string());
        lever_template.ats_type = Some("Lever".to_string());
        lever_template.config.auto_submit = false;
        lever_template.config.timeout_secs = 120;
        manager.add_template(lever_template);

        // Workable template
        let mut workable_template = ApplicationTemplate::new(
            "workable-default".to_string(),
            "Workable Default".to_string(),
        );
        workable_template.description = Some("Default template for Workable ATS".to_string());
        workable_template.ats_type = Some("Workable".to_string());
        workable_template.config.auto_submit = false;
        workable_template.config.timeout_secs = 120;
        manager.add_template(workable_template);

        // LinkedIn Easy Apply template
        let mut linkedin_template = ApplicationTemplate::new(
            "linkedin-easy-apply".to_string(),
            "LinkedIn Easy Apply".to_string(),
        );
        linkedin_template.description =
            Some("Template for LinkedIn Easy Apply applications".to_string());
        linkedin_template.ats_type = Some("LinkedInEasyApply".to_string());
        linkedin_template.config.auto_submit = true;
        linkedin_template.config.timeout_secs = 90;
        manager.add_template(linkedin_template);

        manager
    }

    /// Add a template
    pub fn add_template(&mut self, template: ApplicationTemplate) {
        self.templates.push(template);
    }

    /// Remove a template
    pub fn remove_template(&mut self, template_id: &str) -> bool {
        let initial_len = self.templates.len();
        self.templates.retain(|t| t.id != template_id);
        self.templates.len() < initial_len
    }

    /// Get a template by ID
    pub fn get_template(&self, template_id: &str) -> Option<&ApplicationTemplate> {
        self.templates.iter().find(|t| t.id == template_id)
    }

    /// Get a mutable template by ID
    pub fn get_template_mut(&mut self, template_id: &str) -> Option<&mut ApplicationTemplate> {
        self.templates.iter_mut().find(|t| t.id == template_id)
    }

    /// Find matching template for a job
    pub fn find_matching_template(&self, job: &Job) -> Option<&ApplicationTemplate> {
        // First, try exact ATS match
        let ats_type =
            crate::applicator::AtsDetector::detect_ats(&job.url).map(|a| format!("{:?}", a));

        if let Some(ats_str) = &ats_type {
            if let Some(template) = self.templates.iter().find(|t| {
                t.ats_type.as_ref().map(|a| a.eq_ignore_ascii_case(ats_str)) == Some(true)
                    && t.matches_job(job)
            }) {
                return Some(template);
            }
        }

        // Try generic template (no ATS type specified)
        self.templates
            .iter()
            .find(|t| t.ats_type.is_none() && t.matches_job(job))
    }

    /// List all templates
    pub fn list_templates(&self) -> &[ApplicationTemplate] {
        &self.templates
    }

    /// List enabled templates
    pub fn list_enabled_templates(&self) -> Vec<&ApplicationTemplate> {
        self.templates.iter().filter(|t| t.enabled).collect()
    }
}

impl Default for TemplateManager {
    fn default() -> Self {
        Self::with_defaults()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::JobStatus;

    fn create_test_job(url: &str, company: &str) -> Job {
        Job {
            id: None,
            title: "Test Job".to_string(),
            company: company.to_string(),
            url: url.to_string(),
            description: None,
            requirements: None,
            location: None,
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
            ..Default::default()
        }
    }

    #[test]
    fn test_template_matches_job() {
        let mut template =
            ApplicationTemplate::new("test-template".to_string(), "Test Template".to_string());
        template.ats_type = Some("Greenhouse".to_string());

        let job = create_test_job(
            "https://boards.greenhouse.io/company/job/123",
            "Test Company",
        );
        assert!(template.matches_job(&job));

        let job2 = create_test_job("https://lever.co/company/job/123", "Test Company");
        assert!(!template.matches_job(&job2));
    }

    #[test]
    fn test_template_manager_find_matching() {
        let manager = TemplateManager::with_defaults();

        let job = create_test_job(
            "https://boards.greenhouse.io/company/job/123",
            "Test Company",
        );
        let template = manager.find_matching_template(&job);
        assert!(template.is_some());
        assert_eq!(template.unwrap().ats_type.as_ref().unwrap(), "Greenhouse");
    }

    #[test]
    fn test_template_apply_variables() {
        let mut template =
            ApplicationTemplate::new("test-template".to_string(), "Test Template".to_string());

        let mut variables = HashMap::new();
        variables.insert(
            "resume_path".to_string(),
            serde_json::json!("/path/to/resume.pdf"),
        );
        variables.insert("auto_submit".to_string(), serde_json::json!(true));

        template.apply_variables(&variables);

        assert_eq!(
            template.config.resume_path,
            Some("/path/to/resume.pdf".to_string())
        );
        assert!(template.config.auto_submit);
    }
}

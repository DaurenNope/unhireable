use crate::generator::{UserProfile, JobAnalysis};
use anyhow::Result;
use handlebars::Handlebars;
use serde_json::json;
use std::collections::HashMap;

pub struct TemplateManager {
    handlebars: Handlebars<'static>,
    templates: HashMap<String, String>,
}

impl TemplateManager {
    pub fn new() -> Result<Self> {
        let mut handlebars = Handlebars::new();
        
        // Register helpers
        handlebars.register_helper("format_date", Box::new(format_date_helper));
        handlebars.register_helper("capitalize", Box::new(capitalize_helper));
        handlebars.register_helper("pluralize", Box::new(pluralize_helper));
        
        let mut templates = HashMap::new();
        
        // Default resume template
        templates.insert("resume_modern".to_string(), include_str!("templates/resume_modern.hbs").to_string());
        templates.insert("resume_classic".to_string(), include_str!("templates/resume_classic.hbs").to_string());
        
        // Default cover letter template
        templates.insert("cover_letter_professional".to_string(), include_str!("templates/cover_letter_professional.hbs").to_string());
        templates.insert("cover_letter_casual".to_string(), include_str!("templates/cover_letter_casual.hbs").to_string());
        
        // Register all templates
        for (name, template) in &templates {
            handlebars.register_template_string(name, template)?;
        }
        
        Ok(Self {
            handlebars,
            templates,
        })
    }
    
    pub fn render_resume(&self, profile: &UserProfile, job_analysis: &JobAnalysis, template_name: &str) -> Result<String> {
        let template_name = if self.templates.contains_key(template_name) {
            template_name
        } else {
            "resume_modern" // fallback
        };
        
        let data = json!({
            "profile": profile,
            "job": job_analysis,
            "current_date": chrono::Utc::now().format("%B %d, %Y").to_string()
        });
        
        Ok(self.handlebars.render(template_name, &data)?)
    }
    
    pub fn render_cover_letter(&self, profile: &UserProfile, job_analysis: &JobAnalysis, template_name: &str) -> Result<String> {
        let template_name = if self.templates.contains_key(template_name) {
            template_name
        } else {
            "cover_letter_professional" // fallback
        };
        
        let data = json!({
            "profile": profile,
            "job": job_analysis,
            "current_date": chrono::Utc::now().format("%B %d, %Y").to_string()
        });
        
        Ok(self.handlebars.render(template_name, &data)?)
    }
    
    pub fn list_templates(&self) -> Vec<String> {
        self.templates.keys().cloned().collect()
    }
    
    pub fn add_custom_template(&mut self, name: String, template: String) -> Result<()> {
        self.handlebars.register_template_string(&name, &template)?;
        self.templates.insert(name, template);
        Ok(())
    }
}

// Handlebars helpers
fn format_date_helper(
    h: &handlebars::Helper<'_, '_>,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _: &mut handlebars::RenderContext<'_, '_>,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    let param = h.param(0).unwrap().value().as_str().unwrap_or("");
    let formatted = if let Ok(date) = param.parse::<chrono::DateTime<chrono::Utc>>() {
        date.format("%B %Y").to_string()
    } else {
        param.to_string()
    };
    out.write(&formatted)?;
    Ok(())
}

fn capitalize_helper(
    h: &handlebars::Helper<'_, '_>,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _: &mut handlebars::RenderContext<'_, '_>,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    let param = h.param(0).unwrap().value().as_str().unwrap_or("");
    let mut chars: Vec<char> = param.chars().collect();
    if let Some(first) = chars.get_mut(0) {
        *first = first.to_uppercase().next().unwrap_or(*first);
    }
    out.write(&chars.iter().collect::<String>())?;
    Ok(())
}

fn pluralize_helper(
    h: &handlebars::Helper<'_, '_>,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _: &mut handlebars::RenderContext<'_, '_>,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    let count = h.param(0).unwrap().value().as_u64().unwrap_or(0);
    let word = h.param(1).unwrap().value().as_str().unwrap_or("");
    
    let result = if count == 1 {
        word.to_string()
    } else {
        format!("{}s", word)
    };
    
    out.write(&result)?;
    Ok(())
}

impl Default for TemplateManager {
    fn default() -> Self {
        Self::new().unwrap_or_else(|e| {
            eprintln!("Failed to create TemplateManager: {}", e);
            Self {
                handlebars: Handlebars::new(),
                templates: HashMap::new(),
            }
        })
    }
}

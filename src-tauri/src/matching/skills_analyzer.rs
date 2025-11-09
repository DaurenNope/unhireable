use crate::generator::UserProfile;
use crate::db::models::Job;
use std::collections::HashSet;

/// Analyzes skills from jobs and user profiles
pub struct SkillsAnalyzer;

impl SkillsAnalyzer {
    /// Extract skills from job description and requirements
    pub fn extract_job_skills(job: &Job) -> Vec<String> {
        let mut skills = HashSet::new();
        
        // Common programming languages and technologies
        let common_skills = vec![
            "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
            "react", "vue", "angular", "node.js", "express", "django", "flask",
            "postgresql", "mysql", "mongodb", "redis", "docker", "kubernetes",
            "aws", "azure", "gcp", "terraform", "git", "linux", "bash",
            "html", "css", "sass", "less", "webpack", "vite", "next.js",
            "graphql", "rest", "api", "microservices", "agile", "scrum",
            "machine learning", "ai", "data science", "sql", "nosql",
        ];
        
        // Combine description and requirements
        let text = format!(
            "{} {}",
            job.description.as_deref().unwrap_or(""),
            job.requirements.as_deref().unwrap_or("")
        ).to_lowercase();
        
        // Extract skills from text
        for skill in common_skills {
            if text.contains(&skill.to_lowercase()) {
                skills.insert(skill.to_string());
            }
        }
        
        // Also look for skill-like words (capitalized, technical terms)
        let words: Vec<&str> = text.split_whitespace().collect();
        for word in words {
            let word = word.trim_matches(|c: char| !c.is_alphabetic());
            if word.len() > 2 && word.chars().any(|c| c.is_uppercase()) {
                skills.insert(word.to_string());
            }
        }
        
        skills.into_iter().collect()
    }
    
    /// Extract skills from user profile
    pub fn extract_user_skills(profile: &UserProfile) -> Vec<String> {
        let mut skills = HashSet::new();
        
        // Add technical skills
        for skill in &profile.skills.technical_skills {
            skills.insert(skill.to_lowercase());
        }
        
        // Add skills from experience
        for exp in &profile.experience {
            for tech in &exp.technologies {
                skills.insert(tech.to_lowercase());
            }
        }
        
        // Add skills from projects (parse project descriptions)
        for project in &profile.projects {
            let project_lower = project.to_lowercase();
            // Simple keyword extraction from projects
            let tech_keywords = vec!["react", "python", "javascript", "typescript", "node", "aws"];
            for keyword in tech_keywords {
                if project_lower.contains(keyword) {
                    skills.insert(keyword.to_string());
                }
            }
        }
        
        skills.into_iter().collect()
    }
    
    /// Calculate skills overlap between job and user
    pub fn calculate_skills_overlap(job_skills: &[String], user_skills: &[String]) -> (f64, Vec<String>, Vec<String>) {
        let job_set: HashSet<String> = job_skills.iter()
            .map(|s| s.to_lowercase())
            .collect();
        let user_set: HashSet<String> = user_skills.iter()
            .map(|s| s.to_lowercase())
            .collect();
        
        // Find matched and missing skills
        let matched: Vec<String> = job_set.intersection(&user_set)
            .cloned()
            .collect();
        let missing: Vec<String> = job_set.difference(&user_set)
            .cloned()
            .collect();
        
        // Calculate overlap percentage
        let overlap = if job_set.is_empty() {
            0.0
        } else {
            (matched.len() as f64 / job_set.len() as f64) * 100.0
        };
        
        (overlap, matched, missing)
    }
    
    /// Normalize skill names (handle variations)
    pub fn normalize_skill(skill: &str) -> String {
        let skill_lower = skill.to_lowercase();
        
        // Handle common variations
        let normalized = match skill_lower.as_str() {
            "js" | "javascript" => "javascript",
            "ts" | "typescript" => "typescript",
            "py" | "python" => "python",
            "react.js" | "reactjs" | "react" => "react",
            "node" | "nodejs" | "node.js" => "node.js",
            _ => &skill_lower,
        };
        
        normalized.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::{Job, JobStatus};
    use crate::generator::{UserProfile, PersonalInfo, SkillsProfile, ExperienceEntry};
    use std::collections::HashMap;
    
    #[test]
    fn test_extract_job_skills() {
        let job = Job {
            id: Some(1),
            title: "Senior React Developer".to_string(),
            company: "Test Corp".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("We are looking for a React developer with TypeScript experience. Must know Node.js and REST APIs.".to_string()),
            requirements: Some("Experience with React, TypeScript, Node.js required.".to_string()),
            location: None,
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        };
        
        let skills = SkillsAnalyzer::extract_job_skills(&job);
        assert!(skills.contains(&"react".to_string()));
        assert!(skills.contains(&"typescript".to_string()));
        assert!(skills.contains(&"node.js".to_string()));
    }
    
    #[test]
    fn test_extract_user_skills() {
        let profile = UserProfile {
            personal_info: PersonalInfo {
                name: "Test User".to_string(),
                email: "test@example.com".to_string(),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                portfolio: None,
            },
            summary: "Experienced developer".to_string(),
            skills: SkillsProfile {
                technical_skills: vec!["React".to_string(), "TypeScript".to_string(), "Python".to_string()],
                soft_skills: vec!["Communication".to_string()],
                experience_years: HashMap::new(),
                proficiency_levels: HashMap::new(),
            },
            experience: vec![
                ExperienceEntry {
                    company: "Company A".to_string(),
                    position: "Developer".to_string(),
                    duration: "2 years".to_string(),
                    description: vec!["Built React apps".to_string()],
                    technologies: vec!["React".to_string(), "Node.js".to_string()],
                }
            ],
            education: vec![],
            projects: vec!["React project with AWS".to_string()],
        };
        
        let skills = SkillsAnalyzer::extract_user_skills(&profile);
        assert!(skills.contains(&"react".to_string()));
        assert!(skills.contains(&"typescript".to_string()));
        assert!(skills.contains(&"python".to_string()));
        assert!(skills.contains(&"node.js".to_string()));
    }
    
    #[test]
    fn test_calculate_skills_overlap() {
        let job_skills = vec![
            "react".to_string(),
            "typescript".to_string(),
            "python".to_string(),
            "docker".to_string(),
        ];
        
        let user_skills = vec![
            "react".to_string(),
            "typescript".to_string(),
            "javascript".to_string(),
        ];
        
        let (overlap, matched, missing) = SkillsAnalyzer::calculate_skills_overlap(&job_skills, &user_skills);
        
        assert_eq!(matched.len(), 2);
        assert!(matched.contains(&"react".to_string()));
        assert!(matched.contains(&"typescript".to_string()));
        
        assert_eq!(missing.len(), 2);
        assert!(missing.contains(&"python".to_string()));
        assert!(missing.contains(&"docker".to_string()));
        
        assert!((overlap - 50.0).abs() < 0.01); // 2 out of 4 = 50%
    }
    
    #[test]
    fn test_normalize_skill() {
        assert_eq!(SkillsAnalyzer::normalize_skill("JavaScript"), "javascript");
        assert_eq!(SkillsAnalyzer::normalize_skill("js"), "javascript");
        assert_eq!(SkillsAnalyzer::normalize_skill("React"), "react");
        assert_eq!(SkillsAnalyzer::normalize_skill("ReactJS"), "react");
    }
}


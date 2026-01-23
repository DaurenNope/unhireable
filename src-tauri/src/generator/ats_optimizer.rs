use crate::generator::{JobAnalysis, UserProfile};
use anyhow::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ATSOptimizationResult {
    pub optimized_content: String,
    pub score: f64,
    pub improvements: Vec<String>,
    pub keyword_matches: usize,
    pub keyword_density: f64,
    pub formatting_score: f64,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ATSCompatibilityReport {
    pub overall_score: f64,
    pub keyword_score: f64,
    pub formatting_score: f64,
    pub structure_score: f64,
    pub issues: Vec<ATSIssue>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ATSIssue {
    pub severity: String, // "error", "warning", "info"
    pub category: String, // "formatting", "keywords", "structure", "content"
    pub message: String,
    pub suggestion: String,
}

pub struct ATSOptimizer {
    common_ats_keywords: HashSet<String>,
    formatting_rules: Vec<FormattingRule>,
}

#[allow(dead_code)] // issue_type field reserved for future use
struct FormattingRule {
    pattern: Regex,
    issue_type: String,
    severity: String,
    message: String,
    fix: Box<dyn Fn(&str) -> String>,
}

impl ATSOptimizer {
    pub fn new() -> Self {
        let common_keywords = vec![
            "javascript", "typescript", "python", "java", "rust", "go", "c++", "c#",
            "react", "vue", "angular", "node.js", "express", "django", "flask",
            "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
            "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
            "git", "ci/cd", "jenkins", "github actions", "agile", "scrum",
            "rest api", "graphql", "microservices", "api design",
            "testing", "unit testing", "integration testing", "tdd",
            "machine learning", "ai", "data science", "analytics",
        ]
        .into_iter()
        .map(|s| s.to_lowercase())
        .collect();

        let mut formatting_rules = Vec::new();
        
        // Check for special characters that ATS systems might not parse well
        formatting_rules.push(FormattingRule {
            pattern: Regex::new(r"[^\w\s\-.,;:()\[\]{}@#%&*+=<>/\\|~`$]").unwrap(),
            issue_type: "special_characters".to_string(),
            severity: "warning".to_string(),
            message: "Contains special characters that may not parse well in ATS systems".to_string(),
            fix: Box::new(|text| {
                // Remove or replace problematic characters
                text.chars()
                    .map(|c| if c.is_ascii_alphanumeric() || " -.,;:()[]{}@#%&*+=<>/\\|~`$".contains(c) {
                        c
                    } else {
                        ' '
                    })
                    .collect()
            }),
        });

        // Check for tables (ATS systems often struggle with tables)
        formatting_rules.push(FormattingRule {
            pattern: Regex::new(r"\|.*\|").unwrap(),
            issue_type: "tables".to_string(),
            severity: "warning".to_string(),
            message: "Contains table formatting which may not parse well".to_string(),
            fix: Box::new(|text| {
                // Convert tables to simple text
                text.replace("|", " ")
            }),
        });

        // Check for headers (should use simple formatting)
        formatting_rules.push(FormattingRule {
            pattern: Regex::new(r"^#{1,6}\s+").unwrap(),
            issue_type: "markdown_headers".to_string(),
            severity: "info".to_string(),
            message: "Markdown headers should be converted to plain text for ATS compatibility".to_string(),
            fix: Box::new(|text| {
                text.lines()
                    .map(|line| {
                        if line.starts_with('#') {
                            line.trim_start_matches('#').trim().to_string()
                        } else {
                            line.to_string()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            }),
        });

        Self {
            common_ats_keywords: common_keywords,
            formatting_rules,
        }
    }

    pub fn optimize_for_ats(
        &self,
        content: &str,
        job_analysis: &JobAnalysis,
        _profile: &UserProfile,
    ) -> Result<ATSOptimizationResult> {
        let mut optimized = content.to_string();
        let mut improvements = Vec::new();
        let mut keyword_matches = 0;

        // Extract keywords from job analysis
        let job_keywords: HashSet<String> = job_analysis
            .extracted_keywords
            .iter()
            .chain(job_analysis.required_skills.iter())
            .chain(job_analysis.preferred_skills.iter())
            .map(|s| s.to_lowercase())
            .collect();

        // Count keyword matches
        let content_lower = optimized.to_lowercase();
        for keyword in &job_keywords {
            if content_lower.contains(&keyword.to_lowercase()) {
                keyword_matches += 1;
            }
        }

        // Add missing important keywords naturally
        let missing_keywords: Vec<String> = job_analysis
            .required_skills
            .iter()
            .filter(|skill| {
                !content_lower.contains(&skill.to_lowercase())
                    && self.common_ats_keywords.contains(&skill.to_lowercase())
            })
            .cloned()
            .collect();

        if !missing_keywords.is_empty() {
            // Try to naturally incorporate missing keywords
            let skills_section = self.find_or_create_skills_section(&optimized);
            if let Some(section) = skills_section {
                let mut updated_section = section.clone();
                for keyword in &missing_keywords {
                    if !updated_section.to_lowercase().contains(&keyword.to_lowercase()) {
                        updated_section.push_str(&format!(", {}", keyword));
                    }
                }
                optimized = optimized.replace(&section, &updated_section);
                improvements.push(format!(
                    "Added missing keywords: {}",
                    missing_keywords.join(", ")
                ));
            }
        }

        // Apply formatting fixes
        let mut formatting_issues = 0;
        for rule in &self.formatting_rules {
            if rule.pattern.is_match(&optimized) {
                formatting_issues += 1;
                optimized = (rule.fix)(&optimized);
                improvements.push(rule.message.clone());
            }
        }

        // Calculate scores
        let keyword_density = if !content.is_empty() {
            (keyword_matches as f64 / job_keywords.len().max(1) as f64) * 100.0
        } else {
            0.0
        };

        let formatting_score = if formatting_issues == 0 {
            100.0
        } else {
            100.0 - (formatting_issues as f64 * 10.0).min(50.0)
        };

        let keyword_score = keyword_density.min(100.0);
        let overall_score = keyword_score * 0.6 + formatting_score * 0.4;

        // Generate recommendations
        let mut recommendations = Vec::new();
        if keyword_density < 70.0 {
            recommendations.push("Add more relevant keywords from the job description".to_string());
        }
        if formatting_score < 90.0 {
            recommendations.push("Simplify formatting for better ATS compatibility".to_string());
        }
        if !content.contains("Summary") && !content.contains("Objective") {
            recommendations.push("Add a professional summary section".to_string());
        }
        if content.split_whitespace().count() < 200 {
            recommendations.push("Expand content to provide more detail".to_string());
        }

        Ok(ATSOptimizationResult {
            optimized_content: optimized,
            score: overall_score,
            improvements,
            keyword_matches,
            keyword_density,
            formatting_score,
            recommendations,
        })
    }

    pub fn check_ats_compatibility(&self, content: &str) -> ATSCompatibilityReport {
        let mut issues = Vec::new();
        let mut keyword_count = 0;
        let mut formatting_issues = 0;
        let mut structure_issues = 0;

        // Check for common ATS keywords
        let content_lower = content.to_lowercase();
        for keyword in &self.common_ats_keywords {
            if content_lower.contains(keyword) {
                keyword_count += 1;
            }
        }

        // Check formatting
        for rule in &self.formatting_rules {
            if rule.pattern.is_match(content) {
                formatting_issues += 1;
                issues.push(ATSIssue {
                    severity: rule.severity.clone(),
                    category: "formatting".to_string(),
                    message: rule.message.clone(),
                    suggestion: format!("Review and simplify formatting in affected sections"),
                });
            }
        }

        // Check structure
        if !content.contains("Experience") && !content.contains("Work History") {
            structure_issues += 1;
            issues.push(ATSIssue {
                severity: "warning".to_string(),
                category: "structure".to_string(),
                message: "Missing experience section".to_string(),
                suggestion: "Add a clear experience or work history section".to_string(),
            });
        }

        if !content.contains("Education") {
            structure_issues += 1;
            issues.push(ATSIssue {
                severity: "info".to_string(),
                category: "structure".to_string(),
                message: "Missing education section".to_string(),
                suggestion: "Consider adding an education section".to_string(),
            });
        }

        // Check for proper sections
        let has_summary = content.contains("Summary") || content.contains("Objective");
        if !has_summary {
            structure_issues += 1;
            issues.push(ATSIssue {
                severity: "warning".to_string(),
                category: "structure".to_string(),
                message: "Missing professional summary".to_string(),
                suggestion: "Add a professional summary at the top".to_string(),
            });
        }

        // Calculate scores
        let keyword_score = (keyword_count as f64 / self.common_ats_keywords.len() as f64 * 100.0).min(100.0);
        let formatting_score = if formatting_issues == 0 {
            100.0
        } else {
            100.0 - (formatting_issues as f64 * 15.0).min(60.0)
        };
        let structure_score = if structure_issues == 0 {
            100.0
        } else {
            100.0 - (structure_issues as f64 * 20.0).min(60.0)
        };

        let overall_score = keyword_score * 0.4 + formatting_score * 0.3 + structure_score * 0.3;

        // Generate recommendations
        let mut recommendations = Vec::new();
        if keyword_score < 50.0 {
            recommendations.push("Add more industry-standard keywords and skills".to_string());
        }
        if formatting_score < 80.0 {
            recommendations.push("Simplify formatting and remove special characters".to_string());
        }
        if structure_score < 80.0 {
            recommendations.push("Ensure all standard resume sections are present".to_string());
        }
        if overall_score < 70.0 {
            recommendations.push("Review and improve overall ATS compatibility".to_string());
        }

        ATSCompatibilityReport {
            overall_score,
            keyword_score,
            formatting_score,
            structure_score,
            issues,
            recommendations,
        }
    }

    fn find_or_create_skills_section(&self, content: &str) -> Option<String> {
        // Look for skills section
        let skills_patterns = vec![
            r"(?i)skills?\s*:",
            r"(?i)technical\s+skills?\s*:",
            r"(?i)core\s+skills?\s*:",
        ];

        for pattern in skills_patterns {
            if let Ok(re) = Regex::new(pattern) {
                if let Some(mat) = re.find(content) {
                    // Extract the skills section
                    let start = mat.end();
                    let remaining = &content[start..];
                    let end = remaining
                        .find("\n\n")
                        .or_else(|| remaining.find("\n##"))
                        .unwrap_or(remaining.len());
                    return Some(remaining[..end].trim().to_string());
                }
            }
        }

        None
    }
}

impl Default for ATSOptimizer {
    fn default() -> Self {
        Self::new()
    }
}







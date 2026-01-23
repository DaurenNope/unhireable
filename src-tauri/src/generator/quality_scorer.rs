use crate::generator::{GeneratedDocument, JobAnalysis, UserProfile};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityScore {
    pub overall_score: f64,
    pub content_score: f64,
    pub relevance_score: f64,
    pub completeness_score: f64,
    pub professionalism_score: f64,
    pub ats_score: f64,
    pub details: QualityDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityDetails {
    pub word_count: usize,
    pub keyword_coverage: f64,
    pub section_completeness: HashMap<String, bool>,
    pub grammar_issues: Vec<String>,
    pub formatting_issues: Vec<String>,
    pub strengths: Vec<String>,
    pub weaknesses: Vec<String>,
}

pub struct QualityScorer;

impl QualityScorer {
    pub fn score_document(
        document: &GeneratedDocument,
        profile: &UserProfile,
        job_analysis: &JobAnalysis,
    ) -> QualityScore {
        let word_count = document.metadata.word_count;
        
        // Content score (based on length and structure)
        let content_score = Self::calculate_content_score(&document.content, word_count);
        
        // Relevance score (how well it matches the job)
        let relevance_score = Self::calculate_relevance_score(&document.content, job_analysis);
        
        // Completeness score (all sections present)
        let completeness_score = Self::calculate_completeness_score(&document.content, profile);
        
        // Professionalism score (tone, grammar, formatting)
        let professionalism_score = Self::calculate_professionalism_score(&document.content);
        
        // ATS score (keyword density, formatting)
        let ats_score = Self::calculate_ats_score(&document.content, job_analysis);
        
        // Overall weighted score
        let overall_score = 
            content_score * 0.15 +
            relevance_score * 0.30 +
            completeness_score * 0.20 +
            professionalism_score * 0.20 +
            ats_score * 0.15;

        let details = Self::generate_quality_details(
            &document.content,
            word_count,
            job_analysis,
            profile,
        );

        QualityScore {
            overall_score,
            content_score,
            relevance_score,
            completeness_score,
            professionalism_score,
            ats_score,
            details,
        }
    }

    fn calculate_content_score(content: &str, word_count: usize) -> f64 {
        let mut score = 100.0;

        // Word count check (ideal: 300-800 words for resume, 200-500 for cover letter)
        if word_count < 100 {
            score -= 30.0;
        } else if word_count < 200 {
            score -= 15.0;
        } else if word_count > 1000 {
            score -= 10.0;
        }

        // Check for empty sections
        let empty_sections = content
            .split("\n\n")
            .filter(|section| section.trim().is_empty() || section.trim().len() < 10)
            .count();
        score -= (empty_sections as f64 * 5.0).min(20.0);

        score.max(0.0).min(100.0)
    }

    fn calculate_relevance_score(content: &str, job_analysis: &JobAnalysis) -> f64 {
        let content_lower = content.to_lowercase();
        let mut matches = 0;
        let total_keywords = job_analysis.required_skills.len() + job_analysis.preferred_skills.len();

        if total_keywords == 0 {
            return 75.0; // Default score if no keywords
        }

        // Check required skills
        for skill in &job_analysis.required_skills {
            if content_lower.contains(&skill.to_lowercase()) {
                matches += 2; // Required skills count double
            }
        }

        // Check preferred skills
        for skill in &job_analysis.preferred_skills {
            if content_lower.contains(&skill.to_lowercase()) {
                matches += 1;
            }
        }

        let score = (matches as f64 / (total_keywords + job_analysis.required_skills.len()) as f64) * 100.0;
        score.max(0.0).min(100.0)
    }

    fn calculate_completeness_score(content: &str, profile: &UserProfile) -> f64 {
        let mut score: f64 = 100.0;
        let content_lower = content.to_lowercase();

        // Check for essential sections
        let required_sections = vec![
            ("summary", "Professional Summary"),
            ("experience", "Experience"),
            ("skills", "Skills"),
        ];

        for (keyword, _name) in required_sections {
            if !content_lower.contains(keyword) {
                score -= 15.0;
            }
        }

        // Check if profile data is reflected
        if !profile.experience.is_empty() && !content_lower.contains("experience") {
            score -= 10.0;
        }

        if !profile.skills.technical_skills.is_empty() && !content_lower.contains("skill") {
            score -= 10.0;
        }

        score.max(0.0).min(100.0)
    }

    fn calculate_professionalism_score(content: &str) -> f64 {
        let mut score: f64 = 100.0;

        // Check for casual language
        let casual_words = vec!["hey", "hi there", "cool", "awesome", "yeah", "gonna", "wanna"];
        let content_lower = content.to_lowercase();
        for word in casual_words {
            if content_lower.contains(word) {
                score -= 5.0;
            }
        }

        // Check for proper capitalization
        let sentences: Vec<&str> = content.split('.').collect();
        let capitalized_sentences = sentences
            .iter()
            .filter(|s| {
                let trimmed = s.trim();
                !trimmed.is_empty() && trimmed.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
            })
            .count();

        if sentences.len() > 1 {
            let capitalization_ratio = capitalized_sentences as f64 / sentences.len() as f64;
            if capitalization_ratio < 0.8 {
                score -= 10.0;
            }
        }

        // Check for excessive exclamation marks
        let exclamation_count = content.matches('!').count();
        if exclamation_count > 3 {
            score -= (exclamation_count as f64 - 3.0) * 2.0;
        }

        score.max(0.0).min(100.0)
    }

    fn calculate_ats_score(content: &str, job_analysis: &JobAnalysis) -> f64 {
        let content_lower = content.to_lowercase();
        let mut score: f64 = 100.0;

        // Check keyword density
        let total_keywords = job_analysis.required_skills.len() + job_analysis.preferred_skills.len();
        if total_keywords > 0 {
            let mut found_keywords = 0;
            for skill in job_analysis.required_skills.iter().chain(job_analysis.preferred_skills.iter()) {
                if content_lower.contains(&skill.to_lowercase()) {
                    found_keywords += 1;
                }
            }
            let keyword_coverage = found_keywords as f64 / total_keywords as f64;
            score = keyword_coverage * 100.0;
        }

        // Penalize special characters that ATS might not parse
        let special_char_count = content.matches(|c: char| {
            !c.is_ascii_alphanumeric() && !" -.,;:()[]{}@#%&*+=<>/\\|~`$".contains(c)
        }).count();
        if special_char_count > 10 {
            score -= (special_char_count as f64 - 10.0) * 0.5;
        }

        score.max(0.0).min(100.0)
    }

    fn generate_quality_details(
        content: &str,
        word_count: usize,
        job_analysis: &JobAnalysis,
        _profile: &UserProfile,
    ) -> QualityDetails {
        let content_lower = content.to_lowercase();
        
        // Calculate keyword coverage
        let total_keywords = job_analysis.required_skills.len() + job_analysis.preferred_skills.len();
        let found_keywords = job_analysis
            .required_skills
            .iter()
            .chain(job_analysis.preferred_skills.iter())
            .filter(|skill| content_lower.contains(&skill.to_lowercase()))
            .count();
        let keyword_coverage = if total_keywords > 0 {
            (found_keywords as f64 / total_keywords as f64) * 100.0
        } else {
            0.0
        };

        // Check section completeness
        let mut section_completeness = HashMap::new();
        section_completeness.insert("summary".to_string(), content_lower.contains("summary"));
        section_completeness.insert("experience".to_string(), content_lower.contains("experience"));
        section_completeness.insert("skills".to_string(), content_lower.contains("skill"));
        section_completeness.insert("education".to_string(), content_lower.contains("education"));

        // Basic grammar/formatting checks
        let mut grammar_issues = Vec::new();
        if content.matches("  ").count() > 5 {
            grammar_issues.push("Multiple consecutive spaces detected".to_string());
        }
        if content.lines().any(|line| line.len() > 100) {
            grammar_issues.push("Some lines are too long (consider breaking them)".to_string());
        }

        let mut formatting_issues = Vec::new();
        if content.matches('\t').count() > 0 {
            formatting_issues.push("Tabs detected - use spaces for better ATS compatibility".to_string());
        }
        if content.matches("```").count() > 0 {
            formatting_issues.push("Code blocks detected - remove for ATS compatibility".to_string());
        }

        // Generate strengths and weaknesses
        let mut strengths = Vec::new();
        let mut weaknesses = Vec::new();

        if keyword_coverage > 70.0 {
            strengths.push("Good keyword coverage for ATS systems".to_string());
        } else {
            weaknesses.push("Low keyword coverage - add more relevant skills".to_string());
        }

        if word_count >= 200 && word_count <= 800 {
            strengths.push("Appropriate length for the document type".to_string());
        } else if word_count < 200 {
            weaknesses.push("Document is too short - consider adding more detail".to_string());
        } else {
            weaknesses.push("Document may be too long - consider condensing".to_string());
        }

        if section_completeness.values().all(|&v| v) {
            strengths.push("All essential sections are present".to_string());
        } else {
            weaknesses.push("Some essential sections are missing".to_string());
        }

        QualityDetails {
            word_count,
            keyword_coverage,
            section_completeness,
            grammar_issues,
            formatting_issues,
            strengths,
            weaknesses,
        }
    }
}












use crate::db::models::Job;
use crate::generator::UserProfile;
use crate::matching::{JobMatchResult, skills_analyzer::SkillsAnalyzer};
use std::collections::HashSet;

/// Matches jobs to user profiles and calculates match scores
pub struct JobMatcher {
    weights: MatchWeights,
}

#[derive(Debug, Clone)]
pub struct MatchWeights {
    skills_weight: f64,      // Weight for skills matching (0.0 to 1.0)
    experience_weight: f64,  // Weight for experience level matching
    location_weight: f64,    // Weight for location matching
    title_weight: f64,       // Weight for job title matching
}

impl Default for MatchWeights {
    fn default() -> Self {
        Self {
            skills_weight: 0.5,      // 50% - most important
            experience_weight: 0.25,  // 25%
            location_weight: 0.15,    // 15%
            title_weight: 0.10,       // 10%
        }
    }
}

impl JobMatcher {
    pub fn new() -> Self {
        Self {
            weights: MatchWeights::default(),
        }
    }
    
    pub fn with_weights(weights: MatchWeights) -> Self {
        Self { weights }
    }
    
    /// Calculate match score for a single job
    pub fn calculate_match(&self, job: &Job, profile: &UserProfile) -> JobMatchResult {
        let mut result = JobMatchResult::new(job.clone());
        
        // Extract skills
        let job_skills = SkillsAnalyzer::extract_job_skills(job);
        let user_skills = SkillsAnalyzer::extract_user_skills(profile);
        
        // Calculate skills match
        let (skills_overlap, matched_skills, missing_skills) = 
            SkillsAnalyzer::calculate_skills_overlap(&job_skills, &user_skills);
        result.skills_match = skills_overlap;
        result.matched_skills = matched_skills;
        result.missing_skills = missing_skills;
        
        // Calculate experience level match
        result.experience_match = self.calculate_experience_match(job, profile);
        result.experience_level = self.determine_experience_level(job);
        
        // Calculate location match
        result.location_match = self.calculate_location_match(job, profile);
        
        // Calculate title match
        let title_match = self.calculate_title_match(job, profile);
        
        // Calculate overall match score
        result.match_score = 
            result.skills_match * self.weights.skills_weight +
            result.experience_match * self.weights.experience_weight +
            result.location_match * self.weights.location_weight +
            title_match * self.weights.title_weight;
        
        // Ensure score is between 0 and 100
        result.match_score = result.match_score.min(100.0).max(0.0);
        
        // Generate match reasons
        result.match_reasons = self.generate_match_reasons(&result);
        
        result
    }
    
    /// Calculate experience level match
    fn calculate_experience_match(&self, job: &Job, profile: &UserProfile) -> f64 {
        let job_level = self.determine_experience_level(job);
        let user_level = self.determine_user_experience_level(profile);
        
        match (job_level.as_str(), user_level.as_str()) {
            (job, user) if job == user => 100.0,
            ("entry", "mid") | ("mid", "senior") | ("senior", "lead") => 75.0,
            ("entry", "senior") | ("mid", "lead") => 50.0,
            ("entry", "lead") => 25.0,
            ("mid", "entry") | ("senior", "mid") | ("lead", "senior") => 60.0,
            ("senior", "entry") | ("lead", "mid") => 40.0,
            ("lead", "entry") => 20.0,
            _ => 50.0, // Unknown levels
        }
    }
    
    /// Determine experience level from job description
    fn determine_experience_level(&self, job: &Job) -> String {
        let text = format!(
            "{} {} {}",
            job.title,
            job.description.as_deref().unwrap_or(""),
            job.requirements.as_deref().unwrap_or("")
        ).to_lowercase();
        
        if text.contains("senior") || text.contains("sr.") || text.contains("lead") || 
           text.contains("principal") || text.contains("architect") {
            "senior".to_string()
        } else if text.contains("junior") || text.contains("jr.") || text.contains("entry") ||
                  text.contains("intern") || text.contains("graduate") {
            "entry".to_string()
        } else if text.contains("mid") || text.contains("intermediate") {
            "mid".to_string()
        } else {
            "mid".to_string() // Default to mid-level
        }
    }
    
    /// Determine user experience level from profile
    fn determine_user_experience_level(&self, profile: &UserProfile) -> String {
        let total_years: u32 = profile.skills.experience_years.values().sum();
        let exp_count = profile.experience.len();
        
        if total_years >= 7 || exp_count >= 5 {
            "senior".to_string()
        } else if total_years >= 3 || exp_count >= 2 {
            "mid".to_string()
        } else {
            "entry".to_string()
        }
    }
    
    /// Calculate location match
    fn calculate_location_match(&self, job: &Job, profile: &UserProfile) -> f64 {
        let job_location = job.location.as_deref().unwrap_or("").to_lowercase();
        let user_location = profile.personal_info.location.as_deref().unwrap_or("").to_lowercase();
        
        // If no location specified, give neutral score
        if job_location.is_empty() || user_location.is_empty() {
            return 50.0;
        }
        
        // Check for remote work
        if job_location.contains("remote") || job_location.contains("anywhere") {
            return 100.0; // Remote jobs match everyone
        }
        
        // Simple location matching (could be improved with geocoding)
        if job_location.contains(&user_location) || user_location.contains(&job_location) {
            return 100.0;
        }
        
        // Partial match (e.g., "San Francisco" vs "SF")
        let job_words: Vec<&str> = job_location.split_whitespace().collect();
        let user_words: Vec<&str> = user_location.split_whitespace().collect();
        
        for job_word in &job_words {
            for user_word in &user_words {
                if job_word.len() > 3 && user_word.len() > 3 && 
                   job_word.contains(user_word) || user_word.contains(job_word) {
                    return 75.0;
                }
            }
        }
        
        0.0 // No match
    }
    
    /// Calculate job title match
    fn calculate_title_match(&self, job: &Job, profile: &UserProfile) -> f64 {
        let job_title = job.title.to_lowercase();
        let user_experience: Vec<String> = profile.experience.iter()
            .map(|e| e.position.to_lowercase())
            .collect();
        
        // Check if user has similar position titles
        for exp_title in &user_experience {
            if self.titles_similar(&job_title, exp_title) {
                return 100.0;
            }
        }
        
        // Check for keyword matches
        let job_keywords: Vec<&str> = job_title.split_whitespace().collect();
        for exp in &profile.experience {
            let exp_lower = exp.position.to_lowercase();
            for keyword in &job_keywords {
                if keyword.len() > 3 && exp_lower.contains(keyword) {
                    return 60.0;
                }
            }
        }
        
        30.0 // Default partial match
    }
    
    /// Check if two job titles are similar
    fn titles_similar(&self, title1: &str, title2: &str) -> bool {
        // Simple similarity check (could be improved with NLP)
        let words1: HashSet<&str> = title1.split_whitespace().collect();
        let words2: HashSet<&str> = title2.split_whitespace().collect();
        
        let intersection: HashSet<&str> = words1.intersection(&words2).cloned().collect();
        let union: HashSet<&str> = words1.union(&words2).cloned().collect();
        
        if union.is_empty() {
            return false;
        }
        
        let similarity = intersection.len() as f64 / union.len() as f64;
        similarity > 0.5 // More than 50% word overlap
    }
    
    /// Generate human-readable match reasons
    fn generate_match_reasons(&self, result: &JobMatchResult) -> Vec<String> {
        let mut reasons = Vec::new();
        
        if result.skills_match >= 80.0 {
            reasons.push(format!("Excellent skills match: {}% of required skills", result.skills_match as u32));
        } else if result.skills_match >= 60.0 {
            reasons.push(format!("Good skills match: {}% of required skills", result.skills_match as u32));
        } else if result.skills_match >= 40.0 {
            reasons.push(format!("Fair skills match: {}% of required skills", result.skills_match as u32));
        } else {
            reasons.push(format!("Limited skills match: {}% of required skills", result.skills_match as u32));
        }
        
        if !result.matched_skills.is_empty() {
            reasons.push(format!("Matched skills: {}", result.matched_skills.join(", ")));
        }
        
        if result.experience_match >= 80.0 {
            reasons.push(format!("Experience level matches: {}", result.experience_level));
        }
        
        if result.location_match >= 80.0 {
            reasons.push("Location is a good match".to_string());
        }
        
        if reasons.is_empty() {
            reasons.push("Basic match based on job requirements".to_string());
        }
        
        reasons
    }
    
    /// Match multiple jobs and return sorted by match score
    pub fn match_jobs(&self, jobs: &[Job], profile: &UserProfile) -> Vec<JobMatchResult> {
        let mut results: Vec<JobMatchResult> = jobs.iter()
            .map(|job| self.calculate_match(job, profile))
            .collect();
        
        // Sort by match score (descending)
        results.sort_by(|a, b| b.match_score.partial_cmp(&a.match_score).unwrap_or(std::cmp::Ordering::Equal));
        
        results
    }
    
    /// Filter jobs by minimum match score
    pub fn filter_by_score(&self, results: &[JobMatchResult], min_score: f64) -> Vec<JobMatchResult> {
        results.iter()
            .filter(|r| r.match_score >= min_score)
            .cloned()
            .collect()
    }
}

impl Default for JobMatcher {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::{Job, JobStatus};
    use crate::generator::{UserProfile, PersonalInfo, SkillsProfile, ExperienceEntry};
    use std::collections::HashMap;
    
    fn create_test_job() -> Job {
        Job {
            id: Some(1),
            title: "Senior React Developer".to_string(),
            company: "Test Corp".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("We are looking for a senior React developer with TypeScript experience. Must know Node.js, Docker, and REST APIs. Remote work available.".to_string()),
            requirements: Some("5+ years of experience with React, TypeScript, Node.js required. Docker experience preferred.".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        }
    }
    
    fn create_test_profile() -> UserProfile {
        UserProfile {
            personal_info: PersonalInfo {
                name: "Test User".to_string(),
                email: "test@example.com".to_string(),
                phone: None,
                location: Some("San Francisco, CA".to_string()),
                linkedin: None,
                github: None,
                portfolio: None,
            },
            summary: "Experienced React developer".to_string(),
            skills: SkillsProfile {
                technical_skills: vec!["React".to_string(), "TypeScript".to_string(), "Node.js".to_string()],
                soft_skills: vec!["Communication".to_string()],
                experience_years: {
                    let mut map = HashMap::new();
                    map.insert("React".to_string(), 5);
                    map.insert("TypeScript".to_string(), 4);
                    map.insert("Node.js".to_string(), 3);
                    map
                },
                proficiency_levels: HashMap::new(),
            },
            experience: vec![
                ExperienceEntry {
                    company: "Company A".to_string(),
                    position: "Senior Frontend Developer".to_string(),
                    duration: "3 years".to_string(),
                    description: vec!["Built React applications".to_string()],
                    technologies: vec!["React".to_string(), "TypeScript".to_string(), "Node.js".to_string()],
                }
            ],
            education: vec![],
            projects: vec![],
        }
    }
    
    #[test]
    fn test_calculate_match() {
        let matcher = JobMatcher::new();
        let job = create_test_job();
        let profile = create_test_profile();
        
        let result = matcher.calculate_match(&job, &profile);
        
        assert!(result.match_score > 0.0);
        assert!(result.match_score <= 100.0);
        assert!(result.skills_match > 0.0);
        assert!(!result.matched_skills.is_empty());
        assert_eq!(result.job_id, Some(1));
    }
    
    #[test]
    fn test_experience_level_determination() {
        let matcher = JobMatcher::new();
        let job = create_test_job();
        
        let level = matcher.determine_experience_level(&job);
        assert_eq!(level, "senior");
    }
    
    #[test]
    fn test_location_match_remote() {
        let matcher = JobMatcher::new();
        let job = create_test_job(); // Remote job
        let profile = create_test_profile();
        
        let match_score = matcher.calculate_location_match(&job, &profile);
        assert_eq!(match_score, 100.0); // Remote matches everyone
    }
    
    #[test]
    fn test_match_jobs() {
        let matcher = JobMatcher::new();
        let jobs = vec![create_test_job()];
        let profile = create_test_profile();
        
        let results = matcher.match_jobs(&jobs, &profile);
        
        assert_eq!(results.len(), 1);
        assert!(results[0].match_score > 0.0);
    }
    
    #[test]
    fn test_filter_by_score() {
        let matcher = JobMatcher::new();
        let job = create_test_job();
        let profile = create_test_profile();
        
        let result = matcher.calculate_match(&job, &profile);
        let results = vec![result.clone()];
        
        let filtered = matcher.filter_by_score(&results, 50.0);
        
        if result.match_score >= 50.0 {
            assert_eq!(filtered.len(), 1);
        } else {
            assert_eq!(filtered.len(), 0);
        }
    }
}


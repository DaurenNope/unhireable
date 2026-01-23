use crate::db::models::{Job, SavedSearchFilters};
use crate::filtering::questionnaire::{FilterCriteria, JobQuestionnaire};
use crate::matching::skills_analyzer::SkillsAnalyzer;

/// Smart filtering system that applies questionnaire-based filters to jobs
pub struct SmartFilter;

impl SmartFilter {
    /// Filter jobs based on questionnaire answers
    pub fn filter_jobs(jobs: &[Job], questionnaire: &JobQuestionnaire) -> Vec<Job> {
        let criteria = questionnaire.to_filter_criteria();
        jobs.iter()
            .filter(|job| Self::job_matches_criteria(job, &criteria))
            .cloned()
            .collect()
    }

    /// Check if a job matches the filter criteria
    fn job_matches_criteria(job: &Job, criteria: &FilterCriteria) -> bool {
        // Remote preference
        if criteria.remote_only {
            if let Some(location) = &job.location {
                let location_lower = location.to_lowercase();
                if !location_lower.contains("remote")
                    && !location_lower.contains("anywhere")
                    && !location_lower.contains("global")
                {
                    return false;
                }
            } else {
                return false; // No location info, assume not remote
            }
        }

        // Preferred locations (for hybrid/onsite)
        if !criteria.preferred_locations.is_empty() {
            if let Some(location) = &job.location {
                let location_lower = location.to_lowercase();
                let matches_location = criteria
                    .preferred_locations
                    .iter()
                    .any(|pref| location_lower.contains(&pref.to_lowercase()));
                if !matches_location {
                    return false;
                }
            }
        }

        // Title keywords
        if !criteria.title_keywords.is_empty() {
            let title_lower = job.title.to_lowercase();
            let matches_title = criteria
                .title_keywords
                .iter()
                .any(|keyword| title_lower.contains(&keyword.to_lowercase()));
            if !matches_title {
                return false;
            }
        }

        // Avoid companies
        if !criteria.avoid_companies.is_empty() {
            let company_lower = job.company.to_lowercase();
            if criteria
                .avoid_companies
                .iter()
                .any(|avoid| company_lower.contains(&avoid.to_lowercase()))
            {
                return false;
            }
        }

        // Required skills
        if !criteria.required_skills.is_empty() {
            let job_skills = SkillsAnalyzer::extract_job_skills(job);
            let normalized_job_skills: Vec<String> = job_skills
                .iter()
                .map(|s| SkillsAnalyzer::normalize_skill(s))
                .collect();

            let has_all_required = criteria.required_skills.iter().all(|req_skill| {
                let normalized_req = SkillsAnalyzer::normalize_skill(req_skill);
                normalized_job_skills
                    .iter()
                    .any(|js| js.contains(&normalized_req) || normalized_req.contains(js))
            });

            if !has_all_required {
                return false;
            }
        }

        // Preferred companies (boost but don't require)
        // This is handled in scoring, not filtering

        // Minimum salary
        if let Some(min_salary) = criteria.min_salary {
            if let Some(salary_str) = &job.salary {
                // Try to extract salary from string (e.g., "$120,000 - $150,000")
                if let Some(extracted_salary) = Self::extract_salary(salary_str) {
                    if extracted_salary < min_salary as f64 {
                        return false;
                    }
                }
            }
        }

        // Job types - check description/requirements for keywords
        if !criteria.job_types.is_empty() {
            let job_type_keywords: Vec<&str> = criteria
                .job_types
                .iter()
                .map(|jt| match jt {
                    crate::filtering::questionnaire::JobType::FullTime => "full-time",
                    crate::filtering::questionnaire::JobType::PartTime => "part-time",
                    crate::filtering::questionnaire::JobType::Contract => "contract",
                    crate::filtering::questionnaire::JobType::Internship => "internship",
                    crate::filtering::questionnaire::JobType::Freelance => "freelance",
                })
                .collect();

            let job_text = format!(
                "{} {} {}",
                job.title,
                job.description.as_deref().unwrap_or(""),
                job.requirements.as_deref().unwrap_or("")
            )
            .to_lowercase();

            let matches_type = job_type_keywords
                .iter()
                .any(|keyword| job_text.contains(keyword));

            if !matches_type {
                return false;
            }
        }

        true
    }

    /// Extract numeric salary from salary string
    fn extract_salary(salary_str: &str) -> Option<f64> {
        // Remove currency symbols and commas
        let cleaned = salary_str
            .replace("$", "")
            .replace(",", "")
            .replace("€", "")
            .replace("£", "")
            .trim()
            .to_string();

        // Try to find a number (prefer the first/maximum)
        let numbers: Vec<f64> = cleaned
            .split_whitespace()
            .filter_map(|s| {
                if let Ok(value) = s.parse::<f64>() {
                    Some(value)
                } else if let Some(stripped) = s.strip_suffix(['k', 'K']) {
                    stripped.parse::<f64>().ok().map(|value| value * 1000.0)
                } else {
                    None
                }
            })
            .collect();

        numbers
            .into_iter()
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
    }

    /// Score a job based on how well it matches the questionnaire
    pub fn score_job_match(job: &Job, questionnaire: &JobQuestionnaire) -> f64 {
        let mut score = 0.0;
        let mut max_score = 0.0;

        // Preferred companies (20 points)
        max_score += 20.0;
        if !questionnaire.preferred_companies.is_empty() {
            let company_lower = job.company.to_lowercase();
            if questionnaire
                .preferred_companies
                .iter()
                .any(|pref| company_lower.contains(&pref.to_lowercase()))
            {
                score += 20.0;
            }
        }

        // Preferred skills (30 points)
        max_score += 30.0;
        if !questionnaire.preferred_skills.is_empty() {
            let job_skills = SkillsAnalyzer::extract_job_skills(job);
            let normalized_job_skills: Vec<String> = job_skills
                .iter()
                .map(|s| SkillsAnalyzer::normalize_skill(s))
                .collect();

            let matching_skills = questionnaire
                .preferred_skills
                .iter()
                .filter(|pref_skill| {
                    let normalized_pref = SkillsAnalyzer::normalize_skill(pref_skill);
                    normalized_job_skills
                        .iter()
                        .any(|js| js.contains(&normalized_pref) || normalized_pref.contains(js))
                })
                .count();

            if !questionnaire.preferred_skills.is_empty() {
                score +=
                    (matching_skills as f64 / questionnaire.preferred_skills.len() as f64) * 30.0;
            }
        }

        // Preferred titles (15 points)
        max_score += 15.0;
        if !questionnaire.preferred_titles.is_empty() {
            let title_lower = job.title.to_lowercase();
            if questionnaire
                .preferred_titles
                .iter()
                .any(|pref| title_lower.contains(&pref.to_lowercase()))
            {
                score += 15.0;
            }
        }

        // Salary match (15 points)
        max_score += 15.0;
        if let Some(min_salary) = questionnaire.min_salary {
            if let Some(salary_str) = &job.salary {
                if let Some(extracted_salary) = Self::extract_salary(salary_str) {
                    if extracted_salary >= min_salary as f64 {
                        score += 15.0;
                    } else {
                        // Partial credit if close
                        let ratio = extracted_salary / min_salary as f64;
                        if ratio >= 0.8 {
                            score += 10.0;
                        }
                    }
                }
            }
        }

        // Benefits (10 points)
        max_score += 10.0;
        if !questionnaire.must_have_benefits.is_empty() {
            let job_text = format!(
                "{} {}",
                job.description.as_deref().unwrap_or(""),
                job.requirements.as_deref().unwrap_or("")
            )
            .to_lowercase();

            let matching_benefits = questionnaire
                .must_have_benefits
                .iter()
                .filter(|benefit| job_text.contains(&benefit.to_lowercase()))
                .count();

            if !questionnaire.must_have_benefits.is_empty() {
                score += (matching_benefits as f64 / questionnaire.must_have_benefits.len() as f64)
                    * 10.0;
            }
        }

        // Base score from existing match_score (10 points)
        max_score += 10.0;
        if let Some(existing_score) = job.match_score {
            score += (existing_score / 100.0) * 10.0;
        }

        // Normalize to 0-100
        if max_score > 0.0 {
            (score / max_score) * 100.0
        } else {
            0.0
        }
    }

    /// Filter jobs using SavedSearchFilters (enhanced version)
    pub fn filter_jobs_with_saved_search_filters(
        jobs: &[Job],
        filters: &SavedSearchFilters,
        min_match_score: i32,
    ) -> Vec<Job> {
        jobs.iter()
            .filter(|job| {
                // Remote only
                if filters.remote_only {
                    if let Some(location) = &job.location {
                        let location_lower = location.to_lowercase();
                        if !location_lower.contains("remote")
                            && !location_lower.contains("anywhere")
                            && !location_lower.contains("global")
                        {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }

                // Preferred locations
                if !filters.preferred_locations.is_empty() {
                    if let Some(location) = &job.location {
                        let location_lower = location.to_lowercase();
                        if !filters
                            .preferred_locations
                            .iter()
                            .any(|pref| location_lower.contains(&pref.to_lowercase()))
                        {
                            return false;
                        }
                    }
                }

                // Title keywords
                if !filters.preferred_titles.is_empty() {
                    let title_lower = job.title.to_lowercase();
                    if !filters
                        .preferred_titles
                        .iter()
                        .any(|keyword| title_lower.contains(&keyword.to_lowercase()))
                    {
                        return false;
                    }
                }

                // Avoid companies
                if !filters.avoid_companies.is_empty() {
                    let company_lower = job.company.to_lowercase();
                    if filters
                        .avoid_companies
                        .iter()
                        .any(|avoid| company_lower.contains(&avoid.to_lowercase()))
                    {
                        return false;
                    }
                }

                // Required skills
                if !filters.required_skills.is_empty() {
                    let job_skills = SkillsAnalyzer::extract_job_skills(job);
                    let normalized_job_skills: Vec<String> = job_skills
                        .iter()
                        .map(|s| SkillsAnalyzer::normalize_skill(s))
                        .collect();

                    let has_all_required = filters.required_skills.iter().all(|req_skill| {
                        let normalized_req = SkillsAnalyzer::normalize_skill(req_skill);
                        normalized_job_skills
                            .iter()
                            .any(|js| js.contains(&normalized_req) || normalized_req.contains(js))
                    });

                    if !has_all_required {
                        return false;
                    }
                }

                // Legacy skill_filter (backward compatibility)
                if let Some(skill_filter) = &filters.skill_filter {
                    let skill_lower = skill_filter.to_lowercase();
                    let matches_title = job.title.to_lowercase().contains(&skill_lower);
                    let matches_desc = job
                        .description
                        .as_ref()
                        .map(|d| d.to_lowercase().contains(&skill_lower))
                        .unwrap_or(false);
                    let matches_req = job
                        .requirements
                        .as_ref()
                        .map(|r| r.to_lowercase().contains(&skill_lower))
                        .unwrap_or(false);

                    if !matches_title && !matches_desc && !matches_req {
                        return false;
                    }
                }

                // Minimum salary
                if let Some(min_salary) = filters.min_salary {
                    if let Some(salary_str) = &job.salary {
                        if let Some(extracted_salary) = Self::extract_salary(salary_str) {
                            if extracted_salary < min_salary as f64 {
                                return false;
                            }
                        }
                    }
                }

                // Job types
                if !filters.job_types.is_empty() {
                    let job_text = format!(
                        "{} {} {}",
                        job.title,
                        job.description.as_deref().unwrap_or(""),
                        job.requirements.as_deref().unwrap_or("")
                    )
                    .to_lowercase();

                    let matches_type = filters
                        .job_types
                        .iter()
                        .any(|job_type| job_text.contains(&job_type.to_lowercase()));

                    if !matches_type {
                        return false;
                    }
                }

                // Match score
                let score_threshold = filters
                    .min_match_score
                    .map(|s| s as i32)
                    .unwrap_or(min_match_score);

                if score_threshold > 0 {
                    if let Some(score) = job.match_score {
                        if (score as i32) < score_threshold {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }

                // Status filter
                if let Some(status_filter) = &filters.status {
                    if status_filter != "all" {
                        if job.status.to_string() != *status_filter {
                            return false;
                        }
                    }
                }

                true
            })
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::JobStatus;

    #[test]
    fn test_extract_salary() {
        assert_eq!(
            SmartFilter::extract_salary("$120,000 - $150,000"),
            Some(150000.0)
        );
        assert_eq!(SmartFilter::extract_salary("$80k"), Some(80000.0));
        assert_eq!(SmartFilter::extract_salary("€60,000"), Some(60000.0));
    }

    #[test]
    fn test_filter_remote_only() {
        let questionnaire = JobQuestionnaire {
            remote_preference: crate::filtering::questionnaire::RemotePreference::RemoteOnly,
            job_types: Vec::new(),
            ..Default::default()
        };

        let remote_job = Job {
            id: Some(1),
            title: "Software Engineer".to_string(),
            company: "Acme".to_string(),
            url: "https://example.com/remote".to_string(),
            description: None,
            requirements: None,
            location: Some("Remote".to_string()),
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        };

        let onsite_job = Job {
            id: Some(2),
            title: "Software Engineer".to_string(),
            company: "Acme".to_string(),
            url: "https://example.com/onsite".to_string(),
            description: None,
            requirements: None,
            location: Some("San Francisco, CA".to_string()),
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        };

        let jobs = vec![remote_job.clone(), onsite_job.clone()];
        let filtered = SmartFilter::filter_jobs(&jobs, &questionnaire);

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, Some(1));
    }
}

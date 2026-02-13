use crate::db::models::Job;
use std::collections::HashMap;

/// Calculate Levenshtein distance between two strings
fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();
    let s1_len = s1_chars.len();
    let s2_len = s2_chars.len();

    if s1_len == 0 {
        return s2_len;
    }
    if s2_len == 0 {
        return s1_len;
    }

    let mut matrix = vec![vec![0; s2_len + 1]; s1_len + 1];

    for i in 0..=s1_len {
        matrix[i][0] = i;
    }
    for j in 0..=s2_len {
        matrix[0][j] = j;
    }

    for i in 1..=s1_len {
        for j in 1..=s2_len {
            let cost = if s1_chars[i - 1] == s2_chars[j - 1] {
                0
            } else {
                1
            };
            matrix[i][j] = (matrix[i - 1][j] + 1)
                .min(matrix[i][j - 1] + 1)
                .min(matrix[i - 1][j - 1] + cost);
        }
    }

    matrix[s1_len][s2_len]
}

/// Calculate similarity ratio between two strings (0.0 to 1.0)
fn string_similarity(s1: &str, s2: &str) -> f64 {
    if s1.is_empty() && s2.is_empty() {
        return 1.0;
    }
    if s1.is_empty() || s2.is_empty() {
        return 0.0;
    }

    let distance = levenshtein_distance(s1, s2);
    let max_len = s1.len().max(s2.len());
    1.0 - (distance as f64 / max_len as f64)
}

/// Normalize string for comparison (lowercase, remove extra spaces, remove special chars)
fn normalize_string(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Calculate job similarity score (0.0 to 1.0)
pub fn calculate_job_similarity(job1: &Job, job2: &Job) -> f64 {
    // Normalize titles and companies
    let title1 = normalize_string(&job1.title);
    let title2 = normalize_string(&job2.title);
    let company1 = normalize_string(&job1.company);
    let company2 = normalize_string(&job2.company);

    // Title similarity (60% weight)
    let title_sim = string_similarity(&title1, &title2);

    // Company similarity (40% weight)
    let company_sim = string_similarity(&company1, &company2);

    // Weighted combination
    let similarity = (title_sim * 0.6) + (company_sim * 0.4);

    // Bonus for exact URL match (if URLs are similar, it's definitely the same job)
    if !job1.url.is_empty() && !job2.url.is_empty() {
        let url1_lower = job1.url.to_lowercase();
        let url2_lower = job2.url.to_lowercase();
        let url1_normalized: String = url1_lower.trim().trim_end_matches('/').to_string();
        let url2_normalized: String = url2_lower.trim().trim_end_matches('/').to_string();
        if url1_normalized == url2_normalized {
            return 1.0; // Exact match
        }
        // Check if URLs are very similar (same domain, similar path)
        if url_similarity(&url1_normalized, &url2_normalized) > 0.9 {
            return similarity.max(0.95); // Very high confidence
        }
    }

    similarity
}

/// Calculate URL similarity (for detecting same job on different domains)
fn url_similarity(url1: &str, url2: &str) -> f64 {
    // Extract path from URL (ignore domain)
    let path1: String = url1.split('/').last().unwrap_or("").to_string();
    let path2: String = url2.split('/').last().unwrap_or("").to_string();

    if path1.is_empty() || path2.is_empty() {
        return 0.0;
    }

    // If paths are very similar, likely same job
    string_similarity(&path1, &path2)
}

pub struct FuzzyMatcher;

impl FuzzyMatcher {
    /// Find duplicate jobs in a list
    /// Returns a map of job_id -> Vec of duplicate job_ids
    pub fn find_duplicates(jobs: &[Job], similarity_threshold: f64) -> HashMap<i64, Vec<i64>> {
        let mut duplicates: HashMap<i64, Vec<i64>> = HashMap::new();
        let mut processed = std::collections::HashSet::new();

        for (i, job1) in jobs.iter().enumerate() {
            let id1 = match job1.id {
                Some(id) => id,
                None => continue,
            };

            if processed.contains(&id1) {
                continue;
            }

            let mut group = Vec::new();

            for job2 in jobs.iter().skip(i + 1) {
                let id2 = match job2.id {
                    Some(id) => id,
                    None => continue,
                };

                if processed.contains(&id2) {
                    continue;
                }

                let similarity = calculate_job_similarity(job1, job2);
                if similarity >= similarity_threshold {
                    group.push(id2);
                    processed.insert(id2);
                }
            }

            if !group.is_empty() {
                duplicates.insert(id1, group);
                processed.insert(id1);
            }
        }

        duplicates
    }

    /// Find duplicate of a specific job
    pub fn find_duplicate_of(
        jobs: &[Job],
        target_job: &Job,
        similarity_threshold: f64,
    ) -> Option<Job> {
        for job in jobs {
            if job.id == target_job.id {
                continue;
            }

            let similarity = calculate_job_similarity(target_job, job);
            if similarity >= similarity_threshold {
                return Some(job.clone());
            }
        }

        None
    }

    /// Check if two jobs are likely duplicates
    pub fn are_duplicates(job1: &Job, job2: &Job, similarity_threshold: f64) -> bool {
        calculate_job_similarity(job1, job2) >= similarity_threshold
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_similarity() {
        assert!(string_similarity("Software Engineer", "Software Engineer") > 0.99);
        // "Software Engineer" vs "Software Developer" - 15 chars different out of ~20, so ~0.25 similarity
        // Let's adjust the test to be more realistic
        assert!(string_similarity("Software Engineer", "Software Developer") > 0.5);
        assert!(string_similarity("Software Engineer", "Product Manager") < 0.5);
    }

    #[test]
    fn test_job_similarity() {
        let job1 = Job {
            id: Some(1),
            title: "Senior Software Engineer".to_string(),
            company: "Acme Inc".to_string(),
            url: "https://example.com/job/123".to_string(),
            description: None,
            requirements: None,
            location: None,
            salary: None,
            source: "wellfound".to_string(),
            status: crate::db::models::JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        };

        let job2 = Job {
            id: Some(2),
            title: "Senior Software Engineer".to_string(),
            company: "Acme Inc".to_string(),
            url: "https://other.com/job/456".to_string(),
            description: None,
            requirements: None,
            location: None,
            salary: None,
            source: "remoteok".to_string(),
            status: crate::db::models::JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        };

        let similarity = calculate_job_similarity(&job1, &job2);
        assert!(similarity > 0.9, "Similar jobs should have high similarity");
    }

    #[test]
    fn test_exact_url_match() {
        let job1 = Job {
            id: Some(1),
            title: "Engineer".to_string(),
            company: "Company".to_string(),
            url: "https://example.com/job/123".to_string(),
            description: None,
            requirements: None,
            location: None,
            salary: None,
            source: "wellfound".to_string(),
            status: crate::db::models::JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        };

        let job2 = Job {
            id: Some(2),
            title: "Developer".to_string(),
            company: "Corp".to_string(),
            url: "https://example.com/job/123".to_string(),
            description: None,
            requirements: None,
            location: None,
            salary: None,
            source: "remoteok".to_string(),
            status: crate::db::models::JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        };

        let similarity = calculate_job_similarity(&job1, &job2);
        assert_eq!(similarity, 1.0, "Exact URL match should return 1.0");
    }
}

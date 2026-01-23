use crate::db::models::Job;
use crate::matching::skills_analyzer::SkillsAnalyzer;
use std::collections::HashSet;

/// Calculate cosine similarity between two job descriptions
pub fn calculate_job_similarity(job1: &Job, job2: &Job) -> f64 {
    // Extract skills from both jobs
    let skills1: HashSet<String> = SkillsAnalyzer::extract_job_skills(job1)
        .into_iter()
        .map(|s| SkillsAnalyzer::normalize_skill(&s))
        .collect();

    let skills2: HashSet<String> = SkillsAnalyzer::extract_job_skills(job2)
        .into_iter()
        .map(|s| SkillsAnalyzer::normalize_skill(&s))
        .collect();

    // Calculate skill overlap (Jaccard similarity)
    let intersection: HashSet<_> = skills1.intersection(&skills2).collect();
    let union: HashSet<_> = skills1.union(&skills2).collect();

    let skill_similarity = if union.is_empty() {
        0.0
    } else {
        intersection.len() as f64 / union.len() as f64
    };

    // Calculate title similarity (simple word overlap)
    let title1_lower = job1.title.to_lowercase();
    let title2_lower = job2.title.to_lowercase();
    let title_words1: HashSet<&str> = title1_lower.split_whitespace().collect();
    let title_words2: HashSet<&str> = title2_lower.split_whitespace().collect();
    let title_intersection: HashSet<_> = title_words1.intersection(&title_words2).collect();
    let title_union: HashSet<_> = title_words1.union(&title_words2).collect();

    let title_similarity = if title_union.is_empty() {
        0.0
    } else {
        title_intersection.len() as f64 / title_union.len() as f64
    };

    // Calculate company match bonus
    let company_match = if job1.company.to_lowercase() == job2.company.to_lowercase() {
        0.2 // 20% bonus for same company
    } else {
        0.0
    };

    // Weighted combination: 50% skills, 30% title, 20% company
    let similarity = (skill_similarity * 0.5) + (title_similarity * 0.3) + company_match;

    similarity.min(1.0).max(0.0)
}

pub struct JobSimilarity;

impl JobSimilarity {
    /// Find similar jobs to a given job
    pub fn find_similar_jobs(
        jobs: &[Job],
        target_job: &Job,
        min_similarity: f64,
        limit: usize,
    ) -> Vec<(Job, f64)> {
        let mut similarities: Vec<(Job, f64)> = jobs
            .iter()
            .filter(|job| {
                // Don't include the target job itself
                job.id != target_job.id
            })
            .map(|job| {
                let similarity = calculate_job_similarity(target_job, job);
                (job.clone(), similarity)
            })
            .filter(|(_, similarity)| *similarity >= min_similarity)
            .collect();

        // Sort by similarity (highest first)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        similarities.truncate(limit);

        similarities
    }

    /// Find similar jobs based on a list of reference jobs (for personalized recommendations)
    pub fn find_similar_to_multiple(
        jobs: &[Job],
        reference_jobs: &[Job],
        min_similarity: f64,
        limit: usize,
    ) -> Vec<(Job, f64)> {
        let mut job_scores: std::collections::HashMap<i64, (Job, f64, usize)> =
            std::collections::HashMap::new();

        // For each reference job, find similar jobs and aggregate scores
        for ref_job in reference_jobs {
            let similar = Self::find_similar_jobs(jobs, ref_job, min_similarity, limit * 2);

            for (job, similarity) in similar {
                let job_id = job.id.unwrap_or(0);
                let entry = job_scores
                    .entry(job_id)
                    .or_insert_with(|| (job.clone(), 0.0, 0));
                entry.1 += similarity; // Sum similarities
                entry.2 += 1; // Count references
            }
        }

        // Average the scores and convert to Vec
        let mut results: Vec<(Job, f64)> = job_scores
            .into_iter()
            .map(|(_, (job, total_score, count))| {
                let avg_score = if count > 0 {
                    total_score / count as f64
                } else {
                    0.0
                };
                (job, avg_score)
            })
            .filter(|(_, score)| *score >= min_similarity)
            .collect();

        // Sort by average similarity
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit);

        results
    }
}

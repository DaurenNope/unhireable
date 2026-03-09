use crate::db::models::Job;
use crate::deduplication::fuzzy_matcher::FuzzyMatcher;
use anyhow::Result;

/// Merge multiple jobs into one, keeping the best information from each.
/// Returns `None` if the slice is empty.
pub fn merge_jobs(jobs: &[Job]) -> Option<Job> {
    if jobs.is_empty() {
        return None;
    }

    if jobs.len() == 1 {
        return Some(jobs[0].clone());
    }

    // Find the job with the most complete information
    let best_job = jobs
        .iter()
        .max_by_key(|job| {
            let mut score = 0;
            if job.description.as_ref().map(|d| d.len()).unwrap_or(0) > 100 {
                score += 10;
            }
            if job.requirements.as_ref().map(|r| r.len()).unwrap_or(0) > 100 {
                score += 10;
            }
            if job.salary.is_some() {
                score += 5;
            }
            if job.location.is_some() {
                score += 5;
            }
            if job.match_score.is_some() {
                score += 3;
            }
            score
        })
        .unwrap();

    // Use the best job as base
    let mut merged = best_job.clone();

    // Collect all sources
    let mut sources = vec![merged.source.clone()];
    for job in jobs.iter().skip(1) {
        if !sources.contains(&job.source) {
            sources.push(job.source.clone());
        }
    }

    // Merge sources (comma-separated)
    merged.source = sources.join(", ");

    // Merge descriptions (use longest)
    for job in jobs {
        if let Some(desc) = &job.description {
            if desc.len() > merged.description.as_ref().map(|d| d.len()).unwrap_or(0) {
                merged.description = Some(desc.clone());
            }
        }
    }

    // Merge requirements (use longest)
    for job in jobs {
        if let Some(req) = &job.requirements {
            if req.len() > merged.requirements.as_ref().map(|r| r.len()).unwrap_or(0) {
                merged.requirements = Some(req.clone());
            }
        }
    }

    // Merge salary (prefer non-empty)
    if merged.salary.is_none() || merged.salary.as_ref().unwrap().trim().is_empty() {
        for job in jobs {
            if let Some(sal) = &job.salary {
                if !sal.trim().is_empty() {
                    merged.salary = Some(sal.clone());
                    break;
                }
            }
        }
    }

    // Merge location (prefer non-empty)
    if merged.location.is_none() || merged.location.as_ref().unwrap().trim().is_empty() {
        for job in jobs {
            if let Some(loc) = &job.location {
                if !loc.trim().is_empty() {
                    merged.location = Some(loc.clone());
                    break;
                }
            }
        }
    }

    // Merge match_score (use highest)
    for job in jobs {
        if let Some(score) = job.match_score {
            if score > merged.match_score.unwrap_or(0.0) {
                merged.match_score = Some(score);
            }
        }
    }

    // Use earliest created_at
    for job in jobs {
        if let Some(created) = job.created_at {
            if merged.created_at.is_none() || created < merged.created_at.unwrap() {
                merged.created_at = Some(created);
            }
        }
    }

    // Use latest updated_at
    for job in jobs {
        if let Some(updated) = job.updated_at {
            if updated > merged.updated_at.unwrap_or(chrono::Utc::now()) {
                merged.updated_at = Some(updated);
            }
        }
    }

    Some(merged)
}

pub struct JobMerger;

impl JobMerger {
    /// Find and merge duplicate jobs in the database
    pub fn find_and_merge_duplicates(
        jobs: &[Job],
        similarity_threshold: f64,
    ) -> Result<Vec<(Job, Vec<i64>)>> {
        let duplicates = FuzzyMatcher::find_duplicates(jobs, similarity_threshold);
        let mut merged_jobs = Vec::new();

        for (primary_id, duplicate_ids) in duplicates {
            // Find the primary job
            let primary_job = jobs
                .iter()
                .find(|j| j.id == Some(primary_id))
                .ok_or_else(|| anyhow::anyhow!("Primary job {} not found", primary_id))?;

            // Collect all jobs to merge (primary + duplicates)
            let mut jobs_to_merge = vec![primary_job.clone()];
            for dup_id in &duplicate_ids {
                if let Some(dup_job) = jobs.iter().find(|j| j.id == Some(*dup_id)) {
                    jobs_to_merge.push(dup_job.clone());
                }
            }

            // Merge them (safe — jobs_to_merge always has at least 1 element)
            if let Some(merged) = merge_jobs(&jobs_to_merge) {
                merged_jobs.push((merged, duplicate_ids));
            }
        }

        Ok(merged_jobs)
    }

    /// Check if a new job is a duplicate of any existing jobs
    pub fn find_duplicate_of(
        jobs: &[Job],
        new_job: &Job,
        similarity_threshold: f64,
    ) -> Option<Job> {
        FuzzyMatcher::find_duplicate_of(jobs, new_job, similarity_threshold)
    }
}

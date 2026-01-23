use crate::db::models::Job;
use crate::generator::UserProfile;
use crate::matching::JobMatcher;
use crate::recommendations::behavior_tracker::{BehaviorTracker, InteractionType};
use crate::recommendations::similarity::JobSimilarity;
use crate::cache::Cache;
use crate::metrics;
use anyhow::Result;
use chrono::Utc;
use std::sync::MutexGuard;
use std::sync::Arc;
use std::time::Instant;
use sha2::{Sha256, Digest};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RecommendedJob {
    pub job: Job,
    pub recommendation_score: f64, // 0.0 to 100.0
    pub reasons: Vec<String>,
}

pub struct RecommendationEngine {
    cache: Option<Arc<Cache<String, serde_json::Value>>>,
}

impl RecommendationEngine {
    pub fn new() -> Self {
        Self { cache: None }
    }

    pub fn with_cache(cache: Arc<Cache<String, serde_json::Value>>) -> Self {
        Self { cache: Some(cache) }
    }

    /// Get personalized job recommendations based on user behavior and profile
    /// Uses cache if available
    pub async fn get_recommended_jobs_cached(
        &self,
        db: &MutexGuard<'_, rusqlite::Connection>,
        all_jobs: &[Job],
        profile: Option<&UserProfile>,
        limit: usize,
    ) -> Result<Vec<RecommendedJob>> {
        let start_time = Instant::now();
        
        // Generate cache key based on user profile and job list
        let cache_key = self.generate_cache_key(profile, all_jobs.len(), limit);
        
        // Check cache first
        if let Some(cache) = &self.cache {
            if let Some(cached_value) = cache.get(&cache_key).await {
                if let Ok(recommendations) = serde_json::from_value::<Vec<RecommendedJob>>(cached_value) {
                    metrics::RECOMMENDATION_CACHE_HITS.inc();
                    metrics::RECOMMENDATION_GENERATION_DURATION.observe(start_time.elapsed().as_secs_f64());
                    return Ok(recommendations);
                }
            }
            metrics::RECOMMENDATION_CACHE_MISSES.inc();
        }
        
        // Generate recommendations
        let recommendations = self.get_recommended_jobs(db, all_jobs, profile, limit)?;
        
        // Cache the results
        if let Some(cache) = &self.cache {
            let cache_value = serde_json::to_value(&recommendations)?;
            cache.set(cache_key, cache_value, None).await?;
        }
        
        metrics::RECOMMENDATIONS_GENERATED.inc();
        metrics::RECOMMENDATION_GENERATION_DURATION.observe(start_time.elapsed().as_secs_f64());
        
        Ok(recommendations)
    }

    /// Generate cache key for recommendations
    fn generate_cache_key(&self, profile: Option<&UserProfile>, job_count: usize, limit: usize) -> String {
        let profile_hash = if let Some(p) = profile {
            // Create a simple hash from profile skills
            let skills_str = p.skills.technical_skills.join(",");
            let mut hasher = Sha256::new();
            hasher.update(skills_str.as_bytes());
            format!("{:x}", hasher.finalize())
        } else {
            "no_profile".to_string()
        };
        
        format!("recommendations:{}:{}:{}", profile_hash, job_count, limit)
    }

    /// Invalidate recommendation cache for a user
    /// Should be called when user behavior changes (save, apply, dismiss)
    pub async fn invalidate_cache(&self, user_id: Option<&str>) -> Result<()> {
        if self.cache.is_some() {
            // Invalidate all recommendation cache keys
            // For now, we'll clear all - in production, use user-specific keys
            let cache_keys: Vec<String> = if let Some(uid) = user_id {
                // Get all cache keys with user prefix
                vec![format!("recommendations:{}:*", uid)]
            } else {
                // Clear all recommendation cache
                vec!["recommendations:*".to_string()]
            };
            
            for pattern in cache_keys {
                // Note: Cache doesn't support wildcard deletion in current implementation
                // For now, we'll let TTL handle expiration, or implement cache tagging
                tracing::debug!("Cache invalidation requested for pattern: {}", pattern);
            }
        }
        Ok(())
    }

    /// Invalidate cache for specific cache key
    pub async fn invalidate_cache_key(&self, cache_key: &str) -> Result<()> {
        if let Some(cache) = &self.cache {
            let key = cache_key.to_string();
            cache.remove(&key).await;
            tracing::debug!("Invalidated cache key: {}", cache_key);
        }
        Ok(())
    }

    /// Get personalized job recommendations based on user behavior and profile
    pub fn get_recommended_jobs(
        &self,
        db: &MutexGuard<'_, rusqlite::Connection>,
        all_jobs: &[Job],
        profile: Option<&UserProfile>,
        limit: usize,
    ) -> Result<Vec<RecommendedJob>> {
        let mut recommendations = Vec::new();

        // Filter out jobs user has already dismissed or ignored
        let excluded_job_ids: std::collections::HashSet<i64> = all_jobs
            .iter()
            .filter_map(|job| {
                let job_id = job.id?;
                let dismissed =
                    BehaviorTracker::has_interacted(db, job_id, InteractionType::Dismiss).ok()?;
                let ignored =
                    BehaviorTracker::has_interacted(db, job_id, InteractionType::Ignore).ok()?;
                if dismissed || ignored {
                    Some(job_id)
                } else {
                    None
                }
            })
            .collect();

        // Get jobs user has saved/applied to (for similarity matching)
        let saved_job_ids =
            BehaviorTracker::get_most_interacted_jobs(db, InteractionType::Save, 20)?;

        let applied_job_ids =
            BehaviorTracker::get_most_interacted_jobs(db, InteractionType::Apply, 20)?;

        // Get reference jobs (saved + applied)
        let reference_jobs: Vec<Job> = all_jobs
            .iter()
            .filter(|job| {
                if let Some(id) = job.id {
                    saved_job_ids.contains(&id) || applied_job_ids.contains(&id)
                } else {
                    false
                }
            })
            .cloned()
            .collect();

        // Calculate recommendations for each job
        for job in all_jobs {
            // Skip excluded jobs
            if let Some(job_id) = job.id {
                if excluded_job_ids.contains(&job_id) {
                    continue;
                }
            }

            // Skip jobs user has already applied to
            if let Some(job_id) = job.id {
                if applied_job_ids.contains(&job_id) {
                    continue;
                }
            }

            let mut score = 0.0;
            let mut reasons = Vec::new();

            // 1. Match score from profile (if available) - 40% weight
            if let Some(profile) = profile {
                let matcher = JobMatcher::new();
                let match_result = matcher.calculate_match(job, profile);
                let match_score = match_result.match_score;
                score += match_score * 0.4;

                if match_score >= 70.0 {
                    reasons.push(format!("High match score: {:.0}%", match_score));
                }
            } else {
                // If no profile, use a base score
                score += 30.0;
            }

            // 2. Similarity to saved/applied jobs - 30% weight
            if !reference_jobs.is_empty() {
                let similar_jobs = JobSimilarity::find_similar_to_multiple(
                    all_jobs,
                    &reference_jobs,
                    0.3, // Minimum 30% similarity
                    1,
                );

                if let Some((_, similarity)) = similar_jobs.first() {
                    let similarity_score = similarity * 100.0;
                    score += similarity_score * 0.3;

                    if *similarity >= 0.5 {
                        reasons.push("Similar to jobs you've saved/applied to".to_string());
                    }
                }
            }

            // 3. Recency boost - 15% weight (newer jobs get higher score)
            if let Some(created_at) = job.created_at {
                let days_old = (Utc::now() - created_at).num_days();
                let recency_score = if days_old <= 1 {
                    100.0 // Posted today or yesterday
                } else if days_old <= 7 {
                    80.0 // Posted this week
                } else if days_old <= 30 {
                    50.0 // Posted this month
                } else {
                    20.0 // Older
                };
                score += recency_score * 0.15;

                if days_old <= 1 {
                    reasons.push("Posted recently".to_string());
                }
            }

            // 4. Preferred companies/titles - 10% weight
            let preferred_companies = BehaviorTracker::get_preferred_companies(db, 10)?;
            let preferred_titles = BehaviorTracker::get_preferred_titles(db, 10)?;

            if preferred_companies.contains(&job.company) {
                score += 50.0 * 0.1;
                reasons.push("From a company you're interested in".to_string());
            }

            let job_title_lower = job.title.to_lowercase();
            for preferred_title in &preferred_titles {
                if job_title_lower.contains(&preferred_title.to_lowercase()) {
                    score += 50.0 * 0.1;
                    reasons.push("Similar to jobs you've applied to".to_string());
                    break;
                }
            }

            // 5. View count boost (if many views, might be popular) - 5% weight
            if let Some(job_id) = job.id {
                let view_count = BehaviorTracker::get_interaction_count(
                    db,
                    job_id,
                    Some(InteractionType::View),
                )?;
                if view_count > 5 {
                    score += 30.0 * 0.05;
                    reasons.push("Popular job".to_string());
                }
            }

            // Ensure score is between 0 and 100
            score = score.min(100.0).max(0.0);

            // Only include jobs with score >= 40
            if score >= 40.0 {
                recommendations.push(RecommendedJob {
                    job: job.clone(),
                    recommendation_score: score,
                    reasons: if reasons.is_empty() {
                        vec!["Recommended for you".to_string()]
                    } else {
                        reasons
                    },
                });
            }
        }

        // Sort by recommendation score (highest first)
        recommendations.sort_by(|a, b| {
            b.recommendation_score
                .partial_cmp(&a.recommendation_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Limit results
        recommendations.truncate(limit);

        Ok(recommendations)
    }

    /// Get trending jobs (high match score + recent)
    pub fn get_trending_jobs(
        jobs: &[Job],
        profile: Option<&UserProfile>,
        limit: usize,
    ) -> Vec<RecommendedJob> {
        let mut trending = Vec::new();

        for job in jobs {
            let mut score = 0.0;
            let mut reasons = Vec::new();

            // Match score - 50% weight
            if let Some(profile) = profile {
                let matcher = JobMatcher::new();
                let match_result = matcher.calculate_match(job, profile);
                score += match_result.match_score * 0.5;
            } else if let Some(match_score) = job.match_score {
                score += match_score * 0.5;
            }

            // Recency - 50% weight
            if let Some(created_at) = job.created_at {
                let days_old = (Utc::now() - created_at).num_days();
                let recency_score = if days_old <= 1 {
                    100.0
                } else if days_old <= 3 {
                    90.0
                } else if days_old <= 7 {
                    70.0
                } else if days_old <= 14 {
                    50.0
                } else {
                    30.0
                };
                score += recency_score * 0.5;

                if days_old <= 1 {
                    reasons.push("Posted today".to_string());
                } else if days_old <= 3 {
                    reasons.push("Posted recently".to_string());
                }
            }

            score = score.min(100.0).max(0.0);

            if score >= 60.0 {
                trending.push(RecommendedJob {
                    job: job.clone(),
                    recommendation_score: score,
                    reasons: if reasons.is_empty() {
                        vec!["Trending job".to_string()]
                    } else {
                        reasons
                    },
                });
            }
        }

        trending.sort_by(|a, b| {
            b.recommendation_score
                .partial_cmp(&a.recommendation_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        trending.truncate(limit);
        trending
    }

    /// Get similar jobs to a specific job
    pub fn get_similar_jobs(jobs: &[Job], target_job: &Job, limit: usize) -> Vec<(Job, f64)> {
        JobSimilarity::find_similar_jobs(jobs, target_job, 0.3, limit)
    }
}

impl Default for RecommendationEngine {
    fn default() -> Self {
        Self::new()
    }
}

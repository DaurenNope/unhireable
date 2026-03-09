use crate::db::models::{Job, JobStatus};
use crate::db::queries::{JobQueries, ProfileQueries};
use crate::generator::{AIIntegration, UserProfile};
use crate::matching::JobMatcher;
use anyhow::{Context, Result};
use std::sync::Arc;
use tokio::sync::Mutex;
use rusqlite::Connection;

pub struct Brain {
    matcher: JobMatcher,
    ai: AIIntegration,
    db: Arc<Mutex<Option<crate::db::Database>>>,
}

impl Brain {
    pub fn new(db: Arc<Mutex<Option<crate::db::Database>>>) -> Self {
        Self {
            matcher: JobMatcher::new(),
            ai: AIIntegration::new(),
            db,
        }
    }

    /// Process all jobs in 'Scouted' status and qualify them
    pub async fn process_scouted_jobs(&self) -> Result<usize> {
        // 1. Fetch profile and jobs in a short-lived lock
        let (profile, scouted_jobs) = {
            let db_guard = self.db.lock().await;
            let db = db_guard.as_ref().context("Database not initialized")?;
            let conn = db.get_connection();
            
            let profile = conn.get_user_profile()?.context("User profile not found")?;
            let scouted_jobs = conn.list_jobs(Some(JobStatus::Scouted))?;
            
            (profile, scouted_jobs)
        };

        if scouted_jobs.is_empty() {
            return Ok(0);
        }

        // 2. Qualify jobs (no lock held over await)
        let mut qualified_jobs = Vec::new();
        for mut job in scouted_jobs {
            if let Err(e) = self.qualify_job(&mut job, &profile).await {
                eprintln!("[Brain] Error qualifying job {}: {}", job.url, e);
                continue;
            }
            qualified_jobs.push(job);
        }

        // 3. Save qualified jobs (re-lock and update)
        let mut processed_count = 0;
        if !qualified_jobs.is_empty() {
            let db_guard = self.db.lock().await;
            let db = db_guard.as_ref().context("Database not initialized")?;
            let conn = db.get_connection();
            
            for job in qualified_jobs {
                if let Err(e) = conn.update_job(&job) {
                    eprintln!("[Brain] Error saving qualified job {}: {}", job.title, e);
                } else {
                    processed_count += 1;
                }
            }
        }

        Ok(processed_count)
    }

    /// Individual job qualification logic
    async fn qualify_job(&self, job: &mut Job, profile: &UserProfile) -> Result<()> {
        // Step 1: Heuristic Match (Fast)
        let heuristic_result = self.matcher.calculate_match(job, profile);
        job.match_score = Some(heuristic_result.match_score);

        // Step 2: Deep Qualify (Slow) - only for decent matches
        if heuristic_result.match_score > 40.0 && self.ai.has_api_key() {
            println!("[Brain] 🧠 Deep qualifying job: {} (Heuristic: {})", job.title, heuristic_result.match_score);
            
            match self.ai.analyze_job(job).await {
                Ok(analysis) => {
                    // Update metadata
                    job.requirements = Some(analysis.required_skills.join(", "));
                    
                    // The LLM match_score is usually more nuanced
                    // We blend heuristic and LLM scores
                    let final_score = (heuristic_result.match_score * 0.4) + (analysis.match_score * 0.6);
                    job.match_score = Some(final_score);

                    // Promote to Prospect if score is very high
                    if final_score >= 80.0 {
                        job.status = JobStatus::Prospect;
                        println!("[Brain] ⭐ Promoted to PROSPECT: {} (Final: {})", job.title, final_score);
                    }
                },
                Err(e) => {
                    eprintln!("[Brain] AI analysis failed for {}: {}", job.title, e);
                }
            }
        } else if heuristic_result.match_score >= 80.0 {
            // Promote on heuristic alone when score is very high (no AI key or AI skipped)
            job.status = JobStatus::Prospect;
        }

        Ok(())
    }

    /// Automatically trigger applications for high-match prospects
    pub async fn auto_apply_prospects(&self) -> Result<usize> {
        let db_guard = self.db.lock().await;
        let db = db_guard.as_ref().context("Database not initialized")?;
        let conn = db.get_connection();

        let prospects = conn.list_jobs(Some(JobStatus::Prospect))?;
        let top_tier: Vec<_> = prospects
            .into_iter()
            .filter(|j| j.match_score.unwrap_or(0.0) >= 90.0)
            .collect();

        let count = top_tier.len();
        if count > 0 {
            println!("[Brain] 🚀 Found {} top-tier prospects. Triggering auto-apply...", count);
            // In a real implementation, this would call the Orchestrator or ApplicationLauncher
            // For now, we'll mark them as 'Applied' conceptually or emit an event
            for mut job in top_tier {
                job.status = JobStatus::Applied;
                conn.update_job(&job)?;
                println!("[Brain] ✅ Auto-applied to {}", job.title);
            }
        }

        Ok(count)
    }
}

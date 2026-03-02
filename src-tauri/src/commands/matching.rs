use crate::commands;
use crate::db;
use crate::db::queries::{JobQueries, SnapshotQueries};
use crate::error::Result;
use crate::generator;
use crate::insights::{self, MarketInsights};
use crate::matching;
use crate::recommendations::{
    self,
    behavior_tracker::{BehaviorTracker, InteractionType},
    engine::{RecommendationEngine, RecommendedJob},
};
use crate::AppState;
use tauri::State;

fn sanitize_limit(limit: Option<usize>, default: usize, max: usize) -> usize {
    limit.unwrap_or(default).clamp(1, max)
}

// Job Matching Commands
#[tauri::command]
pub async fn calculate_job_match_score(
    state: State<'_, AppState>,
    job_id: i64,
    profile: generator::UserProfile,
) -> Result<matching::JobMatchResult> {
    let job = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            conn.get_job(job_id)?
                .ok_or_else(|| anyhow::anyhow!("Job not found"))?
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let matcher = matching::JobMatcher::new();
    let match_result = matcher.calculate_match(&job, &profile);

    Ok(match_result)
}

#[tauri::command]
pub async fn match_jobs_for_profile(
    state: State<'_, AppState>,
    profile: generator::UserProfile,
    min_score: Option<f64>,
) -> Result<Vec<matching::JobMatchResult>> {
    let jobs = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            conn.list_jobs(None)?
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let matcher = matching::JobMatcher::new();
    let results = matcher.match_jobs(&jobs, &profile);

    let filtered = if let Some(min) = min_score {
        matcher.filter_by_score(&results, min)
    } else {
        results
    };

    Ok(filtered)
}

#[tauri::command]
pub async fn update_job_match_scores(
    state: State<'_, AppState>,
    profile: generator::UserProfile,
) -> Result<usize> {
    println!(
        "update_job_match_scores called with profile: {:?}",
        profile.personal_info.name
    );
    let (jobs, mut updated_count) = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            let jobs = conn.list_jobs(None)?;
            println!("Found {} jobs to calculate match scores for", jobs.len());
            (jobs, 0)
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    let matcher = matching::JobMatcher::new();

    // Calculate match scores for all jobs
    for job in &jobs {
        let match_result = matcher.calculate_match(job, &profile);

        // Update job with match score
        let mut updated_job = job.clone();
        updated_job.match_score = Some(match_result.match_score);

        {
            let db = state.db.lock().await;
            if let Some(db) = &*db {
                let conn = db.get_connection();
                if conn.update_job(&updated_job).is_ok() {
                    updated_count += 1;
                }
            }
        }
    }

    Ok(updated_count)
}

// Recommendation & Insights Commands

#[tauri::command]
pub async fn get_recommended_jobs(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<RecommendedJob>> {
    let limit = sanitize_limit(limit, 10, 50);
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let jobs = conn.list_jobs(None)?;
        let profile = commands::user::load_user_profile_from_conn(&conn)?;
        let engine = recommendations::RecommendationEngine::new();
        let recommendations = engine.get_recommended_jobs(&conn, &jobs, profile.as_ref(), limit)?;
        Ok(recommendations)
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn get_trending_jobs(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<RecommendedJob>> {
    let limit = sanitize_limit(limit, 10, 50);
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let jobs = conn.list_jobs(None)?;
        let profile = commands::user::load_user_profile_from_conn(&conn)?;
        Ok(RecommendationEngine::get_trending_jobs(
            &jobs,
            profile.as_ref(),
            limit,
        ))
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn get_similar_jobs(
    state: State<'_, AppState>,
    job_id: i64,
    limit: Option<usize>,
) -> Result<Vec<(db::models::Job, f64)>> {
    let limit = sanitize_limit(limit, 5, 25);
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let jobs = conn.list_jobs(None)?;
        let target_job = conn
            .get_job(job_id)?
            .ok_or_else(|| anyhow::anyhow!("Job not found"))?;
        Ok(RecommendationEngine::get_similar_jobs(
            &jobs,
            &target_job,
            limit,
        ))
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn track_job_interaction(
    state: State<'_, AppState>,
    job_id: i64,
    interaction_type: String,
) -> Result<()> {
    let interaction = match interaction_type.to_lowercase().as_str() {
        "view" => InteractionType::View,
        "save" => InteractionType::Save,
        "apply" => InteractionType::Apply,
        "dismiss" => InteractionType::Dismiss,
        "ignore" => InteractionType::Ignore,
        other => {
            return Err(anyhow::anyhow!(format!("Unsupported interaction type: {}", other)).into())
        }
    };

    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        BehaviorTracker::track_interaction(&conn, job_id, interaction)?;
        Ok(())
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

#[tauri::command]
pub async fn get_market_insights(
    state: State<'_, AppState>,
    timeframe_days: Option<i64>,
) -> Result<MarketInsights> {
    let timeframe = timeframe_days.unwrap_or(30).clamp(7, 180);
    let db = state.db.lock().await;
    if let Some(db) = &*db {
        let conn = db.get_connection();
        let jobs = conn.list_jobs(None)?;
        let profile = commands::user::load_user_profile_from_conn(&conn)?;
        let snapshots = conn.get_recent_job_snapshots(5)?;
        let previous_snapshot = snapshots
            .iter()
            .find(|snapshot| snapshot.timeframe_days == timeframe);

        Ok(insights::generate_market_insights(
            &jobs,
            profile.as_ref(),
            timeframe,
            previous_snapshot,
        ))
    } else {
        Err(anyhow::anyhow!("Database not initialized").into())
    }
}

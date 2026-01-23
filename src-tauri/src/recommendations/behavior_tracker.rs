use anyhow::Result;
use chrono::Utc;
use rusqlite::params;
use std::sync::MutexGuard;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InteractionType {
    View,
    Save,
    Apply,
    Dismiss,
    Ignore,
}

impl InteractionType {
    fn as_str(&self) -> &'static str {
        match self {
            InteractionType::View => "view",
            InteractionType::Save => "save",
            InteractionType::Apply => "apply",
            InteractionType::Dismiss => "dismiss",
            InteractionType::Ignore => "ignore",
        }
    }
}

pub struct BehaviorTracker;

impl BehaviorTracker {
    /// Track a user interaction with a job
    pub fn track_interaction(
        db: &MutexGuard<'_, rusqlite::Connection>,
        job_id: i64,
        interaction_type: InteractionType,
    ) -> Result<()> {
        db.execute(
            "INSERT INTO job_interactions (job_id, interaction_type, created_at) VALUES (?1, ?2, ?3)",
            params![job_id, interaction_type.as_str(), Utc::now()],
        )?;
        Ok(())
    }

    /// Get interaction count for a job
    pub fn get_interaction_count(
        db: &MutexGuard<'_, rusqlite::Connection>,
        job_id: i64,
        interaction_type: Option<InteractionType>,
    ) -> Result<i64> {
        let query = if interaction_type.is_some() {
            "SELECT COUNT(*) FROM job_interactions WHERE job_id = ?1 AND interaction_type = ?2"
        } else {
            "SELECT COUNT(*) FROM job_interactions WHERE job_id = ?1"
        };

        let count = if let Some(itype) = interaction_type {
            db.query_row(query, params![job_id, itype.as_str()], |row| row.get(0))
        } else {
            db.query_row(query, params![job_id], |row| row.get(0))
        }?;

        Ok(count)
    }

    /// Get most interacted jobs (for learning user preferences)
    pub fn get_most_interacted_jobs(
        db: &MutexGuard<'_, rusqlite::Connection>,
        interaction_type: InteractionType,
        limit: i64,
    ) -> Result<Vec<i64>> {
        let mut stmt = db.prepare(
            "SELECT job_id, COUNT(*) as count 
             FROM job_interactions 
             WHERE interaction_type = ?1 
             GROUP BY job_id 
             ORDER BY count DESC 
             LIMIT ?2",
        )?;

        let job_ids = stmt
            .query_map(params![interaction_type.as_str(), limit], |row| {
                Ok(row.get::<_, i64>(0)?)
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(job_ids)
    }

    /// Get user's preferred companies (based on saves/applies)
    pub fn get_preferred_companies(
        db: &MutexGuard<'_, rusqlite::Connection>,
        limit: i64,
    ) -> Result<Vec<String>> {
        let mut stmt = db.prepare(
            "SELECT j.company, COUNT(*) as count
             FROM job_interactions ji
             JOIN jobs j ON ji.job_id = j.id
             WHERE ji.interaction_type IN ('save', 'apply')
             GROUP BY j.company
             ORDER BY count DESC
             LIMIT ?1",
        )?;

        let companies = stmt
            .query_map(params![limit], |row| Ok(row.get::<_, String>(0)?))?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(companies)
    }

    /// Get user's preferred job titles (based on saves/applies)
    pub fn get_preferred_titles(
        db: &MutexGuard<'_, rusqlite::Connection>,
        limit: i64,
    ) -> Result<Vec<String>> {
        let mut stmt = db.prepare(
            "SELECT j.title, COUNT(*) as count
             FROM job_interactions ji
             JOIN jobs j ON ji.job_id = j.id
             WHERE ji.interaction_type IN ('save', 'apply')
             GROUP BY j.title
             ORDER BY count DESC
             LIMIT ?1",
        )?;

        let titles = stmt
            .query_map(params![limit], |row| Ok(row.get::<_, String>(0)?))?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(titles)
    }

    /// Check if user has interacted with a job
    pub fn has_interacted(
        db: &MutexGuard<'_, rusqlite::Connection>,
        job_id: i64,
        interaction_type: InteractionType,
    ) -> Result<bool> {
        let count = Self::get_interaction_count(db, job_id, Some(interaction_type))?;
        Ok(count > 0)
    }
}

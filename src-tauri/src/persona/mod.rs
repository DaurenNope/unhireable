use std::fs;
use std::path::{Path, PathBuf};
use std::sync::MutexGuard;

use anyhow::{anyhow, Context, Result};
use once_cell::sync::Lazy;
use rusqlite::OptionalExtension;

use chrono::Utc;

use crate::db::models::{AlertFrequency, Job, JobStatus, SavedSearch, SavedSearchFilters};
use crate::db::queries::{JobQueries, SavedSearchQueries};
use crate::generator::UserProfile;

#[derive(Clone)]
struct PersonaBlueprint {
    slug: &'static str,
    display_name: &'static str,
    description: &'static str,
    target_role: &'static str,
    profile: UserProfile,
    saved_search: SavedSearch,
    resume_markdown: &'static str,
    cover_letter_markdown: &'static str,
}

#[derive(Clone, serde::Serialize)]
pub struct PersonaSummary {
    pub slug: String,
    pub display_name: String,
    pub description: String,
    pub target_role: String,
}

#[derive(Clone)]
pub struct PersonaAssets {
    pub slug: String,
    pub display_name: String,
    pub profile: UserProfile,
    pub resume_path: PathBuf,
    pub cover_letter_path: PathBuf,
    pub saved_search_id: i64,
    pub saved_search_name: String,
}

#[derive(Clone)]
pub struct PersonaDryRunSetup {
    pub assets: PersonaAssets,
    pub job: Job,
}

static PERSONAS: Lazy<Vec<PersonaBlueprint>> = Lazy::new(|| vec![PersonaBlueprint::atlas()]);

impl PersonaBlueprint {
    fn atlas() -> Self {
        let profile: UserProfile =
            serde_json::from_str(include_str!("../../personas/atlas_profile.json"))
                .expect("Invalid atlas persona profile JSON");

        let mut filters = SavedSearchFilters::default();
        filters.remote_only = true;
        filters.preferred_locations = vec!["Remote".to_string(), "North America".to_string()];
        filters.preferred_titles = vec![
            "Staff Software Engineer".to_string(),
            "Senior Frontend Engineer".to_string(),
            "AI Platform Engineer".to_string(),
        ];
        filters.preferred_companies = vec!["Series B+".to_string(), "Product-led".to_string()];
        filters.avoid_companies = vec!["Stealth".to_string()];
        filters.required_skills = vec![
            "React".to_string(),
            "TypeScript".to_string(),
            "GraphQL".to_string(),
        ];
        filters.preferred_skills = vec![
            "LangChain".to_string(),
            "LLM".to_string(),
            "Vector Search".to_string(),
        ];
        filters.min_salary = Some(160_000);
        filters.job_types = vec!["full-time".to_string()];
        filters.industries = vec!["AI".to_string(), "Developer Tools".to_string()];
        filters.must_have_benefits =
            vec!["Remote stipend".to_string(), "Learning budget".to_string()];
        filters.company_size = Some("medium".to_string());

        let saved_search = SavedSearch {
            id: None,
            name: "Smart Filter".to_string(),
            query: "staff react engineer remote".to_string(),
            sources: vec![
                "remotive".to_string(),
                "remoteok".to_string(),
                "wellfound".to_string(),
                "greenhouse".to_string(),
            ],
            filters,
            alert_frequency: AlertFrequency::Daily,
            min_match_score: 65,
            enabled: true,
            last_run_at: None,
            created_at: None,
            updated_at: None,
        };

        Self {
            slug: "atlas",
            display_name: "Atlas Ward",
            description:
                "Staff-level full-stack engineer focused on AI tooling and resilient data systems.",
            target_role: "Staff Software Engineer (AI Platform)",
            profile,
            saved_search,
            resume_markdown: include_str!("../../personas/atlas_resume.md"),
            cover_letter_markdown: include_str!("../../personas/atlas_cover_letter.md"),
        }
    }
}

pub fn default_slug() -> &'static str {
    PERSONAS.first().map(|p| p.slug).unwrap_or("atlas")
}

pub fn list_personas() -> Vec<PersonaSummary> {
    PERSONAS
        .iter()
        .map(|p| PersonaSummary {
            slug: p.slug.to_string(),
            display_name: p.display_name.to_string(),
            description: p.description.to_string(),
            target_role: p.target_role.to_string(),
        })
        .collect()
}

fn blueprint(slug: &str) -> Option<&'static PersonaBlueprint> {
    PERSONAS.iter().find(|p| p.slug == slug)
}

pub fn activate_persona(
    conn: &MutexGuard<'_, rusqlite::Connection>,
    app_dir: &Path,
    slug: &str,
) -> Result<PersonaAssets> {
    let blueprint = blueprint(slug).ok_or_else(|| anyhow!("Unknown persona '{}'", slug))?;

    // Save profile
    let profile_json = serde_json::to_string(&blueprint.profile)?;
    conn.execute(
        "INSERT OR REPLACE INTO user_profile (id, profile_data, updated_at) VALUES (1, ?1, ?2)",
        rusqlite::params![profile_json, Utc::now()],
    )?;

    // Upsert saved search
    let mut saved_search = blueprint.saved_search.clone();
    saved_search.id = existing_saved_search_id(conn, &saved_search.name)?;
    let saved_search_id = if let Some(id) = saved_search.id {
        conn.update_saved_search(&saved_search)?;
        id
    } else {
        let mut to_create = saved_search.clone();
        conn.create_saved_search(&mut to_create)?;
        to_create.id.expect("saved search id assigned")
    };

    // Write resume + cover letter markdown into persona folder
    let persona_dir = app_dir.join("personas").join(blueprint.slug);
    fs::create_dir_all(&persona_dir)
        .with_context(|| format!("Failed to create persona dir {}", persona_dir.display()))?;

    let resume_path = persona_dir.join("resume.md");
    fs::write(&resume_path, blueprint.resume_markdown)
        .with_context(|| format!("Failed to write {}", resume_path.display()))?;

    let cover_letter_path = persona_dir.join("cover_letter.md");
    fs::write(&cover_letter_path, blueprint.cover_letter_markdown)
        .with_context(|| format!("Failed to write {}", cover_letter_path.display()))?;

    Ok(PersonaAssets {
        slug: blueprint.slug.to_string(),
        display_name: blueprint.display_name.to_string(),
        profile: blueprint.profile.clone(),
        resume_path,
        cover_letter_path,
        saved_search_id,
        saved_search_name: saved_search.name,
    })
}

fn existing_saved_search_id(
    conn: &MutexGuard<'_, rusqlite::Connection>,
    name: &str,
) -> Result<Option<i64>> {
    conn.query_row(
        "SELECT id FROM saved_searches WHERE name = ?1 LIMIT 1",
        [name],
        |row| row.get::<_, i64>(0),
    )
    .optional()
    .map_err(Into::into)
}

pub fn ensure_test_job(conn: &MutexGuard<'_, rusqlite::Connection>, slug: &str) -> Result<Job> {
    let blueprint = blueprint(slug).ok_or_else(|| anyhow!("Unknown persona '{}'", slug))?;
    let test_endpoint = format!("https://httpbin.org/post?persona={}", slug);

    if let Some(existing_id) = conn
        .query_row(
            "SELECT id FROM jobs WHERE url = ?1 LIMIT 1",
            [&test_endpoint],
            |row| row.get::<_, i64>(0),
        )
        .optional()?
    {
        if let Some(job) = conn.get_job(existing_id)? {
            return Ok(job);
        }
    }

    let mut job = Job {
        id: None,
        title: format!("[TEST] {} Dry Run", blueprint.target_role),
        company: "Persona Test Sandbox".to_string(),
        url: test_endpoint,
        description: Some(format!(
            "Synthetic job used to exercise the automation pipeline for {}. Submits to httpbin.org.",
            blueprint.display_name
        )),
        requirements: Some("This is a safe test posting that exists purely for QA workflows.".to_string()),
        location: Some("Remote (simulation)".to_string()),
        salary: Some("$180k – $210k (simulated)".to_string()),
        source: "persona_test".to_string(),
        status: JobStatus::Saved,
        match_score: Some(92.0),
        created_at: None,
        updated_at: None,
    };

    conn.create_job(&mut job)?;
    Ok(job)
}

pub fn prepare_dry_run(
    conn: &MutexGuard<'_, rusqlite::Connection>,
    app_dir: &Path,
    slug: &str,
) -> Result<PersonaDryRunSetup> {
    let assets = activate_persona(conn, app_dir, slug)?;
    let job = ensure_test_job(conn, slug)?;
    Ok(PersonaDryRunSetup { assets, job })
}

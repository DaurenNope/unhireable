use crate::db::models::{Job, JobSnapshot, SnapshotCount};
use crate::generator::UserProfile;
use crate::matching::skills_analyzer::SkillsAnalyzer;
use chrono::{Duration, Utc};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Clone)]
pub struct SkillStat {
    pub name: String,
    pub job_count: usize,
    pub percentage: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct EntityStat {
    pub name: String,
    pub job_count: usize,
    pub percentage: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct TrendStat {
    pub name: String,
    pub current_count: usize,
    pub previous_count: usize,
    pub delta_percentage: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct MarketInsights {
    pub timeframe_days: i64,
    pub total_jobs_considered: usize,
    pub total_jobs_previous: usize,
    pub remote_percentage: f64,
    pub onsite_percentage: f64,
    pub trending_skills: Vec<SkillStat>,
    pub skill_trends: Vec<TrendStat>,
    pub skills_to_learn: Vec<SkillStat>,
    pub trending_roles: Vec<EntityStat>,
    pub role_trends: Vec<TrendStat>,
    pub top_companies: Vec<EntityStat>,
    pub top_locations: Vec<EntityStat>,
    pub sources_breakdown: Vec<EntityStat>,
}

const SNAPSHOT_COUNT_LIMIT: usize = 50;

pub fn generate_job_snapshot(jobs: &[Job], timeframe_days: i64) -> JobSnapshot {
    let filtered_jobs = filter_jobs_by_timeframe(jobs, timeframe_days);
    let total_jobs = filtered_jobs.len();

    let mut skill_counts: HashMap<String, usize> = HashMap::new();
    let mut role_counts: HashMap<String, usize> = HashMap::new();
    let mut company_counts: HashMap<String, usize> = HashMap::new();
    let mut source_counts: HashMap<String, usize> = HashMap::new();
    let mut remote_count = 0usize;

    for job in &filtered_jobs {
        let company = job.company.trim();
        if !company.is_empty() {
            *company_counts.entry(company.to_string()).or_insert(0) += 1;
        }

        let source = job.source.trim();
        if !source.is_empty() {
            *source_counts.entry(source.to_string()).or_insert(0) += 1;
        }

        if job
            .location
            .as_ref()
            .map(|loc| loc.to_lowercase().contains("remote"))
            .unwrap_or(true)
        {
            remote_count += 1;
        }

        let role_category = categorize_role(&job.title);
        *role_counts.entry(role_category).or_insert(0) += 1;

        let extracted_skills = SkillsAnalyzer::extract_job_skills(job);
        let mut unique_skills: HashSet<String> = HashSet::new();
        for skill in extracted_skills {
            let normalized = SkillsAnalyzer::normalize_skill(&skill);
            if !normalized.is_empty() {
                unique_skills.insert(normalized);
            }
        }
        for skill in unique_skills {
            *skill_counts.entry(skill).or_insert(0) += 1;
        }
    }

    let onsite_count = total_jobs.saturating_sub(remote_count);

    JobSnapshot {
        id: None,
        captured_at: Utc::now(),
        timeframe_days,
        total_jobs,
        remote_count,
        onsite_count,
        skill_counts: map_to_snapshot_counts(&skill_counts, SNAPSHOT_COUNT_LIMIT),
        role_counts: map_to_snapshot_counts(&role_counts, SNAPSHOT_COUNT_LIMIT),
        company_counts: map_to_snapshot_counts(&company_counts, SNAPSHOT_COUNT_LIMIT),
        source_counts: map_to_snapshot_counts(&source_counts, SNAPSHOT_COUNT_LIMIT),
    }
}

pub fn generate_market_insights(
    jobs: &[Job],
    profile: Option<&UserProfile>,
    timeframe_days: i64,
    previous_snapshot: Option<&JobSnapshot>,
) -> MarketInsights {
    let now = Utc::now();
    let timeframe = Duration::days(timeframe_days);
    let cutoff_current = now - timeframe;
    let cutoff_previous = cutoff_current - timeframe;

    let mut current_jobs: Vec<Job> = Vec::new();
    let mut previous_jobs: Vec<Job> = Vec::new();

    for job in jobs {
        match job.created_at {
            Some(created_at) => {
                if created_at >= cutoff_current {
                    current_jobs.push(job.clone());
                } else if created_at >= cutoff_previous {
                    previous_jobs.push(job.clone());
                }
            }
            None => current_jobs.push(job.clone()),
        }
    }

    let total_jobs = current_jobs.len();
    let mut total_previous = previous_jobs.len();

    if total_jobs == 0 {
        return MarketInsights {
            timeframe_days,
            total_jobs_considered: 0,
            total_jobs_previous: total_previous,
            remote_percentage: 0.0,
            onsite_percentage: 0.0,
            trending_skills: Vec::new(),
            skill_trends: Vec::new(),
            skills_to_learn: Vec::new(),
            trending_roles: Vec::new(),
            role_trends: Vec::new(),
            top_companies: Vec::new(),
            top_locations: Vec::new(),
            sources_breakdown: Vec::new(),
        };
    }

    let mut skill_counts: HashMap<String, usize> = HashMap::new();
    let mut previous_skill_counts: HashMap<String, usize> = HashMap::new();
    let mut role_counts: HashMap<String, usize> = HashMap::new();
    let mut previous_role_counts: HashMap<String, usize> = HashMap::new();
    let mut company_counts: HashMap<String, usize> = HashMap::new();
    let mut source_counts: HashMap<String, usize> = HashMap::new();
    let mut location_counts = HashMap::new();

    for job in &current_jobs {
        let company = job.company.trim();
        if !company.is_empty() {
            *company_counts.entry(company.to_string()).or_insert(0) += 1;
        }

        let source = job.source.trim();
        if !source.is_empty() {
            *source_counts.entry(source.to_string()).or_insert(0) += 1;
        }

        if let Some(location) = job.location.as_ref() {
            let normalized = location.trim();
            if !normalized.is_empty() {
                *location_counts.entry(normalized.to_string()).or_insert(0) += 1;
            }
        }

        let role_category = categorize_role(&job.title);
        *role_counts.entry(role_category).or_insert(0) += 1;

        let extracted_skills = SkillsAnalyzer::extract_job_skills(job);
        let mut unique_skills: HashSet<String> = HashSet::new();
        for skill in extracted_skills {
            let normalized = SkillsAnalyzer::normalize_skill(&skill);
            if !normalized.is_empty() {
                unique_skills.insert(normalized);
            }
        }
        for skill in unique_skills {
            *skill_counts.entry(skill).or_insert(0) += 1;
        }
    }

    for job in &previous_jobs {
        let role_category = categorize_role(&job.title);
        *previous_role_counts.entry(role_category).or_insert(0) += 1;

        let extracted_skills = SkillsAnalyzer::extract_job_skills(job);
        let mut unique_skills: HashSet<String> = HashSet::new();
        for skill in extracted_skills {
            let normalized = SkillsAnalyzer::normalize_skill(&skill);
            if !normalized.is_empty() {
                unique_skills.insert(normalized);
            }
        }
        for skill in unique_skills {
            *previous_skill_counts.entry(skill).or_insert(0) += 1;
        }
    }

    if let Some(snapshot) =
        previous_snapshot.filter(|snapshot| snapshot.timeframe_days == timeframe_days)
    {
        total_previous = snapshot.total_jobs;
        previous_skill_counts = snapshot_counts_to_map(&snapshot.skill_counts);
        previous_role_counts = snapshot_counts_to_map(&snapshot.role_counts);
    }

    let remote_count = current_jobs
        .iter()
        .filter(|job| {
            job.location
                .as_ref()
                .map(|loc| loc.to_lowercase().contains("remote"))
                .unwrap_or(true)
        })
        .count();

    let remote_percentage = percentage(remote_count, total_jobs);
    let onsite_percentage = percentage(total_jobs.saturating_sub(remote_count), total_jobs);

    const MAX_SKILLS: usize = 15;
    let trending_skills = top_skill_stats(&skill_counts, total_jobs, MAX_SKILLS);
    let skill_trends = compute_trends(&trending_skills, &previous_skill_counts);

    let user_skill_set: HashSet<String> = profile
        .map(|p| {
            SkillsAnalyzer::extract_user_skills(p)
                .into_iter()
                .map(|s| SkillsAnalyzer::normalize_skill(&s))
                .collect()
        })
        .unwrap_or_default();

    let skills_to_learn = skill_counts
        .iter()
        .filter(|(skill, _)| !user_skill_set.contains(*skill))
        .map(|(skill, count)| SkillStat {
            name: skill.clone(),
            job_count: *count,
            percentage: percentage(*count, total_jobs),
        })
        .collect::<Vec<_>>();
    let mut skills_to_learn_sorted = skills_to_learn;
    skills_to_learn_sorted.sort_by(|a, b| b.job_count.cmp(&a.job_count));
    skills_to_learn_sorted.truncate(10);

    let trending_roles = top_entity_stats(&role_counts, total_jobs, 10);
    let role_trends = compute_trends_entity(&trending_roles, &previous_role_counts);
    let top_companies = top_entity_stats(&company_counts, total_jobs, 15);
    let location_counts = count_locations(&current_jobs);
    let top_locations = top_entity_stats(&location_counts, total_jobs, 10);
    let sources_breakdown = top_entity_stats(&source_counts, total_jobs, source_counts.len());

    MarketInsights {
        timeframe_days,
        total_jobs_considered: total_jobs,
        total_jobs_previous: total_previous,
        remote_percentage,
        onsite_percentage,
        trending_skills,
        skill_trends,
        skills_to_learn: skills_to_learn_sorted,
        trending_roles,
        role_trends,
        top_companies,
        top_locations,
        sources_breakdown,
    }
}

fn categorize_role(title: &str) -> String {
    let lower = title.to_lowercase();
    let patterns = [
        ("machine learning", "Machine Learning / AI"),
        ("ml engineer", "Machine Learning / AI"),
        ("data scientist", "Data Science / Analytics"),
        ("data engineer", "Data Engineering"),
        ("data analyst", "Data Science / Analytics"),
        ("frontend", "Frontend Engineering"),
        ("front-end", "Frontend Engineering"),
        ("backend", "Backend Engineering"),
        ("back-end", "Backend Engineering"),
        ("full stack", "Full-Stack Engineering"),
        ("software engineer", "Software Engineering"),
        ("software developer", "Software Engineering"),
        ("devops", "DevOps / SRE"),
        ("site reliability", "DevOps / SRE"),
        ("sre", "DevOps / SRE"),
        ("cloud", "Cloud Engineering"),
        ("security", "Security"),
        ("product manager", "Product Management"),
        ("product marketing", "Product Marketing"),
        ("marketing", "Marketing"),
        ("designer", "Design / UX"),
        ("ux", "Design / UX"),
        ("ui", "Design / UX"),
        ("sales", "Sales"),
        ("account executive", "Sales"),
        ("customer success", "Customer Success"),
        ("support", "Customer Support"),
        ("qa", "Quality Assurance"),
        ("quality assurance", "Quality Assurance"),
        ("project manager", "Project / Program Management"),
        ("program manager", "Project / Program Management"),
        ("people", "People / HR"),
        ("recruiter", "People / HR"),
        ("finance", "Finance / Accounting"),
        ("legal", "Legal"),
    ];

    for (pattern, category) in patterns {
        if lower.contains(pattern) {
            return category.to_string();
        }
    }

    let words: Vec<&str> = title.split_whitespace().take(2).collect();
    if words.is_empty() {
        "Other".to_string()
    } else {
        words.join(" ")
    }
}

fn top_skill_stats(
    counts: &HashMap<String, usize>,
    total_jobs: usize,
    limit: usize,
) -> Vec<SkillStat> {
    let mut stats: Vec<SkillStat> = counts
        .iter()
        .map(|(name, count)| SkillStat {
            name: name.clone(),
            job_count: *count,
            percentage: percentage(*count, total_jobs),
        })
        .collect();
    stats.sort_by(|a, b| b.job_count.cmp(&a.job_count));
    stats.truncate(limit);
    stats
}

fn top_entity_stats(
    counts: &HashMap<String, usize>,
    total_jobs: usize,
    limit: usize,
) -> Vec<EntityStat> {
    let mut stats: Vec<EntityStat> = counts
        .iter()
        .map(|(name, count)| EntityStat {
            name: name.clone(),
            job_count: *count,
            percentage: percentage(*count, total_jobs),
        })
        .collect();
    stats.sort_by(|a, b| b.job_count.cmp(&a.job_count));
    stats.truncate(limit);
    stats
}

fn count_locations(jobs: &[Job]) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    for job in jobs {
        if let Some(location) = job.location.as_ref() {
            let normalized = location.trim();
            if !normalized.is_empty() {
                *counts.entry(normalized.to_string()).or_insert(0) += 1;
            }
        }
    }
    counts
}

fn map_to_snapshot_counts(counts: &HashMap<String, usize>, limit: usize) -> Vec<SnapshotCount> {
    let mut stats: Vec<SnapshotCount> = counts
        .iter()
        .map(|(name, count)| SnapshotCount {
            name: name.clone(),
            count: *count,
        })
        .collect();
    stats.sort_by(|a, b| b.count.cmp(&a.count));
    if stats.len() > limit {
        stats.truncate(limit);
    }
    stats
}

fn snapshot_counts_to_map(counts: &[SnapshotCount]) -> HashMap<String, usize> {
    counts
        .iter()
        .map(|stat| (stat.name.clone(), stat.count))
        .collect()
}

fn filter_jobs_by_timeframe(jobs: &[Job], timeframe_days: i64) -> Vec<Job> {
    let cutoff = Utc::now() - Duration::days(timeframe_days);
    jobs.iter()
        .cloned()
        .filter(|job| match job.created_at {
            Some(created) => created >= cutoff,
            None => true,
        })
        .collect()
}

fn compute_trends(
    current: &[SkillStat],
    previous_counts: &HashMap<String, usize>,
) -> Vec<TrendStat> {
    current
        .iter()
        .map(|stat| {
            let previous = *previous_counts.get(&stat.name).unwrap_or(&0);
            TrendStat {
                name: stat.name.clone(),
                current_count: stat.job_count,
                previous_count: previous,
                delta_percentage: delta(stat.job_count, previous),
            }
        })
        .collect()
}

fn compute_trends_entity(
    current: &[EntityStat],
    previous_counts: &HashMap<String, usize>,
) -> Vec<TrendStat> {
    current
        .iter()
        .map(|stat| {
            let previous = *previous_counts.get(&stat.name).unwrap_or(&0);
            TrendStat {
                name: stat.name.clone(),
                current_count: stat.job_count,
                previous_count: previous,
                delta_percentage: delta(stat.job_count, previous),
            }
        })
        .collect()
}

fn delta(current: usize, previous: usize) -> f64 {
    if previous == 0 {
        if current == 0 {
            0.0
        } else {
            100.0
        }
    } else {
        (((current as f64) - (previous as f64)) / previous as f64 * 1000.0).round() / 10.0
    }
}

fn percentage(count: usize, total: usize) -> f64 {
    if total == 0 {
        0.0
    } else {
        ((count as f64) / (total as f64) * 1000.0).round() / 10.0
    }
}

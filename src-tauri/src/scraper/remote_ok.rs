use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::OnceLock;
use std::time::Duration;

const REMOTE_OK_API_URL: &str = "https://remoteok.com/api";

pub struct RemoteOkScraper;

#[derive(Debug, Deserialize)]
struct RemoteOkJobRaw {
    slug: Option<String>,
    date: Option<String>,
    company: Option<String>,
    position: Option<String>,
    tags: Option<Vec<String>>,
    description: Option<String>,
    location: Option<String>,
    apply_url: Option<String>,
    salary_min: Option<f64>,
    salary_max: Option<f64>,
    url: Option<String>,
}

impl RemoteOkScraper {
    fn map_job(raw: RemoteOkJobRaw) -> Option<Job> {
        let title = raw.position?.trim().to_string();
        let company = raw.company?.trim().to_string();

        if title.is_empty() || company.is_empty() {
            return None;
        }

        // Prefer dedicated URL field, fall back to apply URL or slug
        let job_url = raw
            .url
            .or(raw.apply_url.clone())
            .or_else(|| {
                raw.slug
                    .as_ref()
                    .map(|slug| format!("https://remoteok.com/{}", slug))
            })
            .filter(|url| !url.is_empty())?;

        let description = raw.description.as_ref().map(|html| strip_html_tags(html));

        let tags_text = raw
            .tags
            .as_ref()
            .filter(|tags| !tags.is_empty())
            .map(|tags| tags.join(", "));

        let mut requirements_parts = Vec::new();
        if let Some(tags) = tags_text {
            requirements_parts.push(format!("Tags: {}", tags));
        }
        if let Some(date) = raw.date.as_ref().filter(|d| !d.trim().is_empty()) {
            requirements_parts.push(format!("Posted: {}", date));
        }
        if let Some(apply_url) = raw
            .apply_url
            .as_ref()
            .filter(|url| url.trim() != "" && url.trim() != job_url)
        {
            requirements_parts.push(format!("Apply: {}", apply_url));
        }

        let requirements = if requirements_parts.is_empty() {
            None
        } else {
            Some(requirements_parts.join("\n"))
        };

        let salary = match (raw.salary_min, raw.salary_max) {
            (Some(min), Some(max)) if min > 0.0 && max > 0.0 => {
                Some(format!("${:.0} - ${:.0} (approx.)", min, max))
            }
            (Some(min), _) if min > 0.0 => Some(format!("${:.0}+ (approx.)", min)),
            (_, Some(max)) if max > 0.0 => Some(format!("Up to ${:.0} (approx.)", max)),
            _ => None,
        };

        Some(Job {
            id: None,
            title,
            company,
            url: job_url,
            description,
            requirements,
            location: raw.location.filter(|loc| !loc.trim().is_empty()),
            salary,
            source: crate::scraper::source_normalizer::normalize_source_name("RemoteOK"),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        })
    }

    fn job_matches_query(job: &Job, query_lower: &str) -> bool {
        if query_lower.is_empty() {
            return true;
        }

        // Split query into words and match if any word appears (more flexible matching)
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();

        // If query has multiple words, match if ALL words appear (anywhere in the text)
        // This allows "remote software engineer" to match "Senior Software Engineer (Remote)"
        let job_text = format!(
            "{} {} {} {} {}",
            job.title.to_lowercase(),
            job.company.to_lowercase(),
            job.description
                .as_ref()
                .map(|d| d.to_lowercase())
                .unwrap_or_default(),
            job.requirements
                .as_ref()
                .map(|r| r.to_lowercase())
                .unwrap_or_default(),
            job.location
                .as_ref()
                .map(|l| l.to_lowercase())
                .unwrap_or_default(),
        );

        // All query words must appear in the job text
        query_words.iter().all(|word| job_text.contains(word))
    }
}

fn strip_html_tags(html: &str) -> String {
    static TAG_REGEX: OnceLock<regex::Regex> = OnceLock::new();
    let regex = TAG_REGEX.get_or_init(|| regex::Regex::new(r"(?s)<[^>]*>").unwrap());
    let without_tags = regex.replace_all(html, " ");
    without_tags
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

impl JobScraper for RemoteOkScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Unhireable Job Scraper)")
            .build()
            .context("Failed to create HTTP client")?;

        let response = client
            .get(REMOTE_OK_API_URL)
            .send()
            .context("Failed to fetch RemoteOK API")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "RemoteOK API returned status: {}",
                response.status()
            ));
        }

        let jobs_raw: Vec<RemoteOkJobRaw> = response
            .json()
            .context("Failed to parse RemoteOK API response")?;

        let query_lower = query.to_lowercase();
        let mut jobs: Vec<Job> = jobs_raw
            .into_iter()
            .filter_map(Self::map_job)
            .filter(|job| Self::job_matches_query(job, &query_lower))
            .collect();

        // Deduplicate by URL
        let mut seen_urls = HashSet::new();
        jobs.retain(|job| seen_urls.insert(job.url.clone()));

        Ok(jobs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::JobStatus;

    #[test]
    fn test_map_job_with_all_fields() {
        let raw = RemoteOkJobRaw {
            slug: Some("123456".to_string()),
            date: Some("2024-01-01".to_string()),
            company: Some("Test Company".to_string()),
            position: Some("Senior Software Engineer".to_string()),
            tags: Some(vec!["rust".to_string(), "remote".to_string()]),
            description: Some("<p>Great job opportunity</p>".to_string()),
            location: Some("Remote".to_string()),
            apply_url: Some("https://example.com/apply".to_string()),
            salary_min: Some(100000.0),
            salary_max: Some(150000.0),
            url: Some("https://remoteok.com/jobs/123456".to_string()),
        };

        let job = RemoteOkScraper::map_job(raw).expect("Should map valid job");

        assert_eq!(job.title, "Senior Software Engineer");
        assert_eq!(job.company, "Test Company");
        assert_eq!(job.url, "https://remoteok.com/jobs/123456");
        assert_eq!(job.location, Some("Remote".to_string()));
        assert_eq!(job.source, "remoteok");
        assert_eq!(job.status, JobStatus::Saved);
        assert!(job.description.is_some());
        assert!(job.requirements.is_some());
        assert!(job.salary.is_some());
        assert!(job.salary.unwrap().contains("100000"));
    }

    #[test]
    fn test_map_job_with_minimal_fields() {
        let raw = RemoteOkJobRaw {
            slug: Some("123456".to_string()),
            date: None,
            company: Some("Test Company".to_string()),
            position: Some("Software Engineer".to_string()),
            tags: None,
            description: None,
            location: None,
            apply_url: None,
            salary_min: None,
            salary_max: None,
            url: Some("https://remoteok.com/jobs/123456".to_string()),
        };

        let job = RemoteOkScraper::map_job(raw).expect("Should map job with minimal fields");

        assert_eq!(job.title, "Software Engineer");
        assert_eq!(job.company, "Test Company");
        assert_eq!(job.url, "https://remoteok.com/jobs/123456");
        assert_eq!(job.source, "remoteok");
    }

    #[test]
    fn test_map_job_rejects_empty_title() {
        let raw = RemoteOkJobRaw {
            slug: None,
            date: None,
            company: Some("Test Company".to_string()),
            position: Some("".to_string()),
            tags: None,
            description: None,
            location: None,
            apply_url: None,
            salary_min: None,
            salary_max: None,
            url: Some("https://remoteok.com/jobs/123456".to_string()),
        };

        let job = RemoteOkScraper::map_job(raw);
        assert!(job.is_none(), "Should reject job with empty title");
    }

    #[test]
    fn test_map_job_rejects_empty_company() {
        let raw = RemoteOkJobRaw {
            slug: None,
            date: None,
            company: Some("".to_string()),
            position: Some("Software Engineer".to_string()),
            tags: None,
            description: None,
            location: None,
            apply_url: None,
            salary_min: None,
            salary_max: None,
            url: Some("https://remoteok.com/jobs/123456".to_string()),
        };

        let job = RemoteOkScraper::map_job(raw);
        assert!(job.is_none(), "Should reject job with empty company");
    }

    #[test]
    fn test_map_job_uses_slug_when_url_missing() {
        let raw = RemoteOkJobRaw {
            slug: Some("123456".to_string()),
            date: None,
            company: Some("Test Company".to_string()),
            position: Some("Software Engineer".to_string()),
            tags: None,
            description: None,
            location: None,
            apply_url: None,
            salary_min: None,
            salary_max: None,
            url: None,
        };

        let job = RemoteOkScraper::map_job(raw).expect("Should use slug for URL");
        assert_eq!(job.url, "https://remoteok.com/123456");
    }

    #[test]
    fn test_strip_html_tags() {
        let html = "<p>This is <b>bold</b> text</p>";
        let result = strip_html_tags(html);
        assert_eq!(result, "This is bold text");
    }

    #[test]
    fn test_strip_html_tags_complex() {
        let html = "<div><h1>Title</h1><p>Paragraph with <a href='#'>link</a></p></div>";
        let result = strip_html_tags(html);
        assert!(!result.contains('<'));
        assert!(!result.contains('>'));
        assert!(result.contains("Title"));
        assert!(result.contains("Paragraph"));
        assert!(result.contains("link"));
    }

    #[test]
    fn test_job_matches_query_empty_query() {
        let job = create_test_job();
        assert!(RemoteOkScraper::job_matches_query(&job, ""));
    }

    #[test]
    fn test_job_matches_query_single_word() {
        let job = create_test_job();
        assert!(RemoteOkScraper::job_matches_query(&job, "engineer"));
        assert!(RemoteOkScraper::job_matches_query(&job, "software"));
        assert!(!RemoteOkScraper::job_matches_query(&job, "nonexistent"));
    }

    #[test]
    fn test_job_matches_query_multiple_words() {
        let job = create_test_job();
        assert!(RemoteOkScraper::job_matches_query(
            &job,
            "remote software engineer"
        ));
        assert!(RemoteOkScraper::job_matches_query(
            &job,
            "software engineer remote"
        ));
        assert!(!RemoteOkScraper::job_matches_query(
            &job,
            "remote python developer"
        ));
    }

    #[test]
    fn test_job_matches_query_case_insensitive() {
        let job = create_test_job();
        // The function expects query_lower (already lowercased), so we test with lowercase
        assert!(
            RemoteOkScraper::job_matches_query(&job, "software"),
            "Should match 'software'"
        );
        assert!(
            RemoteOkScraper::job_matches_query(&job, "remote"),
            "Should match 'remote'"
        );
        assert!(
            RemoteOkScraper::job_matches_query(&job, "engineer"),
            "Should match 'engineer'"
        );
        // Test that the function handles case-insensitive matching correctly
        // (the caller lowercases the query before passing it)
        assert!(
            RemoteOkScraper::job_matches_query(&job, &"SOFTWARE".to_lowercase()),
            "Should match lowercased 'SOFTWARE'"
        );
        assert!(
            RemoteOkScraper::job_matches_query(&job, &"Remote".to_lowercase()),
            "Should match lowercased 'Remote'"
        );
        assert!(
            RemoteOkScraper::job_matches_query(&job, &"ENGINEER".to_lowercase()),
            "Should match lowercased 'ENGINEER'"
        );
    }

    fn create_test_job() -> Job {
        Job {
            id: None,
            title: "Senior Software Engineer (Remote)".to_string(),
            company: "Tech Corp".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("We are looking for a remote software engineer".to_string()),
            requirements: Some("5+ years experience, Rust, TypeScript".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            source: crate::scraper::source_normalizer::normalize_source_name("RemoteOK"),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        }
    }
}

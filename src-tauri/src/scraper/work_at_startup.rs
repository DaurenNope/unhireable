use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::collections::HashSet;
use std::time::Duration;

const YC_JOBS_BASE_URL: &str = "https://www.workatastartup.com";

pub struct WorkAtStartupScraper;

impl WorkAtStartupScraper {
    fn build_search_url(query: &str) -> String {
        let q = urlencoding::encode(query.trim());
        format!("{}/jobs?q={}", YC_JOBS_BASE_URL, q)
    }

    fn parse_jobs(html: &str) -> Vec<Job> {
        let document = Html::parse_document(html);

        let job_selector = Selector::parse("div.jobs-list > div > div.w-full").unwrap();
        let title_selector = Selector::parse("div.job-name a").unwrap();
        let company_selector = Selector::parse("div.company-details span.font-bold").unwrap();
        let tagline_selector = Selector::parse("div.company-details span.text-gray-600").unwrap();
        let location_selector = Selector::parse("p.job-details span").unwrap();

        let mut jobs = Vec::new();
        let mut seen_urls = HashSet::new();

        for job_element in document.select(&job_selector) {
            let title_elem = job_element.select(&title_selector).next();
            let Some(title_elem) = title_elem else {
                continue;
            };

            let title = title_elem.text().collect::<String>().trim().to_string();
            if title.is_empty() {
                continue;
            }

            let href = title_elem.value().attr("href").unwrap_or("");
            let url = if href.starts_with("http") {
                href.to_string()
            } else if href.starts_with("/") {
                format!("{}{}", YC_JOBS_BASE_URL, href)
            } else {
                format!("{}/{}", YC_JOBS_BASE_URL, href)
            };

            if url.is_empty() || !seen_urls.insert(url.clone()) {
                continue;
            }

            let company = job_element
                .select(&company_selector)
                .next()
                .map(|elem| {
                    elem.text()
                        .collect::<String>()
                        .replace('\u{a0}', " ")
                        .trim()
                        .to_string()
                })
                .filter(|text| !text.is_empty())
                .map(|text| {
                    // Remove trailing cohort, e.g., "Mashgin (W15)"
                    text.split('(').next().unwrap_or(&text).trim().to_string()
                })
                .unwrap_or_else(|| "Unknown Company".to_string());

            let tagline = job_element
                .select(&tagline_selector)
                .next()
                .map(|elem| elem.text().collect::<String>().trim().to_string());

            let location = job_element
                .select(&location_selector)
                .next()
                .map(|elem| elem.text().collect::<String>().trim().to_string())
                .filter(|text| !text.is_empty());

            let description = tagline.clone();

            jobs.push(Job {
                id: None,
                title: title.clone(),
                company,
                url,
                description,
                requirements: tagline,
                location,
                salary: None,
                source: "workatastartup".to_string(),
                status: JobStatus::Saved,
                match_score: None,
                created_at: None,
                updated_at: None,
                        ..Default::default()
        });
        }

        jobs
    }

    fn job_matches_query(job: &Job, query_lower: &str) -> bool {
        if query_lower.is_empty() {
            return true;
        }

        job.title.to_lowercase().contains(query_lower)
            || job.company.to_lowercase().contains(query_lower)
            || job
                .description
                .as_ref()
                .map_or(false, |d| d.to_lowercase().contains(query_lower))
            || job
                .location
                .as_ref()
                .map_or(false, |l| l.to_lowercase().contains(query_lower))
    }
}

impl JobScraper for WorkAtStartupScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let url = Self::build_search_url(query);
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Unhireable Job Scraper)")
            .build()
            .context("Failed to build HTTP client for Work at a Startup")?;

        println!("Fetching jobs from: {}", url);

        // Courtesy per-domain delay
        {
            use rand::{thread_rng, Rng};
            let mut rng = thread_rng();
            let min = config.per_domain_min_delay_ms as i64;
            let max = config.per_domain_max_delay_ms as i64;
            let ms = if max > min {
                rng.gen_range(min..=max)
            } else {
                min
            }
            .max(0) as u64;
            std::thread::sleep(std::time::Duration::from_millis(ms));
        }

        // Request with retries/backoff
        let mut body = String::new();
        let mut last_err: Option<anyhow::Error> = None;
        let mut attempt = 0;
        while attempt < config.retry_attempts {
            attempt += 1;
            match client.get(&url).send() {
                Ok(resp) => match resp.error_for_status() {
                    Ok(ok) => {
                        body = ok.text().context("Failed to get response body")?;
                        break;
                    }
                    Err(status_err) => {
                        eprintln!(
                            "⚠️  WorkAtStartup bad status (attempt {}/{}): {}",
                            attempt, config.retry_attempts, status_err
                        );
                        last_err = Some(anyhow::anyhow!(status_err));
                    }
                },
                Err(e) => {
                    eprintln!(
                        "⚠️  WorkAtStartup request error (attempt {}/{}): {}",
                        attempt, config.retry_attempts, e
                    );
                    last_err = Some(anyhow::anyhow!(e));
                }
            }
            let delay = (config.retry_delay_secs as f64
                * config.retry_backoff_factor.powi((attempt - 1) as i32))
                as u64;
            std::thread::sleep(std::time::Duration::from_secs(delay.max(1)));
        }
        if body.is_empty() {
            if let Some(e) = last_err {
                eprintln!("WorkAtStartup last error: {}", e);
            }
            return Err(anyhow::anyhow!(
                "Work at a Startup returned no jobs for the query '{}'",
                query
            ));
        }

        let mut jobs = Self::parse_jobs(&body);

        // Filter by query if provided
        let query_lower = query.trim().to_lowercase();
        if !query_lower.is_empty() {
            jobs.retain(|job| Self::job_matches_query(job, &query_lower));
        }

        // Limit count
        if jobs.len() > 50 {
            jobs.truncate(50);
        }

        if jobs.is_empty() {
            Err(anyhow::anyhow!(
                "Work at a Startup returned no jobs for the query '{}'",
                query
            ))
        } else {
            println!(
                "Successfully fetched {} jobs from Work at a Startup",
                jobs.len()
            );
            Ok(jobs)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::JobStatus;

    #[test]
    fn job_matches_query_works() {
        let job = Job {
            id: None,
            title: "Software Engineer".into(),
            company: "YC Startup".into(),
            url: "https://www.workatastartup.com/jobs/123".into(),
            description: Some("Build amazing products with Python and React".into()),
            requirements: None,
            location: Some("San Francisco, CA".into()),
            salary: None,
            source: "workatastartup".into(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
                    ..Default::default()
        };

        assert!(WorkAtStartupScraper::job_matches_query(&job, "software"));
        assert!(WorkAtStartupScraper::job_matches_query(&job, "python"));
        assert!(WorkAtStartupScraper::job_matches_query(&job, "yc startup"));
        assert!(!WorkAtStartupScraper::job_matches_query(&job, "java"));
        assert!(WorkAtStartupScraper::job_matches_query(&job, "")); // Empty query matches all
    }
}

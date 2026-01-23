use crate::db::models::{Job, JobStatus};
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::OnceLock;
use std::time::Duration;

#[derive(Debug, Clone, Copy)]
struct BoardConfig {
    token: &'static str,
    display_name: &'static str,
}

const GREENHOUSE_BOARDS: &[BoardConfig] = &[
    BoardConfig {
        token: "notion",
        display_name: "Notion",
    },
    BoardConfig {
        token: "linear",
        display_name: "Linear",
    },
    BoardConfig {
        token: "zapier",
        display_name: "Zapier",
    },
    BoardConfig {
        token: "figma",
        display_name: "Figma",
    },
    BoardConfig {
        token: "airtable",
        display_name: "Airtable",
    },
    BoardConfig {
        token: "loom",
        display_name: "Loom",
    },
    BoardConfig {
        token: "brex",
        display_name: "Brex",
    },
    BoardConfig {
        token: "stripe",
        display_name: "Stripe",
    },
    BoardConfig {
        token: "openai",
        display_name: "OpenAI",
    },
    BoardConfig {
        token: "databricks",
        display_name: "Databricks",
    },
];

#[derive(Debug, Deserialize)]
struct ApiResponse {
    #[serde(default)]
    jobs: Vec<ApiJob>,
}

#[derive(Debug, Deserialize)]
struct ApiJob {
    id: Option<i64>,
    title: Option<String>,
    absolute_url: Option<String>,
    content: Option<String>,
    #[serde(default)]
    metadata: Vec<ApiMetadata>,
    #[serde(default)]
    departments: Vec<ApiDepartment>,
    location: Option<ApiLocation>,
    #[serde(default)]
    offices: Vec<ApiOffice>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct ApiLocation {
    name: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct ApiMetadata {
    name: Option<String>,
    value: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct ApiDepartment {
    name: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct ApiOffice {
    name: Option<String>,
}

pub struct GreenhouseBoardScraper;

impl GreenhouseBoardScraper {
    fn strip_html_tags(html: &str) -> String {
        static TAG_REGEX: OnceLock<regex::Regex> = OnceLock::new();
        let regex = TAG_REGEX.get_or_init(|| regex::Regex::new(r"(?s)<[^>]*>").unwrap());
        let without_tags = regex.replace_all(html, " ");
        without_tags
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn map_job(board: &BoardConfig, job: ApiJob) -> Option<Job> {
        let title = job.title?.trim().to_string();
        if title.is_empty() {
            return None;
        }

        let url = job.absolute_url?.trim().to_string();
        if url.is_empty() {
            return None;
        }

        let description = job.content.as_ref().map(|html| Self::strip_html_tags(html));

        let location = job
            .location
            .and_then(|loc| loc.name)
            .map(|loc| loc.trim().to_string())
            .filter(|loc| !loc.is_empty());

        let mut salary = None;
        for meta in job.metadata {
            if let (Some(name), Some(value)) = (meta.name.as_deref(), meta.value.as_ref()) {
                if name.eq_ignore_ascii_case("salary") && !value.trim().is_empty() {
                    salary = Some(value.trim().to_string());
                    break;
                }
            }
        }

        let mut tags = Vec::new();
        for dept in job.departments {
            if let Some(name) = dept.name {
                if !name.trim().is_empty() {
                    tags.push(name.trim().to_string());
                }
            }
        }
        for office in job.offices {
            if let Some(name) = office.name {
                if !name.trim().is_empty() {
                    tags.push(name.trim().to_string());
                }
            }
        }

        let mut requirements = None;
        if !tags.is_empty() {
            requirements = Some(format!("Tags: {}", tags.join(", ")));
        }

        Some(Job {
            id: job.id,
            title,
            company: board.display_name.to_string(),
            url,
            description,
            requirements,
            location,
            salary,
            source: "greenhouse".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
        })
    }
}

impl JobScraper for GreenhouseBoardScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent("Mozilla/5.0 (Unhireable Job Scraper)")
            .build()
            .context("Failed to build HTTP client for Greenhouse boards")?;

        let query_lower = query.trim().to_lowercase();
        let mut jobs = Vec::new();
        let mut seen_urls = HashSet::new();
        let mut errors = Vec::new();

        for board in GREENHOUSE_BOARDS {
            let api_url = format!(
                "https://boards-api.greenhouse.io/v1/boards/{}/jobs?content=true",
                board.token
            );

            match client.get(&api_url).send() {
                Ok(response) => {
                    let status = response.status();
                    match response.error_for_status() {
                        Ok(resp) => {
                            match resp.text() {
                                Ok(body) => match serde_json::from_str::<ApiResponse>(&body) {
                                    Ok(api_response) => {
                                        println!(
                                            "   ✅ {}: Found {} jobs",
                                            board.display_name,
                                            api_response.jobs.len()
                                        );
                                        for api_job in api_response.jobs {
                                            if let Some(job) = Self::map_job(board, api_job) {
                                                let matches_query = query_lower.is_empty()
                                                    || job
                                                        .title
                                                        .to_lowercase()
                                                        .contains(&query_lower)
                                                    || job
                                                        .company
                                                        .to_lowercase()
                                                        .contains(&query_lower)
                                                    || job
                                                        .description
                                                        .as_ref()
                                                        .map(|d| {
                                                            d.to_lowercase().contains(&query_lower)
                                                        })
                                                        .unwrap_or(false)
                                                    || job
                                                        .requirements
                                                        .as_ref()
                                                        .map(|d| {
                                                            d.to_lowercase().contains(&query_lower)
                                                        })
                                                        .unwrap_or(false)
                                                    || job
                                                        .location
                                                        .as_ref()
                                                        .map(|l| {
                                                            l.to_lowercase().contains(&query_lower)
                                                        })
                                                        .unwrap_or(false);

                                                if matches_query
                                                    && seen_urls.insert(job.url.clone())
                                                {
                                                    jobs.push(job);
                                                }
                                            }
                                        }
                                    }
                                    Err(err) => {
                                        // Only log parsing errors for non-404s (404s are expected for some boards)
                                        if status != 404 {
                                            let mut fallback_succeeded = false;
                                            // Some Greenhouse boards have different JSON structures
                                            // Try to parse jobs array directly if the root structure fails
                                            if let Ok(json_value) =
                                                serde_json::from_str::<serde_json::Value>(&body)
                                            {
                                                if let Some(jobs_array) = json_value.get("jobs") {
                                                    if let Some(jobs_vec) = jobs_array.as_array() {
                                                        println!("   ⚠️  {}: JSON structure differs, but found {} jobs in array", board.display_name, jobs_vec.len());
                                                        // Try to parse each job individually with lenient error handling
                                                        let mut parsed_count = 0;
                                                        for job_val in jobs_vec {
                                                            // Try to parse job - some fields might be null or different types
                                                            let api_job_result =
                                                                serde_json::from_value::<ApiJob>(
                                                                    job_val.clone(),
                                                                );

                                                            // If parsing fails, try to extract fields manually
                                                            let api_job = if let Ok(job) =
                                                                api_job_result
                                                            {
                                                                job
                                                            } else if let Some(mut job_obj) =
                                                                job_val.clone().as_object().cloned()
                                                            {
                                                                // Manual field extraction for non-standard structures
                                                                ApiJob {
                                                                id: job_obj.get("id").and_then(|v| v.as_i64()),
                                                                title: job_obj.remove("title")
                                                                    .and_then(|v| {
                                                                        // Handle string or null
                                                                        if v.is_null() {
                                                                            None
                                                                        } else if let Some(s) = v.as_str() {
                                                                            Some(s.to_string())
                                                                        } else {
                                                                            None
                                                                        }
                                                                    }),
                                                                absolute_url: job_obj.remove("absolute_url")
                                                                    .or_else(|| job_obj.remove("url"))
                                                                    .and_then(|v| {
                                                                        // Handle string or null
                                                                        if v.is_null() {
                                                                            None
                                                                        } else if let Some(s) = v.as_str() {
                                                                            Some(s.to_string())
                                                                        } else {
                                                                            None
                                                                        }
                                                                    }),
                                                                content: job_obj.remove("content")
                                                                    .and_then(|v| {
                                                                        // Handle string or null
                                                                        if v.is_null() {
                                                                            None
                                                                        } else if let Some(s) = v.as_str() {
                                                                            Some(s.to_string())
                                                                        } else {
                                                                            None
                                                                        }
                                                                    }),
                                                                metadata: job_obj.remove("metadata")
                                                                    .and_then(|v| {
                                                                        // Handle null, array, or other types
                                                                        if v.is_null() {
                                                                            Some(Vec::new())
                                                                        } else if let Some(arr) = v.as_array() {
                                                                            Some(arr.iter().filter_map(|item| {
                                                                                if item.is_null() {
                                                                                    None
                                                                                } else if let Some(obj) = item.as_object() {
                                                                                    Some(ApiMetadata {
                                                                                    name: obj.get("name").and_then(|v| v.as_str().map(|s| s.to_owned())),
                                                                                    value: obj.get("value").and_then(|v| v.as_str().map(|s| s.to_owned())),
                                                                                })
                                                                                } else {
                                                                                    None
                                                                                }
                                                                            }).collect())
                                                                        } else {
                                                                            Some(Vec::new())
                                                                        }
                                                                    })
                                                                    .unwrap_or_default(),
                                                                departments: job_obj.remove("departments")
                                                                    .and_then(|v| {
                                                                        // Handle null, array, or other types
                                                                        if v.is_null() {
                                                                            Some(Vec::new())
                                                                        } else if let Some(arr) = v.as_array() {
                                                                            Some(arr.iter().filter_map(|item| {
                                                                                if item.is_null() {
                                                                                    None
                                                                                } else if let Some(obj) = item.as_object() {
                                                                                    Some(ApiDepartment {
                                                                                    name: obj.get("name").and_then(|v| v.as_str().map(|s| s.to_owned())),
                                                                                })
                                                                                } else {
                                                                                    None
                                                                                }
                                                                            }).collect())
                                                                        } else {
                                                                            Some(Vec::new())
                                                                        }
                                                                    })
                                                                    .unwrap_or_default(),
                                                                location: job_obj.get("location")
                                                                    .and_then(|v| {
                                                                        // Handle null or object
                                                                        if v.is_null() {
                                                                            None
                                                                        } else if let Some(obj) = v.as_object() {
                                                                            Some(ApiLocation {
                                                                                name: obj.get("name").and_then(|v| {
                                                                                    // Handle string or null
                                                                                    if v.is_null() {
                                                                                        None
                                                                                    } else {
                                                                                        v.as_str().map(|s| s.to_string())
                                                                                    }
                                                                                }),
                                                                            })
                                                                        } else {
                                                                            None
                                                                        }
                                                                    }),
                                                                offices: job_obj.remove("offices")
                                                                    .and_then(|v| {
                                                                        // Handle null, array, or other types
                                                                        if v.is_null() {
                                                                            Some(Vec::new())
                                                                        } else if let Some(arr) = v.as_array() {
                                                                            Some(arr.iter().filter_map(|item| {
                                                                                if item.is_null() {
                                                                                    None
                                                                                } else if let Some(obj) = item.as_object() {
                                                                                    Some(ApiOffice {
                                                                                        name: obj.get("name").and_then(|v| {
                                                                                            if v.is_null() {
                                                                                                None
                                                                                            } else {
                                                                                                v.as_str().map(|s| s.to_owned())
                                                                                            }
                                                                                        }),
                                                                                    })
                                                                                } else {
                                                                                    None
                                                                                }
                                                                            }).collect())
                                                                        } else {
                                                                            Some(Vec::new())
                                                                        }
                                                                    })
                                                                    .unwrap_or_default(),
                                                            }
                                                            } else {
                                                                continue; // Skip this job if we can't parse it
                                                            };

                                                            if let Some(job) =
                                                                Self::map_job(board, api_job)
                                                            {
                                                                let matches_query = query_lower
                                                                    .is_empty()
                                                                    || job
                                                                        .title
                                                                        .to_lowercase()
                                                                        .contains(&query_lower)
                                                                    || job
                                                                        .company
                                                                        .to_lowercase()
                                                                        .contains(&query_lower)
                                                                    || job
                                                                        .description
                                                                        .as_ref()
                                                                        .map(|d| {
                                                                            d.to_lowercase()
                                                                                .contains(
                                                                                    &query_lower,
                                                                                )
                                                                        })
                                                                        .unwrap_or(false)
                                                                    || job
                                                                        .requirements
                                                                        .as_ref()
                                                                        .map(|d| {
                                                                            d.to_lowercase()
                                                                                .contains(
                                                                                    &query_lower,
                                                                                )
                                                                        })
                                                                        .unwrap_or(false)
                                                                    || job
                                                                        .location
                                                                        .as_ref()
                                                                        .map(|l| {
                                                                            l.to_lowercase()
                                                                                .contains(
                                                                                    &query_lower,
                                                                                )
                                                                        })
                                                                        .unwrap_or(false);

                                                                if matches_query
                                                                    && seen_urls
                                                                        .insert(job.url.clone())
                                                                {
                                                                    jobs.push(job);
                                                                    parsed_count += 1;
                                                                }
                                                            }
                                                        }
                                                        if parsed_count > 0 {
                                                            println!("   ✅ {}: Successfully parsed {} jobs (with fallback parser)", board.display_name, parsed_count);
                                                            // Skip error logging - successfully parsed jobs
                                                            fallback_succeeded = true;
                                                        } else {
                                                            println!("   ⚠️  {}: Found {} jobs in array but couldn't parse any (likely query mismatch or parsing issues)", board.display_name, jobs_vec.len());
                                                            // Don't add to errors - this is expected for some boards with non-standard structures
                                                            // Just continue to next board
                                                            fallback_succeeded = true;
                                                            // Consider it handled even if no jobs matched query
                                                        }
                                                    } else {
                                                        // No jobs array found - might be a different structure
                                                        // Try to parse as direct array
                                                        if let Ok(direct_array) =
                                                            serde_json::from_str::<
                                                                Vec<serde_json::Value>,
                                                            >(
                                                                &body
                                                            )
                                                        {
                                                            println!("   ⚠️  {}: JSON structure differs (direct array), found {} items", board.display_name, direct_array.len());
                                                            // Try to parse each item
                                                            let mut parsed_count = 0;
                                                            for item in direct_array {
                                                                if let Some(mut job_obj) =
                                                                    item.as_object().cloned()
                                                                {
                                                                    let api_job = ApiJob {
                                                                    id: job_obj.get("id").and_then(|v| v.as_i64()),
                                                                    title: job_obj.remove("title").and_then(|v| {
                                                                        if v.is_null() { None } else { v.as_str().map(|s| s.to_string()) }
                                                                    }),
                                                                    absolute_url: job_obj.remove("absolute_url").or_else(|| job_obj.remove("url")).and_then(|v| {
                                                                        if v.is_null() { None } else { v.as_str().map(|s| s.to_string()) }
                                                                    }),
                                                                    content: job_obj.remove("content").and_then(|v| {
                                                                        if v.is_null() { None } else { v.as_str().map(|s| s.to_string()) }
                                                                    }),
                                                                    metadata: job_obj.remove("metadata").and_then(|v| {
                                                                        if v.is_null() { Some(Vec::new()) } else if let Some(arr) = v.as_array() {
                                                                            Some(arr.iter().filter_map(|item| {
                                                                                if item.is_null() { None } else if let Some(obj) = item.as_object() {
                                                                                    Some(ApiMetadata {
                                                                                        name: obj.get("name").and_then(|v| v.as_str().map(|s| s.to_owned())),
                                                                                        value: obj.get("value").and_then(|v| v.as_str().map(|s| s.to_owned())),
                                                                                    })
                                                                                } else { None }
                                                                            }).collect())
                                                                        } else { Some(Vec::new()) }
                                                                    }).unwrap_or_default(),
                                                                    departments: job_obj.remove("departments").and_then(|v| {
                                                                        if v.is_null() { Some(Vec::new()) } else if let Some(arr) = v.as_array() {
                                                                            Some(arr.iter().filter_map(|item| {
                                                                                if item.is_null() { None } else if let Some(obj) = item.as_object() {
                                                                                    Some(ApiDepartment { name: obj.get("name").and_then(|v| v.as_str().map(|s| s.to_owned())) })
                                                                                } else { None }
                                                                            }).collect())
                                                                        } else { Some(Vec::new()) }
                                                                    }).unwrap_or_default(),
                                                                    location: job_obj.get("location").and_then(|v| {
                                                                        if v.is_null() { None } else if let Some(obj) = v.as_object() {
                                                                            Some(ApiLocation { name: obj.get("name").and_then(|v| if v.is_null() { None } else { v.as_str().map(|s| s.to_string()) }) })
                                                                        } else { None }
                                                                    }),
                                                                    offices: job_obj.remove("offices").and_then(|v| {
                                                                        if v.is_null() { Some(Vec::new()) } else if let Some(arr) = v.as_array() {
                                                                            Some(arr.iter().filter_map(|item| {
                                                                                if item.is_null() { None } else if let Some(obj) = item.as_object() {
                                                                                    Some(ApiOffice { name: obj.get("name").and_then(|v| if v.is_null() { None } else { v.as_str().map(|s| s.to_owned()) }) })
                                                                                } else { None }
                                                                            }).collect())
                                                                        } else { Some(Vec::new()) }
                                                                    }).unwrap_or_default(),
                                                                };

                                                                    if let Some(job) = Self::map_job(
                                                                        board, api_job,
                                                                    ) {
                                                                        let matches_query = query_lower.is_empty()
                                                                        || job.title.to_lowercase().contains(&query_lower)
                                                                        || job.company.to_lowercase().contains(&query_lower)
                                                                        || job.description.as_ref().map(|d| d.to_lowercase().contains(&query_lower)).unwrap_or(false)
                                                                        || job.requirements.as_ref().map(|d| d.to_lowercase().contains(&query_lower)).unwrap_or(false)
                                                                        || job.location.as_ref().map(|l| l.to_lowercase().contains(&query_lower)).unwrap_or(false);

                                                                        if matches_query
                                                                            && seen_urls.insert(
                                                                                job.url.clone(),
                                                                            )
                                                                        {
                                                                            jobs.push(job);
                                                                            parsed_count += 1;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            if parsed_count > 0 {
                                                                println!("   ✅ {}: Successfully parsed {} jobs (with direct array parser)", board.display_name, parsed_count);
                                                                fallback_succeeded = true;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            // Only add error if we didn't successfully use fallback parser
                                            if !fallback_succeeded {
                                                errors.push(format!(
                                                    "Failed to parse Greenhouse board {}: {}",
                                                    board.token, err
                                                ));
                                            }
                                        } else {
                                            // Silently skip 404 boards - they just don't use Greenhouse anymore
                                        }
                                    }
                                },
                                Err(err) => {
                                    if status != 404 {
                                        errors.push(format!(
                                            "Failed to read Greenhouse board response {}: {}",
                                            board.token, err
                                        ));
                                    }
                                }
                            }
                        }
                        Err(err) => {
                            // Only log non-404 errors (404s are expected for some boards)
                            if status != 404 {
                                errors.push(format!(
                                    "Greenhouse board {} returned error: {}",
                                    board.token, err
                                ));
                            }
                            // Silently skip 404 boards
                        }
                    }
                }
                Err(err) => {
                    errors.push(format!(
                        "Failed to request Greenhouse board {}: {}",
                        board.token, err
                    ));
                }
            }
        }

        if jobs.is_empty() {
            if errors.is_empty() {
                // No jobs but no errors - likely query doesn't match any jobs
                Err(anyhow::anyhow!(
                    "Greenhouse boards returned no jobs for the query '{}'",
                    query
                ))
            } else {
                // Some errors, but if we have jobs from other boards, still return them
                // Only fail if we have critical errors and no jobs at all
                Err(anyhow::anyhow!(
                    "Greenhouse boards failed: {}",
                    errors.join("; ")
                ))
            }
        } else {
            // Return jobs even if some boards had errors (404s are expected for some companies)
            if !errors.is_empty() {
                println!("   ⚠️  Some Greenhouse boards had errors (this is normal for companies that changed systems)");
            }
            println!(
                "✅ Greenhouse boards returned {} job(s) across {} companies",
                jobs.len(),
                jobs.iter()
                    .map(|j| &j.company)
                    .collect::<HashSet<_>>()
                    .len()
            );
            Ok(jobs)
        }
    }
}

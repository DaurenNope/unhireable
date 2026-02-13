use crate::db::models::Job;
use crate::scraper::{config::ScraperConfig, JobScraper};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::thread;
use std::time::Duration;

pub struct HhKzScraper;

fn retry_with_backoff<F, T>(mut f: F, max_attempts: u32, delay_secs: u64) -> Result<T>
where
    F: FnMut() -> Result<T>,
{
    let mut last_error = None;
    for attempt in 1..=max_attempts {
        match f() {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_error = Some(e);
                if attempt < max_attempts {
                    let delay = delay_secs * (attempt as u64);
                    eprintln!(
                        "hh.kz scrape attempt {} failed, retrying in {}s...",
                        attempt, delay
                    );
                    thread::sleep(Duration::from_secs(delay));
                }
            }
        }
    }
    Err(last_error.unwrap())
}

impl JobScraper for HhKzScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        self.scrape_with_config(query, &ScraperConfig::default())
    }

    fn scrape_with_config(&self, query: &str, config: &ScraperConfig) -> Result<Vec<Job>> {
        // Support both hh.ru (Russia) and hh.kz (Kazakhstan)
        // Default to hh.ru as it's the main site with more jobs
        let base_url = if query.contains("kz") || query.contains("kazakhstan") {
            "https://hh.kz"
        } else {
            "https://hh.ru"
        };

        let max_pages = if config.max_pages == 0 {
            10
        } else {
            config.max_pages
        }; // Default to 10 if unlimited
        let mut all_jobs = Vec::new();

        // Loop through pages
        for page in 0..max_pages {
            let url = format!("{}/search/vacancy?text={}&area=113&salary=&currency_code=RUR&experience=doesNotMatter&order_by=relevance&search_period=0&items_on_page=20&page={}&no_magic=true",
                base_url,
                urlencoding::encode(query),
                page
            );

            let base_url_clone = base_url.to_string(); // Clone for use in closure
            let url_clone = url.clone(); // Clone URL for closure
            let url_for_browser = url.clone(); // Clone for browser automation fallback
            let timeout_secs = config.timeout_secs; // Clone timeout
            let result = retry_with_backoff(
                move || {
                    let client = Client::builder()
                        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                        .timeout(Duration::from_secs(timeout_secs))
                        .build()?;

                    let response = client
                        .get(&url_clone)
                        .send()
                        .context(format!("Failed to send request to {}", base_url_clone))?
                        .text()
                        .context(format!("Failed to read response from {}", base_url_clone))?;

                    let document = Html::parse_document(&response);

                    // Try multiple selector patterns (hh.ru/hh.kz may have changed structure)
                    let job_selectors = [
                        "div.vacancy-serp-item",
                        "div[data-qa='vacancy-serp__vacancy']",
                        "div.serp-item",
                        "div[data-qa='vacancy-serp__vacancy-employer']",
                    ];

                    let title_selectors = [
                        "a.serp-item__title",
                        "a[data-qa='vacancy-serp__vacancy-title']",
                        "a.bloko-link",
                        "h3 a",
                    ];

                    let company_selectors = [
                        "a.bloko-link_kind-tertiary",
                        "a[data-qa='vacancy-serp__vacancy-employer']",
                        "span[data-qa='vacancy-serp__vacancy-employer']",
                        "a.bloko-link_secondary",
                    ];

                    // Salary selectors are now handled inline

                    let mut jobs = Vec::new();

                    // Try each selector pattern
                    'outer: for job_sel in &job_selectors {
                        let job_selector = match Selector::parse(job_sel) {
                            Ok(s) => s,
                            Err(_) => continue,
                        };

                        let job_elements: Vec<_> = document.select(&job_selector).collect();
                        if job_elements.is_empty() {
                            continue;
                        }

                        println!(
                            "Found {} job elements with selector: {}",
                            job_elements.len(),
                            job_sel
                        );

                        // Try simpler approach: parse all elements with the most common selectors
                        let title_selector = Selector::parse("a[data-qa='vacancy-serp__vacancy-title'], a.serp-item__title, a.bloko-link").ok();
                        let company_selector = Selector::parse("a[data-qa='vacancy-serp__vacancy-employer'], a.bloko-link_kind-tertiary, span[data-qa='vacancy-serp__vacancy-employer']").ok();
                        let salary_selector = Selector::parse("span[data-qa='vacancy-serp__vacancy-compensation'], span.bloko-header-section-2").ok();

                        let mut parsed_jobs = Vec::new();
                        for element in &job_elements {
                            // Try to find title and URL
                            let mut title = String::new();
                            let mut job_url = String::new();

                            // Try primary selector first
                            if let Some(ref ts) = title_selector {
                                if let Some(title_elem) = element.select(ts).next() {
                                    title =
                                        title_elem.text().collect::<String>().trim().to_string();
                                    if let Some(href) = title_elem.value().attr("href") {
                                        job_url = if href.starts_with("http") {
                                            href.to_string()
                                        } else {
                                            format!("{}{}", base_url_clone, href)
                                        };
                                    }
                                }
                            }

                            // If title not found, try alternative selectors
                            if title.is_empty() {
                                for ts in &title_selectors {
                                    if let Ok(ts_sel) = Selector::parse(ts) {
                                        if let Some(title_elem) = element.select(&ts_sel).next() {
                                            title = title_elem
                                                .text()
                                                .collect::<String>()
                                                .trim()
                                                .to_string();
                                            if let Some(href) = title_elem.value().attr("href") {
                                                job_url = if href.starts_with("http") {
                                                    href.to_string()
                                                } else {
                                                    format!("{}{}", base_url, href)
                                                };
                                            }
                                            if !title.is_empty() {
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            // If still no title, try finding ANY link in the element as fallback
                            if title.is_empty() {
                                if let Ok(any_link_sel) = Selector::parse("a") {
                                    if let Some(link) = element.select(&any_link_sel).next() {
                                        let link_text =
                                            link.text().collect::<String>().trim().to_string();
                                        if !link_text.is_empty() && link_text.len() > 3 {
                                            title = link_text;
                                            if let Some(href) = link.value().attr("href") {
                                                job_url = if href.starts_with("http") {
                                                    href.to_string()
                                                } else {
                                                    format!("{}{}", base_url, href)
                                                };
                                            }
                                        }
                                    }
                                }
                            }

                            if title.is_empty() || job_url.is_empty() {
                                continue;
                            }

                            // Try to find company
                            let mut company = String::new();
                            if let Some(ref cs) = company_selector {
                                if let Some(company_elem) = element.select(cs).next() {
                                    company =
                                        company_elem.text().collect::<String>().trim().to_string();
                                }
                            }

                            // If company not found, try alternative selectors
                            if company.is_empty() {
                                for cs in &company_selectors {
                                    if let Ok(cs_sel) = Selector::parse(cs) {
                                        if let Some(company_elem) = element.select(&cs_sel).next() {
                                            company = company_elem
                                                .text()
                                                .collect::<String>()
                                                .trim()
                                                .to_string();
                                            if !company.is_empty() {
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            if company.is_empty() {
                                company = "Unknown Company".to_string();
                            }

                            // Try to find salary
                            let salary = if let Some(ref ss) = salary_selector {
                                element
                                    .select(ss)
                                    .next()
                                    .map(|e| e.text().collect::<String>().trim().to_string())
                                    .filter(|s| !s.is_empty())
                            } else {
                                None
                            };

                            // Try to find description/snippet
                            let description_selectors = [
                                "div[data-qa='vacancy-serp__vacancy_snippet']",
                                "div.g-user-content",
                                "div.vacancy-serp-item__snippet",
                                "div.snippet",
                                "span[data-qa='vacancy-serp__vacancy_snippet_responsibility']",
                                "span[data-qa='vacancy-serp__vacancy_snippet_requirement']",
                            ];

                            let mut description_parts = Vec::new();
                            for desc_sel in &description_selectors {
                                if let Ok(desc_selector) = Selector::parse(desc_sel) {
                                    for desc_elem in element.select(&desc_selector) {
                                        let text =
                                            desc_elem.text().collect::<String>().trim().to_string();
                                        if !text.is_empty() && text.len() > 10 {
                                            description_parts.push(text);
                                        }
                                    }
                                }
                            }

                            // Also try to find any text content in the element that might be a snippet
                            if description_parts.is_empty() {
                                // Look for divs with class containing "snippet" or "description"
                                if let Ok(snippet_sel) = Selector::parse("div[class*='snippet'], div[class*='description'], span[class*='snippet']") {
                                    for snippet_elem in element.select(&snippet_sel) {
                                        let text = snippet_elem.text().collect::<String>().trim().to_string();
                                        if !text.is_empty() && text.len() > 20 && text.len() < 500 {
                                            description_parts.push(text);
                                            break; // Take first meaningful snippet
                                        }
                                    }
                                }
                            }

                            let description = if description_parts.is_empty() {
                                None
                            } else {
                                Some(description_parts.join("\n\n"))
                            };

                            // Try to find location
                            let location_selectors = [
                                "span[data-qa='vacancy-serp__vacancy-address']",
                                "span[data-qa='vacancy-serp__vacancy-location']",
                                "div.vacancy-serp-item__meta-info",
                            ];

                            let mut location = None;
                            for loc_sel in &location_selectors {
                                if let Ok(loc_selector) = Selector::parse(loc_sel) {
                                    if let Some(loc_elem) = element.select(&loc_selector).next() {
                                        let loc_text =
                                            loc_elem.text().collect::<String>().trim().to_string();
                                        if !loc_text.is_empty() {
                                            location = Some(loc_text);
                                            break;
                                        }
                                    }
                                }
                            }

                            let job = Job {
                                id: None,
                                title,
                                company,
                                url: job_url,
                                description,
                                requirements: None, // Requirements typically require visiting the detail page
                                location,
                                salary,
                                source: if base_url_clone.contains("hh.ru") {
                                    "hh.ru".to_string()
                                } else {
                                    "hh.kz".to_string()
                                },
                                status: crate::db::models::JobStatus::Saved,
                                match_score: None,
                                created_at: None,
                                updated_at: None,
                                        ..Default::default()
        };

                            parsed_jobs.push(job);
                        }

                        if !parsed_jobs.is_empty() {
                            println!(
                                "✅ Successfully parsed {} jobs from {} with selector: {}",
                                parsed_jobs.len(),
                                base_url_clone,
                                job_sel
                            );
                            jobs = parsed_jobs;
                            break 'outer;
                        }
                    }

                    // Debug: Log response size and sample HTML if no jobs found
                    if jobs.is_empty() {
                        eprintln!(
                            "⚠️  No jobs found in {} response (page {})",
                            base_url_clone, page
                        );
                        eprintln!("Response length: {} bytes", response.len());
                        // Return empty - this means we've reached the end of results
                        return Ok(Vec::new());
                    }

                    Ok(jobs)
                },
                config.retry_attempts,
                config.retry_delay_secs,
            );

            match result {
                Ok(mut jobs) => {
                    if jobs.is_empty() {
                        // No more jobs found on this page, stop pagination
                        println!(
                            "   📄 Page {} returned 0 jobs - reached end of results",
                            page
                        );
                        break;
                    }

                    println!("   📄 Page {}: Found {} jobs", page, jobs.len());
                    all_jobs.append(&mut jobs);

                    // Add delay between pages to be respectful
                    if page < max_pages - 1 {
                        thread::sleep(Duration::from_millis(500));
                    }
                }
                Err(e) => {
                    // If we've already scraped some pages, return what we have
                    if !all_jobs.is_empty() {
                        println!("   ⚠️  Error on page {}: {}, but already collected {} jobs from previous pages", page, e, all_jobs.len());
                        break;
                    }

                    let base_url_for_browser = base_url.to_string(); // Clone for browser automation section
                    eprintln!("Failed to scrape {} via HTTP: {}", base_url_for_browser, e);
                    // Fallback to browser automation if available and enabled
                    if config.use_browser_automation {
                        use crate::scraper::browser::BrowserScraper;
                        println!(
                            "🌐 {}: Using browser automation to bypass blocking...",
                            base_url_for_browser
                        );
                        let html = if BrowserScraper::is_playwright_available() {
                            println!("   Using Playwright for better stealth...");
                            BrowserScraper::new()
                                .with_timeout(config.timeout_secs)
                                .scrape(&url_for_browser)?
                        } else if BrowserScraper::is_chromium_available() {
                            println!("   Using headless Chrome...");
                            BrowserScraper::new()
                                .with_timeout(config.timeout_secs)
                                .scrape(&url_for_browser)?
                        } else {
                            return Err(anyhow::anyhow!(
                            "Browser automation requested but neither Playwright nor Chrome is available"
                        ));
                        };
                        println!(
                            "   Browser automation returned {} bytes of HTML",
                            html.len()
                        );
                        // Reuse parsing logic
                        // For hh.ru/hh.kz, reuse the same parsing by calling into this function's parsing section.
                        // Simplest: construct a mini-parser here for the common selectors.
                        let document = Html::parse_document(&html);
                        let job_selector = Selector::parse("div.vacancy-serp-item, div[data-qa='vacancy-serp__vacancy'], div.serp-item").unwrap();
                        let title_selector = Selector::parse("a.serp-item__title, a[data-qa='vacancy-serp__vacancy-title'], a.bloko-link").unwrap();
                        let company_selector = Selector::parse("a.bloko-link_kind-tertiary, a[data-qa='vacancy-serp__vacancy-employer'], span[data-qa='vacancy-serp__vacancy-employer'], a.bloko-link_secondary").unwrap();
                        let salary_selector = Selector::parse("span.bloko-header-section-2, span[data-qa='vacancy-serp__vacancy-compensation'], div.vacancy-serp-item__compensation").unwrap();

                        let mut jobs = Vec::new();
                        for element in document.select(&job_selector) {
                            let title_elem = element.select(&title_selector).next();
                            let company_elem = element.select(&company_selector).next();
                            if let (Some(title_elem), Some(company_elem)) =
                                (title_elem, company_elem)
                            {
                                let title =
                                    title_elem.text().collect::<String>().trim().to_string();
                                if title.is_empty() {
                                    continue;
                                }
                                let mut job_url =
                                    title_elem.value().attr("href").unwrap_or("").to_string();
                                if !job_url.starts_with("http") {
                                    job_url = format!("{}{}", base_url_for_browser, job_url);
                                }
                                let company =
                                    company_elem.text().collect::<String>().trim().to_string();
                                if company.is_empty() {
                                    continue;
                                }
                                let salary = element
                                    .select(&salary_selector)
                                    .next()
                                    .map(|e| e.text().collect::<String>().trim().to_string())
                                    .unwrap_or_default();
                                jobs.push(Job {
                                    id: None,
                                    title,
                                    company,
                                    url: job_url,
                                    description: None,
                                    requirements: None,
                                    location: None,
                                    salary: if salary.is_empty() {
                                        None
                                    } else {
                                        Some(salary)
                                    },
                                    source: if base_url_for_browser.contains("hh.ru") {
                                        "hh.ru".to_string()
                                    } else {
                                        "hh.kz".to_string()
                                    },
                                    status: crate::db::models::JobStatus::Saved,
                                    match_score: None,
                                    created_at: None,
                                    updated_at: None,
                                            ..Default::default()
        });
                            }
                        }
                        if jobs.is_empty() {
                            eprintln!(
                                "⚠️  {}: No jobs found even with browser automation",
                                base_url_for_browser
                            );
                            // If we've already scraped some pages, return what we have
                            if !all_jobs.is_empty() {
                                println!(
                                    "   But already collected {} jobs from previous pages",
                                    all_jobs.len()
                                );
                                break;
                            }
                            return Ok(vec![]);
                        } else {
                            println!(
                                "✅ Successfully fetched {} jobs from {} (via browser)",
                                jobs.len(),
                                base_url_for_browser
                            );
                            all_jobs.append(&mut jobs);
                            // Continue pagination with browser automation if more pages needed
                            // (Note: Browser automation pagination would need to be implemented separately)
                            break; // For now, just use browser automation for first page
                        }
                    } else {
                        // If we've already scraped some pages, return what we have
                        if !all_jobs.is_empty() {
                            println!("   ⚠️  Error on page {}: {}, but already collected {} jobs from previous pages", page, e, all_jobs.len());
                            break;
                        }
                        // If first page fails completely, return error
                        return Err(e);
                    }
                } // End Err arm
            } // End match result
        } // End for page loop

        // Return all collected jobs from all pages
        let pages_scraped = if all_jobs.is_empty() {
            0
        } else {
            // Estimate pages based on job count (assuming ~20 jobs per page)
            std::cmp::max(1, (all_jobs.len() + 19) / 20)
        };
        println!(
            "✅ Total jobs scraped from {}: {} (across {} page{})",
            base_url,
            all_jobs.len(),
            pages_scraped,
            if pages_scraped == 1 { "" } else { "s" }
        );
        Ok(all_jobs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hh_kz_scraper() {
        // Test the HTML parsing logic directly since mocking HTTP requests with custom URLs is complex
        use scraper::{Html, Selector};

        let html_content = include_str!("../../test/fixtures/hh_kz_search.html");
        let document = Html::parse_document(html_content);

        let job_selector = Selector::parse("div.vacancy-serp-item").unwrap();
        let title_selector = Selector::parse("a.serp-item__title").unwrap();
        let company_selector = Selector::parse("a.bloko-link_kind-tertiary").unwrap();

        println!("Testing HTML parsing directly...");
        println!("HTML length: {}", html_content.len());
        println!(
            "Found {} job elements",
            document.select(&job_selector).count()
        );
        println!(
            "Found {} title elements",
            document.select(&title_selector).count()
        );
        println!(
            "Found {} company elements",
            document.select(&company_selector).count()
        );

        // Test parsing one job element
        let mut jobs = Vec::new();
        for element in document.select(&job_selector) {
            let title_elem = element.select(&title_selector).next();
            let company_elem = element.select(&company_selector).next();

            if let (Some(title_elem), Some(company_elem)) = (title_elem, company_elem) {
                let title = title_elem.text().collect::<String>().trim().to_string();
                let url = title_elem.value().attr("href").unwrap_or("").to_string();
                let company = company_elem.text().collect::<String>().trim().to_string();

                println!("Parsed job: {} at {} - {}", title, company, url);
                jobs.push(title);
            }
        }

        assert!(
            !jobs.is_empty(),
            "Should find at least one job in test fixture"
        );
        assert_eq!(jobs[0], "Frontend Developer");
    }
}

use anyhow::{Result, anyhow};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirecrawlResponse {
    pub success: bool,
    pub data: Option<FirecrawlData>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirecrawlData {
    pub markdown: Option<String>,
    pub html: Option<String>,
    pub metadata: Option<FirecrawlMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirecrawlMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub source_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct FirecrawlClient {
    api_key: String,
    base_url: String,
    client: Client,
}

impl FirecrawlClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            base_url: "https://api.firecrawl.dev/v1".to_string(),
            client: Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    pub fn scrape_url(&self, url: &str, options: Option<FirecrawlOptions>) -> Result<String> {
        let endpoint = format!("{}/scrape", self.base_url);
        
        let mut payload = serde_json::json!({
            "url": url
        });

        if let Some(opts) = options {
            if let Some(formats) = opts.formats {
                payload["formats"] = serde_json::json!(formats);
            }
            if let Some(actions) = opts.actions {
                payload["actions"] = serde_json::json!(actions);
            }
            if opts.only_main_content.unwrap_or(false) {
                payload["onlyMainContent"] = serde_json::json!(true);
            }
        }

        let response = self
            .client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .map_err(|e| anyhow!("Failed to send request to Firecrawl: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().unwrap_or_default();
            return Err(anyhow!(
                "Firecrawl API error ({}): {}",
                status,
                error_text
            ));
        }

        let firecrawl_response: FirecrawlResponse = response
            .json()
            .map_err(|e| anyhow!("Failed to parse Firecrawl response: {}", e))?;

        if !firecrawl_response.success {
            return Err(anyhow!(
                "Firecrawl API returned error: {}",
                firecrawl_response.error.unwrap_or_else(|| "Unknown error".to_string())
            ));
        }

        if let Some(data) = firecrawl_response.data {
            // Prefer markdown, fallback to HTML
            if let Some(markdown) = data.markdown {
                Ok(markdown)
            } else if let Some(html) = data.html {
                Ok(html)
            } else {
                Err(anyhow!("Firecrawl returned empty content"))
            }
        } else {
            Err(anyhow!("Firecrawl returned no data"))
        }
    }

    pub fn scrape_html(&self, url: &str) -> Result<String> {
        let options = FirecrawlOptions {
            formats: Some(vec!["html".to_string()]),
            actions: None,
            only_main_content: Some(false),
        };
        self.scrape_url(url, Some(options))
    }

    pub fn scrape_markdown(&self, url: &str) -> Result<String> {
        let options = FirecrawlOptions {
            formats: Some(vec!["markdown".to_string()]),
            actions: None,
            only_main_content: Some(true),
        };
        self.scrape_url(url, Some(options))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirecrawlOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formats: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actions: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub only_main_content: Option<bool>,
}

impl Default for FirecrawlOptions {
    fn default() -> Self {
        Self {
            formats: Some(vec!["html".to_string(), "markdown".to_string()]),
            actions: None,
            only_main_content: Some(true),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_firecrawl_client_creation() {
        let client = FirecrawlClient::new("test-key".to_string());
        assert_eq!(client.base_url, "https://api.firecrawl.dev/v1");
    }
}


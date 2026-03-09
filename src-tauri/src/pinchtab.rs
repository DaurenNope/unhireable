//! PinchTab HTTP client for browser automation.
//!
//! PinchTab (https://github.com/pinchtab/pinchtab) is a standalone HTTP server
//! that gives AI agents direct control over Chrome. Used for external ATS
//! applications when the extension's tab-based flow fails or when we have
//! the ATS URL upfront.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:9867";

/// PinchTab HTTP client
#[derive(Debug, Clone)]
pub struct PinchTabClient {
    base_url: String,
    client: Client,
}

impl Default for PinchTabClient {
    fn default() -> Self {
        Self::new(DEFAULT_BASE_URL)
    }
}

impl PinchTabClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            client: Client::builder()
                .timeout(Duration::from_secs(60))
                .connect_timeout(Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Check if PinchTab is running and reachable
    pub async fn ping(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        self.client.get(&url).send().await.is_ok()
    }

    /// Navigate to URL (single-instance API)
    pub async fn navigate(&self, url: &str) -> Result<()> {
        let endpoint = format!("{}/navigate", self.base_url);
        let body = serde_json::json!({ "url": url });
        let resp = self
            .client
            .post(&endpoint)
            .json(&body)
            .send()
            .await
            .context("PinchTab navigate request failed")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("PinchTab navigate failed: {} - {}", status, text);
        }
        Ok(())
    }

    /// Get snapshot of interactive elements (for form filling)
    pub async fn get_snapshot(&self) -> Result<PinchTabSnapshot> {
        let url = format!("{}/snapshot?filter=interactive", self.base_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .context("PinchTab snapshot request failed")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("PinchTab snapshot failed: {} - {}", status, text);
        }

        let json: serde_json::Value = resp.json().await.context("PinchTab snapshot invalid JSON")?;
        let snapshot = parse_snapshot(&json);
        Ok(snapshot)
    }

    /// Fill an input by element ref
    pub async fn fill(&self, element_ref: &str, value: &str) -> Result<()> {
        self.action("fill", element_ref, Some(value)).await
    }

    /// Click an element by ref
    pub async fn click(&self, element_ref: &str) -> Result<()> {
        self.action("click", element_ref, None).await
    }

    async fn action(
        &self,
        kind: &str,
        element_ref: &str,
        value: Option<&str>,
    ) -> Result<()> {
        let endpoint = format!("{}/action", self.base_url);
        let mut body = serde_json::json!({
            "kind": kind,
            "ref": element_ref
        });
        if let Some(v) = value {
            body["value"] = serde_json::Value::String(v.to_string());
        }
        let resp = self
            .client
            .post(&endpoint)
            .json(&body)
            .send()
            .await
            .context("PinchTab action request failed")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("PinchTab action {} failed: {} - {}", kind, status, text);
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PinchTabSnapshot {
    #[serde(default)]
    pub nodes: Vec<PinchTabNode>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PinchTabNode {
    #[serde(rename = "ref")]
    pub ref_id: Option<String>,
    #[serde(default)]
    pub value: Option<String>,
    pub name: Option<String>,
    pub role: Option<String>,
    #[serde(rename = "type")]
    pub node_type: Option<String>,
}

fn parse_snapshot(json: &serde_json::Value) -> PinchTabSnapshot {
    let mut nodes = Vec::new();
    if let Some(obj) = json.as_object() {
        if let Some(arr) = obj.get("nodes").and_then(|v| v.as_array()) {
            for item in arr {
                nodes.push(PinchTabNode {
                    ref_id: item.get("ref").or_else(|| item.get("refId")).and_then(|v| v.as_str()).map(String::from),
                    name: item.get("name").and_then(|v| v.as_str()).map(String::from),
                    role: item.get("role").and_then(|v| v.as_str()).map(String::from),
                    node_type: item.get("type").and_then(|v| v.as_str()).map(String::from),
                    value: item.get("value").and_then(|v| v.as_str()).map(String::from),
                });
            }
        }
    } else if let Some(arr) = json.as_array() {
        for item in arr {
            nodes.push(PinchTabNode {
                ref_id: item.get("ref").or_else(|| item.get("refId")).and_then(|v| v.as_str()).map(String::from),
                name: item.get("name").and_then(|v| v.as_str()).map(String::from),
                role: item.get("role").and_then(|v| v.as_str()).map(String::from),
                node_type: item.get("type").and_then(|v| v.as_str()).map(String::from),
                value: item.get("value").and_then(|v| v.as_str()).map(String::from),
            });
        }
    }
    PinchTabSnapshot { nodes }
}

/// Run external apply via PinchTab: navigate to ATS URL and fill form
pub async fn external_apply_via_pinchtab(
    ats_url: &str,
    profile: &serde_json::Value,
) -> Result<ExternalApplyResult> {
    let client = PinchTabClient::default();

    if !client.ping().await {
        return Ok(ExternalApplyResult {
            success: false,
            used_pinchtab: false,
            error: Some("PinchTab not running (start with: pinchtab)".to_string()),
        });
    }

    if let Err(e) = client.navigate(ats_url).await {
        return Ok(ExternalApplyResult {
            success: false,
            used_pinchtab: true,
            error: Some(format!("PinchTab navigate failed: {}", e)),
        });
    }

    // Wait for page load
    tokio::time::sleep(Duration::from_secs(3)).await;

    let snapshot = match client.get_snapshot().await {
        Ok(s) => s,
        Err(e) => {
            return Ok(ExternalApplyResult {
                success: false,
                used_pinchtab: true,
                error: Some(format!("PinchTab snapshot failed: {}", e)),
            });
        }
    };

    let empty = serde_json::Map::new();
    let personal = profile
        .get("personal_info")
        .and_then(|v| v.as_object())
        .unwrap_or(&empty);

    let name = personal.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let email = personal.get("email").and_then(|v| v.as_str()).unwrap_or("");
    let phone = personal.get("phone").and_then(|v| v.as_str()).unwrap_or("");
    let location = personal.get("location").and_then(|v| v.as_str()).unwrap_or("");
    let linkedin = personal.get("linkedin").and_then(|v| v.as_str()).unwrap_or("");
    let github = personal.get("github").and_then(|v| v.as_str()).unwrap_or("");
    let portfolio = personal.get("portfolio").and_then(|v| v.as_str()).unwrap_or("");
    let years_exp = profile
        .get("personal_info")
        .and_then(|p| p.get("years_experience"))
        .map(|v| {
            v.as_str()
                .map(String::from)
                .or_else(|| v.as_u64().map(|n| n.to_string()))
                .unwrap_or_default()
        })
        .unwrap_or_default();

    let mut filled = 0;
    for node in &snapshot.nodes {
        let Some(ref_id) = &node.ref_id else { continue };
        let name_lower = node.name.as_deref().unwrap_or("").to_lowercase();
        let value_lower = node.value.as_deref().unwrap_or("").to_lowercase();
        let combined = format!("{} {}", name_lower, value_lower);
        let role = node.role.as_deref().unwrap_or("").to_lowercase();

        let value = if name_lower.contains("email") || name_lower.contains("e-mail") || value_lower.contains("email") {
            Some(email)
        } else if combined.contains("name") && !combined.contains("last") && !combined.contains("first") {
            Some(name)
        } else if combined.contains("first") && combined.contains("name") {
            Some(name.split_whitespace().next().unwrap_or(name))
        } else if combined.contains("last") && combined.contains("name") {
            Some(name.split_whitespace().last().unwrap_or(""))
        } else if combined.contains("phone") || combined.contains("tel") {
            Some(phone)
        } else if combined.contains("location") || combined.contains("city") || combined.contains("address") {
            Some(location)
        } else if combined.contains("linkedin") || combined.contains("linked in") {
            Some(linkedin)
        } else if combined.contains("github") || combined.contains("git hub") {
            Some(github)
        } else if combined.contains("portfolio") || combined.contains("website") || combined.contains("personal site") {
            Some(portfolio)
        } else if (combined.contains("years") && combined.contains("experience"))
            || combined.contains("experience level")
            || combined.contains("years of experience")
        {
            Some(years_exp.as_str())
        } else {
            None
        };

        if let Some(v) = value {
            if !v.is_empty() {
                let role = role.to_lowercase();
                let node_type = node.node_type.as_deref().unwrap_or("").to_lowercase();
                let is_input = role.contains("textbox")
                    || role.contains("input")
                    || role.contains("combobox")
                    || node_type.contains("input")
                    || node_type.contains("text");
                if is_input && client.fill(ref_id, v).await.is_ok() {
                    filled += 1;
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
            }
        }
    }

    Ok(ExternalApplyResult {
        success: filled > 0,
        used_pinchtab: true,
        error: if filled == 0 {
            Some("No form fields could be auto-filled".to_string())
        } else {
            None
        },
    })
}

#[derive(Debug, Serialize)]
pub struct ExternalApplyResult {
    pub success: bool,
    pub used_pinchtab: bool,
    pub error: Option<String>,
}

use crate::db::models::Job;
use crate::generator::UserProfile;
use anyhow::Result;
use serde_json::json;
use std::time::Duration;

/// Test endpoint submitter for testing application submissions
pub struct TestEndpointSubmitter {
    endpoint: String,
}

impl TestEndpointSubmitter {
    pub fn new(endpoint: String) -> Self {
        Self { endpoint }
    }

    /// Submit application data to test endpoint using reqwest
    pub async fn submit_application(
        &self,
        job: &Job,
        profile: &UserProfile,
        resume_path: Option<&str>,
        cover_letter_path: Option<&str>,
    ) -> Result<String> {
        println!("🧪 Submitting test application to: {}", self.endpoint);

        // Prepare application data
        let application_data = json!({
            "job": {
                "title": job.title,
                "company": job.company,
                "url": job.url,
                "location": job.location,
                "source": job.source,
            },
            "profile": {
                "name": profile.personal_info.name,
                "email": profile.personal_info.email,
                "phone": profile.personal_info.phone,
                "location": profile.personal_info.location,
                "linkedin": profile.personal_info.linkedin,
                "github": profile.personal_info.github,
                "portfolio": profile.personal_info.portfolio,
            },
            "documents": {
                "resume": resume_path,
                "cover_letter": cover_letter_path,
            },
            "submitted_at": chrono::Utc::now().to_rfc3339(),
            "test_mode": true,
        });

        // Clone endpoint and application_data for move into closure
        let endpoint = self.endpoint.clone();
        let application_data_clone = application_data.clone();

        // Use reqwest blocking client (since we already have it in dependencies)
        // Submit to test endpoint (blocking call wrapped in async)
        let (status, body) = tokio::task::spawn_blocking(move || {
            let client = reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .map_err(|e| anyhow::anyhow!("Failed to create HTTP client: {}", e))?;

            let response = client
                .post(&endpoint)
                .json(&application_data_clone)
                .send()
                .map_err(|e| anyhow::anyhow!("Failed to submit to test endpoint: {}", e))?;

            let status = response.status();
            let body = response
                .text()
                .map_err(|e| anyhow::anyhow!("Failed to read response body: {}", e))?;

            Ok::<_, anyhow::Error>((status, body))
        })
        .await
        .map_err(|e| anyhow::anyhow!("Failed to spawn blocking task: {}", e))?
        .map_err(|e| anyhow::anyhow!("Failed to submit to test endpoint: {}", e))?;

        if status.is_success() {
            println!("✅ Test application submitted successfully!");
            println!("   Response status: {}", status);
            println!(
                "   Response body (first 500 chars): {}",
                body.chars().take(500).collect::<String>()
            );

            // Try to parse JSON response for prettier display
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                let json_str = serde_json::to_string_pretty(&json).unwrap_or_else(|_| body.clone());
                println!("   Response JSON: {}", json_str);
                Ok(format!("Test application submitted successfully!\n\nView the full response at: {}\n\nResponse preview:\n{}", 
                    self.endpoint,
                    json_str
                        .chars()
                        .take(1000)
                        .collect::<String>()))
            } else {
                Ok(format!("Test application submitted successfully!\n\nResponse status: {}\n\nView the full response at: {}", status, self.endpoint))
            }
        } else {
            Err(anyhow::anyhow!(
                "Test endpoint returned error: {} - {}",
                status,
                body.chars().take(500).collect::<String>()
            ))
        }
    }
}

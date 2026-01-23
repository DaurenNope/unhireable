// Gmail API integration for inbox monitoring and email parsing
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};

/// Gmail API OAuth2 configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl Default for GmailConfig {
    fn default() -> Self {
        Self {
            client_id: String::new(),
            client_secret: String::new(),
            redirect_uri: "http://localhost:8080/oauth2callback".to_string(),
            access_token: None,
            refresh_token: None,
            token_expires_at: None,
        }
    }
}

/// Gmail API service for inbox monitoring
pub struct GmailService {
    pub config: GmailConfig,
    http_client: reqwest::Client,
}

impl GmailService {
    pub fn new(config: GmailConfig) -> Self {
        Self {
            config,
            http_client: reqwest::Client::new(),
        }
    }

    /// Get OAuth2 authorization URL
    pub fn get_authorization_url(&self) -> String {
        let scope = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify";
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
            urlencoding::encode(&self.config.client_id),
            urlencoding::encode(&self.config.redirect_uri),
            urlencoding::encode(scope)
        )
    }

    /// Exchange authorization code for tokens
    pub async fn exchange_code_for_tokens(&mut self, code: &str) -> Result<()> {
        let token_url = "https://oauth2.googleapis.com/token";

        let params = [
            ("code", code),
            ("client_id", &self.config.client_id),
            ("client_secret", &self.config.client_secret),
            ("redirect_uri", &self.config.redirect_uri),
            ("grant_type", "authorization_code"),
        ];

        let response = self
            .http_client
            .post(token_url)
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Token exchange failed: {}", error_text));
        }

        let token_response: TokenResponse = response.json().await?;

        self.config.access_token = Some(token_response.access_token.clone());
        self.config.refresh_token = token_response.refresh_token;
        self.config.token_expires_at =
            Some(chrono::Utc::now() + chrono::Duration::seconds(token_response.expires_in as i64));

        Ok(())
    }

    /// Refresh access token using refresh token
    pub async fn refresh_access_token(&mut self) -> Result<()> {
        let refresh_token = self
            .config
            .refresh_token
            .as_ref()
            .ok_or_else(|| anyhow!("No refresh token available"))?;

        let token_url = "https://oauth2.googleapis.com/token";

        let params = [
            ("refresh_token", refresh_token.as_str()),
            ("client_id", &self.config.client_id),
            ("client_secret", &self.config.client_secret),
            ("grant_type", "refresh_token"),
        ];

        let response = self
            .http_client
            .post(token_url)
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Token refresh failed: {}", error_text));
        }

        let token_response: TokenResponse = response.json().await?;

        self.config.access_token = Some(token_response.access_token);
        self.config.token_expires_at =
            Some(chrono::Utc::now() + chrono::Duration::seconds(token_response.expires_in as i64));

        Ok(())
    }

    /// Ensure we have a valid access token
    async fn ensure_valid_token(&mut self) -> Result<()> {
        // Check if token is expired or will expire soon (within 5 minutes)
        if let Some(expires_at) = self.config.token_expires_at {
            if expires_at < chrono::Utc::now() + chrono::Duration::minutes(5) {
                self.refresh_access_token().await?;
            }
        } else if self.config.access_token.is_none() {
            return Err(anyhow!("No access token available"));
        }

        Ok(())
    }

    /// Get messages from inbox matching a query
    pub async fn search_messages(
        &mut self,
        query: &str,
        max_results: Option<usize>,
    ) -> Result<Vec<GmailMessage>> {
        self.ensure_valid_token().await?;

        let access_token = self
            .config
            .access_token
            .as_ref()
            .ok_or_else(|| anyhow!("No access token available"))?;

        let max_results = max_results.unwrap_or(10);
        let url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages?q={}&maxResults={}",
            urlencoding::encode(query),
            max_results
        );

        let response = self
            .http_client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Gmail API error: {}", error_text));
        }

        let message_list: MessageListResponse = response.json().await?;

        let mut messages = Vec::new();
        for message_id in message_list.messages.unwrap_or_default() {
            if let Ok(message) = self.get_message(&message_id.id).await {
                messages.push(message);
            }
        }

        Ok(messages)
    }

    /// Get a specific message by ID
    pub async fn get_message(&mut self, message_id: &str) -> Result<GmailMessage> {
        self.ensure_valid_token().await?;

        let access_token = self
            .config
            .access_token
            .as_ref()
            .ok_or_else(|| anyhow!("No access token available"))?;

        let url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/{}",
            message_id
        );

        let response = self
            .http_client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Gmail API error: {}", error_text));
        }

        let message: GmailMessage = response.json().await?;
        Ok(message)
    }

    /// Parse email for application status updates
    pub fn parse_application_status(
        &self,
        message: &GmailMessage,
    ) -> Option<ApplicationStatusUpdate> {
        let subject = self.get_header_value(message, "Subject")?;
        let from = self.get_header_value(message, "From")?;
        let body = self.get_message_body(message)?;

        // Look for common patterns in application response emails
        let subject_lower = subject.to_lowercase();
        let body_lower = body.to_lowercase();

        // Check for rejection emails
        if subject_lower.contains("unfortunately")
            || subject_lower.contains("not moving forward")
            || subject_lower.contains("not selected")
            || body_lower.contains("we've decided to move forward with other candidates")
        {
            return Some(ApplicationStatusUpdate {
                status: "rejected".to_string(),
                company: self.extract_company_from_email(&from),
                message: subject.clone(),
                detected_at: chrono::Utc::now(),
            });
        }

        // Check for interview invites
        if subject_lower.contains("interview")
            || subject_lower.contains("schedule")
            || body_lower.contains("would like to schedule")
            || body_lower.contains("next steps")
        {
            return Some(ApplicationStatusUpdate {
                status: "interview".to_string(),
                company: self.extract_company_from_email(&from),
                message: subject.clone(),
                detected_at: chrono::Utc::now(),
            });
        }

        // Check for application received confirmations
        if subject_lower.contains("application received")
            || subject_lower.contains("thank you for applying")
            || body_lower.contains("we received your application")
        {
            return Some(ApplicationStatusUpdate {
                status: "applied".to_string(),
                company: self.extract_company_from_email(&from),
                message: subject.clone(),
                detected_at: chrono::Utc::now(),
            });
        }

        None
    }

    fn get_header_value(&self, message: &GmailMessage, name: &str) -> Option<String> {
        message
            .payload
            .headers
            .iter()
            .find(|h| h.name.eq_ignore_ascii_case(name))
            .map(|h| h.value.clone())
    }

    fn get_message_body(&self, message: &GmailMessage) -> Option<String> {
        // Try to get text/plain or text/html body
        if let Some(parts) = &message.payload.parts {
            for part in parts {
                if part.mime_type == "text/plain" {
                    if let Some(data) = &part.body.data {
                        // Gmail uses URL-safe base64 encoding
                        let data_fixed = data.replace("-", "+").replace("_", "/");
                        // Add padding if needed
                        let padding_needed = 4 - (data_fixed.len() % 4);
                        let padded = if padding_needed != 4 {
                            format!("{}{}", data_fixed, "=".repeat(padding_needed))
                        } else {
                            data_fixed
                        };
                        if let Ok(decoded) = general_purpose::STANDARD.decode(&padded) {
                            return String::from_utf8(decoded).ok();
                        }
                    }
                }
            }
        }

        // Fallback to main body
        if let Some(data) = &message.payload.body.data {
            let data_fixed = data.replace("-", "+").replace("_", "/");
            let padding_needed = 4 - (data_fixed.len() % 4);
            let padded = if padding_needed != 4 {
                format!("{}{}", data_fixed, "=".repeat(padding_needed))
            } else {
                data_fixed
            };
            if let Ok(decoded) = general_purpose::STANDARD.decode(&padded) {
                return String::from_utf8(decoded).ok();
            }
        }

        None
    }

    fn extract_company_from_email(&self, email: &str) -> String {
        // Extract company from email address or display name
        if let Some(at_pos) = email.find('@') {
            if let Some(domain) = email.get(at_pos + 1..) {
                if let Some(dot_pos) = domain.find('.') {
                    return domain[..dot_pos].to_string();
                }
            }
        }
        email.to_string()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
    token_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct MessageListResponse {
    messages: Option<Vec<MessageId>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MessageId {
    id: String,
    thread_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailMessage {
    pub id: String,
    pub thread_id: String,
    pub label_ids: Vec<String>,
    pub snippet: String,
    pub payload: MessagePayload,
    pub internal_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePayload {
    pub headers: Vec<Header>,
    pub body: MessageBody,
    pub parts: Option<Vec<MessagePart>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Header {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageBody {
    pub size: Option<u64>,
    pub data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePart {
    pub mime_type: String,
    pub body: MessageBody,
    pub parts: Option<Vec<MessagePart>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationStatusUpdate {
    pub status: String, // "applied", "interview", "rejected", etc.
    pub company: String,
    pub message: String,
    pub detected_at: chrono::DateTime<chrono::Utc>,
}

// base64 crate is required - add to Cargo.toml: base64 = "0.22"

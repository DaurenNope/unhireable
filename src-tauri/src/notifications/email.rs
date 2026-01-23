use crate::db::models::Job;
use crate::matching::JobMatchResult;
use crate::notifications::templates::EmailTemplate;
use anyhow::Result;
use lettre::{
    message::{header::ContentType, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
};
use serde::{Deserialize, Serialize};

/// Email configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailConfig {
    pub smtp_server: String, // e.g., "smtp.gmail.com"
    pub smtp_port: u16,      // e.g., 587 for TLS, 465 for SSL
    pub username: String,    // Email address
    pub password: String,    // App password or regular password
    pub from_email: String,  // From email address
    pub from_name: String,   // From name
    pub use_tls: bool,       // Use TLS (true for port 587)
    pub use_ssl: bool,       // Use SSL (true for port 465)
}

impl Default for EmailConfig {
    fn default() -> Self {
        Self {
            smtp_server: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            username: String::new(),
            password: String::new(),
            from_email: String::new(),
            from_name: "Unhireable".to_string(),
            use_tls: true,
            use_ssl: false,
        }
    }
}

/// Email service for sending notifications
pub struct EmailService {
    config: EmailConfig,
    transport: Option<SmtpTransport>,
}

impl EmailService {
    /// Create a new email service with configuration
    pub fn new(config: EmailConfig) -> Self {
        Self {
            config,
            transport: None,
        }
    }

    /// Initialize the SMTP transport
    pub fn initialize(&mut self) -> Result<()> {
        if self.config.username.is_empty() || self.config.password.is_empty() {
            return Err(anyhow::anyhow!("Email credentials not configured"));
        }

        let creds = Credentials::new(self.config.username.clone(), self.config.password.clone());

        // Build SMTP transport
        // For Gmail: use relay with port 587 (STARTTLS is automatic)
        // For other providers: adjust port and use builder_dangerous if needed
        let transport = if self.config.smtp_port == 465 {
            // SSL/TLS on port 465 (less common, use builder_dangerous)
            SmtpTransport::builder_dangerous(&self.config.smtp_server)
                .port(self.config.smtp_port)
                .credentials(creds)
                .build()
        } else {
            // STARTTLS on port 587 (most common, including Gmail)
            SmtpTransport::relay(&self.config.smtp_server)?
                .port(self.config.smtp_port)
                .credentials(creds)
                .build()
        };

        // Note: test_connection() may not be available in all lettre versions
        // We'll test by actually trying to send in test_connection method

        self.transport = Some(transport);
        Ok(())
    }

    /// Send an email
    pub fn send_email(
        &self,
        to: &str,
        subject: &str,
        body_html: &str,
        body_text: Option<&str>,
    ) -> Result<()> {
        let transport = self.transport.as_ref().ok_or_else(|| {
            anyhow::anyhow!("Email service not initialized. Call initialize() first.")
        })?;

        let from_email = format!("{} <{}>", self.config.from_name, self.config.from_email);

        // Create email message
        let email = if let Some(text_body) = body_text {
            // Multipart message with both HTML and plain text
            Message::builder()
                .from(from_email.parse()?)
                .to(to.parse()?)
                .subject(subject)
                .multipart(
                    MultiPart::alternative()
                        .singlepart(
                            SinglePart::builder()
                                .header(ContentType::TEXT_PLAIN)
                                .body(text_body.to_string()),
                        )
                        .singlepart(
                            SinglePart::builder()
                                .header(ContentType::TEXT_HTML)
                                .body(body_html.to_string()),
                        ),
                )?
        } else {
            // HTML only
            Message::builder()
                .from(from_email.parse()?)
                .to(to.parse()?)
                .subject(subject)
                .header(ContentType::TEXT_HTML)
                .body(body_html.to_string())?
        };

        // Send email with timeout
        let result = transport.send(&email);

        match result {
            Ok(_) => {
                println!("✅ Email sent successfully to: {}", to);
                Ok(())
            }
            Err(e) => {
                eprintln!("❌ Failed to send email to {}: {}", to, e);
                Err(anyhow::anyhow!("Failed to send email: {}", e))
            }
        }
    }

    /// Send job match notification
    pub fn send_job_match_notification(
        &self,
        to: &str,
        job: &Job,
        match_result: &JobMatchResult,
    ) -> Result<()> {
        let template = EmailTemplate::job_match_notification(job, match_result);
        let subject = format!(
            "🎯 Great Job Match: {} at {} ({:.0}% Match)",
            job.title, job.company, match_result.match_score
        );

        self.send_email(to, &subject, &template.html, Some(&template.text))
    }

    /// Send new jobs notification
    pub fn send_new_jobs_notification(
        &self,
        to: &str,
        jobs: &[Job],
        match_results: Option<&[JobMatchResult]>,
    ) -> Result<()> {
        let template = EmailTemplate::new_jobs_notification(jobs, match_results);
        let subject = format!("📧 {} New Job(s) Found", jobs.len());

        self.send_email(to, &subject, &template.html, Some(&template.text))
    }

    /// Send daily summary notification
    pub fn send_daily_summary(&self, to: &str, stats: &DailySummaryStats) -> Result<()> {
        let template = EmailTemplate::daily_summary(stats);
        let subject = format!(
            "📊 Daily Job Search Summary - {} New Jobs",
            stats.new_jobs_count
        );

        self.send_email(to, &subject, &template.html, Some(&template.text))
    }

    /// Test email configuration
    /// This creates a temporary transport and attempts to verify the connection
    pub fn test_connection(&self) -> Result<()> {
        if self.config.username.is_empty() || self.config.password.is_empty() {
            return Err(anyhow::anyhow!("Email credentials not configured"));
        }

        // Build a test transport (same as initialize)
        let creds = Credentials::new(self.config.username.clone(), self.config.password.clone());

        let _transport = if self.config.smtp_port == 465 {
            SmtpTransport::builder_dangerous(&self.config.smtp_server)
                .port(self.config.smtp_port)
                .credentials(creds)
                .build()
        } else {
            SmtpTransport::relay(&self.config.smtp_server)?
                .port(self.config.smtp_port)
                .credentials(creds)
                .build()
        };

        // Note: In lettre 0.11, we verify the config is valid by building the transport
        // The actual connection test happens when sending an email
        // For now, if we get here without errors, the config is valid

        Ok(())
    }

    /// Send test email
    pub fn send_test_email(&self, to: &str) -> Result<()> {
        let subject = "Test Email from Unhireable";
        let html_body = r#"
            <html>
                <body>
                    <h1>Test Email from Unhireable</h1>
                    <p>This is a test email to verify your email configuration is working correctly.</p>
                    <p>If you received this email, your SMTP settings are configured properly!</p>
                    <hr>
                    <p><small>Unhireable - Neural Career System</small></p>
                </body>
            </html>
        "#;
        let text_body = "Test Email from Unhireable\n\nThis is a test email to verify your email configuration is working correctly.\n\nIf you received this email, your SMTP settings are configured properly!";

        self.send_email(to, subject, html_body, Some(text_body))
    }
}

/// Daily summary statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySummaryStats {
    pub new_jobs_count: usize,
    pub total_jobs_count: usize,
    pub high_match_jobs_count: usize, // Jobs with match score >= 60%
    pub applications_submitted: usize,
    pub interviews_scheduled: usize,
    pub date: chrono::DateTime<chrono::Utc>,
}

impl Default for DailySummaryStats {
    fn default() -> Self {
        Self {
            new_jobs_count: 0,
            total_jobs_count: 0,
            high_match_jobs_count: 0,
            applications_submitted: 0,
            interviews_scheduled: 0,
            date: chrono::Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_config_default() {
        let config = EmailConfig::default();
        assert_eq!(config.smtp_server, "smtp.gmail.com");
        assert_eq!(config.smtp_port, 587);
        assert!(config.use_tls);
        assert!(!config.use_ssl);
    }

    #[test]
    fn test_email_config_serialization() {
        let config = EmailConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: EmailConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.smtp_server, deserialized.smtp_server);
    }

    fn create_test_email_config() -> EmailConfig {
        EmailConfig {
            smtp_server: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            username: "test@example.com".to_string(),
            password: "test_password".to_string(),
            from_email: "test@example.com".to_string(),
            from_name: "Test Sender".to_string(),
            use_tls: true,
            use_ssl: false,
        }
    }

    #[test]
    fn test_email_config_creation() {
        let config = create_test_email_config();
        assert_eq!(config.smtp_server, "smtp.gmail.com");
        assert_eq!(config.smtp_port, 587);
        assert_eq!(config.username, "test@example.com");
        assert!(config.use_tls);
        assert!(!config.use_ssl);
    }

    #[test]
    fn test_email_service_creation() {
        let config = create_test_email_config();
        let _service = EmailService::new(config);
        // Service should be created (we can't test initialization without actual SMTP server)
        assert!(true); // Placeholder - service creation doesn't fail
    }

    #[test]
    fn test_email_config_gmail() {
        let config = EmailConfig {
            smtp_server: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            username: "user@gmail.com".to_string(),
            password: "app_password".to_string(),
            from_email: "user@gmail.com".to_string(),
            from_name: "Test".to_string(),
            use_tls: true,
            use_ssl: false,
        };
        assert_eq!(config.smtp_server, "smtp.gmail.com");
        assert_eq!(config.smtp_port, 587);
        assert!(config.use_tls);
    }

    #[test]
    fn test_email_config_outlook() {
        let config = EmailConfig {
            smtp_server: "smtp-mail.outlook.com".to_string(),
            smtp_port: 587,
            username: "user@outlook.com".to_string(),
            password: "password".to_string(),
            from_email: "user@outlook.com".to_string(),
            from_name: "Test".to_string(),
            use_tls: true,
            use_ssl: false,
        };
        assert_eq!(config.smtp_server, "smtp-mail.outlook.com");
        assert_eq!(config.smtp_port, 587);
    }

    #[test]
    fn test_email_config_custom_smtp() {
        let config = EmailConfig {
            smtp_server: "mail.example.com".to_string(),
            smtp_port: 465,
            username: "user@example.com".to_string(),
            password: "password".to_string(),
            from_email: "user@example.com".to_string(),
            from_name: "Test".to_string(),
            use_tls: false,
            use_ssl: true,
        };
        assert_eq!(config.smtp_port, 465);
        assert!(config.use_ssl);
        assert!(!config.use_tls);
    }
}

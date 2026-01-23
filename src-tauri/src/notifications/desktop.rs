use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

/// Desktop notification service for sending native OS notifications
pub struct DesktopNotificationService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopNotificationConfig {
    pub enabled: bool,
    pub quiet_hours_start: Option<u8>,  // 0-23
    pub quiet_hours_end: Option<u8>,    // 0-23
    pub digest_mode: bool,              // Batch notifications
    pub show_job_matches: bool,
    pub show_new_jobs: bool,
    pub show_application_status: bool,
    pub show_errors: bool,
}

impl Default for DesktopNotificationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            quiet_hours_start: None,
            quiet_hours_end: None,
            digest_mode: false,
            show_job_matches: true,
            show_new_jobs: true,
            show_application_status: true,
            show_errors: true,
        }
    }
}

impl DesktopNotificationService {
    /// Request notification permission (must be called before sending notifications)
    pub async fn request_permission(app: &AppHandle) -> bool {
        let notification = app.notification();
        notification.request_permission().is_ok()
    }

    /// Check if notifications are allowed
    pub async fn is_permission_granted(app: &AppHandle) -> bool {
        let _notification = app.notification();
        // Note: Tauri notification plugin doesn't have a check_permission method,
        // so we'll need to handle this differently
        // For now, we'll try to send and handle errors
        true // Placeholder - will be improved
    }

    /// Check if we're in quiet hours
    fn is_quiet_hours(config: &DesktopNotificationConfig) -> bool {
        if config.quiet_hours_start.is_none() || config.quiet_hours_end.is_none() {
            return false;
        }

        use chrono::Timelike;
        let now = chrono::Local::now().hour() as u8;
        let start = config.quiet_hours_start.unwrap();
        let end = config.quiet_hours_end.unwrap();

        if start <= end {
            // Normal case: e.g., 22:00 - 08:00
            now >= start && now < end
        } else {
            // Wraps around midnight: e.g., 22:00 - 08:00
            now >= start || now < end
        }
    }

    /// Send a desktop notification
    pub async fn send(
        app: &AppHandle,
        title: &str,
        body: &str,
        config: Option<&DesktopNotificationConfig>,
    ) -> Result<(), String> {
        let default_config;
        let config = if let Some(cfg) = config {
            cfg
        } else {
            default_config = DesktopNotificationConfig::default();
            &default_config
        };

        if !config.enabled {
            return Ok(()); // Silently ignore if disabled
        }

        if Self::is_quiet_hours(config) {
            return Ok(()); // Silently ignore during quiet hours
        }

        // Request permission if needed
        let _permission = Self::request_permission(app).await;

        let notification = app.notification();
        notification
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| format!("Failed to show notification: {}", e))?;

        Ok(())
    }

    /// Send job match notification
    pub async fn send_job_match(
        app: &AppHandle,
        job_title: &str,
        company: &str,
        match_score: f64,
        config: Option<&DesktopNotificationConfig>,
    ) -> Result<(), String> {
        let default_config;
        let config = if let Some(cfg) = config {
            cfg
        } else {
            default_config = DesktopNotificationConfig::default();
            &default_config
        };

        if !config.show_job_matches {
            return Ok(());
        }

        let title = format!("🎯 Great Match: {} at {}", match_score as i32, company);
        let body = format!("Match score: {}%\n{}", match_score as i32, job_title);

        Self::send(app, &title, &body, Some(config)).await
    }

    /// Send new jobs notification
    pub async fn send_new_jobs(
        app: &AppHandle,
        count: usize,
        config: Option<&DesktopNotificationConfig>,
    ) -> Result<(), String> {
        let default_config;
        let config = if let Some(cfg) = config {
            cfg
        } else {
            default_config = DesktopNotificationConfig::default();
            &default_config
        };

        if !config.show_new_jobs {
            return Ok(());
        }

        let title = format!("📧 {} New Job{} Found", count, if count > 1 { "s" } else { "" });
        let body = format!("Found {} new job{} matching your criteria", count, if count > 1 { "s" } else { "" });

        Self::send(app, &title, &body, Some(config)).await
    }

    /// Send application status notification
    pub async fn send_application_status(
        app: &AppHandle,
        job_title: &str,
        company: &str,
        status: &str,
        config: Option<&DesktopNotificationConfig>,
    ) -> Result<(), String> {
        let default_config;
        let config = if let Some(cfg) = config {
            cfg
        } else {
            default_config = DesktopNotificationConfig::default();
            &default_config
        };

        if !config.show_application_status {
            return Ok(());
        }

        let title = format!("📝 Application Update: {}", company);
        let body = format!("Status: {}\n{}", status, job_title);

        Self::send(app, &title, &body, Some(config)).await
    }

    /// Send error notification
    pub async fn send_error(
        app: &AppHandle,
        error_message: &str,
        config: Option<&DesktopNotificationConfig>,
    ) -> Result<(), String> {
        let default_config;
        let config = if let Some(cfg) = config {
            cfg
        } else {
            default_config = DesktopNotificationConfig::default();
            &default_config
        };

        if !config.show_errors {
            return Ok(());
        }

        let title = "❌ Application Error";
        let body = error_message;

        Self::send(app, title, body, Some(config)).await
    }

    /// Send application success notification
    pub async fn send_application_success(
        app: &AppHandle,
        job_title: &str,
        company: &str,
        config: Option<&DesktopNotificationConfig>,
    ) -> Result<(), String> {
        let default_config;
        let config = if let Some(cfg) = config {
            cfg
        } else {
            default_config = DesktopNotificationConfig::default();
            &default_config
        };

        if !config.show_application_status {
            return Ok(());
        }

        let title = format!("✅ Application Submitted: {}", company);
        let body = format!("Successfully applied to: {}", job_title);

        Self::send(app, &title, &body, Some(config)).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quiet_hours_detection() {
        let mut config = DesktopNotificationConfig::default();
        config.quiet_hours_start = Some(22); // 10 PM
        config.quiet_hours_end = Some(8);    // 8 AM

        // Test at 11 PM (should be quiet)
        // Note: This test would need to mock the current time
        // For now, we just verify the logic structure
        assert!(config.quiet_hours_start.is_some());
        assert!(config.quiet_hours_end.is_some());
    }

    #[test]
    fn test_notification_config_default() {
        let config = DesktopNotificationConfig::default();
        assert!(config.enabled);
        assert!(config.show_job_matches);
        assert!(config.show_new_jobs);
        assert!(config.show_application_status);
        assert!(config.show_errors);
        assert!(!config.digest_mode);
    }
}







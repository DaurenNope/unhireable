//! Follow-up Email Automation
//!
//! Automatically sends thank-you emails, status check-ins, and interview confirmations

use crate::db::models::{Application, ApplicationStatus, Interview};
use crate::db::queries::{ApplicationQueries, InterviewQueries, JobQueries};
use crate::generator::ai_integration::AIIntegration;
use crate::notifications::email::EmailService;
use crate::notifications::templates::EmailTemplate;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

/// Follow-up configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowUpConfig {
    pub enabled: bool,
    pub thank_you_delay_hours: i64, // Hours after interview to send thank-you
    pub status_check_delay_days: i64, // Days after application to send check-in
    pub max_follow_ups: usize,      // Maximum follow-ups per application
    pub ai_enhance_messages: bool,  // Use AI to enhance messages
    pub auto_send: bool,            // Automatically send or just notify
}

impl Default for FollowUpConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            thank_you_delay_hours: 4,   // 4 hours after interview
            status_check_delay_days: 7, // 1 week after application
            max_follow_ups: 2,
            ai_enhance_messages: true,
            auto_send: false, // Manual approval by default
        }
    }
}

/// Follow-up email type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FollowUpType {
    InterviewThankYou,
    StatusCheckIn,
    InterviewConfirmation,
}

/// Pending follow-up email
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingFollowUp {
    pub id: String,
    pub application_id: i64,
    pub follow_up_type: FollowUpType,
    pub scheduled_for: DateTime<Utc>,
    pub recipient_email: String,
    pub subject: String,
    pub template: EmailTemplate,
    pub created_at: DateTime<Utc>,
}

/// Follow-up automation service
pub struct FollowUpAutomation {
    config: FollowUpConfig,
    ai_integration: Option<AIIntegration>,
}

impl FollowUpAutomation {
    pub fn new(config: FollowUpConfig) -> Self {
        Self {
            ai_integration: None,
            config,
        }
    }

    pub fn with_ai(mut self, ai: AIIntegration) -> Self {
        self.ai_integration = Some(ai);
        self
    }

    /// Scan for applications that need follow-ups
    pub fn scan_for_follow_ups(&self, db: &crate::db::Database) -> Vec<PendingFollowUp> {
        if !self.config.enabled {
            return vec![];
        }

        let mut pending = Vec::new();
        let conn = db.get_connection();

        // Get all applications that might need follow-ups
        let applications = conn.list_applications(None, None).unwrap_or_default();

        for app in applications {
            if let Some(follow_up) = self.check_application_follow_up(&app, &conn) {
                pending.push(follow_up);
            }
        }

        pending
    }

    fn check_application_follow_up(
        &self,
        app: &Application,
        conn: &std::sync::MutexGuard<rusqlite::Connection>,
    ) -> Option<PendingFollowUp> {
        let now = Utc::now();

        match app.status {
            ApplicationStatus::InterviewScheduled => {
                // Check for interview confirmation or thank-you
                if let Ok(interviews) = conn.list_interviews(Some(app.id?)) {
                    for interview in interviews {
                        if !interview.completed {
                            // Send interview confirmation if interview is within 24 hours
                            if interview.scheduled_at > now
                                && interview.scheduled_at < now + Duration::hours(24)
                            {
                                return self.create_interview_confirmation_follow_up(
                                    app, &interview, conn,
                                );
                            }

                            // Send thank-you if interview is completed (scheduled time has passed)
                            if interview.scheduled_at < now
                                && interview.scheduled_at > now - Duration::hours(24)
                            {
                                return self.create_thank_you_follow_up(app, &interview, conn);
                            }
                        }
                    }
                }
            }
            ApplicationStatus::Submitted => {
                // Check for status check-in
                if let Some(applied_at) = app.applied_at {
                    let days_since_application = (now - applied_at).num_days();
                    if days_since_application >= self.config.status_check_delay_days {
                        // Check if we haven't sent too many follow-ups
                        if self.count_previous_follow_ups(app.id?) < self.config.max_follow_ups {
                            return self.create_status_check_in_follow_up(
                                app,
                                days_since_application as u32,
                                conn,
                            );
                        }
                    }
                }
            }
            _ => {}
        }

        None
    }

    fn create_interview_confirmation_follow_up(
        &self,
        app: &Application,
        interview: &Interview,
        conn: &std::sync::MutexGuard<rusqlite::Connection>,
    ) -> Option<PendingFollowUp> {
        // Get job details
        let job = conn.get_job(app.job_id).ok()??;

        let scheduled_time = interview.scheduled_at.format("%I:%M %p %Z").to_string();
        let scheduled_date = interview.scheduled_at.format("%A, %B %d, %Y").to_string();

        let template = EmailTemplate::interview_confirmation(
            &job.company,
            None, // TODO: Extract recruiter name from contacts
            &scheduled_date,
            &scheduled_time,
            &interview.r#type,
            interview.location.as_deref(),
        );

        Some(PendingFollowUp {
            id: format!("confirmation_{}_{}", app.id?, interview.id?),
            application_id: app.id?,
            follow_up_type: FollowUpType::InterviewConfirmation,
            scheduled_for: interview.scheduled_at - Duration::hours(2), // 2 hours before interview
            recipient_email: "recruiter@example.com".to_string(),       // TODO: Get from contacts
            subject: format!("Confirmation: Interview for {} position", job.title),
            template,
            created_at: Utc::now(),
        })
    }

    fn create_thank_you_follow_up(
        &self,
        app: &Application,
        interview: &Interview,
        conn: &std::sync::MutexGuard<rusqlite::Connection>,
    ) -> Option<PendingFollowUp> {
        // Get job details
        let job = conn.get_job(app.job_id).ok()??;

        let scheduled_for =
            interview.scheduled_at + Duration::hours(self.config.thank_you_delay_hours);

        let template = EmailTemplate::interview_thank_you(
            &job.company,
            None, // TODO: Extract recruiter name
            &interview.r#type,
            None,
        );

        // Enhance with AI if enabled
        if self.config.ai_enhance_messages {
            if let Some(_ai) = &self.ai_integration {
                // TODO: Use AI to enhance the thank-you message
                // template = self.enhance_with_ai(template, &job, interview).await;
            }
        }

        Some(PendingFollowUp {
            id: format!("thankyou_{}_{}", app.id?, interview.id?),
            application_id: app.id?,
            follow_up_type: FollowUpType::InterviewThankYou,
            scheduled_for,
            recipient_email: "recruiter@example.com".to_string(), // TODO: Get from contacts
            subject: format!(
                "Thank You - {} Interview at {}",
                interview.r#type, job.company
            ),
            template,
            created_at: Utc::now(),
        })
    }

    fn create_status_check_in_follow_up(
        &self,
        app: &Application,
        days_since: u32,
        conn: &std::sync::MutexGuard<rusqlite::Connection>,
    ) -> Option<PendingFollowUp> {
        let job = conn.get_job(app.job_id).ok()??;

        let template = EmailTemplate::status_check_in(
            &job.company,
            None, // TODO: Extract recruiter name
            days_since,
            &job.title,
        );

        Some(PendingFollowUp {
            id: format!("checkin_{}_{}", app.id?, days_since),
            application_id: app.id?,
            follow_up_type: FollowUpType::StatusCheckIn,
            scheduled_for: Utc::now() + Duration::hours(1), // Send in 1 hour
            recipient_email: "recruiter@example.com".to_string(), // TODO: Get from contacts
            subject: format!("Following Up: {} Position at {}", job.title, job.company),
            template,
            created_at: Utc::now(),
        })
    }

    fn count_previous_follow_ups(&self, _application_id: i64) -> usize {
        // TODO: Implement tracking of sent follow-ups
        // For now, return 0 to allow follow-ups
        0
    }

    /// Send pending follow-ups
    pub async fn send_pending_follow_ups(
        &self,
        email_service: &EmailService,
        pending: &[PendingFollowUp],
    ) -> Vec<Result<(), String>> {
        let mut results = Vec::new();

        for follow_up in pending {
            if self.config.auto_send {
                let result = email_service.send_email(
                    &follow_up.recipient_email,
                    &follow_up.subject,
                    &follow_up.template.html,
                    Some(&follow_up.template.text),
                );

                results.push(
                    result.map_err(|e| format!("Failed to send follow-up {}: {}", follow_up.id, e)),
                );
            } else {
                // Just log that follow-up is ready
                println!(
                    "📧 Follow-up ready to send: {} to {}",
                    follow_up.subject, follow_up.recipient_email
                );
                results.push(Ok(()));
            }
        }

        results
    }
}

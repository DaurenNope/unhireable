use crate::db::models::Job;
use crate::matching::JobMatchResult;
use serde::{Deserialize, Serialize};

/// Email template with HTML and plain text versions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplate {
    pub html: String,
    pub text: String,
}

impl EmailTemplate {
    /// Create a job match notification email
    pub fn job_match_notification(job: &Job, match_result: &JobMatchResult) -> Self {
        let quality_badge = match match_result.match_score {
            score if score >= 80.0 => "🟢 Excellent Match",
            score if score >= 60.0 => "🔵 Good Match",
            score if score >= 40.0 => "🟡 Fair Match",
            _ => "🔴 Poor Match",
        };

        let matched_skills_list = if match_result.matched_skills.is_empty() {
            "<li>None</li>".to_string()
        } else {
            match_result
                .matched_skills
                .iter()
                .map(|skill| format!("<li>{}</li>", html_escape(skill)))
                .collect::<Vec<_>>()
                .join("\n")
        };

        let missing_skills_list = if match_result.missing_skills.is_empty() {
            "<li>None - You have all required skills!</li>".to_string()
        } else {
            match_result
                .missing_skills
                .iter()
                .map(|skill| format!("<li>{}</li>", html_escape(skill)))
                .collect::<Vec<_>>()
                .join("\n")
        };

        let html = format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .job-card {{ background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .match-score {{ font-size: 24px; font-weight: bold; color: #667eea; }}
        .skills-list {{ list-style: none; padding: 0; }}
        .skills-list li {{ padding: 5px 0; }}
        .matched {{ color: #28a745; }}
        .missing {{ color: #dc3545; }}
        .button {{ display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Great Job Match Found!</h1>
            <p>{}</p>
        </div>
        <div class="content">
            <div class="job-card">
                <h2>{}</h2>
                <p><strong>Company:</strong> {}</p>
                <p><strong>Location:</strong> {}</p>
                <p><strong>Experience Level:</strong> {}</p>
                {}
                <div class="match-score">
                    Match Score: {:.0}%
                </div>
                <h3>Your Matched Skills:</h3>
                <ul class="skills-list matched">
                    {}
                </ul>
                <h3>Missing Skills:</h3>
                <ul class="skills-list missing">
                    {}
                </ul>
                <h3>Match Reasons:</h3>
                <ul>
                    {}
                </ul>
                <a href="{}" class="button">View Job Details</a>
            </div>
        </div>
        <div class="footer">
            <p>Unhireable - Neural Career System</p>
            <p>This email was sent because you have match notifications enabled.</p>
        </div>
    </div>
</body>
</html>
            "#,
            quality_badge,
            html_escape(&job.title),
            html_escape(&job.company),
            job.location
                .as_ref()
                .map(|l| html_escape(l))
                .unwrap_or_else(|| "Not specified".to_string()),
            match_result.experience_level,
            job.salary
                .as_ref()
                .map(|s| format!("<p><strong>Salary:</strong> {}</p>", html_escape(s)))
                .unwrap_or_default(),
            match_result.match_score,
            matched_skills_list,
            missing_skills_list,
            match_result
                .match_reasons
                .iter()
                .map(|reason| format!("<li>{}</li>", html_escape(reason)))
                .collect::<Vec<_>>()
                .join("\n"),
            job.url
        );

        let text = format!(
            r#"
🎯 Great Job Match Found!
{}

Job Title: {}
Company: {}
Location: {}
Experience Level: {}
{}

Match Score: {:.0}%

Your Matched Skills:
{}

Missing Skills:
{}

Match Reasons:
{}

View Job: {}
            "#,
            quality_badge,
            job.title,
            job.company,
            job.location
                .as_ref()
                .unwrap_or(&"Not specified".to_string()),
            match_result.experience_level,
            job.salary
                .as_ref()
                .map(|s| format!("Salary: {}\n", s))
                .unwrap_or_default(),
            match_result.match_score,
            match_result.matched_skills.join(", "),
            if match_result.missing_skills.is_empty() {
                "None - You have all required skills!".to_string()
            } else {
                match_result.missing_skills.join(", ")
            },
            match_result.match_reasons.join("\n- "),
            job.url
        );

        Self { html, text }
    }

    /// Create a new jobs notification email
    pub fn new_jobs_notification(jobs: &[Job], match_results: Option<&[JobMatchResult]>) -> Self {
        let jobs_html: String = jobs.iter().enumerate().map(|(i, job)| {
            let match_info = match_results.and_then(|results| {
                results.iter().find(|r| r.job_id == job.id)
            });

            let match_badge = match_info.map(|m| {
                format!("<span style='color: {}; font-weight: bold;'>{:.0}% Match</span>",
                    match m.match_score {
                        score if score >= 80.0 => "#28a745",
                        score if score >= 60.0 => "#007bff",
                        score if score >= 40.0 => "#ffc107",
                        _ => "#dc3545",
                    },
                    m.match_score
                )
            }).unwrap_or_default();

            format!(
                r#"
                <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea;">
                    <h3 style="margin: 0 0 10px 0;">{}. {}</h3>
                    <p style="margin: 5px 0;"><strong>Company:</strong> {}</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> {}</p>
                    {}
                    <p style="margin: 10px 0;"><a href="{}" style="color: #667eea; text-decoration: none;">View Job →</a></p>
                </div>
                "#,
                i + 1,
                html_escape(&job.title),
                html_escape(&job.company),
                job.location.as_ref().map(|l| html_escape(l)).unwrap_or_else(|| "Not specified".to_string()),
                if !match_badge.is_empty() {
                    format!("<p style='margin: 5px 0;'>{}</p>", match_badge)
                } else {
                    String::new()
                },
                job.url
            )
        }).collect();

        let html = format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 {} New Job(s) Found!</h1>
        </div>
        <div class="content">
            {}
        </div>
        <div class="footer">
            <p>Unhireable - Neural Career System</p>
        </div>
    </div>
</body>
</html>
            "#,
            jobs.len(),
            jobs_html
        );

        let text = format!(
            r#"
📧 {} New Job(s) Found!

{}

            "#,
            jobs.len(),
            jobs.iter()
                .enumerate()
                .map(|(i, job)| {
                    format!(
                        "{}. {} at {}\n   Location: {}\n   URL: {}\n",
                        i + 1,
                        job.title,
                        job.company,
                        job.location
                            .as_ref()
                            .unwrap_or(&"Not specified".to_string()),
                        job.url
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        );

        Self { html, text }
    }

    /// Create a daily summary email
    pub fn daily_summary(stats: &crate::notifications::email::DailySummaryStats) -> Self {
        let html = format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .stat {{ background: white; padding: 15px; margin: 10px 0; border-radius: 5px; }}
        .stat-number {{ font-size: 32px; font-weight: bold; color: #667eea; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Daily Job Search Summary</h1>
            <p>{}</p>
        </div>
        <div class="content">
            <div class="stat">
                <div class="stat-number">{}</div>
                <div>New Jobs Found</div>
            </div>
            <div class="stat">
                <div class="stat-number">{}</div>
                <div>Total Jobs in Database</div>
            </div>
            <div class="stat">
                <div class="stat-number">{}</div>
                <div>High Match Jobs (60%+)</div>
            </div>
            <div class="stat">
                <div class="stat-number">{}</div>
                <div>Applications Submitted</div>
            </div>
            <div class="stat">
                <div class="stat-number">{}</div>
                <div>Interviews Scheduled</div>
            </div>
        </div>
        <div class="footer">
            <p>Unhireable - Neural Career System</p>
        </div>
    </div>
</body>
</html>
            "#,
            stats.date.format("%B %d, %Y"),
            stats.new_jobs_count,
            stats.total_jobs_count,
            stats.high_match_jobs_count,
            stats.applications_submitted,
            stats.interviews_scheduled
        );

        let text = format!(
            r#"
📊 Daily Job Search Summary
{}

New Jobs Found: {}
Total Jobs in Database: {}
High Match Jobs (60%+): {}
Applications Submitted: {}
Interviews Scheduled: {}
            "#,
            stats.date.format("%B %d, %Y"),
            stats.new_jobs_count,
            stats.total_jobs_count,
            stats.high_match_jobs_count,
            stats.applications_submitted,
            stats.interviews_scheduled
        );

        Self { html, text }
    }

    /// Create a thank-you follow-up email after interview
    pub fn interview_thank_you(
        company: &str,
        recruiter_name: Option<&str>,
        interview_type: &str,
        custom_message: Option<&str>,
    ) -> Self {
        let greeting = if let Some(name) = recruiter_name {
            format!("Dear {},", name)
        } else {
            "Dear Hiring Team,".to_string()
        };

        let custom_section = custom_message
            .map(|msg| format!("\n\n{}", msg))
            .unwrap_or_default();

        let html = format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .signature {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <p>{}</p>

            <p>Thank you for taking the time to interview me for the position at {}. I enjoyed learning more about the team and the exciting work being done at {}.</p>

            <p>The {} interview was particularly insightful, and I'm even more enthusiastic about the opportunity to contribute to your organization's success.{}</p>

            <p>I'm looking forward to hearing from you regarding next steps in the process. Please don't hesitate to reach out if you need any additional information.</p>

            <p>Best regards,<br>
            [Your Name]</p>

            <div class="signature">
                <p>Sent via Unhireable - Neural Career System</p>
            </div>
        </div>
        <div class="footer">
            <p>This follow-up email was automatically generated and sent.</p>
        </div>
    </div>
</body>
</html>
            "#,
            greeting, company, company, interview_type, custom_section
        );

        let text = format!(
            r#"
{}

Thank you for taking the time to interview me for the position at {}. I enjoyed learning more about the team and the exciting work being done at {}.

The {} interview was particularly insightful, and I'm even more enthusiastic about the opportunity to contribute to your organization's success.{}

I'm looking forward to hearing from you regarding next steps in the process. Please don't hesitate to reach out if you need any additional information.

Best regards,
[Your Name]

Sent via Unhireable - Neural Career System
            "#,
            greeting, company, company, interview_type, custom_section
        );

        Self { html, text }
    }

    /// Create a status check-in follow-up email
    pub fn status_check_in(
        company: &str,
        recruiter_name: Option<&str>,
        days_since_application: u32,
        position_title: &str,
    ) -> Self {
        let greeting = if let Some(name) = recruiter_name {
            format!("Dear {},", name)
        } else {
            "Dear Hiring Team,".to_string()
        };

        let html = format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .signature {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <p>{}</p>

            <p>I hope this email finds you well. I'm writing to follow up on my application for the {} position at {}, which I submitted {} days ago.</p>

            <p>I'm very interested in this opportunity and would appreciate any updates you can provide regarding the status of my application. I'm particularly excited about the possibility of contributing to {}'s mission.</p>

            <p>Thank you for your time and consideration. I look forward to hearing from you.</p>

            <p>Best regards,<br>
            [Your Name]</p>

            <div class="signature">
                <p>Sent via Unhireable - Neural Career System</p>
            </div>
        </div>
        <div class="footer">
            <p>This follow-up email was automatically generated and sent.</p>
        </div>
    </div>
</body>
</html>
            "#,
            greeting, position_title, company, days_since_application, company
        );

        let text = format!(
            r#"
{}

I hope this email finds you well. I'm writing to follow up on my application for the {} position at {}, which I submitted {} days ago.

I'm very interested in this opportunity and would appreciate any updates you can provide regarding the status of my application. I'm particularly excited about the possibility of contributing to {}'s mission.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
[Your Name]

Sent via Unhireable - Neural Career System
            "#,
            greeting, position_title, company, days_since_application, company
        );

        Self { html, text }
    }

    /// Create an interview confirmation follow-up email
    pub fn interview_confirmation(
        company: &str,
        recruiter_name: Option<&str>,
        interview_date: &str,
        interview_time: &str,
        interview_type: &str,
        calendar_link: Option<&str>,
    ) -> Self {
        let greeting = if let Some(name) = recruiter_name {
            format!("Dear {},", name)
        } else {
            "Dear Hiring Team,".to_string()
        };

        let calendar_section = calendar_link
            .map(|link| format!("\n\n<p>Calendar Link: <a href='{}'>{}</a></p>", link, link))
            .unwrap_or_default();

        let html = format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .interview-details {{ background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #667eea; }}
        .signature {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <p>{}</p>

            <p>Thank you for scheduling the {} interview. I'm confirming the details below and looking forward to speaking with you.</p>

            <div class="interview-details">
                <strong>Interview Details:</strong><br>
                Date: {}<br>
                Time: {}<br>
                Type: {}{}
            </div>

            <p>Please let me know if there's anything I should prepare or any information I should have ready for our conversation.</p>

            <p>Best regards,<br>
            [Your Name]</p>

            <div class="signature">
                <p>Sent via Unhireable - Neural Career System</p>
            </div>
        </div>
        <div class="footer">
            <p>This confirmation email was automatically generated and sent.</p>
        </div>
    </div>
</body>
</html>
            "#,
            greeting,
            interview_type,
            interview_date,
            interview_time,
            interview_type,
            calendar_section
        );

        let text = format!(
            r#"
{}

Thank you for scheduling the {} interview. I'm confirming the details below and looking forward to speaking with you.

Interview Details:
Date: {}
Time: {}
Type: {}{}

Please let me know if there's anything I should prepare or any information I should have ready for our conversation.

Best regards,
[Your Name]

Sent via Unhireable - Neural Career System
            "#,
            greeting,
            interview_type,
            interview_date,
            interview_time,
            interview_type,
            calendar_link
                .map(|link| format!("\nCalendar Link: {}", link))
                .unwrap_or_default()
        );

        Self { html, text }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::{Job, JobStatus};
    use crate::matching::JobMatchResult;
    use chrono::Utc;

    fn create_test_job() -> Job {
        Job {
            id: Some(1),
            title: "Senior React Developer".to_string(),
            company: "Tech Corp".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("We are looking for a senior React developer.".to_string()),
            requirements: Some("React, TypeScript, Node.js".to_string()),
            location: Some("Remote".to_string()),
            salary: None,
            contact_email: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: Some(85.0),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        }
    }

    fn create_test_match_result() -> JobMatchResult {
        JobMatchResult {
            job_id: Some(1),
            job: create_test_job(),
            match_score: 85.0,
            skills_match: 90.0,
            experience_match: 80.0,
            location_match: 100.0,
            matched_skills: vec!["React".to_string(), "TypeScript".to_string()],
            missing_skills: vec!["Docker".to_string()],
            match_reasons: vec!["Strong skills match".to_string()],
            experience_level: "Senior".to_string(),
        }
    }

    #[test]
    fn test_job_match_notification_template() {
        let job = create_test_job();
        let match_result = create_test_match_result();
        let template = EmailTemplate::job_match_notification(&job, &match_result);

        // Check that template contains job information
        assert!(template.html.contains("Senior React Developer"));
        assert!(template.html.contains("Tech Corp"));
        assert!(template.html.contains("85"));

        // Check text version
        assert!(template.text.contains("Senior React Developer"));
        assert!(template.text.contains("Tech Corp"));
    }

    #[test]
    fn test_new_jobs_notification_template() {
        let jobs = vec![create_test_job()];
        let template = EmailTemplate::new_jobs_notification(&jobs, None);

        // Check that template contains job information
        assert!(template.html.contains("Senior React Developer"));
        assert!(template.html.contains("Tech Corp"));

        // Check text version
        assert!(template.text.contains("Senior React Developer"));
    }

    #[test]
    fn test_new_jobs_notification_with_match_results() {
        let jobs = vec![create_test_job()];
        let match_results = vec![create_test_match_result()];
        let template = EmailTemplate::new_jobs_notification(&jobs, Some(&match_results));

        // Check that template contains match information
        assert!(template.html.contains("85"));
        assert!(template.html.contains("Senior React Developer"));
    }

    #[test]
    fn test_template_html_escaping() {
        let mut job = create_test_job();
        job.company = "Tech & Co <script>alert('xss')</script>".to_string();
        let match_result = create_test_match_result();
        let template = EmailTemplate::job_match_notification(&job, &match_result);

        // HTML should be escaped (no script tags)
        assert!(!template.html.contains("<script>"));
        // But should contain escaped version
        assert!(template.html.contains("&amp;"));
    }

    #[test]
    fn test_html_escape() {
        assert_eq!(html_escape("<script>"), "&lt;script&gt;");
        assert_eq!(html_escape("Test & Company"), "Test &amp; Company");
    }
}

/// HTML escape function to prevent XSS
fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

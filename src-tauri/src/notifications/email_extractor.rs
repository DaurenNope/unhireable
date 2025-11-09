use regex::Regex;
use std::collections::HashSet;

/// Extract email addresses from text
pub fn extract_emails(text: &str) -> Vec<String> {
    // Regex pattern for email addresses
    // This pattern matches most common email formats
    let email_pattern = r#"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"#;
    
    let re = Regex::new(email_pattern).unwrap_or_else(|_| {
        // Fallback simple pattern if regex fails
        Regex::new(r#"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"#).unwrap()
    });
    
    let mut emails = HashSet::new();
    
    // Find all matches
    for cap in re.find_iter(text) {
        let email = cap.as_str().to_lowercase();
        // Filter out common false positives
        if !email.contains("example.com") && 
           !email.contains("test@") &&
           !email.ends_with(".png") &&
           !email.ends_with(".jpg") &&
           !email.ends_with(".gif") {
            emails.insert(email);
        }
    }
    
    emails.into_iter().collect()
}

/// Extract email addresses from job description and requirements
pub fn extract_job_emails(description: &Option<String>, requirements: &Option<String>) -> Vec<String> {
    let mut emails = Vec::new();
    
    if let Some(desc) = description {
        emails.extend(extract_emails(desc));
    }
    
    if let Some(req) = requirements {
        emails.extend(extract_emails(req));
    }
    
    // Remove duplicates while preserving order
    let mut seen = HashSet::new();
    emails.into_iter()
        .filter(|email| seen.insert(email.clone()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_emails() {
        let text = "Contact us at jobs@company.com or hr@company.com for more information.";
        let emails = extract_emails(text);
        assert!(emails.contains(&"jobs@company.com".to_string()));
        assert!(emails.contains(&"hr@company.com".to_string()));
    }

    #[test]
    fn test_extract_job_emails() {
        let description = Some("Send your resume to apply@company.com".to_string());
        let requirements = Some("Contact hr@company.com for questions".to_string());
        let emails = extract_job_emails(&description, &requirements);
        assert!(emails.len() >= 1);
        assert!(emails.iter().any(|e| e.contains("apply@company.com")));
    }

    #[test]
    fn test_extract_emails_no_duplicates() {
        let text = "Email us at jobs@company.com. Also contact jobs@company.com for more info.";
        let emails = extract_emails(text);
        // Should only have one instance
        assert_eq!(emails.iter().filter(|e| e == &"jobs@company.com").count(), 1);
    }
}


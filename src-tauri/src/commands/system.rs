use crate::applicator::ats_detector::AtsDetector;
use crate::error::Result;

// ATS Suggestions struct
#[derive(serde::Serialize)]
pub struct AtsSuggestion {
    pub ats_type: Option<String>,
    pub confidence: String,
    pub tips: Vec<String>,
    pub known_quirks: Vec<String>,
    pub automation_support: String,
}

// ATS Suggestions Command
#[tauri::command]
pub async fn get_ats_suggestions(job_url: String) -> Result<AtsSuggestion> {
    let detected = AtsDetector::detect_ats(&job_url);
    let ats_type_str = detected.as_ref().map(|ats| format!("{:?}", ats));

    let (confidence, tips, quirks, automation) = match detected {
        Some(crate::applicator::ats_detector::AtsType::Greenhouse) => (
            "high",
            vec![
                "Greenhouse forms are well-structured and automation-friendly".to_string(),
                "Resume upload is typically required".to_string(),
                "Cover letter can be uploaded or pasted as text".to_string(),
                "LinkedIn and GitHub URLs are usually optional fields".to_string(),
            ],
            vec![
                "Some companies add custom questions that may require manual review".to_string(),
                "File size limits are typically 5MB for resumes".to_string(),
            ],
            "full",
        ),
        Some(crate::applicator::ats_detector::AtsType::Lever) => (
            "high",
            vec![
                "Lever has a clean, consistent form structure".to_string(),
                "Resume upload is required".to_string(),
                "Portfolio/GitHub/LinkedIn URLs are common optional fields".to_string(),
                "Cover letter can be added as text in comments section".to_string(),
            ],
            vec![
                "Some Lever forms have dynamic fields that appear based on answers".to_string(),
                "File uploads may have specific format requirements".to_string(),
            ],
            "full",
        ),
        Some(crate::applicator::ats_detector::AtsType::Workday) => (
            "medium",
            vec![
                "Workday forms can be complex with multiple steps".to_string(),
                "Resume upload is typically required early in the process".to_string(),
                "You may need to create a Workday account first".to_string(),
                "Cover letter is often optional or in a separate section".to_string(),
            ],
            vec![
                "Workday forms often have many required fields and validation steps".to_string(),
                "Some companies use custom Workday configurations".to_string(),
                "File uploads may require specific formats (PDF preferred)".to_string(),
            ],
            "partial",
        ),
        Some(crate::applicator::ats_detector::AtsType::Workable) => (
            "high",
            vec![
                "Workable forms are well-structured and automation-friendly".to_string(),
                "Resume upload is required".to_string(),
                "Cover letter can be uploaded or entered as text".to_string(),
                "LinkedIn, GitHub, and portfolio URLs are common optional fields".to_string(),
            ],
            vec![
                "Some Workable forms have consent checkboxes that need to be checked".to_string(),
                "File size limits may apply (typically 10MB)".to_string(),
            ],
            "full",
        ),
        Some(crate::applicator::ats_detector::AtsType::LinkedInEasyApply) => (
            "high",
            vec![
                "LinkedIn Easy Apply is designed for quick applications".to_string(),
                "Resume upload is required (uses your LinkedIn profile resume)".to_string(),
                "Cover letter/message is optional but recommended".to_string(),
                "Phone number and location are typically required".to_string(),
            ],
            vec![
                "LinkedIn may pre-fill some fields from your profile".to_string(),
                "Some positions require LinkedIn Premium for Easy Apply".to_string(),
            ],
            "full",
        ),
        Some(_) => (
            "medium",
            vec![
                "This ATS system has been detected and field selectors are available".to_string(),
                "Resume upload is typically required".to_string(),
                "Review the form structure before automating".to_string(),
                "Ensure all required fields are identified".to_string(),
            ],
            vec![
                "Forms may have unique validation rules".to_string(),
                "File upload requirements may vary".to_string(),
                "Some forms may have CAPTCHA or other anti-bot measures".to_string(),
            ],
            "partial",
        ),
        None => (
            "low",
            vec![
                "This appears to be a generic application form".to_string(),
                "Review the form structure before automating".to_string(),
                "Ensure all required fields are identified".to_string(),
                "Test with a dry-run before submitting real applications".to_string(),
            ],
            vec![
                "Generic forms may have varying structures".to_string(),
                "Manual review is recommended before automation".to_string(),
                "File upload fields may not be standardized".to_string(),
            ],
            "limited",
        ),
    };

    Ok(AtsSuggestion {
        ats_type: ats_type_str,
        confidence: confidence.to_string(),
        tips,
        known_quirks: quirks,
        automation_support: automation.to_string(),
    })
}

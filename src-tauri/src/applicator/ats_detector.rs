use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AtsType {
    Greenhouse,
    Lever,
    Workday,
    Workable,
    LinkedInEasyApply,
    // Additional ATS systems (20+ total)
    BambooHR,
    SmartRecruiters,
    ICIMS,
    Taleo,
    SuccessFactors,
    Jobvite,
    Bullhorn,
    ZohoRecruit,
    Recruitee,
    JazzHR,
    Personio,
    Teamtailor,
    BreezyHR,
    RecruiteeBoard,
    AshbyHQ,
    PinPoint,
    Recruiterflow,
    Manatal,
    Erecruit,
    SAPSuccessFactors,
    ADP,
    PeopleFluent,
    OracleTaleo,
    Cornerstone,
    JobDiva,
    Generic,
}

pub struct AtsDetector;

impl AtsDetector {
    /// Detect ATS system from URL or page content
    pub fn detect_ats(url: &str) -> Option<AtsType> {
        let url_lower = url.to_lowercase();

        // Check URL patterns (ordered by specificity - more specific first)
        // Greenhouse
        if url_lower.contains("greenhouse.io") || url_lower.contains("boards.greenhouse.io") {
            return Some(AtsType::Greenhouse);
        }

        // Lever
        if url_lower.contains("lever.co") || url_lower.contains("jobs.lever.co") {
            return Some(AtsType::Lever);
        }

        // Workday
        if url_lower.contains("workday.com") || url_lower.contains("myworkdayjobs.com") {
            return Some(AtsType::Workday);
        }

        // Workable
        if url_lower.contains("apply.workable.com") || url_lower.contains("workable.com") {
            return Some(AtsType::Workable);
        }

        // LinkedIn Easy Apply
        if url_lower.contains("linkedin.com/jobs") || url_lower.contains("linkedin.com/job") {
            return Some(AtsType::LinkedInEasyApply);
        }

        // BambooHR
        if url_lower.contains("bamboohr.com") || url_lower.contains("apply.bamboohr.com") {
            return Some(AtsType::BambooHR);
        }

        // SmartRecruiters
        if url_lower.contains("smartrecruiters.com") || url_lower.contains("apply.smartrecruiters.com") {
            return Some(AtsType::SmartRecruiters);
        }

        // ICIMS
        if url_lower.contains("icims.com") || url_lower.contains("careers") && url_lower.contains("icims") {
            return Some(AtsType::ICIMS);
        }

        // Taleo / Oracle Taleo
        if url_lower.contains("taleo.net") || url_lower.contains("taleo.com") || url_lower.contains("oracletaleo") {
            return Some(AtsType::Taleo);
        }

        // SAP SuccessFactors
        if url_lower.contains("successfactors.eu") || url_lower.contains("sfbobs") || url_lower.contains("successfactors.com") {
            return Some(AtsType::SuccessFactors);
        }

        // Jobvite
        if url_lower.contains("jobvite.com") || url_lower.contains("apply.jobvite.com") {
            return Some(AtsType::Jobvite);
        }

        // Bullhorn
        if url_lower.contains("bullhorn.com") || url_lower.contains("bullhornreach.com") {
            return Some(AtsType::Bullhorn);
        }

        // Zoho Recruit
        if url_lower.contains("zoho.com/recruit") || url_lower.contains("recruit.zoho.com") {
            return Some(AtsType::ZohoRecruit);
        }

        // Recruitee
        if url_lower.contains("recruitee.com") || url_lower.contains("apply.recruitee.com") {
            return Some(AtsType::Recruitee);
        }

        // JazzHR
        if url_lower.contains("jazzhr.com") || url_lower.contains("apply.jazzhr.com") {
            return Some(AtsType::JazzHR);
        }

        // Personio
        if url_lower.contains("personio.com") || url_lower.contains("jobs.personio.com") {
            return Some(AtsType::Personio);
        }

        // Teamtailor
        if url_lower.contains("teamtailor.com") || url_lower.contains("apply.teamtailor.com") {
            return Some(AtsType::Teamtailor);
        }

        // BreezyHR
        if url_lower.contains("breezy.hr") || url_lower.contains("breezyhr.com") {
            return Some(AtsType::BreezyHR);
        }

        // AshbyHQ
        if url_lower.contains("ashbyhq.com") || url_lower.contains("jobs.ashbyhq.com") {
            return Some(AtsType::AshbyHQ);
        }

        // PinPoint
        if url_lower.contains("pinpoint.com") || url_lower.contains("apply.pinpoint.com") {
            return Some(AtsType::PinPoint);
        }

        // Recruiterflow
        if url_lower.contains("recruiterflow.com") || url_lower.contains("apply.recruiterflow.com") {
            return Some(AtsType::Recruiterflow);
        }

        // Manatal
        if url_lower.contains("manatal.com") || url_lower.contains("apply.manatal.com") {
            return Some(AtsType::Manatal);
        }

        // Erecruit
        if url_lower.contains("erecruit.com") || url_lower.contains("apply.erecruit.com") {
            return Some(AtsType::Erecruit);
        }

        // ADP
        if url_lower.contains("adp.com") && url_lower.contains("careers") {
            return Some(AtsType::ADP);
        }

        // PeopleFluent
        if url_lower.contains("peoplefluent.com") || url_lower.contains("careers.peoplefluent.com") {
            return Some(AtsType::PeopleFluent);
        }

        // Oracle Taleo (additional check)
        if url_lower.contains("oracle") && url_lower.contains("taleo") {
            return Some(AtsType::OracleTaleo);
        }

        // Cornerstone
        if url_lower.contains("cornerstoneondemand.com") || url_lower.contains("csod.com") {
            return Some(AtsType::Cornerstone);
        }

        // JobDiva
        if url_lower.contains("jobdiva.com") || url_lower.contains("apply.jobdiva.com") {
            return Some(AtsType::JobDiva);
        }

        // Default to generic if no specific ATS detected
        None
    }

    /// Get form field selectors for a specific ATS
    pub fn get_field_selectors(ats_type: &Option<AtsType>) -> FieldSelectors {
        match ats_type {
            Some(AtsType::Greenhouse) => FieldSelectors::greenhouse(),
            Some(AtsType::Lever) => FieldSelectors::lever(),
            Some(AtsType::Workday) => FieldSelectors::workday(),
            Some(AtsType::Workable) => FieldSelectors::workable(),
            Some(AtsType::LinkedInEasyApply) => FieldSelectors::linkedin(),
            Some(AtsType::BambooHR) => FieldSelectors::bamboohr(),
            Some(AtsType::SmartRecruiters) => FieldSelectors::smartrecruiters(),
            Some(AtsType::ICIMS) => FieldSelectors::icims(),
            Some(AtsType::Taleo) | Some(AtsType::OracleTaleo) => FieldSelectors::taleo(),
            Some(AtsType::SuccessFactors) | Some(AtsType::SAPSuccessFactors) => FieldSelectors::successfactors(),
            Some(AtsType::Jobvite) => FieldSelectors::jobvite(),
            Some(AtsType::Bullhorn) => FieldSelectors::bullhorn(),
            Some(AtsType::ZohoRecruit) => FieldSelectors::zohorecruit(),
            Some(AtsType::Recruitee) => FieldSelectors::recruitee(),
            Some(AtsType::JazzHR) => FieldSelectors::jazzhr(),
            Some(AtsType::Personio) => FieldSelectors::personio(),
            Some(AtsType::Teamtailor) => FieldSelectors::teamtailor(),
            Some(AtsType::BreezyHR) => FieldSelectors::breezyhr(),
            Some(AtsType::AshbyHQ) => FieldSelectors::ashbyhq(),
            Some(AtsType::PinPoint) => FieldSelectors::pinpoint(),
            Some(AtsType::Recruiterflow) => FieldSelectors::recruiterflow(),
            Some(AtsType::Manatal) => FieldSelectors::manatal(),
            Some(AtsType::Erecruit) => FieldSelectors::erecruit(),
            Some(AtsType::ADP) => FieldSelectors::adp(),
            Some(AtsType::PeopleFluent) => FieldSelectors::peoplefluent(),
            Some(AtsType::Cornerstone) => FieldSelectors::cornerstone(),
            Some(AtsType::JobDiva) => FieldSelectors::jobdiva(),
            _ => FieldSelectors::generic(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct FieldSelectors {
    pub first_name: Vec<String>,
    pub last_name: Vec<String>,
    pub email: Vec<String>,
    pub phone: Vec<String>,
    pub location: Vec<String>,
    pub linkedin: Vec<String>,
    pub github: Vec<String>,
    pub portfolio: Vec<String>,
    pub resume_upload: Vec<String>,
    pub cover_letter_upload: Vec<String>,
    pub cover_letter_text: Vec<String>,
    pub submit_button: Vec<String>,
    pub consent_checkbox: Vec<String>,
}

impl FieldSelectors {
    pub fn greenhouse() -> Self {
        Self {
            first_name: vec![
                "#first_name".to_string(),
                "input[name='first_name']".to_string(),
                "input[id*='first']".to_string(),
            ],
            last_name: vec![
                "#last_name".to_string(),
                "input[name='last_name']".to_string(),
                "input[id*='last']".to_string(),
            ],
            email: vec![
                "#email".to_string(),
                "input[name='email']".to_string(),
                "input[type='email']".to_string(),
            ],
            phone: vec![
                "#phone".to_string(),
                "input[name='phone']".to_string(),
                "input[type='tel']".to_string(),
            ],
            location: vec![
                "#location".to_string(),
                "input[name='location']".to_string(),
                "input[id*='location']".to_string(),
            ],
            linkedin: vec![
                "#linkedin_url".to_string(),
                "input[name='linkedin_url']".to_string(),
                "input[id*='linkedin']".to_string(),
            ],
            github: vec![
                "#github_url".to_string(),
                "input[name='github_url']".to_string(),
                "input[id*='github']".to_string(),
            ],
            portfolio: vec![
                "#portfolio_url".to_string(),
                "input[name='portfolio_url']".to_string(),
                "input[id*='portfolio']".to_string(),
            ],
            resume_upload: vec![
                "input[type='file'][name*='resume']".to_string(),
                "input[type='file'][name*='cv']".to_string(),
                "input[type='file'][id*='resume']".to_string(),
                "#resume".to_string(),
            ],
            cover_letter_upload: vec![
                "input[type='file'][name*='cover']".to_string(),
                "input[type='file'][id*='cover']".to_string(),
            ],
            cover_letter_text: vec![
                "textarea[name*='cover']".to_string(),
                "textarea[id*='cover']".to_string(),
                "#cover_letter".to_string(),
            ],
            submit_button: vec![
                "button[type='submit']".to_string(),
                "input[type='submit']".to_string(),
                "button:contains('Submit')".to_string(),
                "button:contains('Apply')".to_string(),
            ],
            consent_checkbox: vec![
                "input[type='checkbox'][name*='consent']".to_string(),
                "input[type='checkbox'][name*='authorize']".to_string(),
            ],
        }
    }

    pub fn lever() -> Self {
        Self {
            first_name: vec![
                "input[name='name']".to_string(),
                "#name".to_string(),
                "input[id*='name']".to_string(),
            ],
            last_name: vec![
                "input[name='lastName']".to_string(),
                "#lastName".to_string(),
            ],
            email: vec![
                "input[name='email']".to_string(),
                "#email".to_string(),
                "input[type='email']".to_string(),
            ],
            phone: vec![
                "input[name='phone']".to_string(),
                "#phone".to_string(),
                "input[type='tel']".to_string(),
            ],
            location: vec![
                "input[name='location']".to_string(),
                "#location".to_string(),
            ],
            linkedin: vec![
                "input[name='urls[LinkedIn]']".to_string(),
                "input[name*='linkedin']".to_string(),
            ],
            github: vec![
                "input[name='urls[GitHub]']".to_string(),
                "input[name*='github']".to_string(),
            ],
            portfolio: vec![
                "input[name='urls[Portfolio]']".to_string(),
                "input[name*='portfolio']".to_string(),
            ],
            resume_upload: vec![
                "input[type='file'][name*='resume']".to_string(),
                "input[type='file']".to_string(),
            ],
            cover_letter_upload: vec!["input[type='file'][name*='cover']".to_string()],
            cover_letter_text: vec![
                "textarea[name*='comments']".to_string(),
                "textarea[id*='comments']".to_string(),
            ],
            submit_button: vec![
                "button[type='submit']".to_string(),
                "button:contains('Submit application')".to_string(),
            ],
            consent_checkbox: vec![],
        }
    }

    pub fn workday() -> Self {
        Self {
            first_name: vec![
                "input[data-automation-id='firstName']".to_string(),
                "input[name='firstName']".to_string(),
            ],
            last_name: vec![
                "input[data-automation-id='lastName']".to_string(),
                "input[name='lastName']".to_string(),
            ],
            email: vec![
                "input[data-automation-id='email']".to_string(),
                "input[type='email']".to_string(),
            ],
            phone: vec![
                "input[data-automation-id='phone']".to_string(),
                "input[type='tel']".to_string(),
            ],
            location: vec!["input[data-automation-id='city']".to_string()],
            linkedin: vec!["input[data-automation-id='linkedIn']".to_string()],
            github: vec![],
            portfolio: vec![],
            resume_upload: vec!["input[type='file'][data-automation-id='resume']".to_string()],
            cover_letter_upload: vec![],
            cover_letter_text: vec!["textarea[data-automation-id='coverLetter']".to_string()],
            submit_button: vec!["button[data-automation-id='submit']".to_string()],
            consent_checkbox: vec![],
        }
    }

    pub fn workable() -> Self {
        Self {
            first_name: vec![
                "input[name='firstName']".to_string(),
                "input[data-qa='firstName']".to_string(),
                "div[data-qa='firstName'] input".to_string(),
                "input[id*='firstName']".to_string(),
                "input[id*='first_name']".to_string(),
            ],
            last_name: vec![
                "input[name='lastName']".to_string(),
                "input[data-qa='lastName']".to_string(),
                "div[data-qa='lastName'] input".to_string(),
                "input[id*='lastName']".to_string(),
                "input[id*='last_name']".to_string(),
            ],
            email: vec![
                "input[name='email']".to_string(),
                "input[data-qa='email']".to_string(),
                "div[data-qa='email'] input".to_string(),
                "input[type='email']".to_string(),
                "input[id*='email']".to_string(),
            ],
            phone: vec![
                "input[name='phone']".to_string(),
                "input[data-qa='phone']".to_string(),
                "div[data-qa='phone'] input".to_string(),
                "input[type='tel']".to_string(),
                "input[id*='phone']".to_string(),
            ],
            location: vec![
                "input[name='location']".to_string(),
                "div[data-qa='location'] input".to_string(),
                "input[id*='location']".to_string(),
            ],
            linkedin: vec![
                "input[name='linkedInUrl']".to_string(),
                "input[name='linkedin']".to_string(),
                "input[data-qa='linkedInUrl']".to_string(),
                "div[data-qa='linkedInUrl'] input".to_string(),
                "input[id*='linkedin']".to_string(),
            ],
            github: vec![
                "input[name='githubUrl']".to_string(),
                "input[name='github']".to_string(),
                "input[data-qa='githubUrl']".to_string(),
                "div[data-qa='githubUrl'] input".to_string(),
                "input[id*='github']".to_string(),
            ],
            portfolio: vec![
                "input[name='portfolioWebsite']".to_string(),
                "input[name='website']".to_string(),
                "input[data-qa='portfolioWebsite']".to_string(),
                "div[data-qa='portfolioWebsite'] input".to_string(),
                "input[id*='portfolio']".to_string(),
            ],
            resume_upload: vec![
                // Direct file inputs
                "input[type='file'][name='resume']".to_string(),
                "input[type='file'][name*='resume']".to_string(),
                "input[type='file'][data-qa='resume']".to_string(),
                "input[type='file'][id*='resume']".to_string(),
                // File inputs inside containers
                "div[data-qa='resume'] input[type='file']".to_string(),
                "label[for*='resume'] input[type='file']".to_string(),
                "label:has-text('Resume') input[type='file']".to_string(),
                // Generic file input as last resort (Workable often has only one)
                "input[type='file']".to_string(),
            ],
            cover_letter_upload: vec![
                "input[type='file'][name='coverLetter']".to_string(),
                "input[type='file'][name*='cover']".to_string(),
                "input[type='file'][data-qa='coverLetter']".to_string(),
                "div[data-qa='coverLetter'] input[type='file']".to_string(),
                "label[for*='cover'] input[type='file']".to_string(),
            ],
            cover_letter_text: vec![
                "textarea[name='coverLetter']".to_string(),
                "textarea[data-qa='coverLetter']".to_string(),
                "div[data-qa='coverLetter'] textarea".to_string(),
                "textarea[name*='cover']".to_string(),
                "textarea[id*='cover']".to_string(),
            ],
            submit_button: vec![
                "button[type='submit'][data-qa='submit']".to_string(),
                "button[data-ui='submit']".to_string(),
                "button[type='submit']".to_string(),
                "button:contains('Submit')".to_string(),
                "button:contains('Send application')".to_string(),
                "button:contains('Apply')".to_string(),
            ],
            consent_checkbox: vec![
                "input[type='checkbox'][name*='consent']".to_string(),
                "input[type='checkbox'][data-qa*='consent']".to_string(),
                "input[type='checkbox'][id*='consent']".to_string(),
            ],
        }
    }

    pub fn linkedin() -> Self {
        Self {
            first_name: vec![
                "input[name='firstName']".to_string(),
                "input[id*='firstName']".to_string(),
                "input[data-test-single-line-text-input='firstName']".to_string(),
                "input[aria-label*='First name']".to_string(),
            ],
            last_name: vec![
                "input[name='lastName']".to_string(),
                "input[id*='lastName']".to_string(),
                "input[data-test-single-line-text-input='lastName']".to_string(),
                "input[aria-label*='Last name']".to_string(),
            ],
            email: vec![
                "input[name='email']".to_string(),
                "input[type='email']".to_string(),
                "input[data-test-single-line-text-input='email']".to_string(),
                "input[aria-label*='Email']".to_string(),
            ],
            phone: vec![
                "input[name='phone']".to_string(),
                "input[type='tel']".to_string(),
                "input[data-test-single-line-text-input='phone']".to_string(),
                "input[aria-label*='Phone']".to_string(),
            ],
            location: vec![
                "input[name='location']".to_string(),
                "input[data-test-single-line-text-input='location']".to_string(),
                "input[aria-label*='Location']".to_string(),
            ],
            linkedin: vec![],
            github: vec![],
            portfolio: vec![],
            resume_upload: vec![
                "input[type='file'][name*='resume']".to_string(),
                "input[type='file'][accept*='pdf']".to_string(),
                "input[type='file'][accept*='doc']".to_string(),
                "input[type='file']".to_string(),
                // LinkedIn often uses hidden file inputs triggered by buttons
                "button[aria-label*='Upload resume']".to_string(),
                "button:has-text('Upload resume')".to_string(),
            ],
            cover_letter_upload: vec![],
            cover_letter_text: vec![
                "textarea[name*='message']".to_string(),
                "textarea[aria-label*='Message']".to_string(),
                "textarea[data-test-multiline-text-input='message']".to_string(),
                "textarea[placeholder*='message']".to_string(),
            ],
            submit_button: vec![
                "button[aria-label*='Submit application']".to_string(),
                "button[aria-label*='Submit']".to_string(),
                "button:contains('Submit application')".to_string(),
                "button[data-test-modal-primary-btn]".to_string(),
                "button[type='submit']".to_string(),
            ],
            consent_checkbox: vec![
                "input[type='checkbox'][name*='consent']".to_string(),
                "input[type='checkbox'][aria-label*='consent']".to_string(),
                "input[type='checkbox'][data-test-checkbox]".to_string(),
            ],
        }
    }

    // Additional ATS field selectors (20+ systems)
    pub fn bamboohr() -> Self {
        Self {
            first_name: vec!["input[name*='firstName']".to_string(), "input[id*='firstName']".to_string()],
            last_name: vec!["input[name*='lastName']".to_string(), "input[id*='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name*='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name*='phone']".to_string()],
            location: vec!["input[name*='location']".to_string(), "input[name*='city']".to_string()],
            linkedin: vec!["input[name*='linkedin']".to_string()],
            github: vec!["input[name*='github']".to_string()],
            portfolio: vec!["input[name*='portfolio']".to_string(), "input[name*='website']".to_string()],
            resume_upload: vec!["input[type='file'][name*='resume']".to_string(), "input[type='file']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name*='cover']".to_string()],
            cover_letter_text: vec!["textarea[name*='cover']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "button:contains('Submit')".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn smartrecruiters() -> Self {
        Self {
            first_name: vec!["input[name='firstname']".to_string(), "input[data-testid='firstname']".to_string()],
            last_name: vec!["input[name='lastname']".to_string(), "input[data-testid='lastname']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "button[data-testid='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn icims() -> Self {
        Self {
            first_name: vec!["input[name*='firstName']".to_string(), "input[id*='firstName']".to_string()],
            last_name: vec!["input[name*='lastName']".to_string(), "input[id*='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name*='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name*='phone']".to_string()],
            location: vec!["input[name*='location']".to_string()],
            linkedin: vec!["input[name*='linkedin']".to_string()],
            github: vec!["input[name*='github']".to_string()],
            portfolio: vec!["input[name*='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name*='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name*='cover']".to_string()],
            cover_letter_text: vec!["textarea[name*='cover']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "input[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn taleo() -> Self {
        Self {
            first_name: vec!["input[name*='firstName']".to_string(), "input[id*='firstName']".to_string()],
            last_name: vec!["input[name*='lastName']".to_string(), "input[id*='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name*='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name*='phone']".to_string()],
            location: vec!["input[name*='location']".to_string()],
            linkedin: vec!["input[name*='linkedin']".to_string()],
            github: vec!["input[name*='github']".to_string()],
            portfolio: vec!["input[name*='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name*='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name*='cover']".to_string()],
            cover_letter_text: vec!["textarea[name*='cover']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "input[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn successfactors() -> Self {
        Self {
            first_name: vec!["input[name*='firstName']".to_string(), "input[data-automation-id='firstName']".to_string()],
            last_name: vec!["input[name*='lastName']".to_string(), "input[data-automation-id='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name*='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name*='phone']".to_string()],
            location: vec!["input[name*='location']".to_string()],
            linkedin: vec!["input[name*='linkedin']".to_string()],
            github: vec!["input[name*='github']".to_string()],
            portfolio: vec!["input[name*='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name*='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name*='cover']".to_string()],
            cover_letter_text: vec!["textarea[name*='cover']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "button[data-automation-id='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn jobvite() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string(), "input[id='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string(), "input[id='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "button.jv-button-submit".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn bullhorn() -> Self {
        Self {
            first_name: vec!["input[name*='firstName']".to_string(), "input[id*='firstName']".to_string()],
            last_name: vec!["input[name*='lastName']".to_string(), "input[id*='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name*='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name*='phone']".to_string()],
            location: vec!["input[name*='location']".to_string()],
            linkedin: vec!["input[name*='linkedin']".to_string()],
            github: vec!["input[name*='github']".to_string()],
            portfolio: vec!["input[name*='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name*='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name*='cover']".to_string()],
            cover_letter_text: vec!["textarea[name*='cover']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "input[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn zohorecruit() -> Self {
        Self {
            first_name: vec!["input[name*='firstName']".to_string(), "input[id*='firstName']".to_string()],
            last_name: vec!["input[name*='lastName']".to_string(), "input[id*='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name*='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name*='phone']".to_string()],
            location: vec!["input[name*='location']".to_string()],
            linkedin: vec!["input[name*='linkedin']".to_string()],
            github: vec!["input[name*='github']".to_string()],
            portfolio: vec!["input[name*='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name*='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name*='cover']".to_string()],
            cover_letter_text: vec!["textarea[name*='cover']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "input[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn recruitee() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string(), "input[data-field='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string(), "input[data-field='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "button.recruitee-submit".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn jazzhr() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string(), "input[id='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string(), "input[id='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "button.jazz-submit".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn personio() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string(), "input[data-field='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string(), "input[data-field='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string(), "button.personio-submit".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn teamtailor() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn breezyhr() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn ashbyhq() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn pinpoint() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn recruiterflow() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn manatal() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn erecruit() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn adp() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn peoplefluent() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn cornerstone() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn jobdiva() -> Self {
        Self {
            first_name: vec!["input[name='firstName']".to_string()],
            last_name: vec!["input[name='lastName']".to_string()],
            email: vec!["input[type='email']".to_string(), "input[name='email']".to_string()],
            phone: vec!["input[type='tel']".to_string(), "input[name='phone']".to_string()],
            location: vec!["input[name='location']".to_string()],
            linkedin: vec!["input[name='linkedin']".to_string()],
            github: vec!["input[name='github']".to_string()],
            portfolio: vec!["input[name='portfolio']".to_string()],
            resume_upload: vec!["input[type='file'][name='resume']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name='cover']".to_string()],
            cover_letter_text: vec!["textarea[name='coverLetter']".to_string()],
            submit_button: vec!["button[type='submit']".to_string()],
            consent_checkbox: vec!["input[type='checkbox'][name*='consent']".to_string()],
        }
    }

    pub fn generic() -> Self {
        Self {
            first_name: vec![
                "input[name*='first']".to_string(),
                "input[id*='first']".to_string(),
                "input[name='fname']".to_string(),
            ],
            last_name: vec![
                "input[name*='last']".to_string(),
                "input[id*='last']".to_string(),
                "input[name='lname']".to_string(),
            ],
            email: vec![
                "input[type='email']".to_string(),
                "input[name*='email']".to_string(),
                "input[id*='email']".to_string(),
            ],
            phone: vec![
                "input[type='tel']".to_string(),
                "input[name*='phone']".to_string(),
                "input[id*='phone']".to_string(),
            ],
            location: vec![
                "input[name*='location']".to_string(),
                "input[name*='city']".to_string(),
                "input[id*='location']".to_string(),
            ],
            linkedin: vec![
                "input[name*='linkedin']".to_string(),
                "input[id*='linkedin']".to_string(),
            ],
            github: vec![
                "input[name*='github']".to_string(),
                "input[id*='github']".to_string(),
            ],
            portfolio: vec![
                "input[name*='portfolio']".to_string(),
                "input[name*='website']".to_string(),
            ],
            resume_upload: vec!["input[type='file']".to_string()],
            cover_letter_upload: vec!["input[type='file'][name*='cover']".to_string()],
            cover_letter_text: vec![
                "textarea[name*='cover']".to_string(),
                "textarea[name*='message']".to_string(),
            ],
            submit_button: vec![
                "button[type='submit']".to_string(),
                "input[type='submit']".to_string(),
                "button:contains('Submit')".to_string(),
                "button:contains('Apply')".to_string(),
            ],
            consent_checkbox: vec!["input[type='checkbox']".to_string()],
        }
    }
}

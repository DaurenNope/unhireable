use crate::resume_analyzer::{ocr, EducationEntry, ExperienceEntry, PersonalInfo};
use anyhow::{bail, Context, Error, Result};
use log::{info, warn};
use lopdf::Document;
use regex::Regex;
use std::path::Path;

pub struct ResumeParser;

impl ResumeParser {
    /// Extract text from a PDF file
    pub fn extract_text_from_pdf<P: AsRef<Path>>(pdf_path: P) -> Result<String> {
        let path = pdf_path.as_ref();
        let mut lopdf_error: Option<Error> = None;
        let mut text_content = match Self::extract_text_with_lopdf(path) {
            Ok(text) => text,
            Err(err) => {
                lopdf_error = Some(err);
                warn!(
                    "Direct PDF text extraction via lopdf failed for {:?}; will try fallbacks next.",
                    path
                );
                String::new()
            }
        };

        if !Self::is_text_meaningful(&text_content) {
            info!(
                "Direct text extraction looked incomplete/garbled ({} chars) for {:?}. Trying `pdftotext` fallback...",
                text_content.len(),
                path
            );

            match ocr::extract_text_with_pdftotext(path) {
                Ok(pdftotext_text) => {
                    if Self::is_text_meaningful(&pdftotext_text) {
                        info!("`pdftotext` fallback succeeded for {:?}", path);
                        text_content = pdftotext_text;
                    } else {
                        warn!(
                            "`pdftotext` output still looked incomplete for {:?}. Will try OCR next.",
                            path
                        );
                    }
                }
                Err(err) => {
                    warn!("`pdftotext` fallback failed for {:?}: {}", path, err);
                }
            }
        }

        if !Self::is_text_meaningful(&text_content) {
            info!(
                "Attempting OCR fallback because text is still not meaningful ({} chars) for {:?}",
                text_content.len(),
                path
            );
            match ocr::extract_text_with_ocr(path) {
                Ok(ocr_text) => {
                    if Self::is_text_meaningful(&ocr_text) {
                        info!("OCR extraction succeeded for {:?}", path);
                        text_content = ocr_text;
                    } else {
                        warn!("OCR extraction produced unreadable text for {:?}", path);
                        bail!(
                            "Failed to extract readable text from {:?} even after OCR fallback{}",
                            path,
                            lopdf_error
                                .as_ref()
                                .map(|e| format!(" (initial lopdf error: {e})"))
                                .unwrap_or_default()
                        );
                    }
                }
                Err(err) => {
                    warn!("OCR extraction failed for {:?}: {}", path, err);
                    bail!(
                        "Failed to extract text from {:?}. OCR tooling may be unavailable. Details: {}{}",
                        path,
                        err,
                        lopdf_error
                            .as_ref()
                            .map(|e| format!(" (initial lopdf error: {e})"))
                            .unwrap_or_default()
                    );
                }
            }
        }

        Ok(text_content)
    }

    /// Parse resume text and extract structured information
    pub fn parse_resume_text(text: &str) -> Result<ParsedResume> {
        let personal_info = Self::extract_personal_info(text);
        let summary = Self::extract_summary(text);
        let skills = Self::extract_skills(text);
        let experience = Self::extract_experience(text);
        let education = Self::extract_education(text);
        let projects = Self::extract_projects(text);

        Ok(ParsedResume {
            personal_info,
            summary,
            skills,
            experience,
            education,
            projects,
            raw_text: text.to_string(),
        })
    }

    fn extract_personal_info(text: &str) -> PersonalInfo {
        let email_re = Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap();
        let phone_re =
            Regex::new(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}").unwrap();
        let linkedin_re =
            Regex::new(r"(?:linkedin\.com/in/|linkedin\.com/pub/)([a-zA-Z0-9-]+)").unwrap();
        let github_re = Regex::new(r"github\.com/([a-zA-Z0-9-]+)").unwrap();
        let url_re = Regex::new(r"https?://(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})").unwrap();

        let email = email_re.find(text).map(|m| m.as_str().to_string());
        let phone = phone_re.find(text).map(|m| m.as_str().to_string());

        let linkedin = linkedin_re
            .captures(text)
            .and_then(|c| c.get(1))
            .map(|m| format!("https://linkedin.com/in/{}", m.as_str()));

        let github = github_re
            .captures(text)
            .and_then(|c| c.get(1))
            .map(|m| format!("https://github.com/{}", m.as_str()));

        // Try to find portfolio URL (usually appears early in resume)
        let portfolio = url_re.captures_iter(text).find_map(|c| {
            let url = c.get(0)?.as_str();
            if !url.contains("linkedin") && !url.contains("github") {
                Some(url.to_string())
            } else {
                None
            }
        });

        // Extract name (usually first line or after "Name:" or similar)
        let name = Self::extract_name(text);

        // Extract location (look for common patterns)
        let location = Self::extract_location(text);

        PersonalInfo {
            name,
            email,
            phone,
            location,
            linkedin,
            github,
            portfolio,
        }
    }

    fn extract_name(text: &str) -> Option<String> {
        // Try to find name in first few lines
        let lines: Vec<&str> = text.lines().take(5).collect();

        for line in lines {
            let trimmed = line.trim();
            // Skip if it's an email, phone, or URL
            if trimmed.contains('@') || trimmed.contains("http") || trimmed.len() < 3 {
                continue;
            }
            // If it looks like a name (2-4 words, capitalized)
            let words: Vec<&str> = trimmed.split_whitespace().collect();
            if words.len() >= 2 && words.len() <= 4 {
                let all_capitalized = words
                    .iter()
                    .all(|w| w.chars().next().map(|c| c.is_uppercase()).unwrap_or(false));
                if all_capitalized {
                    return Some(trimmed.to_string());
                }
            }
        }
        None
    }

    fn extract_location(text: &str) -> Option<String> {
        // Look for common location patterns
        let location_patterns = [
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})", // City, State
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+)", // City, Country
            r"Remote",
            r"Remote\s*•",
        ];

        for pattern in &location_patterns {
            let re = Regex::new(pattern).ok()?;
            if let Some(cap) = re.find(text) {
                return Some(cap.as_str().to_string());
            }
        }
        None
    }

    fn extract_summary(text: &str) -> Option<String> {
        // Look for summary/objective sections
        let summary_keywords = ["summary", "objective", "about", "profile", "overview"];

        for keyword in &summary_keywords {
            let pattern = format!(r"(?i){}[:\s]*(.+?)(?:\n\n|\n[A-Z][a-z]+\s*:|$)", keyword);
            if let Ok(re) = Regex::new(&pattern) {
                if let Some(cap) = re.captures(text) {
                    if let Some(summary_match) = cap.get(1) {
                        let summary = summary_match.as_str().trim();
                        if summary.len() > 20 {
                            return Some(summary.to_string());
                        }
                    }
                }
            }
        }
        None
    }

    fn extract_skills(text: &str) -> Vec<String> {
        // Common technical skills to look for
        let common_skills = [
            "JavaScript",
            "TypeScript",
            "Python",
            "Java",
            "C++",
            "C#",
            "Go",
            "Rust",
            "React",
            "Vue",
            "Angular",
            "Node.js",
            "Express",
            "Django",
            "Flask",
            "AWS",
            "Azure",
            "GCP",
            "Docker",
            "Kubernetes",
            "Git",
            "CI/CD",
            "SQL",
            "PostgreSQL",
            "MySQL",
            "MongoDB",
            "Redis",
            "Machine Learning",
            "AI",
            "TensorFlow",
            "PyTorch",
            "HTML",
            "CSS",
            "SASS",
            "Tailwind",
            "Bootstrap",
        ];

        let mut found_skills = Vec::new();
        let text_lower = text.to_lowercase();

        for skill in &common_skills {
            let skill_lower = skill.to_lowercase();
            if text_lower.contains(&skill_lower) {
                found_skills.push(skill.to_string());
            }
        }

        // Also look for a "Skills" section
        if let Ok(re) = Regex::new(r"(?i)skills?[:\s]*(.+?)(?:\n\n|\n[A-Z][a-z]+\s*:|$)") {
            if let Some(cap) = re.captures(text) {
                if let Some(skills_match) = cap.get(1) {
                    let skills_text = skills_match.as_str();
                    // Extract skills from comma/pipe/line-separated list
                    for skill in skills_text.split(&[',', '|', '\n'][..]) {
                        let trimmed = skill.trim();
                        if trimmed.len() > 2 && !found_skills.contains(&trimmed.to_string()) {
                            found_skills.push(trimmed.to_string());
                        }
                    }
                }
            }
        }

        found_skills
    }

    fn extract_experience(text: &str) -> Vec<ExperienceEntry> {
        let mut experiences = Vec::new();

        // Look for experience section
        let exp_pattern = Regex::new(r"(?is)(?:experience|work\s+experience|professional\s+experience|employment)[:\s]*(.+?)(?:\n{2,}(?:education|skills|projects|certifications)|$)").ok();

        if let Some(re) = exp_pattern {
            if let Some(cap) = re.captures(text) {
                if let Some(exp_match) = cap.get(1) {
                    let exp_text = exp_match.as_str();

                    experiences.extend(Self::collect_experience_entries(exp_text));
                }
            }
        }

        experiences
    }

    fn parse_position_company(line: &str) -> (Option<String>, Option<String>) {
        // Common patterns: "Position at Company", "Position, Company", "Company - Position"
        let patterns = [
            Regex::new(r"(.+?)\s+at\s+(.+)").ok(),
            Regex::new(r"(.+?),\s*(.+)").ok(),
            Regex::new(r"(.+?)\s+-\s+(.+)").ok(),
        ];

        for pattern in patterns.iter().flatten() {
            if let Some(cap) = pattern.captures(line) {
                if let (Some(p1), Some(p2)) = (cap.get(1), cap.get(2)) {
                    let part1 = p1.as_str().trim().to_string();
                    let part2 = p2.as_str().trim().to_string();
                    // Usually position comes first, then company
                    return (Some(part1), Some(part2));
                }
            }
        }

        // If no pattern matches, assume the whole line is the position
        (Some(line.trim().to_string()), None)
    }

    fn extract_duration(text: &str) -> Option<String> {
        // Look for date patterns: "Jan 2020 - Present", "2020-2023", etc.
        let date_patterns = [
            Regex::new(r"(\w+\s+\d{4})\s*[-–—]\s*(\w+\s+\d{4}|Present|Current)").ok(),
            Regex::new(r"(\d{4})\s*[-–—]\s*(\d{4}|Present|Current)").ok(),
        ];

        for pattern in date_patterns.iter().flatten() {
            if let Some(cap) = pattern.find(text) {
                return Some(cap.as_str().to_string());
            }
        }
        None
    }

    fn extract_technologies(text: &str) -> Vec<String> {
        // Extract technologies mentioned in the text
        let tech_keywords = [
            "JavaScript",
            "TypeScript",
            "Python",
            "React",
            "Node.js",
            "AWS",
            "Docker",
            "Kubernetes",
            "PostgreSQL",
            "MongoDB",
            "Redis",
        ];

        let mut found = Vec::new();
        let text_lower = text.to_lowercase();

        for tech in &tech_keywords {
            if text_lower.contains(&tech.to_lowercase()) {
                found.push(tech.to_string());
            }
        }

        found
    }

    fn extract_education(text: &str) -> Vec<EducationEntry> {
        let mut education = Vec::new();

        // Look for education section
        let edu_pattern = Regex::new(r"(?is)(?:education|academic)[:\s]*(.+?)(?:\n{2,}(?:experience|skills|projects|certifications)|$)").ok();

        if let Some(re) = edu_pattern {
            if let Some(cap) = re.captures(text) {
                if let Some(edu_match) = cap.get(1) {
                    let edu_text = edu_match.as_str();

                    // Split by entries
                    let entries: Vec<&str> = edu_text.split("\n\n").collect();

                    for entry_text in entries {
                        if entry_text.trim().len() < 10 {
                            continue;
                        }

                        let lines: Vec<&str> = entry_text.lines().collect();
                        if lines.is_empty() {
                            continue;
                        }

                        // First line often contains degree and institution
                        let first_line = lines[0].trim();
                        let (degree, institution) = Self::parse_degree_institution(first_line);

                        // Look for year
                        let year = Self::extract_year(entry_text);

                        // Remaining lines are details
                        let details = if lines.len() > 1 {
                            Some(lines[1..].join("\n").trim().to_string())
                        } else {
                            None
                        };

                        education.push(EducationEntry {
                            institution,
                            degree,
                            year,
                            details,
                        });
                    }
                }
            }
        }

        education
    }

    fn parse_degree_institution(line: &str) -> (Option<String>, Option<String>) {
        // Common patterns: "Degree, Institution", "Institution - Degree"
        let patterns = [
            Regex::new(r"(.+?),\s*(.+)").ok(),
            Regex::new(r"(.+?)\s+-\s+(.+)").ok(),
        ];

        for pattern in patterns.iter().flatten() {
            if let Some(cap) = pattern.captures(line) {
                if let (Some(p1), Some(p2)) = (cap.get(1), cap.get(2)) {
                    let part1 = p1.as_str().trim().to_string();
                    let part2 = p2.as_str().trim().to_string();
                    // Usually degree comes first, then institution
                    return (Some(part1), Some(part2));
                }
            }
        }

        // If no pattern matches, assume the whole line is the degree
        (Some(line.trim().to_string()), None)
    }

    fn extract_year(text: &str) -> Option<String> {
        // Look for year patterns: "2020", "2020-2024", etc.
        let year_pattern = Regex::new(r"\b(19|20)\d{2}(?:\s*[-–—]\s*(?:19|20)\d{2})?\b").ok();
        year_pattern?.find(text).map(|m| m.as_str().to_string())
    }

    fn extract_projects(text: &str) -> Vec<String> {
        let mut projects = Vec::new();

        // Look for projects section
        let proj_pattern = Regex::new(
            r"(?i)(?:projects?|portfolio)[:\s]*(.+?)(?:\n\n(?:experience|education|skills)|$)",
        )
        .ok();

        if let Some(re) = proj_pattern {
            if let Some(cap) = re.captures(text) {
                if let Some(proj_match) = cap.get(1) {
                    let proj_text = proj_match.as_str();

                    // Split by entries
                    let entries: Vec<&str> = proj_text.split("\n\n").collect();

                    for entry in entries {
                        let trimmed = entry.trim();
                        if trimmed.len() > 10 {
                            projects.push(trimmed.to_string());
                        }
                    }
                }
            }
        }

        projects
    }

    fn collect_experience_entries(exp_text: &str) -> Vec<ExperienceEntry> {
        let lines: Vec<String> = exp_text
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty() && *l != "•")
            .map(|l| l.to_string())
            .collect();

        let mut entries = Vec::new();
        let mut idx = 0;

        while idx < lines.len() {
            let line = &lines[idx];

            if Self::is_header_line(line) {
                let header = line.clone();
                idx += 1;

                let mut duration_line = None;
                if idx < lines.len() && Self::line_looks_like_duration(&lines[idx]) {
                    duration_line = Some(lines[idx].clone());
                    idx += 1;
                }

                let mut body = Vec::new();
                while idx < lines.len() && !Self::is_header_line(&lines[idx]) {
                    body.push(lines[idx].clone());
                    idx += 1;
                }

                entries.push(Self::build_experience_entry(header, duration_line, body));
            } else {
                idx += 1;
            }
        }

        if entries.is_empty() {
            return Vec::new();
        }

        entries
    }

    fn build_experience_entry(
        header: String,
        duration_line: Option<String>,
        body_lines: Vec<String>,
    ) -> ExperienceEntry {
        let (header_clean, inline_duration) = Self::split_header_duration(&header);
        let (position, company) = Self::parse_position_company(&header_clean);
        let duration = duration_line
            .as_ref()
            .and_then(|line| Self::extract_duration(line))
            .or_else(|| inline_duration.clone())
            .or_else(|| Self::extract_duration(&body_lines.join(" ")));

        let description: Vec<String> = body_lines
            .into_iter()
            .map(|line| {
                line.trim_start_matches(['•', '-', '–', '—'])
                    .trim()
                    .to_string()
            })
            .filter(|line| !line.is_empty())
            .collect();

        let technologies = Self::extract_technologies(&description.join(" "));

        ExperienceEntry {
            company,
            position,
            duration,
            description,
            technologies,
        }
    }

    fn is_header_line(line: &str) -> bool {
        let (clean_line, _) = Self::split_header_duration(line);
        if clean_line.starts_with(['•', '-', '–', '—']) || clean_line.len() > 120 {
            return false;
        }

        let has_separator = clean_line.contains(',')
            || clean_line.contains(" at ")
            || clean_line.contains(" | ")
            || clean_line.contains(" - ")
            || clean_line.contains(" – ")
            || clean_line.contains(" — ");

        if !has_separator || clean_line.split_whitespace().count() > 8 {
            return false;
        }

        let title_keywords = [
            "Engineer",
            "Developer",
            "Manager",
            "Lead",
            "Architect",
            "Specialist",
            "Consultant",
            "Director",
            "Analyst",
            "Founder",
            "Intern",
            "Designer",
            "Scientist",
            "QA",
            "Devops",
            "Operations",
        ];

        title_keywords
            .iter()
            .any(|kw| clean_line.to_lowercase().contains(&kw.to_lowercase()))
    }

    fn line_looks_like_duration(line: &str) -> bool {
        regex::Regex::new(r"(?i)(\d{1,2}/\d{4}|\w{3,9}\s+\d{4})\s*[-–—]\s*(\d{1,2}/\d{4}|\w{3,9}\s+\d{4}|Present|Current)")
            .ok()
            .map(|re| re.is_match(line))
            .unwrap_or(false)
    }

    fn split_header_duration(line: &str) -> (String, Option<String>) {
        if let Ok(re) = Regex::new(
            r"(?is)^(.*?)(\b(?:\w{3,9}\s+\d{4}|\d{1,2}/\d{4})\s*[-–—]\s*(?:\w{3,9}\s+\d{4}|\d{1,2}/\d{4}|Present|Current))\s*$",
        ) {
            if let Some(caps) = re.captures(line) {
                let header_part = caps
                    .get(1)
                    .map(|m| m.as_str().trim().to_string())
                    .unwrap_or_default();
                let duration_part = caps.get(2).map(|m| m.as_str().trim().to_string());
                return (header_part, duration_part);
            }
        }
        (line.trim().to_string(), None)
    }

    fn extract_text_with_lopdf(path: &Path) -> Result<String> {
        let doc =
            Document::load(path).with_context(|| format!("Failed to load PDF: {:?}", path))?;

        let mut text_content = String::new();

        let pages = doc.get_pages();
        for (page_num, _) in pages.iter() {
            if let Ok(text) = doc.extract_text(&[*page_num]) {
                text_content.push_str(&text);
                text_content.push('\n');
            }
        }

        Ok(text_content.trim().to_string())
    }

    fn is_text_meaningful(text: &str) -> bool {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return false;
        }

        let meaningful_chars = trimmed.chars().filter(|c| !c.is_whitespace()).count();
        if meaningful_chars < 200 {
            return false;
        }

        let identity_hits = trimmed.matches("Identity-H").count()
            + trimmed.matches("Identity-V").count()
            + trimmed.matches("Unimplemented").count();
        if identity_hits >= 5 {
            return false;
        }

        true
    }
}

#[derive(Debug)]
pub struct ParsedResume {
    pub personal_info: PersonalInfo,
    pub summary: Option<String>,
    pub skills: Vec<String>,
    pub experience: Vec<ExperienceEntry>,
    pub education: Vec<EducationEntry>,
    pub projects: Vec<String>,
    pub raw_text: String,
}

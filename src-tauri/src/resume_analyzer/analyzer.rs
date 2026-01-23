use crate::resume_analyzer::parser::ParsedResume;
use crate::resume_analyzer::{
    AnalysisInsights, AtsBreakdown, ExperienceEntry, HrSignal, HrSignalStatus,
    JobAlignmentInsights, JobTargetInput, KeywordGap, ResumeAnalysis,
};
use chrono::Datelike;
use std::collections::HashMap;

pub struct ResumeAnalyzer;

impl ResumeAnalyzer {
    /// Analyze a parsed resume and generate insights
    pub fn analyze(parsed: ParsedResume, job_target: Option<JobTargetInput>) -> ResumeAnalysis {
        let insights = Self::generate_insights(&parsed, job_target.as_ref());

        ResumeAnalysis {
            personal_info: parsed.personal_info,
            summary: parsed.summary,
            skills: parsed.skills,
            experience: parsed.experience,
            education: parsed.education,
            projects: parsed.projects,
            raw_text: parsed.raw_text,
            insights,
        }
    }

    fn generate_insights(
        parsed: &ParsedResume,
        job_target: Option<&JobTargetInput>,
    ) -> AnalysisInsights {
        let total_years_experience = Self::calculate_experience_years(&parsed.experience);
        let resume_profile =
            Self::build_resume_profile(parsed, total_years_experience.unwrap_or(0.0));
        let primary_skills = Self::identify_primary_skills(&parsed.skills);
        let skill_categories = Self::categorize_skills(&parsed.skills);
        let strengths = Self::identify_strengths(parsed);
        let recommendations = Self::generate_recommendations(parsed);
        let ats_breakdown = Self::score_ats_profiles(&resume_profile.features);
        let ats_score = if ats_breakdown.is_empty() {
            None
        } else {
            Some(ats_breakdown.iter().map(|b| b.score).sum::<f64>() / ats_breakdown.len() as f64)
        };
        let hr_signals = Self::derive_hr_signals(parsed, &resume_profile);
        let keyword_gaps = Self::identify_keyword_gaps(parsed);
        let job_alignment = Self::infer_job_alignment(parsed, job_target);

        AnalysisInsights {
            total_years_experience,
            primary_skills,
            skill_categories,
            strengths,
            recommendations,
            ats_score,
            ats_breakdown,
            hr_signals,
            keyword_gaps,
            job_alignment,
        }
    }

    fn calculate_experience_years(experience: &[ExperienceEntry]) -> Option<f64> {
        if experience.is_empty() {
            return None;
        }

        let mut total_months = 0.0;

        for exp in experience {
            if let Some(duration) = &exp.duration {
                // Try to extract years from duration string
                if let Some(years) = Self::extract_years_from_duration(duration) {
                    total_months += years * 12.0;
                } else if duration.contains("year") {
                    // Rough estimate: assume 1-2 years per entry if not specified
                    total_months += 18.0;
                } else {
                    // Estimate based on number of entries
                    total_months += 12.0;
                }
            } else {
                // Estimate 1 year per entry if no duration specified
                total_months += 12.0;
            }
        }

        Some(total_months / 12.0)
    }

    fn extract_years_from_duration(duration: &str) -> Option<f64> {
        // Look for patterns like "2020-2024" or "3 years"
        let year_range = regex::Regex::new(r"(\d{4})\s*[-–—]\s*(\d{4}|Present|Current)").ok()?;
        if let Some(cap) = year_range.captures(duration) {
            let start: i32 = cap.get(1)?.as_str().parse().ok()?;
            let end_str = cap.get(2)?.as_str();
            let end = if end_str == "Present" || end_str == "Current" {
                chrono::Utc::now().year()
            } else {
                end_str.parse().ok()?
            };
            return Some((end - start) as f64);
        }

        // Look for "X years" pattern
        let years_pattern = regex::Regex::new(r"(\d+)\s*years?").ok()?;
        if let Some(cap) = years_pattern.captures(duration) {
            return cap.get(1)?.as_str().parse().ok();
        }

        None
    }

    fn identify_primary_skills(skills: &[String]) -> Vec<String> {
        // Return top 10 skills
        skills.iter().take(10).cloned().collect()
    }

    fn categorize_skills(skills: &[String]) -> Vec<String> {
        let mut categories = std::collections::HashSet::new();

        let skill_categories: Vec<(&str, &[&str])> = vec![
            (
                "Frontend",
                &[
                    "React",
                    "Vue",
                    "Angular",
                    "HTML",
                    "CSS",
                    "JavaScript",
                    "TypeScript",
                ],
            ),
            (
                "Backend",
                &[
                    "Node.js", "Python", "Java", "Go", "Rust", "Django", "Flask", "Express",
                ],
            ),
            (
                "Database",
                &["SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis"],
            ),
            (
                "Cloud/DevOps",
                &["AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD"],
            ),
            (
                "Mobile",
                &[
                    "React Native",
                    "Flutter",
                    "iOS",
                    "Android",
                    "Swift",
                    "Kotlin",
                ],
            ),
            (
                "AI/ML",
                &[
                    "Machine Learning",
                    "AI",
                    "TensorFlow",
                    "PyTorch",
                    "Data Science",
                ],
            ),
        ];

        for skill in skills {
            let skill_lower = skill.to_lowercase();
            for (category, keywords) in &skill_categories {
                if keywords
                    .iter()
                    .any(|kw| skill_lower.contains(&kw.to_lowercase()))
                {
                    categories.insert(category.to_string());
                    break;
                }
            }
        }

        categories.into_iter().collect()
    }

    fn identify_strengths(parsed: &ParsedResume) -> Vec<String> {
        let mut strengths = Vec::new();

        // Check for comprehensive experience
        if parsed.experience.len() >= 3 {
            strengths.push("Extensive work experience".to_string());
        }

        // Check for diverse skills
        if parsed.skills.len() >= 10 {
            strengths.push("Broad technical skill set".to_string());
        }

        // Check for education
        if !parsed.education.is_empty() {
            strengths.push("Strong educational background".to_string());
        }

        // Check for projects
        if !parsed.projects.is_empty() {
            strengths.push("Active project portfolio".to_string());
        }

        // Check for complete contact info
        if parsed.personal_info.email.is_some() && parsed.personal_info.phone.is_some() {
            strengths.push("Complete contact information".to_string());
        }

        // Check for online presence
        if parsed.personal_info.linkedin.is_some() || parsed.personal_info.github.is_some() {
            strengths.push("Professional online presence".to_string());
        }

        if strengths.is_empty() {
            strengths.push("Resume structure is present".to_string());
        }

        strengths
    }

    fn generate_recommendations(parsed: &ParsedResume) -> Vec<String> {
        let mut recommendations = Vec::new();

        // Check for missing elements
        if parsed.personal_info.name.is_none() {
            recommendations.push("Add your full name at the top of the resume".to_string());
        }

        if parsed.personal_info.email.is_none() {
            recommendations.push("Include your email address for contact".to_string());
        }

        if parsed.summary.is_none() {
            recommendations.push("Add a professional summary or objective statement".to_string());
        }

        if parsed.skills.len() < 5 {
            recommendations
                .push("Expand your skills section with more relevant technologies".to_string());
        }

        if parsed.experience.is_empty() {
            recommendations
                .push("Include your work experience with detailed descriptions".to_string());
        } else {
            // Check if experience entries have descriptions
            let has_descriptions = parsed
                .experience
                .iter()
                .any(|exp| !exp.description.is_empty());
            if !has_descriptions {
                recommendations.push(
                    "Add bullet points describing your achievements and responsibilities"
                        .to_string(),
                );
            }
        }

        if parsed.education.is_empty() {
            recommendations.push("Include your educational background".to_string());
        }

        if parsed.projects.is_empty() {
            recommendations
                .push("Consider adding a projects section to showcase your work".to_string());
        }

        if parsed.personal_info.linkedin.is_none() && parsed.personal_info.github.is_none() {
            recommendations.push("Add links to your LinkedIn and/or GitHub profiles".to_string());
        }

        if recommendations.is_empty() {
            recommendations.push("Your resume looks comprehensive! Consider tailoring it for specific job applications.".to_string());
        }

        recommendations
    }

    fn score_ats_profiles(features: &FeatureScores) -> Vec<AtsBreakdown> {
        ATS_PROFILES
            .iter()
            .map(|profile| {
                let weighted = profile.weights.contact * features.contact
                    + profile.weights.keywords * features.keywords
                    + profile.weights.experience * features.experience_depth
                    + profile.weights.metrics * features.metrics
                    + profile.weights.chronology * features.chronology
                    + profile.weights.layout * features.layout;

                let total_weights = profile.weights.total();
                let score = if total_weights > 0.0 {
                    (weighted / total_weights).clamp(0.0, 1.0) * 100.0
                } else {
                    0.0
                };

                let verdict = if score >= 85.0 {
                    "Submission-ready"
                } else if score >= 70.0 {
                    "Needs light tailoring"
                } else if score >= 55.0 {
                    "At risk of recruiter rejection"
                } else {
                    "Likely rejected by parser"
                }
                .to_string();

                let mut highlights = Vec::new();
                if features.contact >= 0.9 && profile.weights.contact > 0.0 {
                    highlights
                        .push("Contact information is complete and ATS-friendly.".to_string());
                }
                if features.keywords >= 0.75 && profile.weights.keywords > 0.0 {
                    highlights.push("High keyword density for relevant skills.".to_string());
                }
                if features.metrics >= 0.6 && profile.weights.metrics > 0.0 {
                    highlights.push("Impact statements include measurable outcomes.".to_string());
                }
                if features.chronology >= 0.7 && profile.weights.chronology > 0.0 {
                    highlights.push("Employment timeline is clearly documented.".to_string());
                }

                let mut risks = Vec::new();
                if features.metrics < 0.4 && profile.weights.metrics > 0.0 {
                    risks.push("Add more metrics (%, $, #) to bullet points.".to_string());
                }
                if features.chronology < 0.5 && profile.weights.chronology > 0.0 {
                    risks.push(
                        "Include months/years for each role to avoid parsing gaps.".to_string(),
                    );
                }
                if features.layout < 0.5 && profile.weights.layout > 0.0 {
                    risks.push(
                        "Simplify formatting to single-column bullets for ATS parsing.".to_string(),
                    );
                }
                if features.keywords < 0.5 && profile.weights.keywords > 0.0 {
                    risks.push(
                        "Increase role-specific keywords to pass automated screens.".to_string(),
                    );
                }

                AtsBreakdown {
                    system: profile.name.to_string(),
                    score,
                    verdict,
                    highlights,
                    risks,
                }
            })
            .collect()
    }

    fn build_resume_profile(parsed: &ParsedResume, total_years: f64) -> ResumeProfile {
        let number_re = regex::Regex::new(r"[\d%$]").ok();
        let duration_re = regex::Regex::new(
            r"(?i)(\w+\s+\d{4}|\d{1,2}/\d{4})\s*[-–—]\s*(\w+\s+\d{4}|\d{1,2}/\d{4}|Present|Current)",
        )
        .ok();

        let mut bullet_count = 0usize;
        let mut bullets_with_metrics = 0usize;
        let mut duration_entries = 0usize;
        let mut duration_with_dates = 0usize;

        for exp in &parsed.experience {
            bullet_count += exp.description.len();
            if let Some(re) = &number_re {
                bullets_with_metrics += exp
                    .description
                    .iter()
                    .filter(|line| re.is_match(line))
                    .count();
            }

            if let Some(duration) = &exp.duration {
                duration_entries += 1;
                if let Some(re) = &duration_re {
                    if re.is_match(duration) {
                        duration_with_dates += 1;
                    }
                }
            }
        }

        let metrics_ratio = if bullet_count > 0 {
            bullets_with_metrics as f64 / bullet_count as f64
        } else {
            0.0
        };

        let chronology_ratio = if duration_entries > 0 {
            duration_with_dates as f64 / duration_entries as f64
        } else {
            0.0
        };

        let mut missing_contact = Vec::new();
        if parsed.personal_info.email.is_none() {
            missing_contact.push("email".to_string());
        }
        if parsed.personal_info.phone.is_none() {
            missing_contact.push("phone".to_string());
        }
        if parsed.personal_info.location.is_none() {
            missing_contact.push("location".to_string());
        }
        if parsed.personal_info.linkedin.is_none() && parsed.personal_info.github.is_none() {
            missing_contact.push("online profile".to_string());
        }

        let mut contact_score: f64 = 0.0;
        if parsed.personal_info.name.is_some() {
            contact_score += 0.2;
        }
        if parsed.personal_info.email.is_some() {
            contact_score += 0.35;
        }
        if parsed.personal_info.phone.is_some() {
            contact_score += 0.25;
        }
        if parsed.personal_info.location.is_some() {
            contact_score += 0.1;
        }
        if parsed.personal_info.linkedin.is_some() || parsed.personal_info.github.is_some() {
            contact_score += 0.1;
        }
        let contact_score = contact_score.clamp(0.0, 1.0);

        let keywords_score = ((parsed.skills.len() as f64) / 18.0).clamp(0.0, 1.0);
        let experience_depth = (total_years / 10.0).clamp(0.0, 1.0);

        let bullet_density = if parsed.experience.is_empty() {
            0.0
        } else {
            (bullet_count as f64 / ((parsed.experience.len() as f64 * 4.0) + 1.0)).clamp(0.0, 1.0)
        };

        let total_lines = parsed.raw_text.lines().count().max(1);
        let long_line_ratio = parsed
            .raw_text
            .lines()
            .filter(|line| line.trim().len() > 110)
            .count() as f64
            / total_lines as f64;

        let layout_score = (bullet_density * 0.6) + ((1.0 - long_line_ratio).clamp(0.0, 1.0) * 0.4);

        ResumeProfile {
            features: FeatureScores {
                contact: contact_score,
                keywords: keywords_score,
                experience_depth,
                metrics: metrics_ratio,
                chronology: chronology_ratio,
                layout: layout_score.clamp(0.0, 1.0),
            },
            metrics_ratio,
            chronology_ratio,
            missing_contact,
            has_linkedin: parsed.personal_info.linkedin.is_some(),
        }
    }

    fn derive_hr_signals(_parsed: &ParsedResume, profile: &ResumeProfile) -> Vec<HrSignal> {
        let mut signals = Vec::new();

        let contact_status = if profile.features.contact >= 0.85 {
            HrSignalStatus::Positive
        } else if profile.features.contact >= 0.6 {
            HrSignalStatus::Warning
        } else {
            HrSignalStatus::Critical
        };
        let contact_detail = if profile.features.contact >= 0.85 {
            "Email, phone, and location are clearly listed in the header.".to_string()
        } else if profile.missing_contact.is_empty() {
            "Add full contact details near the header so ATS systems can auto-fill forms."
                .to_string()
        } else {
            format!(
                "Missing {} — add them near the header for recruiter visibility.",
                profile.missing_contact.join(", ")
            )
        };
        signals.push(HrSignal {
            status: contact_status,
            label: "Contact readiness".to_string(),
            detail: contact_detail,
        });

        let metrics_status = if profile.metrics_ratio >= 0.5 {
            HrSignalStatus::Positive
        } else if profile.metrics_ratio >= 0.3 {
            HrSignalStatus::Warning
        } else {
            HrSignalStatus::Critical
        };
        let metrics_detail = if profile.metrics_ratio >= 0.5 {
            "Most bullets include metrics (%/$/#), which recruiters trust.".to_string()
        } else {
            "Only a handful of bullets include metrics. Quantify results to stand out in ATS rank ordering."
                .to_string()
        };
        signals.push(HrSignal {
            status: metrics_status,
            label: "Impact & metrics".to_string(),
            detail: metrics_detail,
        });

        let chronology_status = if profile.chronology_ratio >= 0.7 {
            HrSignalStatus::Positive
        } else if profile.chronology_ratio >= 0.4 {
            HrSignalStatus::Warning
        } else {
            HrSignalStatus::Critical
        };
        let chronology_detail = if profile.chronology_ratio >= 0.7 {
            "Roles list month + year ranges, preventing ATS gap flags.".to_string()
        } else {
            "Some roles are missing month/year ranges. Add \"Jan 2023 – Present\" style dates so HRIS systems track tenure correctly."
                .to_string()
        };
        signals.push(HrSignal {
            status: chronology_status,
            label: "Timeline clarity".to_string(),
            detail: chronology_detail,
        });

        let structure_status = if profile.features.layout >= 0.75 {
            HrSignalStatus::Positive
        } else if profile.features.layout >= 0.45 {
            HrSignalStatus::Warning
        } else {
            HrSignalStatus::Critical
        };
        let structure_detail = if profile.features.layout >= 0.75 {
            "Single-column layout with concise bullets is ATS-safe.".to_string()
        } else {
            "Long paragraphs or multi-column layouts can confuse parsers. Stick to short bullets under each role."
                .to_string()
        };
        signals.push(HrSignal {
            status: structure_status,
            label: "Structure & readability".to_string(),
            detail: structure_detail,
        });

        let keyword_status = if profile.features.keywords >= 0.7 {
            HrSignalStatus::Positive
        } else if profile.features.keywords >= 0.45 {
            HrSignalStatus::Warning
        } else {
            HrSignalStatus::Critical
        };
        let keyword_detail = if profile.features.keywords >= 0.7 {
            "Skill density is high; recruiters can filter by the right tags.".to_string()
        } else {
            "Add a dedicated skills section and mirror phrasing from target job postings to boost ATS ranking."
                .to_string()
        };
        signals.push(HrSignal {
            status: keyword_status,
            label: "Keyword depth".to_string(),
            detail: keyword_detail,
        });

        if !profile.has_linkedin {
            signals.push(HrSignal {
                status: HrSignalStatus::Warning,
                label: "Online presence".to_string(),
                detail: "Link to LinkedIn/GitHub so recruiters can verify identity fast."
                    .to_string(),
            });
        }

        signals
    }

    fn identify_keyword_gaps(parsed: &ParsedResume) -> Vec<KeywordGap> {
        let text_lower = parsed.raw_text.to_lowercase();
        let mut gaps = Vec::new();

        for spec in ROLE_KEYWORDS {
            let trigger_hits = spec
                .triggers
                .iter()
                .filter(|kw| has_keyword(&parsed.skills, &text_lower, kw))
                .count();
            if trigger_hits == 0 {
                continue;
            }

            let missing: Vec<String> = spec
                .recommended
                .iter()
                .filter(|kw| !has_keyword(&parsed.skills, &text_lower, kw))
                .map(|kw| kw.to_string())
                .collect();

            if !missing.is_empty() {
                gaps.push(KeywordGap {
                    category: spec.role.to_string(),
                    missing: missing.into_iter().take(5).collect(),
                });
            }
        }

        gaps
    }

    fn infer_job_alignment(
        parsed: &ParsedResume,
        job_target: Option<&JobTargetInput>,
    ) -> Option<JobAlignmentInsights> {
        if let Some(target) = job_target {
            if let Some(desc) = target.description.as_deref() {
                if let Some(insight) = Self::align_with_job(desc, target.title.as_deref(), parsed) {
                    return Some(insight);
                }
            }
        }
        Self::infer_role_alignment(parsed)
    }

    fn align_with_job(
        job_description: &str,
        job_title: Option<&str>,
        parsed: &ParsedResume,
    ) -> Option<JobAlignmentInsights> {
        let cleaned = job_description.trim();
        if cleaned.is_empty() {
            return None;
        }
        let job_lower = cleaned.to_lowercase();
        let keywords = extract_job_keywords(&job_lower);
        if keywords.is_empty() {
            return None;
        }

        let resume_lower = parsed.raw_text.to_lowercase();
        let matched: Vec<String> = keywords
            .iter()
            .filter(|kw| has_keyword(&parsed.skills, &resume_lower, kw))
            .cloned()
            .collect();
        let missing: Vec<String> = keywords
            .iter()
            .filter(|kw| !matched.contains(kw))
            .cloned()
            .collect();

        let keyword_match = (matched.len() as f64 / keywords.len() as f64).clamp(0.0, 1.0);
        let (role_label, role_confidence) = determine_role_from_text(job_title, &job_lower);

        Some(JobAlignmentInsights {
            dominant_role: role_label.or_else(|| job_title.map(|t| t.to_string())),
            role_confidence,
            keyword_match,
            matched_keywords: matched.into_iter().take(12).collect(),
            missing_keywords: missing.into_iter().take(12).collect(),
        })
    }

    fn infer_role_alignment(parsed: &ParsedResume) -> Option<JobAlignmentInsights> {
        let text_lower = parsed.raw_text.to_lowercase();
        let mut best_match: Option<(f64, JobAlignmentInsights)> = None;

        for spec in ROLE_KEYWORDS {
            let trigger_hits = spec
                .triggers
                .iter()
                .filter(|kw| has_keyword(&parsed.skills, &text_lower, kw))
                .count();
            if trigger_hits == 0 {
                continue;
            }

            let matched: Vec<String> = spec
                .recommended
                .iter()
                .filter(|kw| has_keyword(&parsed.skills, &text_lower, kw))
                .map(|kw| kw.to_string())
                .collect();

            let missing: Vec<String> = spec
                .recommended
                .iter()
                .filter(|kw| !has_keyword(&parsed.skills, &text_lower, kw))
                .map(|kw| kw.to_string())
                .collect();

            let role_confidence =
                (trigger_hits as f64 / spec.triggers.len() as f64).clamp(0.0, 1.0);
            let keyword_match =
                (matched.len() as f64 / spec.recommended.len() as f64).clamp(0.0, 1.0);
            let composite = (role_confidence * 0.6) + (keyword_match * 0.4);

            if best_match
                .as_ref()
                .map(|(score, _)| composite > *score)
                .unwrap_or(true)
            {
                best_match = Some((
                    composite,
                    JobAlignmentInsights {
                        dominant_role: Some(spec.role.to_string()),
                        role_confidence,
                        keyword_match,
                        matched_keywords: matched.into_iter().take(10).collect(),
                        missing_keywords: missing.into_iter().take(10).collect(),
                    },
                ));
            }
        }

        best_match.map(|(_, insight)| insight)
    }
}

fn extract_job_keywords(text: &str) -> Vec<String> {
    const STOPWORDS: &[&str] = &[
        "with",
        "that",
        "will",
        "from",
        "have",
        "this",
        "team",
        "your",
        "you",
        "our",
        "for",
        "and",
        "the",
        "their",
        "work",
        "role",
        "able",
        "must",
        "will",
        "help",
        "make",
        "strong",
        "experience",
        "years",
        "plus",
        "join",
        "build",
        "software",
        "engineer",
        "engineering",
        "developer",
    ];

    let mut counts: HashMap<String, usize> = HashMap::new();
    for token in text.split(|c: char| !c.is_alphanumeric() && c != '+' && c != '#') {
        let trimmed = token.trim_matches(|c: char| !c.is_alphanumeric());
        if trimmed.len() < 4 {
            continue;
        }
        let lower = trimmed.to_lowercase();
        if STOPWORDS.contains(&lower.as_str()) {
            continue;
        }
        *counts.entry(lower).or_insert(0) += 1;
    }

    let mut entries: Vec<(String, usize)> = counts.into_iter().collect();
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    entries.into_iter().map(|(word, _)| word).take(25).collect()
}

fn determine_role_from_text(
    job_title: Option<&str>,
    job_text_lower: &str,
) -> (Option<String>, f64) {
    let job_title_lower = job_title.map(|t| t.to_lowercase());
    let mut best_role: Option<(String, f64)> = None;

    for spec in ROLE_KEYWORDS {
        let trigger_hits = spec
            .triggers
            .iter()
            .filter(|kw| {
                let kw_lower = kw.to_lowercase();
                job_text_lower.contains(&kw_lower)
                    || job_title_lower
                        .as_ref()
                        .map(|t| t.contains(&kw_lower))
                        .unwrap_or(false)
            })
            .count();

        if trigger_hits == 0 {
            continue;
        }

        let confidence = (trigger_hits as f64 / spec.triggers.len() as f64).clamp(0.0, 1.0);
        if best_role
            .as_ref()
            .map(|(_, best_conf)| confidence > *best_conf)
            .unwrap_or(true)
        {
            best_role = Some((spec.role.to_string(), confidence));
        }
    }

    if let Some((role, conf)) = best_role {
        (Some(role), conf)
    } else {
        (
            job_title.map(|t| t.to_string()),
            job_title.map(|_| 0.35).unwrap_or(0.0),
        )
    }
}

fn has_keyword(skills: &[String], text_lower: &str, keyword: &str) -> bool {
    let keyword_lower = keyword.to_lowercase();
    skills
        .iter()
        .any(|skill| skill.to_lowercase().contains(&keyword_lower))
        || text_lower.contains(&keyword_lower)
}

struct ResumeProfile {
    features: FeatureScores,
    metrics_ratio: f64,
    chronology_ratio: f64,
    missing_contact: Vec<String>,
    has_linkedin: bool,
}

#[derive(Clone)]
struct FeatureScores {
    contact: f64,
    keywords: f64,
    experience_depth: f64,
    metrics: f64,
    chronology: f64,
    layout: f64,
}

struct AtsProfileSpec {
    name: &'static str,
    weights: AtsWeights,
}

struct AtsWeights {
    contact: f64,
    keywords: f64,
    experience: f64,
    metrics: f64,
    chronology: f64,
    layout: f64,
}

impl AtsWeights {
    fn total(&self) -> f64 {
        self.contact
            + self.keywords
            + self.experience
            + self.metrics
            + self.chronology
            + self.layout
    }
}

const ATS_PROFILES: &[AtsProfileSpec] = &[
    AtsProfileSpec {
        name: "Lever",
        weights: AtsWeights {
            contact: 0.2,
            keywords: 0.25,
            experience: 0.2,
            metrics: 0.2,
            chronology: 0.1,
            layout: 0.05,
        },
    },
    AtsProfileSpec {
        name: "Greenhouse",
        weights: AtsWeights {
            contact: 0.15,
            keywords: 0.3,
            experience: 0.2,
            metrics: 0.2,
            chronology: 0.1,
            layout: 0.05,
        },
    },
    AtsProfileSpec {
        name: "Workday",
        weights: AtsWeights {
            contact: 0.25,
            keywords: 0.2,
            experience: 0.15,
            metrics: 0.1,
            chronology: 0.2,
            layout: 0.1,
        },
    },
    AtsProfileSpec {
        name: "Taleo",
        weights: AtsWeights {
            contact: 0.25,
            keywords: 0.3,
            experience: 0.15,
            metrics: 0.1,
            chronology: 0.1,
            layout: 0.1,
        },
    },
    AtsProfileSpec {
        name: "iCIMS",
        weights: AtsWeights {
            contact: 0.2,
            keywords: 0.2,
            experience: 0.25,
            metrics: 0.15,
            chronology: 0.1,
            layout: 0.1,
        },
    },
];

struct RoleKeywordSpec {
    role: &'static str,
    triggers: &'static [&'static str],
    recommended: &'static [&'static str],
}

const ROLE_KEYWORDS: &[RoleKeywordSpec] = &[
    RoleKeywordSpec {
        role: "Backend / Platform Engineer",
        triggers: &[
            "backend",
            "api",
            "microservice",
            "distributed",
            "rust",
            "go",
            "node",
        ],
        recommended: &[
            "distributed systems",
            "scalability",
            "kubernetes",
            "observability",
            "microservices",
            "ci/cd",
            "performance tuning",
            "postgresql",
        ],
    },
    RoleKeywordSpec {
        role: "Frontend / Product Engineer",
        triggers: &[
            "frontend",
            "react",
            "typescript",
            "ui",
            "ux",
            "next.js",
            "tailwind",
        ],
        recommended: &[
            "design systems",
            "accessibility",
            "a/b testing",
            "component library",
            "performance budgets",
            "analytics instrumentation",
        ],
    },
    RoleKeywordSpec {
        role: "AI / Machine Learning Engineer",
        triggers: &[
            "ml",
            "machine learning",
            "ai",
            "pytorch",
            "tensorflow",
            "llm",
        ],
        recommended: &[
            "model deployment",
            "prompt engineering",
            "vector database",
            "evaluation harness",
            "data pipelines",
            "feature store",
        ],
    },
    RoleKeywordSpec {
        role: "DevOps / SRE",
        triggers: &[
            "devops",
            "sre",
            "infrastructure",
            "terraform",
            "kubernetes",
            "aws",
        ],
        recommended: &[
            "observability",
            "incident response",
            "cost optimization",
            "autoscaling",
            "infrastructure as code",
            "disaster recovery",
        ],
    },
];

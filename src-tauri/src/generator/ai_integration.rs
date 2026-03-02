use crate::db::models::Job;
use crate::generator::{JobAnalysis, UserProfile};
use anyhow::Result;
use serde_json::{json, Value};
use std::env;

pub struct AIIntegration {
    api_key: Option<String>,
    base_url: String,
    model: String,
}

impl AIIntegration {
    pub fn new() -> Self {
        Self {
            api_key: env::var("OPENAI_API_KEY")
                .ok()
                .or_else(|| env::var("AI_API_KEY").ok()),
            base_url: env::var("OPENAI_BASE_URL")
                .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
            model: env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-3.5-turbo".to_string()),
        }
    }

    pub fn with_api_key(mut self, api_key: String) -> Self {
        self.api_key = Some(api_key);
        self
    }

    pub fn with_model(mut self, model: String) -> Self {
        self.model = model;
        self
    }

    pub fn has_api_key(&self) -> bool {
        self.api_key.is_some()
    }

    pub async fn analyze_job(&self, job: &Job) -> Result<JobAnalysis> {
        if self.api_key.is_none() {
            // Fallback to basic analysis without AI
            return Ok(self.basic_job_analysis(job));
        }

        let prompt = format!(
            r#"
Analyze this job posting and extract key information:

Job Title: {}
Company: {}
Description: {}
Requirements: {}

Please provide a JSON response with:
1. extracted_keywords: Array of key skills and technologies mentioned
2. required_skills: Array of must-have skills
3. preferred_skills: Array of nice-to-have skills  
4. experience_level: One of "entry", "mid", "senior", "executive"
5. company_tone: Brief description of company culture/vibes
6. key_responsibilities: Array of main responsibilities
7. match_score: Score 0-100 for how well this aligns with typical tech roles

Focus on technical skills, tools, and technologies mentioned in the job description.
"#,
            job.title,
            job.company,
            job.description.as_deref().unwrap_or(""),
            job.requirements.as_deref().unwrap_or("")
        );

        match self.call_ai(&prompt).await {
            Ok(response) => match serde_json::from_str::<Value>(&response) {
                Ok(analysis) => {
                    let extracted_keywords = analysis["extracted_keywords"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    let required_skills = analysis["required_skills"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    let preferred_skills = analysis["preferred_skills"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    let experience_level = analysis["experience_level"]
                        .as_str()
                        .unwrap_or("mid")
                        .to_string();

                    let company_tone = analysis["company_tone"]
                        .as_str()
                        .unwrap_or("professional")
                        .to_string();

                    let key_responsibilities = analysis["key_responsibilities"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    let match_score = analysis["match_score"].as_f64().unwrap_or(75.0);

                    Ok(JobAnalysis {
                        extracted_keywords,
                        required_skills,
                        preferred_skills,
                        experience_level,
                        company_tone,
                        key_responsibilities,
                        match_score,
                        job_title: job.title.clone(),
                        company: job.company.clone(),
                    })
                }
                Err(e) => {
                    eprintln!("Failed to parse AI response: {}", e);
                    Ok(self.basic_job_analysis(job))
                }
            },
            Err(e) => {
                eprintln!("AI call failed: {}", e);
                Ok(self.basic_job_analysis(job))
            }
        }
    }

    pub async fn improve_profile(
        &self,
        profile: &UserProfile,
        job_analysis: &JobAnalysis,
    ) -> Result<UserProfile> {
        if self.api_key.is_none() {
            return Ok(profile.clone());
        }

        let prompt = format!(
            r#"
Improve this user profile to better match the target job:

Current Profile:
- Summary: {}
- Skills: {}
- Experience: {}

Target Job Analysis:
- Required Skills: {}
- Company Tone: {}
- Experience Level: {}

Please suggest improvements to:
1. Make the summary more compelling for this specific role
2. Highlight the most relevant skills and experiences
3. Suggest rephrasing to better match the job requirements

Return a JSON response with:
- improved_summary: Enhanced professional summary
- skill_priorities: Array of skills to emphasize
- experience_highlights: Array of experiences to highlight

Keep it professional and authentic - don't invent new experiences, just improve the presentation.
"#,
            profile.summary,
            profile.skills.technical_skills.join(", "),
            profile
                .experience
                .iter()
                .take(3)
                .map(|e| format!("{} at {}", e.position, e.company))
                .collect::<Vec<_>>()
                .join(", "),
            job_analysis.required_skills.join(", "),
            job_analysis.company_tone,
            job_analysis.experience_level
        );

        match self.call_ai(&prompt).await {
            Ok(response) => {
                match serde_json::from_str::<Value>(&response) {
                    Ok(improvements) => {
                        let mut improved_profile = profile.clone();

                        if let Some(summary) = improvements["improved_summary"].as_str() {
                            improved_profile.summary = summary.to_string();
                        }

                        // Reorder skills based on priorities
                        if let Some(priorities) = improvements["skill_priorities"].as_array() {
                            let priority_skills: Vec<String> = priorities
                                .iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect();

                            improved_profile.skills.technical_skills = self
                                .reorder_skills_by_priority(
                                    &improved_profile.skills.technical_skills,
                                    &priority_skills,
                                );
                        }

                        Ok(improved_profile)
                    }
                    Err(e) => {
                        eprintln!("Failed to parse profile improvements: {}", e);
                        Ok(profile.clone())
                    }
                }
            }
            Err(e) => {
                eprintln!("Profile improvement AI call failed: {}", e);
                Ok(profile.clone())
            }
        }
    }

    async fn call_ai(&self, prompt: &str) -> Result<String> {
        // Record metrics: start timing
        let start_time = std::time::Instant::now();

        let client = reqwest::Client::new();
        let url = format!("{}/chat/completions", self.base_url);

        let request_body = json!({
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful career counselor and job application expert. Provide clear, structured, and actionable advice."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        });

        let response = client
            .post(&url)
            .header(
                "Authorization",
                format!("Bearer {}", self.api_key.as_ref().unwrap()),
            )
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let response_text = response.text().await?;

        // Record success metrics
        let _duration = start_time.elapsed().as_secs_f64();

        // Parse the response to extract the content
        let response_json: Value = serde_json::from_str(&response_text)?;

        if let Some(content) = response_json["choices"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|choice| choice["message"]["content"].as_str())
        {
            Ok(content.to_string())
        } else {
            Err(anyhow::anyhow!("Invalid AI response format"))
        }
    }

    pub fn basic_job_analysis(&self, job: &Job) -> JobAnalysis {
        let description = job.description.as_deref().unwrap_or("");
        let requirements = job.requirements.as_deref().unwrap_or("");
        let combined_text = format!("{} {}", description, requirements);

        // Basic keyword extraction
        let keywords = self.extract_basic_keywords(&combined_text);

        // Basic skill categorization
        let (required, preferred) = self.categorize_skills(&keywords);

        JobAnalysis {
            extracted_keywords: keywords,
            required_skills: required,
            preferred_skills: preferred,
            experience_level: self.estimate_experience_level(description),
            company_tone: self.estimate_company_tone(description),
            key_responsibilities: self.extract_responsibilities(description),
            match_score: 75.0, // Default score for basic analysis
            job_title: job.title.clone(),
            company: job.company.clone(),
        }
    }

    fn extract_basic_keywords(&self, text: &str) -> Vec<String> {
        let common_tech_skills = vec![
            "react",
            "vue",
            "angular",
            "javascript",
            "typescript",
            "nodejs",
            "python",
            "java",
            "rust",
            "go",
            "sql",
            "mongodb",
            "postgresql",
            "docker",
            "kubernetes",
            "aws",
            "azure",
            "gcp",
            "git",
            "ci/cd",
            "agile",
            "scrum",
            "rest",
            "graphql",
            "html",
            "css",
            "sass",
            "webpack",
            "vite",
            "testing",
            "unit testing",
        ];

        let text_lower = text.to_lowercase();
        common_tech_skills
            .into_iter()
            .filter(|skill| text_lower.contains(skill))
            .map(String::from)
            .collect()
    }

    fn categorize_skills(&self, keywords: &[String]) -> (Vec<String>, Vec<String>) {
        let senior_skills = vec![
            "architecture",
            "leadership",
            "mentoring",
            "strategy",
            "aws",
            "kubernetes",
        ];

        let (required, preferred): (Vec<_>, Vec<_>) = keywords
            .iter()
            .partition(|skill| senior_skills.contains(&skill.as_str()));

        (
            required.into_iter().cloned().collect(),
            preferred.into_iter().cloned().collect(),
        )
    }

    fn estimate_experience_level(&self, description: &str) -> String {
        let desc_lower = description.to_lowercase();

        if desc_lower.contains("senior")
            || desc_lower.contains("lead")
            || desc_lower.contains("principal")
        {
            "senior".to_string()
        } else if desc_lower.contains("junior")
            || desc_lower.contains("entry")
            || desc_lower.contains("intern")
        {
            "entry".to_string()
        } else {
            "mid".to_string()
        }
    }

    fn estimate_company_tone(&self, description: &str) -> String {
        let desc_lower = description.to_lowercase();

        if desc_lower.contains("fast-paced")
            || desc_lower.contains("startup")
            || desc_lower.contains("agile")
        {
            "innovative and fast-paced".to_string()
        } else if desc_lower.contains("enterprise") || desc_lower.contains("established") {
            "stable and professional".to_string()
        } else {
            "professional and collaborative".to_string()
        }
    }

    fn extract_responsibilities(&self, description: &str) -> Vec<String> {
        // Simple responsibility extraction - in real implementation, this would be more sophisticated
        let sentences: Vec<&str> = description
            .split('.')
            .filter(|s| !s.trim().is_empty())
            .take(5) // Take first 5 sentences
            .collect();

        sentences.iter().map(|s| s.trim().to_string()).collect()
    }

    fn reorder_skills_by_priority(
        &self,
        current_skills: &[String],
        priorities: &[String],
    ) -> Vec<String> {
        let mut prioritized = Vec::new();
        let mut remaining = current_skills.to_vec();

        // Add prioritized skills first
        for priority in priorities {
            if let Some(pos) = remaining
                .iter()
                .position(|s| s.to_lowercase().contains(&priority.to_lowercase()))
            {
                prioritized.push(remaining.remove(pos));
            }
        }

        // Add remaining skills
        prioritized.extend(remaining);
        prioritized
    }
}

impl Default for AIIntegration {
    fn default() -> Self {
        Self::new()
    }
}

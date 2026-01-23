use crate::db::models::Job;
use crate::generator::JobAnalysis;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AIProvider {
    OpenAI,
    Anthropic,
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIProviderConfig {
    pub provider: AIProvider,
    pub api_key: Option<String>,
    pub base_url: String,
    pub model: String,
    pub enabled: bool,
}

impl Default for AIProviderConfig {
    fn default() -> Self {
        Self {
            provider: AIProvider::OpenAI,
            api_key: None,
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-3.5-turbo".to_string(),
            enabled: true,
        }
    }
}

pub struct MultiProviderAI {
    providers: HashMap<AIProvider, AIProviderConfig>,
    default_provider: AIProvider,
    cache: HashMap<String, String>, // Simple in-memory cache
}

impl MultiProviderAI {
    pub fn new() -> Self {
        let mut providers = HashMap::new();
        
        // Default OpenAI config
        providers.insert(
            AIProvider::OpenAI,
            AIProviderConfig {
                provider: AIProvider::OpenAI,
                api_key: std::env::var("OPENAI_API_KEY").ok(),
                base_url: std::env::var("OPENAI_BASE_URL")
                    .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
                model: std::env::var("OPENAI_MODEL")
                    .unwrap_or_else(|_| "gpt-3.5-turbo".to_string()),
                enabled: true,
            },
        );

        // Anthropic Claude config
        providers.insert(
            AIProvider::Anthropic,
            AIProviderConfig {
                provider: AIProvider::Anthropic,
                api_key: std::env::var("ANTHROPIC_API_KEY").ok(),
                base_url: "https://api.anthropic.com/v1".to_string(),
                model: std::env::var("ANTHROPIC_MODEL")
                    .unwrap_or_else(|_| "claude-3-sonnet-20240229".to_string()),
                enabled: true,
            },
        );

        // Ollama config (local LLM)
        providers.insert(
            AIProvider::Ollama,
            AIProviderConfig {
                provider: AIProvider::Ollama,
                api_key: None, // Ollama doesn't require API key
                base_url: std::env::var("OLLAMA_BASE_URL")
                    .unwrap_or_else(|_| "http://localhost:11434".to_string()),
                model: std::env::var("OLLAMA_MODEL")
                    .unwrap_or_else(|_| "llama2".to_string()),
                enabled: true,
            },
        );

        Self {
            providers,
            default_provider: AIProvider::OpenAI,
            cache: HashMap::new(),
        }
    }

    pub fn with_provider_config(mut self, provider: AIProvider, config: AIProviderConfig) -> Self {
        self.providers.insert(provider, config);
        self
    }

    pub fn set_default_provider(mut self, provider: AIProvider) -> Self {
        self.default_provider = provider;
        self
    }

    pub fn get_provider_config(&self, provider: &AIProvider) -> Option<&AIProviderConfig> {
        self.providers.get(provider)
    }

    pub fn list_available_providers(&self) -> Vec<AIProvider> {
        self.providers
            .iter()
            .filter(|(_, config)| config.enabled && (config.api_key.is_some() || config.provider == AIProvider::Ollama))
            .map(|(provider, _)| provider.clone())
            .collect()
    }

    pub async fn call_ai(
        &mut self,
        prompt: &str,
        provider: Option<AIProvider>,
    ) -> Result<String> {
        use crate::metrics::{AI_API_CALLS_TOTAL, AI_API_CALL_DURATION};
        
        // Check cache first
        let cache_key = format!("{:?}:{}", provider.as_ref().unwrap_or(&self.default_provider), prompt);
        if let Some(cached) = self.cache.get(&cache_key) {
            crate::metrics::DOCUMENT_CACHE_HITS.inc();
            return Ok(cached.clone());
        }
        
        crate::metrics::DOCUMENT_CACHE_MISSES.inc();
        AI_API_CALLS_TOTAL.inc();
        let start = std::time::Instant::now();

        let provider = provider.unwrap_or_else(|| self.default_provider.clone());
        let config = self
            .providers
            .get(&provider)
            .ok_or_else(|| anyhow::anyhow!("Provider not configured"))?;

        if !config.enabled {
            return Err(anyhow::anyhow!("Provider is disabled"));
        }

        let result = match provider {
            AIProvider::OpenAI => self.call_openai(config, prompt).await,
            AIProvider::Anthropic => self.call_anthropic(config, prompt).await,
            AIProvider::Ollama => self.call_ollama(config, prompt).await,
        };

        // Record duration
        let duration = start.elapsed().as_secs_f64();
        AI_API_CALL_DURATION.observe(duration);

        // Cache successful results
        if let Ok(ref response) = result {
            self.cache.insert(cache_key, response.clone());
        }

        result
    }

    async fn call_openai(&self, config: &AIProviderConfig, prompt: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let url = format!("{}/chat/completions", config.base_url);

        let request_body = json!({
            "model": config.model,
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
            "max_tokens": 2000
        });

        let response = client
            .post(&url)
            .header(
                "Authorization",
                format!("Bearer {}", config.api_key.as_ref().ok_or_else(|| anyhow::anyhow!("OpenAI API key not set"))?),
            )
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let response_text = response.text().await?;
        let response_json: Value = serde_json::from_str(&response_text)?;

        if let Some(content) = response_json["choices"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|choice| choice["message"]["content"].as_str())
        {
            Ok(content.to_string())
        } else {
            Err(anyhow::anyhow!("Invalid OpenAI response format"))
        }
    }

    async fn call_anthropic(&self, config: &AIProviderConfig, prompt: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let url = format!("{}/messages", config.base_url);

        let request_body = json!({
            "model": config.model,
            "max_tokens": 2000,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });

        let response = client
            .post(&url)
            .header(
                "x-api-key",
                config.api_key.as_ref().ok_or_else(|| anyhow::anyhow!("Anthropic API key not set"))?,
            )
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let response_text = response.text().await?;
        let response_json: Value = serde_json::from_str(&response_text)?;

        if let Some(content) = response_json["content"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|msg| msg["text"].as_str())
        {
            Ok(content.to_string())
        } else {
            Err(anyhow::anyhow!("Invalid Anthropic response format"))
        }
    }

    async fn call_ollama(&self, config: &AIProviderConfig, prompt: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let url = format!("{}/api/generate", config.base_url);

        let request_body = json!({
            "model": config.model,
            "prompt": prompt,
            "stream": false
        });

        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let response_text = response.text().await?;
        let response_json: Value = serde_json::from_str(&response_text)?;

        if let Some(content) = response_json["response"].as_str() {
            Ok(content.to_string())
        } else {
            Err(anyhow::anyhow!("Invalid Ollama response format"))
        }
    }

    pub async fn analyze_job(&mut self, job: &Job, provider: Option<AIProvider>) -> Result<JobAnalysis> {
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
Return only valid JSON, no markdown formatting.
"#,
            job.title,
            job.company,
            job.description.as_deref().unwrap_or(""),
            job.requirements.as_deref().unwrap_or("")
        );

        match self.call_ai(&prompt, provider).await {
            Ok(response) => {
                // Try to extract JSON from markdown code blocks if present
                let json_str = if response.trim().starts_with("```") {
                    response
                        .lines()
                        .skip(1)
                        .take_while(|line| !line.trim().starts_with("```"))
                        .collect::<Vec<_>>()
                        .join("\n")
                } else {
                    response
                };

                match serde_json::from_str::<Value>(&json_str) {
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
                        eprintln!("Response was: {}", json_str);
                        Err(anyhow::anyhow!("Failed to parse AI response: {}", e))
                    }
                }
            }
            Err(e) => {
                eprintln!("AI call failed: {}", e);
                Err(e)
            }
        }
    }

    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }

    pub fn get_cache_size(&self) -> usize {
        self.cache.len()
    }
}

impl Default for MultiProviderAI {
    fn default() -> Self {
        Self::new()
    }
}







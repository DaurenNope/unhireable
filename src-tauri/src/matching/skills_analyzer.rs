use crate::db::models::Job;
use crate::generator::UserProfile;
use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};

const STOP_WORDS: &[&str] = &[
    "api",
    "apis",
    "restful",
    "system",
    "systems",
    "team",
    "teams",
    "communication",
    "communications",
    "agile",
    "scrum",
    "kanban",
    "product",
    "deliverables",
    "collaboration",
    "problem solving",
    "problem-solving",
    "detail oriented",
    "detail-oriented",
    "jira",
    "confluence",
    "microsoft office",
    "office",
];

const CANONICAL_SKILLS: &[&str] = &[
    // Programming Languages
    "python",
    "javascript",
    "typescript",
    "java",
    "c",
    "c++",
    "c#",
    "go",
    "golang",
    "rust",
    "ruby",
    "php",
    "swift",
    "kotlin",
    "dart",
    "scala",
    "clojure",
    "elixir",
    "erlang",
    "haskell",
    "ocaml",
    "f#",
    "r",
    "matlab",
    "perl",
    "lua",
    // Frontend Frameworks & Libraries
    "react",
    "react native",
    "vue",
    "vue.js",
    "svelte",
    "angular",
    "ember",
    "backbone",
    "jquery",
    "next.js",
    "nuxt",
    "gatsby",
    "remix",
    "astro",
    "solid",
    "preact",
    // Backend Frameworks
    "node.js",
    "express",
    "fastify",
    "nest.js",
    "koa",
    "hapi",
    "django",
    "flask",
    "fastapi",
    "tornado",
    "spring",
    "spring boot",
    "quarkus",
    "micronaut",
    "play framework",
    "laravel",
    "symfony",
    "codeigniter",
    "rails",
    "sinatra",
    "phoenix",
    "gin",
    "echo",
    "fiber",
    // Databases
    "postgresql",
    "mysql",
    "mariadb",
    "sqlite",
    "mongodb",
    "redis",
    "dynamodb",
    "cassandra",
    "couchdb",
    "neo4j",
    "influxdb",
    "timescaledb",
    "elasticsearch",
    "opensearch",
    "snowflake",
    "bigquery",
    "redshift",
    "databricks",
    "clickhouse",
    // Message Queues & Streaming
    "kafka",
    "rabbitmq",
    "activemq",
    "nats",
    "pulsar",
    "zeromq",
    // DevOps & Infrastructure
    "docker",
    "kubernetes",
    "k8s",
    "terraform",
    "ansible",
    "puppet",
    "chef",
    "vagrant",
    "packer",
    "jenkins",
    "github actions",
    "gitlab ci",
    "circleci",
    "travis ci",
    "argo",
    "helm",
    "istio",
    "linkerd",
    "prometheus",
    "grafana",
    "datadog",
    "new relic",
    "splunk",
    // Cloud Platforms
    "aws",
    "aws lambda",
    "aws ec2",
    "aws s3",
    "aws rds",
    "aws ecs",
    "aws eks",
    "azure",
    "azure functions",
    "azure devops",
    "gcp",
    "google cloud",
    "firebase",
    "vercel",
    "netlify",
    "cloudflare",
    "heroku",
    "digitalocean",
    // Version Control
    "git",
    "github",
    "gitlab",
    "bitbucket",
    "svn",
    "mercurial",
    // Operating Systems
    "linux",
    "ubuntu",
    "debian",
    "centos",
    "red hat",
    "fedora",
    "arch linux",
    "windows",
    "macos",
    "unix",
    // Scripting & Shell
    "bash",
    "shell scripting",
    "powershell",
    "zsh",
    // Web Technologies
    "html",
    "html5",
    "css",
    "css3",
    "sass",
    "scss",
    "less",
    "stylus",
    "tailwind",
    "tailwindcss",
    "bootstrap",
    "material ui",
    "mui",
    "chakra ui",
    "ant design",
    // Build Tools & Bundlers
    "webpack",
    "vite",
    "rollup",
    "parcel",
    "esbuild",
    "swc",
    "turbo",
    "nx",
    // Testing
    "jest",
    "vitest",
    "mocha",
    "chai",
    "cypress",
    "playwright",
    "selenium",
    "puppeteer",
    "jasmine",
    "karma",
    "testing library",
    "enzyme",
    // API & Protocols
    "graphql",
    "rest",
    "grpc",
    "websocket",
    "graphql apollo",
    "relay",
    "tRPC",
    // Architecture Patterns
    "microservices",
    "event driven architecture",
    "serverless",
    "soa",
    "monolith",
    "domain driven design",
    "ddd",
    "clean architecture",
    "hexagonal architecture",
    // AI & ML
    "machine learning",
    "ml",
    "data science",
    "artificial intelligence",
    "ai",
    "deep learning",
    "neural networks",
    "nlp",
    "natural language processing",
    "computer vision",
    "tensorflow",
    "pytorch",
    "keras",
    "scikit-learn",
    "pandas",
    "numpy",
    "jupyter",
    "hugging face",
    "transformers",
    // Big Data
    "hadoop",
    "spark",
    "flink",
    "storm",
    "airflow",
    "prefect",
    "dbt",
    // Analytics & BI
    "tableau",
    "power bi",
    "looker",
    "lookml",
    "metabase",
    "superset",
    "qlik",
    // Design Tools
    "figma",
    "sketch",
    "adobe xd",
    "invision",
    "framer",
    "principle",
    // Mobile Development
    "ios",
    "android",
    "flutter",
    "xamarin",
    "ionic",
    "cordova",
    "react native",
    "swiftui",
    "jetpack compose",
    // Blockchain
    "blockchain",
    "ethereum",
    "solidity",
    "web3",
    "smart contracts",
    "defi",
];

static SYNONYM_MAP: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    HashMap::from([
        // REST & APIs
        ("rest api", "rest"),
        ("rest apis", "rest"),
        ("restful api", "rest"),
        ("restful apis", "rest"),
        ("restful services", "rest"),
        ("swagger", "rest"),
        ("openapi", "rest"),
        ("open api", "rest"),
        // GraphQL
        ("graphql api", "graphql"),
        ("graphql apis", "graphql"),
        ("apollo graphql", "graphql apollo"),
        // Cloud Platforms
        ("aws cloud", "aws"),
        ("amazon web services", "aws"),
        ("amazon aws", "aws"),
        ("google cloud", "gcp"),
        ("google cloud platform", "gcp"),
        ("gcp cloud", "gcp"),
        ("ms azure", "azure"),
        ("microsoft azure", "azure"),
        ("azure cloud", "azure"),
        // Frontend Frameworks
        ("reactjs", "react"),
        ("react.js", "react"),
        ("reactjs", "react"),
        ("vue.js", "vue"),
        ("vuejs", "vue"),
        ("angular.js", "angular"),
        ("angularjs", "angular"),
        ("nextjs", "next.js"),
        ("nuxtjs", "nuxt"),
        // Backend & Runtime
        ("nodejs", "node.js"),
        ("node", "node.js"),
        ("express.js", "express"),
        ("expressjs", "express"),
        ("django rest framework", "django"),
        ("django framework", "django"),
        ("spring boot", "spring"),
        ("spring framework", "spring"),
        // Databases
        ("mongo", "mongodb"),
        ("mongo db", "mongodb"),
        ("mongodb database", "mongodb"),
        ("postgres", "postgresql"),
        ("postgresql database", "postgresql"),
        ("postgres db", "postgresql"),
        ("sql server", "sql"),
        ("structured query language", "sql"),
        ("no sql", "nosql"),
        ("no-sql", "nosql"),
        ("amazon dynamodb", "dynamodb"),
        ("dynamo db", "dynamodb"),
        ("redis cache", "redis"),
        ("elastic search", "elasticsearch"),
        // DevOps
        ("docker containers", "docker"),
        ("docker containerization", "docker"),
        ("k8s", "kubernetes"),
        ("kubernetes cluster", "kubernetes"),
        ("terraform cloud", "terraform"),
        ("terraform iac", "terraform"),
        ("aws lambda functions", "aws lambda"),
        ("lambda functions", "aws lambda"),
        ("serverless", "aws lambda"),
        ("serverless functions", "aws lambda"),
        // AI/ML
        ("ml", "machine learning"),
        ("machine-learning", "machine learning"),
        ("machinelearning", "machine learning"),
        ("ai", "artificial intelligence"),
        ("artificial-intelligence", "artificial intelligence"),
        ("deep-learning", "deep learning"),
        ("deeplearning", "deep learning"),
        ("scikit learn", "scikit-learn"),
        ("scikit-learn", "scikit-learn"),
        ("scikitlearn", "scikit-learn"),
        ("natural language processing", "nlp"),
        ("computer vision", "computer vision"),
        // Design & UI
        ("figma design", "figma"),
        ("tailwindcss", "tailwind"),
        ("tailwind css", "tailwind"),
        ("material-ui", "material ui"),
        ("mui", "material ui"),
        ("chakra-ui", "chakra ui"),
        // Languages
        ("c sharp", "c#"),
        ("c-sharp", "c#"),
        ("csharp", "c#"),
        ("objective c", "c"),
        ("objective-c", "objective c"),
        ("golang", "go"),
        ("golang", "go"),
        ("js", "javascript"),
        ("ts", "typescript"),
        ("typescript", "typescript"),
        // Testing
        ("react testing library", "testing library"),
        ("rtl", "testing library"),
        // Mobile
        ("react-native", "react native"),
        ("reactnative", "react native"),
        ("swift ui", "swiftui"),
        ("swiftui", "swiftui"),
        ("jetpack compose", "jetpack compose"),
        // Version Control
        ("git version control", "git"),
        ("github actions", "github actions"),
        ("gitlab ci/cd", "gitlab ci"),
        // Build Tools
        ("webpack bundler", "webpack"),
        ("vite bundler", "vite"),
    ])
});

/// Analyzes skills from jobs and user profiles
pub struct SkillsAnalyzer;

impl SkillsAnalyzer {
    /// Extract skills from job description and requirements
    pub fn extract_job_skills(job: &Job) -> Vec<String> {
        let mut skills = HashSet::new();
        let combined_text = format!(
            "{} {}",
            job.description.as_deref().unwrap_or(""),
            job.requirements.as_deref().unwrap_or("")
        );
        let text = combined_text.to_lowercase();

        for &canonical_skill in CANONICAL_SKILLS {
            if text.contains(canonical_skill) {
                skills.insert(canonical_skill.to_string());
            }
        }

        for (pattern, canonical) in SYNONYM_MAP.iter() {
            if text.contains(pattern) {
                skills.insert((*canonical).to_string());
            }
        }

        let mut normalized: HashSet<String> = HashSet::new();
        for raw in skills {
            let normalized_skill = SkillsAnalyzer::normalize_skill(&raw);
            if !normalized_skill.is_empty() {
                normalized.insert(normalized_skill);
            }
        }

        for word in combined_text.split_whitespace() {
            let cleaned = word
                .trim_matches(|c: char| !c.is_alphanumeric() && c != '+' && c != '#')
                .trim();
            if cleaned.len() > 2
                && (word.chars().any(|c| c.is_uppercase())
                    || cleaned.contains('+')
                    || cleaned.contains('#'))
            {
                let normalized_skill = SkillsAnalyzer::normalize_skill(cleaned);
                if !normalized_skill.is_empty() {
                    normalized.insert(normalized_skill);
                }
            }
        }

        normalized.into_iter().collect()
    }

    /// Extract skills from user profile
    pub fn extract_user_skills(profile: &UserProfile) -> Vec<String> {
        let mut skills = HashSet::new();

        for skill in &profile.skills.technical_skills {
            let normalized = SkillsAnalyzer::normalize_skill(skill);
            if !normalized.is_empty() {
                skills.insert(normalized);
            }
        }

        for exp in &profile.experience {
            for tech in &exp.technologies {
                let normalized = SkillsAnalyzer::normalize_skill(tech);
                if !normalized.is_empty() {
                    skills.insert(normalized);
                }
            }
        }

        for project in &profile.projects {
            let project_lower = project.to_lowercase();
            for &canonical_skill in CANONICAL_SKILLS {
                if project_lower.contains(canonical_skill) {
                    skills.insert(canonical_skill.to_string());
                }
            }
            for (pattern, canonical) in SYNONYM_MAP.iter() {
                if project_lower.contains(pattern) {
                    skills.insert(canonical.to_string());
                }
            }
        }

        skills.into_iter().collect()
    }

    /// Calculate skills overlap between job and user
    pub fn calculate_skills_overlap(
        job_skills: &[String],
        user_skills: &[String],
    ) -> (f64, Vec<String>, Vec<String>) {
        let job_set: HashSet<String> = job_skills.iter().map(|s| s.to_lowercase()).collect();
        let user_set: HashSet<String> = user_skills.iter().map(|s| s.to_lowercase()).collect();

        // Find matched and missing skills
        let matched: Vec<String> = job_set.intersection(&user_set).cloned().collect();
        let missing: Vec<String> = job_set.difference(&user_set).cloned().collect();

        // Calculate overlap percentage
        let overlap = if job_set.is_empty() {
            0.0
        } else {
            (matched.len() as f64 / job_set.len() as f64) * 100.0
        };

        (overlap, matched, missing)
    }

    /// Normalize skill names (handle variations)
    pub fn normalize_skill(skill: &str) -> String {
        let mut normalized = skill.trim().to_lowercase();

        if normalized.is_empty() {
            return normalized;
        }

        normalized = normalized
            .replace(['-', '_'], " ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        if STOP_WORDS.iter().any(|stop| *stop == normalized) {
            return String::new();
        }

        if let Some(canonical) = SYNONYM_MAP.get(normalized.as_str()) {
            return canonical.to_string();
        }

        if CANONICAL_SKILLS
            .iter()
            .any(|skill_name| *skill_name == normalized)
        {
            return normalized;
        }

        if normalized.len() <= 2 {
            return String::new();
        }

        normalized
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::{Job, JobStatus};
    use crate::generator::{ExperienceEntry, PersonalInfo, SkillsProfile, UserProfile};
    use std::collections::HashMap;

    #[test]
    fn test_extract_job_skills() {
        let job = Job {
            id: Some(1),
            title: "Senior React Developer".to_string(),
            company: "Test Corp".to_string(),
            url: "https://example.com/job/1".to_string(),
            description: Some("We are looking for a React developer with TypeScript experience. Must know Node.js and REST APIs.".to_string()),
            requirements: Some("Experience with React, TypeScript, Node.js required.".to_string()),
            location: None,
            salary: None,
            source: "test".to_string(),
            status: JobStatus::Saved,
            match_score: None,
            created_at: None,
            updated_at: None,
            ..Default::default()
        };

        let skills = SkillsAnalyzer::extract_job_skills(&job);
        assert!(skills.contains(&"react".to_string()));
        assert!(skills.contains(&"typescript".to_string()));
        assert!(skills.contains(&"node.js".to_string()));
    }

    #[test]
    fn test_extract_user_skills() {
        let profile = UserProfile {
            personal_info: PersonalInfo {
                name: "Test User".to_string(),
                email: "test@example.com".to_string(),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                portfolio: None,
            },
            summary: "Experienced developer".to_string(),
            skills: SkillsProfile {
                technical_skills: vec![
                    "React".to_string(),
                    "TypeScript".to_string(),
                    "Python".to_string(),
                ],
                soft_skills: vec!["Communication".to_string()],
                experience_years: HashMap::new(),
                proficiency_levels: HashMap::new(),
            },
            experience: vec![ExperienceEntry {
                company: "Company A".to_string(),
                position: "Developer".to_string(),
                duration: "2 years".to_string(),
                description: vec!["Built React apps".to_string()],
                technologies: vec!["React".to_string(), "Node.js".to_string()],
            }],
            education: vec![],
            projects: vec!["React project with AWS".to_string()],
        };

        let skills = SkillsAnalyzer::extract_user_skills(&profile);
        assert!(skills.contains(&"react".to_string()));
        assert!(skills.contains(&"typescript".to_string()));
        assert!(skills.contains(&"python".to_string()));
        assert!(skills.contains(&"node.js".to_string()));
    }

    #[test]
    fn test_calculate_skills_overlap() {
        let job_skills = vec![
            "react".to_string(),
            "typescript".to_string(),
            "python".to_string(),
            "docker".to_string(),
        ];

        let user_skills = vec![
            "react".to_string(),
            "typescript".to_string(),
            "javascript".to_string(),
        ];

        let (overlap, matched, missing) =
            SkillsAnalyzer::calculate_skills_overlap(&job_skills, &user_skills);

        assert_eq!(matched.len(), 2);
        assert!(matched.contains(&"react".to_string()));
        assert!(matched.contains(&"typescript".to_string()));

        assert_eq!(missing.len(), 2);
        assert!(missing.contains(&"python".to_string()));
        assert!(missing.contains(&"docker".to_string()));

        assert!((overlap - 50.0).abs() < 0.01); // 2 out of 4 = 50%
    }

    #[test]
    fn test_normalize_skill() {
        assert_eq!(SkillsAnalyzer::normalize_skill("JavaScript"), "javascript");
        assert_eq!(SkillsAnalyzer::normalize_skill("js"), "javascript");
        assert_eq!(SkillsAnalyzer::normalize_skill("React"), "react");
        assert_eq!(SkillsAnalyzer::normalize_skill("ReactJS"), "react");
    }
}

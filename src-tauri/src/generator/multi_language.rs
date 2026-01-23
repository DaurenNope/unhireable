use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Language {
    English,
    Spanish,
    French,
    German,
    Italian,
    Portuguese,
    Russian,
    Chinese,
    Japanese,
    Korean,
}

impl Language {
    pub fn from_code(code: &str) -> Option<Self> {
        match code.to_lowercase().as_str() {
            "en" | "english" => Some(Language::English),
            "es" | "spanish" => Some(Language::Spanish),
            "fr" | "french" => Some(Language::French),
            "de" | "german" => Some(Language::German),
            "it" | "italian" => Some(Language::Italian),
            "pt" | "portuguese" => Some(Language::Portuguese),
            "ru" | "russian" => Some(Language::Russian),
            "zh" | "chinese" => Some(Language::Chinese),
            "ja" | "japanese" => Some(Language::Japanese),
            "ko" | "korean" => Some(Language::Korean),
            _ => None,
        }
    }

    pub fn code(&self) -> &str {
        match self {
            Language::English => "en",
            Language::Spanish => "es",
            Language::French => "fr",
            Language::German => "de",
            Language::Italian => "it",
            Language::Portuguese => "pt",
            Language::Russian => "ru",
            Language::Chinese => "zh",
            Language::Japanese => "ja",
            Language::Korean => "ko",
        }
    }

    pub fn name(&self) -> &str {
        match self {
            Language::English => "English",
            Language::Spanish => "Spanish",
            Language::French => "French",
            Language::German => "German",
            Language::Italian => "Italian",
            Language::Portuguese => "Portuguese",
            Language::Russian => "Russian",
            Language::Chinese => "Chinese",
            Language::Japanese => "Japanese",
            Language::Korean => "Korean",
        }
    }
}

pub struct MultiLanguageTranslator {
    translations: HashMap<Language, HashMap<String, String>>,
}

impl MultiLanguageTranslator {
    pub fn new() -> Self {
        let mut translations = HashMap::new();

        // English (default) - no translation needed
        translations.insert(Language::English, HashMap::new());

        // Spanish translations
        let mut spanish = HashMap::new();
        spanish.insert("Professional Summary".to_string(), "Resumen Profesional".to_string());
        spanish.insert("Experience".to_string(), "Experiencia".to_string());
        spanish.insert("Education".to_string(), "Educación".to_string());
        spanish.insert("Skills".to_string(), "Habilidades".to_string());
        spanish.insert("Projects".to_string(), "Proyectos".to_string());
        translations.insert(Language::Spanish, spanish);

        // French translations
        let mut french = HashMap::new();
        french.insert("Professional Summary".to_string(), "Résumé Professionnel".to_string());
        french.insert("Experience".to_string(), "Expérience".to_string());
        french.insert("Education".to_string(), "Formation".to_string());
        french.insert("Skills".to_string(), "Compétences".to_string());
        french.insert("Projects".to_string(), "Projets".to_string());
        translations.insert(Language::French, french);

        // German translations
        let mut german = HashMap::new();
        german.insert("Professional Summary".to_string(), "Berufliche Zusammenfassung".to_string());
        german.insert("Experience".to_string(), "Berufserfahrung".to_string());
        german.insert("Education".to_string(), "Ausbildung".to_string());
        german.insert("Skills".to_string(), "Fähigkeiten".to_string());
        german.insert("Projects".to_string(), "Projekte".to_string());
        translations.insert(Language::German, german);

        Self { translations }
    }

    pub fn translate_section_header(&self, text: &str, language: &Language) -> String {
        if *language == Language::English {
            return text.to_string();
        }

        self.translations
            .get(language)
            .and_then(|lang_map| lang_map.get(text))
            .cloned()
            .unwrap_or_else(|| text.to_string())
    }

    pub fn translate_document(
        &self,
        content: &str,
        from_language: &Language,
        to_language: &Language,
    ) -> Result<String> {
        if from_language == to_language {
            return Ok(content.to_string());
        }

        // For now, just translate section headers
        // Full translation would require AI integration
        let mut translated = content.to_string();

        // Translate common section headers
        let sections = vec![
            "Professional Summary",
            "Experience",
            "Education",
            "Skills",
            "Projects",
        ];

        for section in sections {
            let translated_header = self.translate_section_header(section, to_language);
            translated = translated.replace(section, &translated_header);
        }

        Ok(translated)
    }

    pub fn get_available_languages(&self) -> Vec<Language> {
        vec![
            Language::English,
            Language::Spanish,
            Language::French,
            Language::German,
            Language::Italian,
            Language::Portuguese,
            Language::Russian,
            Language::Chinese,
            Language::Japanese,
            Language::Korean,
        ]
    }
}

impl Default for MultiLanguageTranslator {
    fn default() -> Self {
        Self::new()
    }
}














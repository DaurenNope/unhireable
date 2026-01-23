use crate::generator::GeneratedDocument;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentVersion {
    pub id: String,
    pub version_number: u32,
    pub document: GeneratedDocument,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub metadata: VersionMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionMetadata {
    pub job_id: Option<i64>,
    pub template_name: String,
    pub ai_provider: Option<String>,
    pub quality_score: Option<f64>,
    pub changes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionHistory {
    pub document_id: String,
    pub versions: Vec<DocumentVersion>,
    pub current_version: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct VersionControl {
    histories: HashMap<String, VersionHistory>,
}

impl VersionControl {
    pub fn new() -> Self {
        Self {
            histories: HashMap::new(),
        }
    }

    pub fn create_version(
        &mut self,
        document: GeneratedDocument,
        document_id: Option<String>,
        notes: Option<String>,
        tags: Vec<String>,
        metadata: VersionMetadata,
    ) -> Result<DocumentVersion> {
        let doc_id = document_id.unwrap_or_else(|| Uuid::new_v4().to_string());
        
        let version_number = if let Some(history) = self.histories.get(&doc_id) {
            history.current_version + 1
        } else {
            1
        };

        let version = DocumentVersion {
            id: Uuid::new_v4().to_string(),
            version_number,
            document,
            created_at: Utc::now(),
            created_by: None,
            notes,
            tags,
            metadata,
        };

        // Update or create history
        if let Some(history) = self.histories.get_mut(&doc_id) {
            history.versions.push(version.clone());
            history.current_version = version_number;
            history.updated_at = Utc::now();
        } else {
            let now = Utc::now();
            self.histories.insert(
                doc_id.clone(),
                VersionHistory {
                    document_id: doc_id,
                    versions: vec![version.clone()],
                    current_version: version_number,
                    created_at: now,
                    updated_at: now,
                },
            );
        }

        Ok(version)
    }

    pub fn get_version(&self, document_id: &str, version_number: u32) -> Option<&DocumentVersion> {
        self.histories
            .get(document_id)?
            .versions
            .iter()
            .find(|v| v.version_number == version_number)
    }

    pub fn get_current_version(&self, document_id: &str) -> Option<&DocumentVersion> {
        let history = self.histories.get(document_id)?;
        history.versions.iter().find(|v| v.version_number == history.current_version)
    }

    pub fn get_version_history(&self, document_id: &str) -> Option<&VersionHistory> {
        self.histories.get(document_id)
    }

    pub fn list_all_versions(&self, document_id: &str) -> Vec<&DocumentVersion> {
        self.histories
            .get(document_id)
            .map(|history| history.versions.iter().collect())
            .unwrap_or_default()
    }

    pub fn compare_versions(
        &self,
        document_id: &str,
        version1: u32,
        version2: u32,
    ) -> Option<VersionComparison> {
        let v1 = self.get_version(document_id, version1)?;
        let v2 = self.get_version(document_id, version2)?;

        let changes = Self::calculate_changes(&v1.document.content, &v2.document.content);

        Some(VersionComparison {
            version1: v1.version_number,
            version2: v2.version_number,
            changes,
            word_count_diff: v2.document.metadata.word_count as i32 - v1.document.metadata.word_count as i32,
        })
    }

    pub fn restore_version(&mut self, document_id: &str, version_number: u32) -> Result<DocumentVersion> {
        let version = self
            .get_version(document_id, version_number)
            .ok_or_else(|| anyhow::anyhow!("Version not found"))?
            .clone();

        // Create a new version from the restored one
        let restored = DocumentVersion {
            id: Uuid::new_v4().to_string(),
            version_number: self
                .histories
                .get(document_id)
                .map(|h| h.current_version + 1)
                .unwrap_or(1),
            document: version.document.clone(),
            created_at: Utc::now(),
            created_by: None,
            notes: Some(format!("Restored from version {}", version_number)),
            tags: version.tags.clone(),
            metadata: version.metadata.clone(),
        };

        if let Some(history) = self.histories.get_mut(document_id) {
            history.versions.push(restored.clone());
            history.current_version = restored.version_number;
            history.updated_at = Utc::now();
        }

        Ok(restored)
    }

    pub fn delete_version(&mut self, document_id: &str, version_number: u32) -> Result<()> {
        let history = self
            .histories
            .get_mut(document_id)
            .ok_or_else(|| anyhow::anyhow!("Document not found"))?;

        let initial_len = history.versions.len();
        history.versions.retain(|v| v.version_number != version_number);

        if history.versions.len() == initial_len {
            return Err(anyhow::anyhow!("Version not found"));
        }

        // Update current version if needed
        if history.current_version == version_number {
            history.current_version = history
                .versions
                .iter()
                .map(|v| v.version_number)
                .max()
                .unwrap_or(1);
        }

        Ok(())
    }

    pub fn tag_version(
        &mut self,
        document_id: &str,
        version_number: u32,
        tag: String,
    ) -> Result<()> {
        let history = self
            .histories
            .get_mut(document_id)
            .ok_or_else(|| anyhow::anyhow!("Document not found"))?;

        let version = history
            .versions
            .iter_mut()
            .find(|v| v.version_number == version_number)
            .ok_or_else(|| anyhow::anyhow!("Version not found"))?;

        if !version.tags.contains(&tag) {
            version.tags.push(tag);
        }

        Ok(())
    }

    fn calculate_changes(content1: &str, content2: &str) -> Vec<String> {
        let mut changes = Vec::new();

        // Simple word count comparison
        let words1 = content1.split_whitespace().count();
        let words2 = content2.split_whitespace().count();
        if words1 != words2 {
            changes.push(format!(
                "Word count changed: {} -> {} ({:+})",
                words1,
                words2,
                words2 as i32 - words1 as i32
            ));
        }

        // Check for major section changes
        let sections1: Vec<&str> = content1
            .lines()
            .filter(|line| line.starts_with('#') || line.to_uppercase().contains("SECTION"))
            .collect();
        let sections2: Vec<&str> = content2
            .lines()
            .filter(|line| line.starts_with('#') || line.to_uppercase().contains("SECTION"))
            .collect();

        if sections1 != sections2 {
            changes.push("Section structure changed".to_string());
        }

        // Character-level diff (simplified)
        let char_diff = (content1.len() as i32 - content2.len() as i32).abs();
        if char_diff > 100 {
            changes.push(format!("Significant content changes ({} character difference)", char_diff));
        }

        changes
    }

    pub fn list_all_documents(&self) -> Vec<String> {
        self.histories.keys().cloned().collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionComparison {
    pub version1: u32,
    pub version2: u32,
    pub changes: Vec<String>,
    pub word_count_diff: i32,
}

impl Default for VersionControl {
    fn default() -> Self {
        Self::new()
    }
}














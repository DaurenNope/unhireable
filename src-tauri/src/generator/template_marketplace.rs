use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: TemplateCategory,
    pub template_type: TemplateType,
    pub content: String,
    pub author: String,
    pub author_id: Option<String>,
    pub rating: f64,
    pub download_count: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tags: Vec<String>,
    pub preview_image_url: Option<String>,
    pub price: Option<f64>, // None = free
    pub is_premium: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TemplateCategory {
    Modern,
    Classic,
    Creative,
    Executive,
    Technical,
    Minimalist,
    Traditional,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TemplateType {
    Resume,
    CoverLetter,
    Email,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateSearchFilters {
    pub category: Option<TemplateCategory>,
    pub template_type: Option<TemplateType>,
    pub min_rating: Option<f64>,
    pub free_only: bool,
    pub tags: Vec<String>,
    pub author: Option<String>,
}

pub struct TemplateMarketplace {
    templates: HashMap<String, MarketplaceTemplate>,
    user_templates: HashMap<String, Vec<String>>, // user_id -> template_ids
}

impl TemplateMarketplace {
    pub fn new() -> Self {
        Self {
            templates: HashMap::new(),
            user_templates: HashMap::new(),
        }
    }

    pub fn add_template(&mut self, template: MarketplaceTemplate) -> Result<()> {
        self.templates.insert(template.id.clone(), template);
        Ok(())
    }

    pub fn get_template(&self, id: &str) -> Option<&MarketplaceTemplate> {
        self.templates.get(id)
    }

    pub fn search_templates(&self, filters: TemplateSearchFilters) -> Vec<&MarketplaceTemplate> {
        self.templates
            .values()
            .filter(|template| {
                // Category filter
                if let Some(ref category) = filters.category {
                    if template.category != *category {
                        return false;
                    }
                }

                // Type filter
                if let Some(ref template_type) = filters.template_type {
                    if template.template_type != *template_type {
                        return false;
                    }
                }

                // Rating filter
                if let Some(min_rating) = filters.min_rating {
                    if template.rating < min_rating {
                        return false;
                    }
                }

                // Free only filter
                if filters.free_only && template.price.is_some() {
                    return false;
                }

                // Tags filter
                if !filters.tags.is_empty() {
                    let has_all_tags = filters
                        .tags
                        .iter()
                        .all(|tag| template.tags.iter().any(|t| t.to_lowercase() == tag.to_lowercase()));
                    if !has_all_tags {
                        return false;
                    }
                }

                // Author filter
                if let Some(ref author) = filters.author {
                    if !template.author.to_lowercase().contains(&author.to_lowercase()) {
                        return false;
                    }
                }

                true
            })
            .collect()
    }

    pub fn get_popular_templates(&self, limit: usize) -> Vec<&MarketplaceTemplate> {
        let mut templates: Vec<&MarketplaceTemplate> = self.templates.values().collect();
        templates.sort_by(|a, b| {
            b.download_count
                .cmp(&a.download_count)
                .then_with(|| b.rating.partial_cmp(&a.rating).unwrap_or(std::cmp::Ordering::Equal))
        });
        templates.into_iter().take(limit).collect()
    }

    pub fn get_recent_templates(&self, limit: usize) -> Vec<&MarketplaceTemplate> {
        let mut templates: Vec<&MarketplaceTemplate> = self.templates.values().collect();
        templates.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        templates.into_iter().take(limit).collect()
    }

    pub fn get_top_rated_templates(&self, limit: usize) -> Vec<&MarketplaceTemplate> {
        let mut templates: Vec<&MarketplaceTemplate> = self.templates.values().collect();
        templates.sort_by(|a, b| {
            b.rating
                .partial_cmp(&a.rating)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| b.download_count.cmp(&a.download_count))
        });
        templates.into_iter().take(limit).collect()
    }

    pub fn download_template(&mut self, id: &str, user_id: Option<String>) -> Result<String> {
        let template = self
            .templates
            .get_mut(id)
            .ok_or_else(|| anyhow::anyhow!("Template not found"))?;

        template.download_count += 1;

        if let Some(user_id) = user_id {
            self.user_templates
                .entry(user_id)
                .or_insert_with(Vec::new)
                .push(id.to_string());
        }

        Ok(template.content.clone())
    }

    pub fn rate_template(&mut self, id: &str, rating: f64) -> Result<()> {
        let template = self
            .templates
            .get_mut(id)
            .ok_or_else(|| anyhow::anyhow!("Template not found"))?;

        // Simple average rating update (in production, you'd want more sophisticated rating system)
        template.rating = (template.rating + rating) / 2.0;
        Ok(())
    }

    pub fn get_user_templates(&self, user_id: &str) -> Vec<&MarketplaceTemplate> {
        self.user_templates
            .get(user_id)
            .map(|template_ids| {
                template_ids
                    .iter()
                    .filter_map(|id| self.templates.get(id))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn share_template(&mut self, template_id: &str, user_id: &str) -> Result<String> {
        // Create a copy of the template for sharing
        let template = self
            .templates
            .get(template_id)
            .ok_or_else(|| anyhow::anyhow!("Template not found"))?
            .clone();

        let shared_id = format!("shared_{}_{}", user_id, template_id);
        let mut shared_template = template;
        shared_template.id = shared_id.clone();
        shared_template.author_id = Some(user_id.to_string());

        self.templates.insert(shared_id.clone(), shared_template);
        Ok(shared_id)
    }
}

impl Default for TemplateMarketplace {
    fn default() -> Self {
        Self::new()
    }
}














use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FlowStep {
    ScrapeJobs,
    MatchJobs,
    GenerateDocuments,
    SendNotifications,
    UpdateDatabase,
    GenerateRecommendations,
    UpdateUserProfile,
    CalculateMatchScores,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    pub step: FlowStep,
    pub dependencies: Vec<String>,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flow {
    pub id: String,
    pub name: String,
    pub nodes: Vec<FlowNode>,
    pub enabled: bool,
}

pub struct FlowEngine {
    flows: Arc<Mutex<HashMap<String, Flow>>>,
}

impl FlowEngine {
    pub fn new() -> Self {
        FlowEngine {
            flows: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn register_flow(&self, flow: Flow) -> Result<()> {
        let mut flows = self.flows.lock().await;
        flows.insert(flow.id.clone(), flow);
        Ok(())
    }

    pub async fn execute_flow(&self, flow_id: &str) -> Result<()> {
        let flows = self.flows.lock().await;
        let flow = flows.get(flow_id)
            .ok_or_else(|| anyhow::anyhow!("Flow not found: {}", flow_id))?;

        if !flow.enabled {
            return Ok(());
        }

        // Topological sort to execute nodes in dependency order
        let execution_order = self.topological_sort(&flow.nodes)?;

        for node_id in execution_order {
            if let Some(node) = flow.nodes.iter().find(|n| n.id == node_id) {
                self.execute_node(node).await?;
            }
        }

        Ok(())
    }

    fn topological_sort(&self, nodes: &[FlowNode]) -> Result<Vec<String>> {
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();

        // Initialize in-degree and graph
        for node in nodes {
            in_degree.insert(node.id.clone(), 0);
            graph.insert(node.id.clone(), Vec::new());
        }

        for node in nodes {
            for dep in &node.dependencies {
                *in_degree.get_mut(&node.id).unwrap() += 1;
                graph.get_mut(dep).unwrap().push(node.id.clone());
            }
        }

        // Kahn's algorithm
        let mut queue: Vec<String> = in_degree
            .iter()
            .filter(|(_, &degree)| degree == 0)
            .map(|(id, _)| id.clone())
            .collect();

        let mut result = Vec::new();
        while let Some(node_id) = queue.pop() {
            result.push(node_id.clone());

            if let Some(neighbors) = graph.get(&node_id) {
                for neighbor in neighbors {
                    let degree = in_degree.get_mut(neighbor).unwrap();
                    *degree -= 1;
                    if *degree == 0 {
                        queue.push(neighbor.clone());
                    }
                }
            }
        }

        if result.len() != nodes.len() {
            return Err(anyhow::anyhow!("Circular dependency detected in flow"));
        }

        Ok(result)
    }

    async fn execute_node(&self, node: &FlowNode) -> Result<()> {
        tracing::info!("Executing flow node: {} ({:?})", node.id, node.step);
        
        match &node.step {
            FlowStep::ScrapeJobs => {
                // Implementation would call scraper
                tracing::info!("Scraping jobs");
            }
            FlowStep::MatchJobs => {
                // Implementation would call matcher
                tracing::info!("Matching jobs");
            }
            FlowStep::GenerateDocuments => {
                // Implementation would call generator
                tracing::info!("Generating documents");
            }
            FlowStep::SendNotifications => {
                // Implementation would call notifier
                tracing::info!("Sending notifications");
            }
            FlowStep::UpdateDatabase => {
                // Implementation would update database
                tracing::info!("Updating database");
            }
            FlowStep::GenerateRecommendations => {
                // Implementation would call recommendation engine
                tracing::info!("Generating recommendations");
            }
            FlowStep::UpdateUserProfile => {
                // Implementation would update user profile
                tracing::info!("Updating user profile");
            }
            FlowStep::CalculateMatchScores => {
                // Implementation would calculate match scores
                tracing::info!("Calculating match scores");
            }
            FlowStep::Custom(name) => {
                tracing::info!("Executing custom step: {}", name);
            }
        }

        Ok(())
    }
    
    /// Register default flows for Intelligence Agent
    pub async fn register_intelligence_flows(&self) -> Result<()> {
        use serde_json::json;
        
        // Flow: Generate Recommendations
        let generate_recommendations_flow = Flow {
            id: "generate_recommendations".to_string(),
            name: "Generate Recommendations".to_string(),
            nodes: vec![
                FlowNode {
                    id: "fetch_jobs".to_string(),
                    step: FlowStep::UpdateDatabase,
                    dependencies: vec![],
                    config: json!({"action": "fetch_jobs"}),
                },
                FlowNode {
                    id: "calculate_similarity".to_string(),
                    step: FlowStep::CalculateMatchScores,
                    dependencies: vec!["fetch_jobs".to_string()],
                    config: json!({"action": "calculate_similarity"}),
                },
                FlowNode {
                    id: "generate_recommendations".to_string(),
                    step: FlowStep::GenerateRecommendations,
                    dependencies: vec!["calculate_similarity".to_string()],
                    config: json!({"limit": 20}),
                },
                FlowNode {
                    id: "cache_results".to_string(),
                    step: FlowStep::UpdateDatabase,
                    dependencies: vec!["generate_recommendations".to_string()],
                    config: json!({"action": "cache_recommendations"}),
                },
            ],
            enabled: true,
        };
        
        // Flow: Update User Profile
        let update_profile_flow = Flow {
            id: "update_user_profile".to_string(),
            name: "Update User Profile".to_string(),
            nodes: vec![
                FlowNode {
                    id: "update_profile".to_string(),
                    step: FlowStep::UpdateUserProfile,
                    dependencies: vec![],
                    config: json!({}),
                },
                FlowNode {
                    id: "invalidate_cache".to_string(),
                    step: FlowStep::UpdateDatabase,
                    dependencies: vec!["update_profile".to_string()],
                    config: json!({"action": "invalidate_recommendation_cache"}),
                },
                FlowNode {
                    id: "regenerate_recommendations".to_string(),
                    step: FlowStep::GenerateRecommendations,
                    dependencies: vec!["invalidate_cache".to_string()],
                    config: json!({"limit": 20}),
                },
            ],
            enabled: true,
        };
        
        // Flow: Calculate Match Scores
        let calculate_match_scores_flow = Flow {
            id: "calculate_match_scores".to_string(),
            name: "Calculate Match Scores".to_string(),
            nodes: vec![
                FlowNode {
                    id: "fetch_new_jobs".to_string(),
                    step: FlowStep::UpdateDatabase,
                    dependencies: vec![],
                    config: json!({"action": "fetch_new_jobs"}),
                },
                FlowNode {
                    id: "calculate_scores".to_string(),
                    step: FlowStep::CalculateMatchScores,
                    dependencies: vec!["fetch_new_jobs".to_string()],
                    config: json!({"batch_size": 10}),
                },
                FlowNode {
                    id: "cache_scores".to_string(),
                    step: FlowStep::UpdateDatabase,
                    dependencies: vec!["calculate_scores".to_string()],
                    config: json!({"action": "cache_match_scores"}),
                },
                FlowNode {
                    id: "publish_events".to_string(),
                    step: FlowStep::SendNotifications,
                    dependencies: vec!["cache_scores".to_string()],
                    config: json!({"event_type": "job.matched"}),
                },
            ],
            enabled: true,
        };
        
        self.register_flow(generate_recommendations_flow).await?;
        self.register_flow(update_profile_flow).await?;
        self.register_flow(calculate_match_scores_flow).await?;
        
        tracing::info!("Intelligence Agent flows registered");
        Ok(())
    }
    
    /// Get all registered flows
    pub async fn get_flows(&self) -> Vec<Flow> {
        let flows = self.flows.lock().await;
        flows.values().cloned().collect()
    }
    
    /// Get a specific flow by ID
    pub async fn get_flow(&self, flow_id: &str) -> Option<Flow> {
        let flows = self.flows.lock().await;
        flows.get(flow_id).cloned()
    }
    
    /// Enable or disable a flow
    pub async fn set_flow_enabled(&self, flow_id: &str, enabled: bool) -> Result<()> {
        let mut flows = self.flows.lock().await;
        if let Some(flow) = flows.get_mut(flow_id) {
            flow.enabled = enabled;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Flow not found: {}", flow_id))
        }
    }
}







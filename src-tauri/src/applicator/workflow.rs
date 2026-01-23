use crate::applicator::{ApplicationResult, RetryExecutor};
use crate::db::models::Job;
use crate::generator::UserProfile;
use anyhow::{anyhow, Context, Result};
use headless_chrome::{Browser, LaunchOptionsBuilder, Tab};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

/// Workflow step types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowStepType {
    /// Navigate to URL
    Navigate,
    /// Fill form fields
    FillForm,
    /// Upload file
    UploadFile,
    /// Click button/element
    Click,
    /// Wait for element or time
    Wait,
    /// Verify page content or URL
    Verify,
    /// Custom JavaScript execution
    ExecuteScript,
    /// Conditional branching
    Condition,
}

/// Single step in a workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    /// Step ID (unique within workflow)
    pub id: String,
    /// Step type
    pub step_type: WorkflowStepType,
    /// Step configuration (step-type specific)
    pub config: HashMap<String, serde_json::Value>,
    /// Next step ID (None for terminal step)
    pub next_step_id: Option<String>,
    /// Alternative step ID for failure
    pub failure_step_id: Option<String>,
    /// Retry configuration for this step
    pub retry_config: Option<crate::applicator::RetryConfig>,
    /// Timeout in seconds
    pub timeout_secs: Option<u64>,
}

/// Workflow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    /// Workflow ID
    pub id: String,
    /// Workflow name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// ATS type this workflow is designed for
    pub ats_type: Option<String>,
    /// Steps in the workflow
    pub steps: Vec<WorkflowStep>,
    /// Initial step ID
    pub initial_step_id: String,
    /// Metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Workflow execution state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowState {
    /// Current step ID
    pub current_step_id: String,
    /// Step execution history
    pub step_history: Vec<StepExecution>,
    /// Variables stored during execution
    pub variables: HashMap<String, serde_json::Value>,
    /// Whether workflow completed successfully
    pub completed: bool,
    /// Final result
    pub result: Option<ApplicationResult>,
    /// Errors encountered
    pub errors: Vec<String>,
}

/// Step execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepExecution {
    /// Step ID
    pub step_id: String,
    /// Execution start time
    pub started_at: chrono::DateTime<chrono::Utc>,
    /// Execution end time
    pub ended_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Whether step succeeded
    pub succeeded: bool,
    /// Error message if failed
    pub error: Option<String>,
    /// Attempts made
    pub attempts: u32,
}

/// Browser context manager for workflow execution
/// Maintains a browser instance across workflow steps
#[allow(dead_code)] // browser field reserved for future use
struct BrowserContext {
    browser: Arc<Browser>,
    tab: Arc<Tab>,
}

impl BrowserContext {
    /// Create a new browser context
    fn new() -> Result<Self> {
        let launch_options = LaunchOptionsBuilder::default()
            .headless(true)
            .build()
            .map_err(|e| anyhow!("Failed to create launch options: {}", e))?;

        let browser = Browser::new(launch_options)
            .map_err(|e| anyhow!("Failed to launch browser: {}", e))?;
        let tab = browser
            .wait_for_initial_tab()
            .map_err(|e| anyhow!("Failed to get initial tab: {}", e))?;

        Ok(Self {
            browser: Arc::new(browser),
            tab,
        })
    }

    /// Get the current tab
    fn tab(&self) -> &Arc<Tab> {
        &self.tab
    }
}

/// Workflow orchestrator for multi-step application flows
pub struct WorkflowOrchestrator;

impl WorkflowOrchestrator {
    /// Create a new workflow orchestrator
    pub fn new() -> Self {
        Self
    }

    /// Execute a workflow
    pub async fn execute(
        &self,
        workflow: &Workflow,
        job: &Job,
        profile: &UserProfile,
        initial_state: Option<WorkflowState>,
    ) -> Result<WorkflowState> {
        let mut state = initial_state.unwrap_or_else(|| WorkflowState {
            current_step_id: workflow.initial_step_id.clone(),
            step_history: Vec::new(),
            variables: HashMap::new(),
            completed: false,
            result: None,
            errors: Vec::new(),
        });

        // Initialize browser context for workflow execution
        let browser_context = Arc::new(BrowserContext::new()
            .context("Failed to initialize browser context for workflow")?);

        let step_map: HashMap<String, &WorkflowStep> = workflow
            .steps
            .iter()
            .map(|step| (step.id.clone(), step))
            .collect();

        loop {
            let step = step_map
                .get(&state.current_step_id)
                .ok_or_else(|| anyhow!("Step not found: {}", state.current_step_id))?;

            let step_start = chrono::Utc::now();
            let step_result = self
                .execute_step(step, &job, profile, &state, &browser_context)
                .await;
            let step_end = chrono::Utc::now();

            // Extract attempt count from error context if available
            let attempts = if let Err(ref e) = step_result {
                // Try to extract attempt count from error message
                let err_msg = e.to_string();
                if err_msg.contains("after") && err_msg.contains("attempt") {
                    if let Some(num_str) = err_msg.split("after").nth(1)
                        .and_then(|s| s.split_whitespace().next()) {
                        num_str.parse().unwrap_or(1)
                    } else {
                        1
                    }
                } else {
                    1
                }
            } else {
                1
            };

            let execution = StepExecution {
                step_id: step.id.clone(),
                started_at: step_start,
                ended_at: Some(step_end),
                succeeded: step_result.is_ok(),
                error: step_result.as_ref().err().map(|e| e.to_string()),
                attempts,
            };

            state.step_history.push(execution);

            match step_result {
                Ok(step_variables) => {
                    // Merge step variables into state
                    state.variables.extend(step_variables);

                    // Move to next step
                    if let Some(next_id) = &step.next_step_id {
                        state.current_step_id = next_id.clone();
                    } else {
                        // Terminal step - workflow complete
                        state.completed = true;
                        break;
                    }
                }
                Err(e) => {
                    let error_msg = format!("Step '{}' failed: {}", step.id, e);
                    state.errors.push(error_msg.clone());
                    
                    tracing::warn!("Workflow step failed: {}", error_msg);

                    // Try failure step if available
                    if let Some(failure_id) = &step.failure_step_id {
                        tracing::info!("Routing to failure handler step: {}", failure_id);
                        state.current_step_id = failure_id.clone();
                    } else {
                        // No failure handler - workflow failed
                        state.completed = true;
                        tracing::error!("Workflow failed at step {}: {}", step.id, e);
                        return Err(anyhow!(
                            "Workflow failed at step '{}': {}. Error history: {:?}",
                            step.id,
                            e,
                            state.errors
                        ));
                    }
                }
            }
        }

        Ok(state)
    }

    /// Execute a single workflow step
    async fn execute_step(
        &self,
        step: &WorkflowStep,
        job: &Job,
        profile: &UserProfile,
        state: &WorkflowState,
        browser_context: &Arc<BrowserContext>,
    ) -> Result<HashMap<String, serde_json::Value>> {
        // Apply retry mechanism if configured
        let retry_config = step.retry_config.clone().unwrap_or_default();
        
        // If retry config is default (max_attempts = 3), use retry executor
        if retry_config.max_attempts > 1 {
            let retry_executor = RetryExecutor::with_config(retry_config.clone());
            let step_clone = step.clone();
            let job_clone = job.clone();
            let profile_clone = profile.clone();
            let state_vars = state.variables.clone();
            let browser_context_clone = Arc::clone(browser_context);

            let operation = move || -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<HashMap<String, serde_json::Value>>> + Send>> {
                let step = step_clone.clone();
                let job = job_clone.clone();
                let profile = profile_clone.clone();
                let vars = state_vars.clone();
                let ctx = Arc::clone(&browser_context_clone);
                Box::pin(async move {
                    Self::execute_step_internal(
                        &step,
                        &job,
                        &profile,
                        &vars,
                        &ctx,
                    )
                    .await
                })
            };

            let result = retry_executor.execute(operation).await;
            if result.success {
                result
                    .result
                    .ok_or_else(|| anyhow!("Retry succeeded but no result"))
            } else {
                Err(anyhow!(
                    "Step failed after {} attempts: {:?}",
                    result.attempts,
                    result.errors
                ))
            }
        } else {
            // No retry - execute directly
            Self::execute_step_internal(step, job, profile, &state.variables, browser_context).await
        }
    }

    /// Internal step execution (called by retry mechanism)
    async fn execute_step_internal(
        step: &WorkflowStep,
        job: &Job,
        profile: &UserProfile,
        variables: &HashMap<String, serde_json::Value>,
        browser_context: &Arc<BrowserContext>,
    ) -> Result<HashMap<String, serde_json::Value>> {
        let tab = browser_context.tab().clone();
        let timeout_secs = step.timeout_secs.unwrap_or(30);
        
        // Wrap blocking browser calls in spawn_blocking
        match &step.step_type {
            WorkflowStepType::Navigate => {
                Self::step_navigate(step, job, variables, &tab, timeout_secs).await
            }
            WorkflowStepType::FillForm => {
                Self::step_fill_form(step, profile, variables, &tab, timeout_secs).await
            }
            WorkflowStepType::UploadFile => {
                Self::step_upload_file(step, profile, variables, &tab, timeout_secs).await
            }
            WorkflowStepType::Click => {
                Self::step_click(step, &tab, timeout_secs).await
            }
            WorkflowStepType::Wait => {
                Self::step_wait(step).await
            }
            WorkflowStepType::Verify => {
                Self::step_verify(step, &tab, timeout_secs).await
            }
            WorkflowStepType::ExecuteScript => {
                Self::step_execute_script(step, variables, &tab, timeout_secs).await
            }
            WorkflowStepType::Condition => {
                Self::step_condition(step, variables).await
            }
        }
    }

    /// Navigate to URL
    async fn step_navigate(
        step: &WorkflowStep,
        job: &Job,
        variables: &HashMap<String, serde_json::Value>,
        tab: &Arc<Tab>,
        timeout_secs: u64,
    ) -> Result<HashMap<String, serde_json::Value>> {
        // Get URL from config or use job URL
        let url = step
            .config
            .get("url")
            .and_then(|v| v.as_str())
            .or_else(|| variables.get("url").and_then(|v| v.as_str()))
            .or_else(|| Some(&job.url))
            .ok_or_else(|| anyhow!("Missing 'url' in Navigate step config. Provide either in step config, as 'url' variable, or use job.url"))?;

        println!("🔄 Workflow: Navigating to {}", url);

        // Substitute variables in URL if needed
        let url = Self::substitute_variables(url, variables);
        let url_clone = url.clone();
        let tab_clone = Arc::clone(tab);
        let timeout = Duration::from_secs(timeout_secs);

        // Wrap blocking browser calls with proper error classification
        let current_url = tokio::task::spawn_blocking(move || -> Result<String> {
            tab_clone.set_default_timeout(timeout);
            
            tab_clone.navigate_to(&url_clone)
                .map_err(|e| Self::classify_browser_error(&format!("Navigation failed to '{}': {}", url_clone, e)))?;
            
            tab_clone.wait_until_navigated()
                .map_err(|e| Self::classify_browser_error(&format!("Navigation timeout after {}s for '{}': {}", timeout_secs, url_clone, e)))?;
            
            Ok(tab_clone.get_url())
        })
        .await
        .map_err(|e| anyhow!("Task join error during navigation: {}", e))??;

        // Wait for DOM to be ready (allow JavaScript to render)
        tokio::time::sleep(Duration::from_secs(2)).await;

        let mut vars = HashMap::new();
        vars.insert("current_url".to_string(), serde_json::json!(current_url));
        
        println!("✅ Navigated to: {}", current_url);
        Ok(vars)
    }

    /// Click an element
    async fn step_click(
        step: &WorkflowStep,
        tab: &Arc<Tab>,
        timeout_secs: u64,
    ) -> Result<HashMap<String, serde_json::Value>> {
                let selector = step
                    .config
                    .get("selector")
                    .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'selector' in Click step config"))?;

                println!("🔄 Workflow: Clicking element: {}", selector);

        let selector_clone = selector.to_string();
        let tab_clone = Arc::clone(tab);
        let timeout = Duration::from_secs(timeout_secs);

        // Wrap blocking browser calls
        tokio::task::spawn_blocking(move || -> Result<()> {
            // Set timeout for element wait
            tab_clone.set_default_timeout(timeout);
            
            let element = tab_clone
                .wait_for_element(&selector_clone)
                .map_err(|e| Self::classify_browser_error(&format!("Element not found '{}': {}", selector_clone, e)))?;

            element
                .click()
                .map_err(|e| Self::classify_browser_error(&format!("Click failed on '{}': {}", selector_clone, e)))?;

            Ok(())
        })
        .await
        .map_err(|e| anyhow!("Task join error: {}", e))??;

        // Wait for action to complete
        tokio::time::sleep(Duration::from_millis(500)).await;

        println!("✅ Clicked element: {}", selector);
                Ok(HashMap::new())
            }

    /// Wait for a duration or element
    async fn step_wait(step: &WorkflowStep) -> Result<HashMap<String, serde_json::Value>> {
                let duration_secs = step
                    .config
                    .get("duration_secs")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(2);

                println!("🔄 Workflow: Waiting {}s", duration_secs);
        tokio::time::sleep(Duration::from_secs(duration_secs)).await;
                Ok(HashMap::new())
    }

    /// Fill form fields
    async fn step_fill_form(
        step: &WorkflowStep,
        profile: &UserProfile,
        variables: &HashMap<String, serde_json::Value>,
        tab: &Arc<Tab>,
        timeout_secs: u64,
    ) -> Result<HashMap<String, serde_json::Value>> {
        println!("🔄 Workflow: Filling form fields");

        let fields = step
            .config
            .get("fields")
            .and_then(|v| v.as_object())
            .ok_or_else(|| anyhow!("Missing 'fields' in FillForm step config"))?;

        let name_parts: Vec<&str> = profile.personal_info.name.split_whitespace().collect();
        let first_name = name_parts.first().map(|s| s.to_string()).unwrap_or_default();
        let last_name = name_parts.get(1..).map(|p| p.join(" ")).unwrap_or_default();

        // Prepare field data
        let mut field_data: Vec<(String, String)> = Vec::new();
        for (selector, value_template) in fields {
            let value_str = value_template.as_str().unwrap_or("");
            let value = Self::substitute_form_value(value_str, profile, &first_name, &last_name, variables);
            field_data.push((selector.clone(), value));
        }

        let tab_clone = Arc::clone(tab);
        let timeout = Duration::from_secs(timeout_secs);

        // Wrap blocking browser calls
        tokio::task::spawn_blocking(move || -> Result<()> {
            tab_clone.set_default_timeout(timeout);

            for (selector, value) in &field_data {
                println!("  Filling {} with: {}", selector, value);

                let element = tab_clone
                    .wait_for_element(selector)
                    .map_err(|e| Self::classify_browser_error(&format!("Form field not found '{}': {}", selector, e)))?;

                // Try to clear existing value by clicking and clearing
                let _ = element.click();
                let _ = element.call_js_fn("function(){ this.value=''; }", false);

                // Type the value
                element
                    .type_into(value)
                    .map_err(|e| Self::classify_browser_error(&format!("Failed to type into '{}': {}", selector, e)))?;

                // Small delay between fields
                std::thread::sleep(Duration::from_millis(200));
            }

            Ok(())
        })
        .await
        .map_err(|e| anyhow!("Task join error: {}", e))??;

        println!("✅ Form fields filled");
        Ok(HashMap::new())
    }

    /// Upload file
    async fn step_upload_file(
        step: &WorkflowStep,
        _profile: &UserProfile,
        variables: &HashMap<String, serde_json::Value>,
        tab: &Arc<Tab>,
        timeout_secs: u64,
    ) -> Result<HashMap<String, serde_json::Value>> {
        let selector = step
            .config
            .get("selector")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'selector' in UploadFile step config"))?;

        let file_path = step
            .config
            .get("file_path")
            .and_then(|v| v.as_str())
            .or_else(|| variables.get("resume_path").and_then(|v| v.as_str()))
            .ok_or_else(|| anyhow!("Missing 'file_path' in UploadFile step config. Provide either in step config or as 'resume_path' variable"))?;

        println!("🔄 Workflow: Uploading file: {} to {}", file_path, selector);

        // Verify file exists
        let file_path_buf = std::path::Path::new(file_path);
        if !file_path_buf.exists() {
            return Err(anyhow!("File not found: {}. Please ensure the file path is correct.", file_path));
        }

        // Get absolute path
        let absolute_path = file_path_buf
            .canonicalize()
            .map_err(|e| anyhow!("Failed to canonicalize file path '{}': {}", file_path, e))?;

        let file_path_str = absolute_path.to_string_lossy().to_string();
        let selector_clone = selector.to_string();
        let tab_clone = Arc::clone(tab);
        let timeout = Duration::from_secs(timeout_secs);

        // Wrap blocking browser calls
        tokio::task::spawn_blocking(move || -> Result<()> {
            tab_clone.set_default_timeout(timeout);

            let element = tab_clone
                .wait_for_element(&selector_clone)
                .map_err(|e| Self::classify_browser_error(&format!("File input not found '{}': {}", selector_clone, e)))?;

            // Set file path - use absolute path
            let file_paths: Vec<&str> = vec![&file_path_str];
            element
                .set_input_files(&file_paths)
                .map_err(|e| Self::classify_browser_error(&format!("File upload failed '{}': {}", file_path_str, e)))?;

            Ok(())
        })
        .await
        .map_err(|e| anyhow!("Task join error: {}", e))??;

        // Wait for upload to complete
        tokio::time::sleep(Duration::from_secs(2)).await;

        println!("✅ File uploaded: {}", file_path);
        Ok(HashMap::new())
    }

    /// Verify page state
    async fn step_verify(
        step: &WorkflowStep,
        tab: &Arc<Tab>,
        timeout_secs: u64,
    ) -> Result<HashMap<String, serde_json::Value>> {
                println!("🔄 Workflow: Verifying page");

        let tab_clone = Arc::clone(tab);
        let timeout = Duration::from_secs(timeout_secs);

        let current_url = tokio::task::spawn_blocking({
            let tab_clone = Arc::clone(&tab_clone);
            move || tab_clone.get_url()
        })
        .await
        .map_err(|e| anyhow!("Task join error: {}", e))?;

        let mut vars = HashMap::new();
        vars.insert("verified_url".to_string(), serde_json::json!(current_url));

        // Check URL pattern if specified
        if let Some(url_pattern) = step.config.get("url_contains") {
            if let Some(pattern) = url_pattern.as_str() {
                if !current_url.contains(pattern) {
                    return Err(anyhow!(
                        "URL verification failed: expected to contain '{}', got '{}'",
                        pattern,
                        current_url
                    ));
                }
                println!("✅ URL verification passed: contains '{}'", pattern);
            }
        }

        // Check for success indicators
        if let Some(selectors) = step.config.get("success_selectors") {
            if let Some(selector_array) = selectors.as_array() {
                let selector_strings: Vec<String> = selector_array
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect();

                let verify_result = tokio::task::spawn_blocking({
                    let tab_clone = Arc::clone(&tab_clone);
                    let selectors = selector_strings.clone();
                    move || -> Result<bool> {
                        tab_clone.set_default_timeout(timeout);
                        for selector in &selectors {
                            match tab_clone.wait_for_element(selector) {
                                Ok(_) => {
                                    println!("✅ Success indicator found: {}", selector);
                                    return Ok(true);
                                }
                                Err(_) => {
                                    println!("⚠️  Success indicator not found: {}", selector);
                                }
                            }
                        }
                        Ok(false)
                    }
                })
                .await
                .map_err(|e| anyhow!("Task join error: {}", e))??;

                vars.insert("success_verified".to_string(), serde_json::json!(verify_result));
            }
        }

        println!("✅ Page verification completed");
        Ok(vars)
    }

    /// Execute JavaScript
    async fn step_execute_script(
        step: &WorkflowStep,
        variables: &HashMap<String, serde_json::Value>,
        tab: &Arc<Tab>,
        timeout_secs: u64,
    ) -> Result<HashMap<String, serde_json::Value>> {
                let script = step
                    .config
                    .get("script")
                    .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'script' in ExecuteScript step config"))?;

                println!("🔄 Workflow: Executing script");

        // Substitute variables in script
        let script = Self::substitute_variables(script, variables);
        let tab_clone = Arc::clone(tab);
        let timeout = Duration::from_secs(timeout_secs);

        let result = tokio::task::spawn_blocking(move || -> Result<serde_json::Value> {
            tab_clone.set_default_timeout(timeout);
            let eval_result = tab_clone
                .evaluate(&script, false)
                .map_err(|e| Self::classify_browser_error(&format!("Script execution failed: {}", e)))?;

            serde_json::to_value(eval_result.value)
                .map_err(|e| anyhow!("Failed to serialize script result: {}", e))
        })
        .await
        .map_err(|e| anyhow!("Task join error: {}", e))??;

        let mut vars = HashMap::new();
        vars.insert("script_result".to_string(), result);

        println!("✅ Script executed successfully");
        Ok(vars)
    }

    /// Evaluate condition and return next step
    async fn step_condition(
        step: &WorkflowStep,
        variables: &HashMap<String, serde_json::Value>,
    ) -> Result<HashMap<String, serde_json::Value>> {
                println!("🔄 Workflow: Evaluating condition");

        let condition_type = step
            .config
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("equals");

        let left = step
            .config
            .get("left")
            .and_then(|v| v.as_str())
            .or_else(|| variables.get("left").and_then(|v| v.as_str()))
            .ok_or_else(|| anyhow!("Missing 'left' in Condition step config"))?;

        let right = step
            .config
            .get("right")
            .and_then(|v| v.as_str())
            .or_else(|| variables.get("right").and_then(|v| v.as_str()))
            .ok_or_else(|| anyhow!("Missing 'right' in Condition step config"))?;

        let condition_result = match condition_type {
            "equals" => left == right,
            "contains" => left.contains(right),
            "starts_with" => left.starts_with(right),
            "ends_with" => left.ends_with(right),
            _ => return Err(anyhow!("Unknown condition type: {}", condition_type)),
        };

        let mut vars = HashMap::new();
        vars.insert("condition_result".to_string(), serde_json::json!(condition_result));

        // Note: Branching logic is handled by the orchestrator based on condition_result
        // The next_step_id can be set based on this result in the workflow definition
        println!(
            "✅ Condition evaluated: {} {} {} = {}",
            left, condition_type, right, condition_result
        );
        Ok(vars)
    }

    /// Classify browser errors as retryable or non-retryable
    /// Returns an error with appropriate context for retry logic
    fn classify_browser_error(error_msg: &str) -> anyhow::Error {
        let error_lower = error_msg.to_lowercase();
        
        // Non-retryable errors
        if error_lower.contains("element not found") || 
           error_lower.contains("selector") && error_lower.contains("not found") ||
           error_lower.contains("invalid selector") ||
           error_lower.contains("file not found") ||
           error_lower.contains("authentication") ||
           error_lower.contains("unauthorized") ||
           error_lower.contains("forbidden") ||
           error_lower.contains("validation") {
            anyhow::anyhow!("{}", error_msg)
        }
        // Retryable errors (network, timeout, temporary)
        else if error_lower.contains("timeout") ||
                error_lower.contains("network") ||
                error_lower.contains("connection") ||
                error_lower.contains("temporary") ||
                error_lower.contains("rate limit") ||
                error_lower.contains("503") ||
                error_lower.contains("502") ||
                error_lower.contains("504") ||
                error_lower.contains("429") {
            anyhow::anyhow!("{}", error_msg)
        }
        // Default: classify as potentially retryable
        else {
            anyhow::anyhow!("{}", error_msg)
        }
    }

    /// Helper: Substitute variables in string
    fn substitute_variables(template: &str, variables: &HashMap<String, serde_json::Value>) -> String {
        let mut result = template.to_string();
        for (key, value) in variables {
            let placeholder = format!("{{{{{}}}}}", key);
            let value_str = match value {
                serde_json::Value::String(s) => s.clone(),
                _ => value.to_string(),
            };
            result = result.replace(&placeholder, &value_str);
        }
        result
    }

    /// Helper: Substitute form values with profile data
    fn substitute_form_value(
        template: &str,
        profile: &UserProfile,
        first_name: &str,
        last_name: &str,
        variables: &HashMap<String, serde_json::Value>,
    ) -> String {
        let mut result = template.to_string();
        
        result = result.replace("{{first_name}}", first_name);
        result = result.replace("{{last_name}}", last_name);
        result = result.replace("{{full_name}}", &profile.personal_info.name);
        result = result.replace("{{email}}", &profile.personal_info.email);
        
        if let Some(phone) = &profile.personal_info.phone {
            result = result.replace("{{phone}}", phone);
        }

        // Substitute other variables
        for (key, value) in variables {
            let placeholder = format!("{{{{{}}}}}", key);
            let value_str = match value {
                serde_json::Value::String(s) => s.clone(),
                _ => value.to_string(),
            };
            result = result.replace(&placeholder, &value_str);
        }

        result
    }

    /// Create a standard workflow for a given ATS type
    pub fn create_standard_workflow(ats_type: &str) -> Workflow {
        match ats_type.to_lowercase().as_str() {
            "greenhouse" => Self::greenhouse_workflow(),
            "lever" => Self::lever_workflow(),
            "workable" => Self::workable_workflow(),
            "linkedineasyapply" => Self::linkedin_workflow(),
            _ => Self::generic_workflow(),
        }
    }

    fn greenhouse_workflow() -> Workflow {
        Workflow {
            id: "greenhouse-standard".to_string(),
            name: "Greenhouse Standard Application".to_string(),
            description: Some("Standard workflow for Greenhouse ATS applications".to_string()),
            ats_type: Some("Greenhouse".to_string()),
            initial_step_id: "navigate".to_string(),
            steps: vec![
                WorkflowStep {
                    id: "navigate".to_string(),
                    step_type: WorkflowStepType::Navigate,
                    config: HashMap::new(),
                    next_step_id: Some("fill-form".to_string()),
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(30),
                },
                WorkflowStep {
                    id: "fill-form".to_string(),
                    step_type: WorkflowStepType::FillForm,
                    config: HashMap::new(),
                    next_step_id: Some("upload-resume".to_string()),
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(60),
                },
                WorkflowStep {
                    id: "upload-resume".to_string(),
                    step_type: WorkflowStepType::UploadFile,
                    config: HashMap::new(),
                    next_step_id: Some("submit".to_string()),
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(30),
                },
                WorkflowStep {
                    id: "submit".to_string(),
                    step_type: WorkflowStepType::Click,
                    config: HashMap::new(),
                    next_step_id: Some("verify".to_string()),
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(30),
                },
                WorkflowStep {
                    id: "verify".to_string(),
                    step_type: WorkflowStepType::Verify,
                    config: HashMap::new(),
                    next_step_id: None,
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(10),
                },
            ],
            metadata: HashMap::new(),
        }
    }

    fn lever_workflow() -> Workflow {
        Self::generic_workflow() // Placeholder - same as generic for now
    }

    fn workable_workflow() -> Workflow {
        Self::generic_workflow() // Placeholder - same as generic for now
    }

    fn linkedin_workflow() -> Workflow {
        Self::generic_workflow() // Placeholder - same as generic for now
    }

    fn generic_workflow() -> Workflow {
        Workflow {
            id: "generic-standard".to_string(),
            name: "Generic Standard Application".to_string(),
            description: Some("Generic workflow for standard application forms".to_string()),
            ats_type: None,
            initial_step_id: "navigate".to_string(),
            steps: vec![
                WorkflowStep {
                    id: "navigate".to_string(),
                    step_type: WorkflowStepType::Navigate,
                    config: HashMap::new(),
                    next_step_id: Some("fill-form".to_string()),
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(30),
                },
                WorkflowStep {
                    id: "fill-form".to_string(),
                    step_type: WorkflowStepType::FillForm,
                    config: HashMap::new(),
                    next_step_id: Some("submit".to_string()),
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(60),
                },
                WorkflowStep {
                    id: "submit".to_string(),
                    step_type: WorkflowStepType::Click,
                    config: HashMap::new(),
                    next_step_id: Some("verify".to_string()),
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(30),
                },
                WorkflowStep {
                    id: "verify".to_string(),
                    step_type: WorkflowStepType::Verify,
                    config: HashMap::new(),
                    next_step_id: None,
                    failure_step_id: None,
                    retry_config: None,
                    timeout_secs: Some(10),
                },
            ],
            metadata: HashMap::new(),
        }
    }
}

impl Default for WorkflowOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}







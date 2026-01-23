//! Automation Commands for Tauri

use crate::automation::{
    AutomationConfig, AutomationOrchestrator, AutomationStatus, PipelineResult,
    AutoPilot, AutoPilotConfig, AutoPilotStatus, SchedulerStatus,
    ClassifiedEmail,
};
use crate::commands::user::load_user_profile_from_conn;
use crate::error::Result;
use crate::AppState;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

// Global orchestrator instance (lazy initialized)
static ORCHESTRATOR: once_cell::sync::OnceCell<Arc<Mutex<Option<AutomationOrchestrator>>>> =
    once_cell::sync::OnceCell::new();

// Global auto-pilot instance
static AUTOPILOT: once_cell::sync::OnceCell<Arc<Mutex<Option<AutoPilot>>>> =
    once_cell::sync::OnceCell::new();

fn get_orchestrator() -> &'static Arc<Mutex<Option<AutomationOrchestrator>>> {
    ORCHESTRATOR.get_or_init(|| Arc::new(Mutex::new(None)))
}

fn get_autopilot() -> &'static Arc<Mutex<Option<AutoPilot>>> {
    AUTOPILOT.get_or_init(|| Arc::new(Mutex::new(None)))
}

/// Initialize the automation orchestrator
#[tauri::command]
pub async fn init_automation(
    state: State<'_, AppState>,
    config: Option<AutomationConfig>,
) -> Result<bool> {
    let config = config.unwrap_or_default();
    
    let orchestrator = AutomationOrchestrator::new(
        config,
        state.db.clone(),
        state.app_dir.clone(),
    );
    
    let mut orch_guard = get_orchestrator().lock().await;
    *orch_guard = Some(orchestrator);
    
    println!("🤖 Automation orchestrator initialized");
    Ok(true)
}

/// Run the full automation pipeline once
#[tauri::command]
pub async fn run_automation_pipeline(state: State<'_, AppState>) -> Result<PipelineResult> {
    // Get user profile
    let profile = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            load_user_profile_from_conn(&conn)?
                .ok_or_else(|| anyhow::anyhow!("User profile not found. Please configure your profile in Settings."))?
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    // Get or create orchestrator
    let mut orch_guard = get_orchestrator().lock().await;
    if orch_guard.is_none() {
        let config = AutomationConfig::default();
        *orch_guard = Some(AutomationOrchestrator::new(
            config,
            state.db.clone(),
            state.app_dir.clone(),
        ));
    }

    let orchestrator = orch_guard.as_ref().unwrap();
    
    // Run pipeline
    let result = orchestrator.run_pipeline(&profile).await?;
    
    Ok(result)
}

/// Run automation with custom configuration
#[tauri::command]
pub async fn run_automation_with_config(
    state: State<'_, AppState>,
    config: AutomationConfig,
) -> Result<PipelineResult> {
    // Get user profile
    let profile = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            load_user_profile_from_conn(&conn)?
                .ok_or_else(|| anyhow::anyhow!("User profile not found"))?
        } else {
            return Err(anyhow::anyhow!("Database not initialized").into());
        }
    };

    // Create orchestrator with custom config
    let orchestrator = AutomationOrchestrator::new(
        config,
        state.db.clone(),
        state.app_dir.clone(),
    );
    
    // Run pipeline
    let result = orchestrator.run_pipeline(&profile).await?;
    
    Ok(result)
}

/// Get automation status
#[tauri::command]
pub async fn get_automation_status() -> Result<AutomationStatus> {
    let orch_guard = get_orchestrator().lock().await;
    if let Some(orchestrator) = orch_guard.as_ref() {
        Ok(orchestrator.get_status().await)
    } else {
        Ok(AutomationStatus::default())
    }
}

/// Get automation configuration
#[tauri::command]
pub async fn get_automation_config() -> Result<AutomationConfig> {
    let orch_guard = get_orchestrator().lock().await;
    if let Some(orchestrator) = orch_guard.as_ref() {
        Ok(orchestrator.get_config().await)
    } else {
        Ok(AutomationConfig::default())
    }
}

/// Update automation configuration
#[tauri::command]
pub async fn update_automation_config(config: AutomationConfig) -> Result<bool> {
    let orch_guard = get_orchestrator().lock().await;
    if let Some(orchestrator) = orch_guard.as_ref() {
        orchestrator.update_config(config).await;
        Ok(true)
    } else {
        Err(anyhow::anyhow!("Automation not initialized").into())
    }
}

/// Stop running automation
#[tauri::command]
pub async fn stop_automation() -> Result<bool> {
    let orch_guard = get_orchestrator().lock().await;
    if let Some(orchestrator) = orch_guard.as_ref() {
        orchestrator.request_stop().await;
        println!("🛑 Automation stop requested");
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Check if automation is running
#[tauri::command]
pub async fn is_automation_running() -> Result<bool> {
    let orch_guard = get_orchestrator().lock().await;
    if let Some(orchestrator) = orch_guard.as_ref() {
        Ok(orchestrator.is_running().await)
    } else {
        Ok(false)
    }
}

/// Quick start automation with sensible defaults
#[tauri::command]
pub async fn quick_start_automation(
    state: State<'_, AppState>,
    query: Option<String>,
    max_applications: Option<usize>,
    dry_run: Option<bool>,
) -> Result<PipelineResult> {
    let mut config = AutomationConfig::default();
    
    // Apply quick start options
    if let Some(q) = query {
        config.search.queries = vec![q];
    }
    
    if let Some(max) = max_applications {
        config.application.max_applications_per_run = max;
    }
    
    config.application.dry_run = dry_run.unwrap_or(true);
    
    // Run with this config
    run_automation_with_config(state, config).await
}

/// Get default automation configuration
#[tauri::command]
pub fn get_default_automation_config() -> AutomationConfig {
    AutomationConfig::default()
}

// ============================================================================
// AUTO-PILOT COMMANDS - Full end-to-end automation
// ============================================================================

/// Initialize auto-pilot mode
#[tauri::command]
pub async fn init_autopilot(
    state: State<'_, AppState>,
    config: Option<AutoPilotConfig>,
) -> Result<bool> {
    let config = config.unwrap_or_default();
    
    let autopilot = AutoPilot::new(
        config,
        state.db.clone(),
        state.app_dir.clone(),
    );
    
    // Load user profile
    let profile = {
        let db = state.db.lock().await;
        if let Some(db) = &*db {
            let conn = db.get_connection();
            load_user_profile_from_conn(&conn)?
        } else {
            None
        }
    };

    if let Some(p) = profile {
        autopilot.set_profile(p).await;
    }
    
    let mut ap_guard = get_autopilot().lock().await;
    *ap_guard = Some(autopilot);
    
    println!("🤖 Auto-pilot initialized");
    Ok(true)
}

/// Start auto-pilot mode
#[tauri::command]
pub async fn start_autopilot(state: State<'_, AppState>) -> Result<bool> {
    // Ensure initialized
    {
        let ap_guard = get_autopilot().lock().await;
        if ap_guard.is_none() {
            drop(ap_guard);
            init_autopilot(state.clone(), None).await?;
        }
    }

    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        autopilot.start().await?;
        Ok(true)
    } else {
        Err(anyhow::anyhow!("Failed to initialize auto-pilot").into())
    }
}

/// Stop auto-pilot mode
#[tauri::command]
pub async fn stop_autopilot() -> Result<bool> {
    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        autopilot.stop().await;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Get auto-pilot status
#[tauri::command]
pub async fn get_autopilot_status() -> Result<AutoPilotStatus> {
    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        Ok(autopilot.get_status().await)
    } else {
        // Return default status if not initialized
        Ok(AutoPilotStatus {
            enabled: false,
            running: false,
            mode: "Manual".to_string(),
            apply_mode: crate::automation::autopilot::ApplyModeStatus {
                id: "manual".to_string(),
                name: "Manual".to_string(),
                icon: "👁️".to_string(),
                description: "Manual Review - Browser opens, you review and submit".to_string(),
            },
            uptime_secs: 0.0,
            started_at: None,
            pipeline: crate::automation::autopilot::PipelineStatus::default(),
            scheduler: SchedulerStatus {
                enabled: false,
                running: false,
                mode: crate::automation::ScheduleMode::Manual,
                runs_today: 0,
                max_runs_per_day: 3,
                last_run: None,
                next_run: None,
                last_result_summary: None,
            },
            email_monitor: crate::automation::email_monitor::EmailMonitorStatus::default(),
            stats: crate::automation::autopilot::AutoPilotStats::default(),
            recent_activity: vec![],
            alerts: vec![],
        })
    }
}

/// Get auto-pilot configuration
#[tauri::command]
pub async fn get_autopilot_config() -> Result<AutoPilotConfig> {
    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        Ok(autopilot.get_config().await)
    } else {
        Ok(AutoPilotConfig::default())
    }
}

/// Update auto-pilot configuration
#[tauri::command]
pub async fn update_autopilot_config(config: AutoPilotConfig) -> Result<bool> {
    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        autopilot.update_config(config).await;
        Ok(true)
    } else {
        Err(anyhow::anyhow!("Auto-pilot not initialized").into())
    }
}

/// Manually trigger a pipeline run in auto-pilot
#[tauri::command]
pub async fn autopilot_run_now(state: State<'_, AppState>) -> Result<PipelineResult> {
    // Ensure initialized
    {
        let ap_guard = get_autopilot().lock().await;
        if ap_guard.is_none() {
            drop(ap_guard);
            init_autopilot(state.clone(), None).await?;
        }
    }

    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        Ok(autopilot.run_now().await?)
    } else {
        Err(anyhow::anyhow!("Auto-pilot not initialized").into())
    }
}

/// Process an email through the classifier
#[tauri::command]
pub async fn process_email(
    state: State<'_, AppState>,
    from: String,
    subject: String,
    body: String,
) -> Result<ClassifiedEmail> {
    // Ensure initialized
    {
        let ap_guard = get_autopilot().lock().await;
        if ap_guard.is_none() {
            drop(ap_guard);
            init_autopilot(state.clone(), None).await?;
        }
    }

    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        Ok(autopilot.process_email(&from, &subject, &body).await)
    } else {
        Err(anyhow::anyhow!("Auto-pilot not initialized").into())
    }
}

/// Get default auto-pilot configuration
#[tauri::command]
pub fn get_default_autopilot_config() -> AutoPilotConfig {
    AutoPilotConfig::default()
}

/// Dismiss an alert
#[tauri::command]
pub async fn dismiss_autopilot_alert(index: usize) -> Result<bool> {
    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        autopilot.dismiss_alert(index).await;
        Ok(true)
    } else {
        Ok(false)
    }
}

// ==== Apply Mode Commands ====

use crate::applicator::{ApplyMode, PreApplyCheck, ReliabilityTier};
use serde::{Deserialize, Serialize};

/// Mode info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyModeInfo {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub is_headless: bool,
    pub auto_submit: bool,
    pub requires_confirmation: bool,
    pub min_reliability: String,
}

impl From<ApplyMode> for ApplyModeInfo {
    fn from(mode: ApplyMode) -> Self {
        Self {
            id: format!("{:?}", mode).to_lowercase(),
            name: mode.name().to_string(),
            icon: mode.icon().to_string(),
            description: mode.description().to_string(),
            is_headless: mode.is_headless(),
            auto_submit: mode.auto_submit(),
            requires_confirmation: mode.requires_confirmation(),
            min_reliability: format!("{:?}", mode.minimum_reliability()),
        }
    }
}

/// Get all available apply modes
#[tauri::command]
pub fn get_apply_modes() -> Vec<ApplyModeInfo> {
    vec![
        ApplyModeInfo::from(ApplyMode::Manual),
        ApplyModeInfo::from(ApplyMode::SemiAuto),
        ApplyModeInfo::from(ApplyMode::Autopilot),
    ]
}

/// Get current apply mode
#[tauri::command]
pub async fn get_current_apply_mode() -> Result<ApplyModeInfo> {
    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        let mode = autopilot.get_apply_mode().await;
        Ok(ApplyModeInfo::from(mode))
    } else {
        // Default to Manual if not initialized
        Ok(ApplyModeInfo::from(ApplyMode::Manual))
    }
}

/// Set apply mode
#[tauri::command]
pub async fn set_apply_mode(mode: String) -> Result<ApplyModeInfo> {
    let apply_mode = match mode.to_lowercase().as_str() {
        "manual" => ApplyMode::Manual,
        "semiauto" | "semi-auto" | "semi_auto" => ApplyMode::SemiAuto,
        "autopilot" | "auto-pilot" | "auto_pilot" => ApplyMode::Autopilot,
        _ => return Err(anyhow::anyhow!("Invalid mode: {}. Use 'manual', 'semiauto', or 'autopilot'", mode).into()),
    };
    
    let ap_guard = get_autopilot().lock().await;
    if let Some(autopilot) = ap_guard.as_ref() {
        autopilot.set_apply_mode(apply_mode).await;
        println!("✅ Apply mode set to: {} {}", apply_mode.icon(), apply_mode.name());
        Ok(ApplyModeInfo::from(apply_mode))
    } else {
        // Still return the mode info even if autopilot not initialized
        println!("⚠️ Auto-pilot not initialized, mode will be applied when started: {}", apply_mode);
        Ok(ApplyModeInfo::from(apply_mode))
    }
}

/// Pre-check if a URL can be applied to with current/specified mode
#[tauri::command]
pub fn check_apply_compatibility(url: String, mode: Option<String>) -> Result<PreApplyCheckResult> {
    let apply_mode = if let Some(m) = mode {
        match m.to_lowercase().as_str() {
            "manual" => ApplyMode::Manual,
            "semiauto" | "semi-auto" | "semi_auto" => ApplyMode::SemiAuto,
            "autopilot" | "auto-pilot" | "auto_pilot" => ApplyMode::Autopilot,
            _ => ApplyMode::Manual,
        }
    } else {
        ApplyMode::Manual
    };
    
    let check = PreApplyCheck::check(&url, apply_mode);
    
    Ok(PreApplyCheckResult {
        url: check.url,
        mode: format!("{:?}", check.mode),
        ats_type: check.ats_type,
        reliability_tier: check.reliability_tier,
        can_proceed: check.can_proceed,
        reason: check.reason,
        recommended_mode: check.recommended_mode.map(|m| format!("{:?}", m).to_lowercase()),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreApplyCheckResult {
    pub url: String,
    pub mode: String,
    pub ats_type: Option<String>,
    pub reliability_tier: String,
    pub can_proceed: bool,
    pub reason: String,
    pub recommended_mode: Option<String>,
}

use crate::error::Result;
use crate::scheduler;
use crate::AppState;
use tauri::State;

use tauri::Manager;

fn get_config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| crate::error::Error::Custom(e.to_string()))?;
    Ok(app_dir.join("scheduler.json"))
}

// Scheduler Commands
#[tauri::command]
pub async fn get_scheduler_config(app: tauri::AppHandle) -> Result<scheduler::SchedulerConfig> {
    let path = get_config_path(&app)?;
    Ok(scheduler::SchedulerConfig::load_from_path(&path)?)
}

#[tauri::command]
pub async fn update_scheduler_config(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    config: scheduler::SchedulerConfig,
) -> Result<()> {
    let path = get_config_path(&app)?;
    config.save_to_path(&path)?;

    // If scheduler is running, update it
    let mut scheduler_guard = state.scheduler.lock().await;
    if let Some(scheduler) = scheduler_guard.as_mut() {
        scheduler.update_config(config).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn start_scheduler(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<String> {
    let mut scheduler_guard = state.scheduler.lock().await;

    if scheduler_guard.is_some() {
        return Ok("Scheduler is already running".to_string());
    }

    let path = get_config_path(&app)?;
    let config = scheduler::SchedulerConfig::load_from_path(&path)?;

    if !config.enabled {
        // If disabled in config but user clicked start, we should probably enable it?
        // But for now, let's respect the config. The user should have updated config first.
        // Actually, let's just warn but start it if they explicitly asked?
        // No, let's return the message. The frontend should update config before starting.
        return Ok("Scheduler is disabled in config".to_string());
    }

    // Create new scheduler
    let app_handle = std::sync::Arc::new(std::sync::Mutex::new(Some(app.clone())));
    let scheduler = scheduler::JobScheduler::new(config, state.db.clone(), app_handle);

    // Start it
    scheduler.start().await?;

    *scheduler_guard = Some(scheduler);

    Ok("Scheduler started".to_string())
}

#[tauri::command]
pub async fn stop_scheduler(state: State<'_, AppState>) -> Result<String> {
    let mut scheduler_guard = state.scheduler.lock().await;

    if let Some(scheduler) = scheduler_guard.take() {
        scheduler.stop().await?;
        Ok("Scheduler stopped".to_string())
    } else {
        Ok("Scheduler was not running".to_string())
    }
}

#[tauri::command]
pub async fn get_scheduler_status(state: State<'_, AppState>) -> Result<serde_json::Value> {
    let scheduler_guard = state.scheduler.lock().await;

    if let Some(scheduler) = scheduler_guard.as_ref() {
        Ok(scheduler.get_status().await)
    } else {
        Ok(serde_json::json!({
            "running": false,
            "status": "stopped"
        }))
    }
}

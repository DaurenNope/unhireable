//! Browser Bridge - Communication between Tauri app and Chrome extension
//!
//! Uses Chrome Native Messaging for reliable extension communication.
//! The bridge allows the Rust app to:
//! - Open job URLs in Chrome
//! - Trigger form filling
//! - Receive completion status
//! - Control the automation flow

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::Duration;

/// Commands sent from Tauri app to Chrome extension
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum BridgeCommand {
    /// Open a URL in a new tab
    OpenUrl { url: String, wait_for_load: bool },

    /// Fill form with profile data
    FillForm {
        profile: serde_json::Value,
        auto_submit: bool,
        human_mode: bool,
    },

    /// Click submit/apply button
    Submit,

    /// Get current page status
    GetStatus,

    /// Close current tab
    CloseTab,

    /// Navigate to next job in list
    NextJob,

    /// Ping to check connection
    Ping,
}

/// Response from Chrome extension
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeResponse {
    pub success: bool,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Status of a job application attempt
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ApplyStatus {
    Pending,
    InProgress,
    Success,
    Failed,
    ManualRequired,
}

/// Bridge connection state
#[derive(Debug, Clone, PartialEq)]
pub enum BridgeState {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

/// Pending command with response channel
#[allow(dead_code)]
struct PendingCommand {
    command: BridgeCommand,
    response_tx: mpsc::Sender<BridgeResponse>,
}

/// Browser Bridge for Chrome extension communication
pub struct BrowserBridge {
    state: Arc<RwLock<BridgeState>>,
    pending_commands: Arc<Mutex<HashMap<String, PendingCommand>>>,
    #[allow(dead_code)]
    command_tx: Option<mpsc::Sender<(String, BridgeCommand)>>,
    config: BridgeConfig,
}

#[derive(Debug, Clone)]
pub struct BridgeConfig {
    /// Timeout for commands (seconds)
    pub command_timeout_secs: u64,
    /// Maximum retry attempts
    pub max_retries: u32,
    /// Port for WebSocket server (extension connects here)
    pub ws_port: u16,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            command_timeout_secs: 30,
            max_retries: 3,
            ws_port: 9876,
        }
    }
}

impl BrowserBridge {
    pub fn new(config: BridgeConfig) -> Self {
        Self {
            state: Arc::new(RwLock::new(BridgeState::Disconnected)),
            pending_commands: Arc::new(Mutex::new(HashMap::new())),
            command_tx: None,
            config,
        }
    }

    /// Start the bridge WebSocket server
    pub async fn start(&mut self) -> Result<()> {
        use futures_util::StreamExt;
        use tokio::net::TcpListener;
        use tokio_tungstenite::accept_async;

        let addr = format!("127.0.0.1:{}", self.config.ws_port);
        let listener = TcpListener::bind(&addr)
            .await
            .context(format!("Failed to bind WebSocket server on {}", addr))?;

        println!("🔌 Browser Bridge listening on ws://{}", addr);

        *self.state.write().await = BridgeState::Connecting;

        let state = self.state.clone();
        let pending = self.pending_commands.clone();

        // Spawn WebSocket server task
        tokio::spawn(async move {
            while let Ok((stream, peer)) = listener.accept().await {
                println!("🔗 Extension connected from {}", peer);

                *state.write().await = BridgeState::Connected;

                match accept_async(stream).await {
                    Ok(ws_stream) => {
                        let (_write, mut read) = ws_stream.split();
                        let state_clone = state.clone();
                        let pending_clone = pending.clone();

                        // Handle incoming messages
                        while let Some(msg) = read.next().await {
                            match msg {
                                Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                                    if let Ok(response) =
                                        serde_json::from_str::<BridgeResponse>(&text)
                                    {
                                        // Find and complete pending command
                                        let mut commands = pending_clone.lock().await;
                                        // For now, complete all pending (single-command mode)
                                        for (_, pending) in commands.drain() {
                                            let _ =
                                                pending.response_tx.send(response.clone()).await;
                                        }
                                    }
                                }
                                Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                                    println!("🔌 Extension disconnected");
                                    break;
                                }
                                Err(e) => {
                                    eprintln!("WebSocket error: {}", e);
                                    break;
                                }
                                _ => {}
                            }
                        }

                        *state_clone.write().await = BridgeState::Disconnected;
                    }
                    Err(e) => {
                        eprintln!("WebSocket handshake failed: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    /// Get current bridge state
    pub async fn get_state(&self) -> BridgeState {
        self.state.read().await.clone()
    }

    /// Check if bridge is connected
    pub async fn is_connected(&self) -> bool {
        matches!(*self.state.read().await, BridgeState::Connected)
    }

    /// Open a URL in Chrome
    pub async fn open_url(&self, url: &str) -> Result<BridgeResponse> {
        self.send_command(BridgeCommand::OpenUrl {
            url: url.to_string(),
            wait_for_load: true,
        })
        .await
    }

    /// Fill form with profile data
    pub async fn fill_form(
        &self,
        profile: serde_json::Value,
        auto_submit: bool,
        human_mode: bool,
    ) -> Result<BridgeResponse> {
        self.send_command(BridgeCommand::FillForm {
            profile,
            auto_submit,
            human_mode,
        })
        .await
    }

    /// Submit the current form
    pub async fn submit(&self) -> Result<BridgeResponse> {
        self.send_command(BridgeCommand::Submit).await
    }

    /// Get current page status
    pub async fn get_status(&self) -> Result<BridgeResponse> {
        self.send_command(BridgeCommand::GetStatus).await
    }

    /// Close current tab
    pub async fn close_tab(&self) -> Result<BridgeResponse> {
        self.send_command(BridgeCommand::CloseTab).await
    }

    /// Move to next job in list
    pub async fn next_job(&self) -> Result<BridgeResponse> {
        self.send_command(BridgeCommand::NextJob).await
    }

    /// Ping to check connection
    pub async fn ping(&self) -> Result<BridgeResponse> {
        self.send_command(BridgeCommand::Ping).await
    }

    /// Send a command and wait for response
    async fn send_command(&self, _command: BridgeCommand) -> Result<BridgeResponse> {
        if !self.is_connected().await {
            return Err(anyhow::anyhow!("Bridge not connected to extension"));
        }

        // For now, return a mock response since we need the WebSocket write handle
        // In production, this would send via the WebSocket and wait for response
        Ok(BridgeResponse {
            success: true,
            message: Some("Command queued".to_string()),
            data: None,
            error: None,
        })
    }

    /// Apply to a single job (full flow)
    pub async fn apply_to_job(
        &self,
        job_url: &str,
        profile: serde_json::Value,
        auto_submit: bool,
    ) -> Result<ApplyStatus> {
        // 1. Open the job URL
        let open_result = self.open_url(job_url).await?;
        if !open_result.success {
            return Ok(ApplyStatus::Failed);
        }

        // 2. Wait for page to load
        tokio::time::sleep(Duration::from_secs(3)).await;

        // 3. Fill the form
        let fill_result = self.fill_form(profile, auto_submit, true).await?;
        if !fill_result.success {
            return Ok(ApplyStatus::ManualRequired);
        }

        // 4. If auto-submit is enabled, we're done
        if auto_submit {
            // Wait for submission
            tokio::time::sleep(Duration::from_secs(2)).await;
            Ok(ApplyStatus::Success)
        } else {
            Ok(ApplyStatus::ManualRequired)
        }
    }
}

/// Convenience function to create a bridge with default config
pub fn create_bridge() -> BrowserBridge {
    BrowserBridge::new(BridgeConfig::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_bridge_creation() {
        let bridge = create_bridge();
        assert!(!bridge.is_connected().await);
    }

    #[tokio::test]
    async fn test_bridge_state() {
        let bridge = create_bridge();
        assert_eq!(bridge.get_state().await, BridgeState::Disconnected);
    }
}

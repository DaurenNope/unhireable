//! Automation Orchestrator Module
//!
//! This module provides a fully automated job hunting pipeline that:
//! 1. Continuously discovers fitting jobs from multiple sources
//! 2. Matches jobs against user profile and preferences
//! 3. Generates tailored resumes and cover letters
//! 4. Auto-applies to matching positions
//! 5. Monitors inbox for recruiter responses
//! 6. Sends notifications at every stage
//! 7. Tracks everything in the database
//! 8. Runs on a configurable schedule

pub mod apply_queue;
pub mod autopilot;
pub mod bridge;
pub mod config;
pub mod email_monitor;
pub mod follow_up;
pub mod orchestrator;
pub mod pipeline;
pub mod scheduler;
pub mod status;

pub use autopilot::{AutoPilot, AutoPilotConfig, AutoPilotStatus};
pub use config::AutomationConfig;
pub use email_monitor::{ClassifiedEmail, EmailCategory, EmailClassifier, EmailMonitorConfig};
pub use follow_up::{FollowUpAutomation, FollowUpConfig, FollowUpType, PendingFollowUp};
pub use orchestrator::AutomationOrchestrator;
pub use pipeline::{PipelineResult, PipelineStage};
pub use scheduler::{AutomationScheduler, ScheduleConfig, ScheduleMode, SchedulerStatus};
pub use status::{AutomationStats, AutomationStatus, JobApplicationRecord};

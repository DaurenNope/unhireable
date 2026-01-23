//! Automation Scheduler
//! 
//! Runs the automation pipeline on a configurable schedule

use crate::automation::{AutomationConfig, AutomationOrchestrator, PipelineResult};
use crate::db::Database;
use crate::generator::UserProfile;
use anyhow::Result;
use chrono::{DateTime, Datelike, Duration, Local, NaiveTime, Timelike, Utc, Weekday};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration as TokioDuration};

/// Schedule configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleConfig {
    /// Whether scheduling is enabled
    pub enabled: bool,
    
    /// Run mode
    pub mode: ScheduleMode,
    
    /// Time of day to run (for daily/weekly modes)
    pub run_time: Option<String>, // "09:00" format
    
    /// Days of week to run (for weekly mode)
    pub days_of_week: Vec<String>, // ["monday", "wednesday", "friday"]
    
    /// Interval in minutes (for interval mode)
    pub interval_minutes: Option<u32>,
    
    /// Maximum runs per day
    pub max_runs_per_day: u32,
    
    /// Pause between certain hours (e.g., don't run at night)
    pub quiet_hours: Option<QuietHours>,
    
    /// Auto-pause on weekends
    pub pause_on_weekends: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ScheduleMode {
    /// Run at fixed intervals
    Interval,
    /// Run once per day at specified time
    Daily,
    /// Run on specific days of the week
    Weekly,
    /// Run continuously (with rate limiting)
    Continuous,
    /// Manual only - no automatic runs
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuietHours {
    pub start: String, // "22:00"
    pub end: String,   // "08:00"
}

impl Default for ScheduleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: ScheduleMode::Daily,
            run_time: Some("09:00".to_string()),
            days_of_week: vec![
                "monday".to_string(),
                "tuesday".to_string(),
                "wednesday".to_string(),
                "thursday".to_string(),
                "friday".to_string(),
            ],
            interval_minutes: Some(60),
            max_runs_per_day: 3,
            quiet_hours: Some(QuietHours {
                start: "22:00".to_string(),
                end: "08:00".to_string(),
            }),
            pause_on_weekends: true,
        }
    }
}

/// Automation scheduler that runs the pipeline on a schedule
pub struct AutomationScheduler {
    config: Arc<Mutex<ScheduleConfig>>,
    automation_config: Arc<Mutex<AutomationConfig>>,
    db: Arc<Mutex<Option<Database>>>,
    app_dir: Arc<Mutex<Option<std::path::PathBuf>>>,
    profile: Arc<Mutex<Option<UserProfile>>>,
    running: Arc<Mutex<bool>>,
    stop_signal: Arc<Mutex<bool>>,
    runs_today: Arc<Mutex<u32>>,
    last_run: Arc<Mutex<Option<DateTime<Utc>>>>,
    last_result: Arc<Mutex<Option<PipelineResult>>>,
}

impl AutomationScheduler {
    pub fn new(
        schedule_config: ScheduleConfig,
        automation_config: AutomationConfig,
        db: Arc<Mutex<Option<Database>>>,
        app_dir: Arc<Mutex<Option<std::path::PathBuf>>>,
    ) -> Self {
        Self {
            config: Arc::new(Mutex::new(schedule_config)),
            automation_config: Arc::new(Mutex::new(automation_config)),
            db,
            app_dir,
            profile: Arc::new(Mutex::new(None)),
            running: Arc::new(Mutex::new(false)),
            stop_signal: Arc::new(Mutex::new(false)),
            runs_today: Arc::new(Mutex::new(0)),
            last_run: Arc::new(Mutex::new(None)),
            last_result: Arc::new(Mutex::new(None)),
        }
    }

    /// Set the user profile for automation
    pub async fn set_profile(&self, profile: UserProfile) {
        *self.profile.lock().await = Some(profile);
    }

    /// Start the scheduler
    pub async fn start(&self) -> Result<()> {
        let config = self.config.lock().await.clone();
        
        if !config.enabled {
            println!("⏸️ Automation scheduler is disabled");
            return Ok(());
        }

        if self.profile.lock().await.is_none() {
            return Err(anyhow::anyhow!("User profile not set. Call set_profile first."));
        }

        *self.running.lock().await = true;
        *self.stop_signal.lock().await = false;
        
        println!("🚀 Automation scheduler started in {:?} mode", config.mode);

        match config.mode {
            ScheduleMode::Interval => self.run_interval_mode().await,
            ScheduleMode::Daily => self.run_daily_mode().await,
            ScheduleMode::Weekly => self.run_weekly_mode().await,
            ScheduleMode::Continuous => self.run_continuous_mode().await,
            ScheduleMode::Manual => {
                println!("📋 Manual mode - use run_once() to trigger");
                Ok(())
            }
        }
    }

    /// Stop the scheduler
    pub async fn stop(&self) {
        println!("🛑 Stopping automation scheduler...");
        *self.stop_signal.lock().await = true;
        *self.running.lock().await = false;
    }

    /// Run the pipeline once
    pub async fn run_once(&self) -> Result<PipelineResult> {
        let profile = self.profile.lock().await.clone()
            .ok_or_else(|| anyhow::anyhow!("User profile not set"))?;
        
        let automation_config = self.automation_config.lock().await.clone();
        
        let orchestrator = AutomationOrchestrator::new(
            automation_config,
            self.db.clone(),
            self.app_dir.clone(),
        );

        println!("\n🤖 Running automation pipeline...");
        let result = orchestrator.run_pipeline(&profile).await?;
        
        // Update tracking
        *self.last_run.lock().await = Some(Utc::now());
        *self.last_result.lock().await = Some(result.clone());
        *self.runs_today.lock().await += 1;

        Ok(result)
    }

    /// Run in interval mode
    async fn run_interval_mode(&self) -> Result<()> {
        let config = self.config.lock().await.clone();
        let interval_mins = config.interval_minutes.unwrap_or(60);
        
        println!("⏰ Running every {} minutes", interval_mins);
        
        let mut ticker = interval(TokioDuration::from_secs(interval_mins as u64 * 60));
        
        // Run immediately on start
        if let Err(e) = self.try_run().await {
            println!("⚠️ Initial run failed: {}", e);
        }

        loop {
            ticker.tick().await;
            
            if *self.stop_signal.lock().await {
                break;
            }

            if let Err(e) = self.try_run().await {
                println!("⚠️ Scheduled run failed: {}", e);
            }
        }

        Ok(())
    }

    /// Run in daily mode
    async fn run_daily_mode(&self) -> Result<()> {
        let config = self.config.lock().await.clone();
        let run_time = config.run_time.clone().unwrap_or_else(|| "09:00".to_string());
        
        println!("📅 Running daily at {}", run_time);
        
        // Check every minute for the scheduled time
        let mut ticker = interval(TokioDuration::from_secs(60));
        let mut ran_today = false;
        let mut last_date = Local::now().date_naive();

        loop {
            ticker.tick().await;
            
            if *self.stop_signal.lock().await {
                break;
            }

            let now = Local::now();
            let today = now.date_naive();
            
            // Reset ran_today flag at midnight
            if today != last_date {
                ran_today = false;
                *self.runs_today.lock().await = 0;
                last_date = today;
            }

            // Check if it's time to run
            if !ran_today && self.is_scheduled_time(&run_time) {
                if let Err(e) = self.try_run().await {
                    println!("⚠️ Daily run failed: {}", e);
                }
                ran_today = true;
            }
        }

        Ok(())
    }

    /// Run in weekly mode
    async fn run_weekly_mode(&self) -> Result<()> {
        let config = self.config.lock().await.clone();
        let run_time = config.run_time.clone().unwrap_or_else(|| "09:00".to_string());
        let days = config.days_of_week.clone();
        
        println!("📆 Running on {:?} at {}", days, run_time);
        
        let mut ticker = interval(TokioDuration::from_secs(60));
        let mut ran_today = false;
        let mut last_date = Local::now().date_naive();

        loop {
            ticker.tick().await;
            
            if *self.stop_signal.lock().await {
                break;
            }

            let now = Local::now();
            let today = now.date_naive();
            
            if today != last_date {
                ran_today = false;
                *self.runs_today.lock().await = 0;
                last_date = today;
            }

            // Check if today is a scheduled day
            let weekday = now.weekday();
            let day_name = weekday_to_string(weekday);
            
            if days.iter().any(|d| d.to_lowercase() == day_name) {
                if !ran_today && self.is_scheduled_time(&run_time) {
                    if let Err(e) = self.try_run().await {
                        println!("⚠️ Weekly run failed: {}", e);
                    }
                    ran_today = true;
                }
            }
        }

        Ok(())
    }

    /// Run in continuous mode
    async fn run_continuous_mode(&self) -> Result<()> {
        println!("🔄 Running continuously with rate limiting");
        
        // Run every 30 minutes in continuous mode
        let mut ticker = interval(TokioDuration::from_secs(30 * 60));

        loop {
            ticker.tick().await;
            
            if *self.stop_signal.lock().await {
                break;
            }

            if let Err(e) = self.try_run().await {
                println!("⚠️ Continuous run failed: {}", e);
            }
        }

        Ok(())
    }

    /// Try to run with all safety checks
    async fn try_run(&self) -> Result<PipelineResult> {
        let config = self.config.lock().await.clone();
        
        // Check max runs per day
        let runs = *self.runs_today.lock().await;
        if runs >= config.max_runs_per_day {
            println!("⏸️ Max runs per day ({}) reached", config.max_runs_per_day);
            return Err(anyhow::anyhow!("Max runs per day reached"));
        }

        // Check quiet hours
        if let Some(quiet) = &config.quiet_hours {
            if self.is_quiet_hours(quiet) {
                println!("🌙 Quiet hours active, skipping run");
                return Err(anyhow::anyhow!("Quiet hours active"));
            }
        }

        // Check weekend pause
        if config.pause_on_weekends {
            let weekday = Local::now().weekday();
            if weekday == Weekday::Sat || weekday == Weekday::Sun {
                println!("🏖️ Weekend pause active, skipping run");
                return Err(anyhow::anyhow!("Weekend pause active"));
            }
        }

        self.run_once().await
    }

    /// Check if current time matches scheduled time
    fn is_scheduled_time(&self, time_str: &str) -> bool {
        if let Ok(scheduled) = NaiveTime::parse_from_str(time_str, "%H:%M") {
            let now = Local::now().time();
            // Match within the same minute
            now.hour() == scheduled.hour() && now.minute() == scheduled.minute()
        } else {
            false
        }
    }

    /// Check if currently in quiet hours
    fn is_quiet_hours(&self, quiet: &QuietHours) -> bool {
        let now = Local::now().time();
        
        if let (Ok(start), Ok(end)) = (
            NaiveTime::parse_from_str(&quiet.start, "%H:%M"),
            NaiveTime::parse_from_str(&quiet.end, "%H:%M"),
        ) {
            if start > end {
                // Overnight quiet hours (e.g., 22:00 - 08:00)
                now >= start || now < end
            } else {
                // Same-day quiet hours
                now >= start && now < end
            }
        } else {
            false
        }
    }

    /// Get scheduler status
    pub async fn get_status(&self) -> SchedulerStatus {
        let config = self.config.lock().await.clone();
        let next_run = self.calculate_next_run(&config).await;
        SchedulerStatus {
            enabled: config.enabled,
            running: *self.running.lock().await,
            mode: config.mode,
            runs_today: *self.runs_today.lock().await,
            max_runs_per_day: config.max_runs_per_day,
            last_run: *self.last_run.lock().await,
            next_run,
            last_result_summary: self.last_result.lock().await.as_ref().map(|r| r.summary()),
        }
    }

    /// Calculate next scheduled run time
    async fn calculate_next_run(&self, config: &ScheduleConfig) -> Option<DateTime<Utc>> {
        if !config.enabled || *self.runs_today.lock().await >= config.max_runs_per_day {
            return None;
        }

        let now = Local::now();
        
        match config.mode {
            ScheduleMode::Interval => {
                let mins = config.interval_minutes.unwrap_or(60) as i64;
                Some((now + Duration::minutes(mins)).with_timezone(&Utc))
            }
            ScheduleMode::Daily => {
                if let Some(time_str) = &config.run_time {
                    if let Ok(time) = NaiveTime::parse_from_str(time_str, "%H:%M") {
                        let today_run = now.date_naive().and_time(time);
                        let run_time = if today_run > now.naive_local() {
                            today_run
                        } else {
                            today_run + Duration::days(1)
                        };
                        Some(DateTime::from_naive_utc_and_offset(run_time, Utc))
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    /// Update schedule configuration
    pub async fn update_config(&self, config: ScheduleConfig) {
        *self.config.lock().await = config;
    }

    /// Update automation configuration
    pub async fn update_automation_config(&self, config: AutomationConfig) {
        *self.automation_config.lock().await = config;
    }
}

/// Scheduler status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerStatus {
    pub enabled: bool,
    pub running: bool,
    pub mode: ScheduleMode,
    pub runs_today: u32,
    pub max_runs_per_day: u32,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: Option<DateTime<Utc>>,
    pub last_result_summary: Option<String>,
}

fn weekday_to_string(day: Weekday) -> String {
    match day {
        Weekday::Mon => "monday",
        Weekday::Tue => "tuesday",
        Weekday::Wed => "wednesday",
        Weekday::Thu => "thursday",
        Weekday::Fri => "friday",
        Weekday::Sat => "saturday",
        Weekday::Sun => "sunday",
    }.to_string()
}

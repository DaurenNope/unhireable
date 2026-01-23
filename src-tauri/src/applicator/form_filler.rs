use crate::applicator::ats_detector::{AtsDetector, AtsType, FieldSelectors};
use crate::generator::UserProfile;
use anyhow::{anyhow, Result};
use headless_chrome::{Browser, LaunchOptionsBuilder, Tab};
use serde_json::json;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::Duration;

/// Automation engine selection. Defaults to Chrome unless `JOBEZ_AUTOMATION_ENGINE=playwright`.
#[derive(Debug, Clone, Copy)]
pub enum AutomationEngine {
    Chrome,
    Playwright,
}

impl AutomationEngine {
    fn from_env() -> Self {
        match env::var("JOBEZ_AUTOMATION_ENGINE")
            .unwrap_or_else(|_| "chrome".to_string())
            .to_lowercase()
            .as_str()
        {
            "playwright" => AutomationEngine::Playwright,
            _ => AutomationEngine::Chrome,
        }
    }
}

/// Browser automation entry point.
pub struct FormFiller {
    timeout_secs: u64,
    auto_submit: bool,
    wait_for_confirmation: bool,
    engine: AutomationEngine,
}

impl FormFiller {
    pub fn new() -> Self {
        Self {
            timeout_secs: 120,
            auto_submit: false,
            wait_for_confirmation: true,
            engine: AutomationEngine::from_env(),
        }
    }

    pub fn with_timeout(mut self, timeout_secs: u64) -> Self {
        self.timeout_secs = timeout_secs;
        self
    }

    pub fn with_auto_submit(mut self, auto_submit: bool) -> Self {
        self.auto_submit = auto_submit;
        self
    }

    pub fn with_wait_for_confirmation(mut self, wait: bool) -> Self {
        self.wait_for_confirmation = wait;
        self
    }

    pub fn with_engine(mut self, engine: AutomationEngine) -> Self {
        self.engine = engine;
        self
    }

    pub async fn fill_and_submit(
        &self,
        url: &str,
        profile: &UserProfile,
        resume_path: Option<&str>,
        cover_letter_path: Option<&str>,
        ats_type: &Option<AtsType>,
    ) -> Result<()> {
        let selectors = AtsDetector::get_field_selectors(ats_type);

        let name_parts: Vec<&str> = profile.personal_info.name.split_whitespace().collect();
        let first_name = if name_parts.is_empty() {
            "".to_string()
        } else if name_parts.len() == 1 {
            // Only one name part - use it as first name
            name_parts[0].to_string()
        } else {
            name_parts[0].to_string()
        };
        let last_name = if name_parts.len() > 1 {
            name_parts[1..].join(" ")
        } else {
            "".to_string()
        };

        println!("📋 Profile data for application:");
        println!(
            "   Name: '{}' (first: '{}', last: '{}')",
            profile.personal_info.name, first_name, last_name
        );
        println!("   Email: '{}'", profile.personal_info.email);
        println!("   Phone: '{:?}'", profile.personal_info.phone);

        // Validate required profile fields
        let mut missing_fields = Vec::new();

        if profile.personal_info.name.trim().is_empty() {
            missing_fields.push("Name");
        }

        if profile.personal_info.email.trim().is_empty() {
            missing_fields.push("Email");
        } else if !profile.personal_info.email.contains('@') {
            missing_fields.push("Email (invalid format - missing @)");
        }

        if !missing_fields.is_empty() {
            return Err(anyhow::anyhow!(
                "❌ Cannot apply: Profile is missing required fields: {}\n\n\
                Please update your profile in Settings before applying:\n\
                - Go to Settings → Profile/Personal Info\n\
                - Fill in your Name and Email\n\
                - Save the profile",
                missing_fields.join(", ")
            ));
        }

        if profile.personal_info.phone.is_none()
            || profile
                .personal_info
                .phone
                .as_ref()
                .unwrap()
                .trim()
                .is_empty()
        {
            println!("⚠️  Warning: Phone number is missing. Some applications may require it.");
        }

        if first_name.is_empty() {
            println!("⚠️  Warning: First name is empty. Using full name as first name.");
        }

        let task = FormFillTask {
            url: url.to_string(),
            selectors,
            ats_type: ats_type.clone(),
            first_name,
            last_name,
            email: profile.personal_info.email.clone(),
            phone: profile.personal_info.phone.clone(),
            location: profile.personal_info.location.clone(),
            linkedin: profile.personal_info.linkedin.clone(),
            github: profile.personal_info.github.clone(),
            portfolio: profile.personal_info.portfolio.clone(),
            resume_path: resume_path.map(|s| s.to_string()),
            cover_letter_path: cover_letter_path.map(|s| s.to_string()),
            auto_submit: self.auto_submit,
            wait_for_confirmation: self.wait_for_confirmation,
            timeout: Duration::from_secs(self.timeout_secs),
        };

        match self.engine {
            AutomationEngine::Chrome => {
                tokio::task::spawn_blocking(move || run_form_fill_chrome(task)).await??;
            }
            AutomationEngine::Playwright => {
                tokio::task::spawn_blocking(move || run_form_fill_playwright(task)).await??;
            }
        }

        Ok(())
    }
}

impl Default for FormFiller {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone)]
struct FormFillTask {
    url: String,
    selectors: FieldSelectors,
    ats_type: Option<AtsType>,
    first_name: String,
    last_name: String,
    email: String,
    phone: Option<String>,
    location: Option<String>,
    linkedin: Option<String>,
    github: Option<String>,
    portfolio: Option<String>,
    resume_path: Option<String>,
    cover_letter_path: Option<String>,
    auto_submit: bool,
    wait_for_confirmation: bool,
    timeout: Duration,
}

fn run_form_fill_chrome(mut task: FormFillTask) -> Result<()> {
    println!("🧭 Launching headless Chrome to apply at {}", task.url);

    let launch_options = LaunchOptionsBuilder::default()
        .headless(!task.auto_submit)
        .window_size(Some((1280, 900)))
        .build()
        .map_err(|e| anyhow!("Failed to build Chrome launch options: {}", e))?;

    let browser = Arc::new(
        Browser::new(launch_options)
            .map_err(|e| anyhow!("Failed to launch Chrome browser: {}", e))?,
    );
    let tab = browser
        .wait_for_initial_tab()
        .map_err(|e| anyhow!("Failed to acquire initial browser tab: {}", e))?;
    tab.set_default_timeout(task.timeout);

    let backend = ChromeAutomation::new(browser, tab, task.timeout);
    run_form_fill_with_backend(&backend, &mut task)
}

fn run_form_fill_playwright(task: FormFillTask) -> Result<()> {
    println!("🧭 Launching Playwright (Node) to apply at {}", task.url);
    let script_path = write_playwright_script(&task)?;
    let project_root = find_project_root();
    let node_path = build_node_path(&project_root);

    let output = if let Some(root) = &project_root {
        std::process::Command::new("node")
            .env("NODE_PATH", &node_path)
            .current_dir(root)
            .arg(&script_path)
            .output()
            .map_err(|e| anyhow!("Failed to execute Playwright script: {}", e))?
    } else {
        std::process::Command::new("node")
            .env("NODE_PATH", &node_path)
            .arg(&script_path)
            .output()
            .map_err(|e| anyhow!("Failed to execute Playwright script: {}", e))?
    };

    if env::var("JOBEZ_KEEP_PLAYWRIGHT_SCRIPT").is_err() {
        let _ = fs::remove_file(&script_path);
    } else {
        println!(
            "⚠️  Keeping Playwright script at {} (JOBEZ_KEEP_PLAYWRIGHT_SCRIPT set)",
            script_path.display()
        );
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(anyhow!(
            "Playwright error: {}. Output: {}",
            stderr.trim(),
            stdout.trim()
        ));
    }

    Ok(())
}

#[cfg_attr(test, mockall::automock)]
trait AutomationBackend {
    fn navigate(&self, url: &str) -> Result<()>;
    fn prepare_application_page(&self, task: &mut FormFillTask) -> Result<()>;
    fn fill_text_field(&self, selectors: &[String], value: &str) -> Result<bool>;
    fn upload_file(&self, selectors: &[String], path: Option<String>, label: &str) -> Result<()>;
    fn click_submit(&self, selectors: &[String]) -> Result<()>;
    fn verify_submission(&self) -> Result<bool>;
    fn try_import_from_resume(&self) -> Result<bool>;
}

fn run_form_fill_with_backend<B: AutomationBackend>(
    backend: &B,
    task: &mut FormFillTask,
) -> Result<()> {
    backend.navigate(&task.url)?;
    backend.prepare_application_page(task)?;

    // Wait for form to be fully loaded after navigation
    println!("⏳ Waiting for form to load...");
    std::thread::sleep(Duration::from_secs(2));

    if task.auto_submit {
        println!("🤖 Auto-submit enabled (browser running headless)");
    } else {
        println!("🧑‍💻 Manual review mode: browser window left open");
    }

    println!("✏️  Starting to fill form fields...");
    use std::io::Write;
    std::io::stdout().flush().ok();

    // For Workable, try "import from resume" feature first
    let is_workable = matches!(task.ats_type, Some(AtsType::Workable));
    let imported = if is_workable && task.resume_path.is_some() {
        println!("📄 Uploading resume first for Workable import feature...");
        backend.upload_file(
            &task.selectors.resume_upload,
            task.resume_path.clone(),
            "resume",
        )?;

        // Wait a moment for the upload to process
        std::thread::sleep(Duration::from_secs(2));

        println!("🔍 Looking for 'Import from resume' button...");
        match backend.try_import_from_resume() {
            Ok(true) => {
                println!("✅ Successfully used 'Import from resume' feature!");
                std::thread::sleep(Duration::from_secs(3)); // Wait for fields to populate
                true
            }
            Ok(false) => {
                println!(
                    "ℹ️  'Import from resume' not found or not available, filling manually..."
                );
                false
            }
            Err(e) => {
                println!(
                    "⚠️  Error trying import from resume: {}. Filling manually...",
                    e
                );
                false
            }
        }
    } else {
        false
    };

    // Fill text fields (only if not imported, or fill missing fields after import)
    if !imported {
        println!("🔍 Attempting to fill first name: '{}'", task.first_name);
        backend.fill_text_field(&task.selectors.first_name, &task.first_name)?;
        backend.fill_text_field(&task.selectors.last_name, &task.last_name)?;
        backend.fill_text_field(&task.selectors.email, &task.email)?;

        if let Some(phone) = task.phone.as_deref() {
            backend.fill_text_field(&task.selectors.phone, phone)?;
        }
        if let Some(location) = task.location.as_deref() {
            backend.fill_text_field(&task.selectors.location, location)?;
        }
        if let Some(linkedin) = task.linkedin.as_deref() {
            backend.fill_text_field(&task.selectors.linkedin, linkedin)?;
        }
        if let Some(github) = task.github.as_deref() {
            backend.fill_text_field(&task.selectors.github, github)?;
        }
        if let Some(portfolio) = task.portfolio.as_deref() {
            backend.fill_text_field(&task.selectors.portfolio, portfolio)?;
        }
    } else {
        // After import, check and fill only empty fields
        println!("🔍 Checking which fields need manual filling after import...");
        backend.fill_text_field(&task.selectors.first_name, &task.first_name)?;
        backend.fill_text_field(&task.selectors.last_name, &task.last_name)?;
        backend.fill_text_field(&task.selectors.email, &task.email)?;

        if let Some(phone) = task.phone.as_deref() {
            backend.fill_text_field(&task.selectors.phone, phone)?;
        }
        if let Some(location) = task.location.as_deref() {
            backend.fill_text_field(&task.selectors.location, location)?;
        }
        if let Some(linkedin) = task.linkedin.as_deref() {
            backend.fill_text_field(&task.selectors.linkedin, linkedin)?;
        }
        if let Some(github) = task.github.as_deref() {
            backend.fill_text_field(&task.selectors.github, github)?;
        }
        if let Some(portfolio) = task.portfolio.as_deref() {
            backend.fill_text_field(&task.selectors.portfolio, portfolio)?;
        }
    }

    // Upload resume if not already uploaded (for non-Workable or if import failed)
    // For LinkedIn, the "Next" button click will be handled in the Playwright script
    if !is_workable || !imported {
        backend.upload_file(
            &task.selectors.resume_upload,
            task.resume_path.clone(),
            "resume",
        )?;
    }
    backend.upload_file(
        &task.selectors.cover_letter_upload,
        task.cover_letter_path.clone(),
        "cover letter",
    )?;

    if task.auto_submit {
        backend.click_submit(&task.selectors.submit_button)?;
        std::thread::sleep(Duration::from_secs(3));
        println!("⌛ Waiting for submission confirmation...");

        // Verify the application was actually submitted
        let verified = backend.verify_submission()?;
        if verified {
            println!("✅ Application submitted successfully! Verified by page content.");
        } else {
            println!("⚠️  Submission clicked but verification unclear. Check manually.");
        }
    } else {
        println!("ℹ️  Auto-submit disabled. Please review the form manually.");
    }

    Ok(())
}

struct ChromeAutomation {
    browser: Arc<Browser>,
    active_tab: RwLock<Arc<Tab>>,
    timeout: Duration,
}

impl ChromeAutomation {
    fn new(browser: Arc<Browser>, tab: Arc<Tab>, timeout: Duration) -> Self {
        Self {
            browser,
            active_tab: RwLock::new(tab),
            timeout,
        }
    }

    fn current_tab(&self) -> Result<Arc<Tab>> {
        self.ensure_active_tab()?;
        Ok(self
            .active_tab
            .read()
            .map_err(|_| anyhow!("Tab lock poisoned"))?
            .clone())
    }

    fn ensure_active_tab(&self) -> Result<()> {
        if let Ok(current_guard) = self.active_tab.read() {
            let tab = current_guard.clone();
            drop(current_guard);
            if tab.evaluate("1", false).is_ok() {
                return Ok(());
            }
        }

        let tabs_arc = self.browser.get_tabs();
        let tabs_guard = tabs_arc
            .lock()
            .map_err(|_| anyhow!("Failed to lock browser tabs"))?;
        for candidate in tabs_guard.iter() {
            if candidate.evaluate("1", false).is_ok() {
                *self
                    .active_tab
                    .write()
                    .map_err(|_| anyhow!("Tab lock poisoned"))? = candidate.clone();
                return Ok(());
            }
        }

        Err(anyhow!(
            "Chrome tab connection lost and no alternative tab available."
        ))
    }
}

impl AutomationBackend for ChromeAutomation {
    fn navigate(&self, url: &str) -> Result<()> {
        let tab = self.current_tab()?;
        tab.navigate_to(url)
            .map_err(|e| anyhow!("Failed to navigate to job URL: {}", e))?;
        tab.wait_until_navigated()
            .map_err(|e| anyhow!("Navigation did not finish in time: {}", e))?;
        Ok(())
    }

    fn prepare_application_page(&self, task: &mut FormFillTask) -> Result<()> {
        let tab = self.current_tab()?;
        let current_url = tab.get_url();
        println!("📍 Current URL before preparation: {}", current_url);

        self.dismiss_known_modals()?;

        // Special handling for LinkedIn Easy Apply
        if matches!(task.ats_type, Some(AtsType::LinkedInEasyApply)) {
            return self.prepare_linkedin_easy_apply(task);
        }

        // Click the primary Apply button first
        println!("🔍 Looking for primary Apply button...");
        let clicked = self.try_primary_apply_cta()?;
        if clicked {
            println!("🖱️  Primary Apply button clicked, waiting for Remotive to open new page...");
            std::thread::sleep(Duration::from_secs(3));

            // After clicking, Remotive opens a new tab/window. Switch to it.
            self.switch_to_new_tab_if_needed()?;
        }

        // Now extract ATS URLs from the new page and navigate
        self.handle_remotive_handshake()?;

        // After navigation, re-detect ATS from the final URL and update selectors
        let tab = self.current_tab()?;
        let final_url = tab.get_url();
        println!("📍 Final URL after handshake: {}", final_url);

        let detected_ats = AtsDetector::detect_ats(&final_url);
        if detected_ats != task.ats_type {
            if let Some(ref ats) = detected_ats {
                println!("🔍 Re-detected ATS from final URL: {:?}", ats);
            } else {
                println!("ℹ️  No specific ATS detected from final URL, falling back to generic.");
            }
            task.selectors = AtsDetector::get_field_selectors(&detected_ats);
            task.ats_type = detected_ats;
        }
        task.url = final_url;

        // Wait a bit for the form to render (especially for React-based forms like Workable)
        println!("⏳ Waiting for form to render...");
        std::thread::sleep(Duration::from_secs(2));

        // Verify we can see form elements and log their structure
        let check_script = r#"
            (function() {
                try {
                    const inputs = Array.from(document.querySelectorAll('input, textarea'));
                    const info = inputs.map(el => {
                        const obj = {
                            tag: el.tagName.toLowerCase(),
                            type: el.type || 'text',
                            name: el.name || '',
                            id: el.id || '',
                            dataQa: el.getAttribute('data-qa') || '',
                            placeholder: el.placeholder || ''
                        };
                        return obj;
                    });
                    return { count: inputs.length, inputs: info };
                } catch (e) {
                    return { error: e.toString(), count: 0, inputs: [] };
                }
            })();
        "#;
        match tab.evaluate(check_script, false) {
            Ok(result) => {
                if let Some(value) = result.value {
                    if let Some(err) = value.get("error").and_then(|v| v.as_str()) {
                        println!("⚠️  Error inspecting form: {}", err);
                    } else {
                        if let Some(count) = value.get("count").and_then(|v| v.as_u64()) {
                            println!("📋 Found {} form inputs/textarea elements on page", count);
                        }
                        if let Some(inputs) = value.get("inputs").and_then(|v| v.as_array()) {
                            println!("🔍 Form field details (first 10):");
                            for (idx, input) in inputs.iter().take(10).enumerate() {
                                if let Some(obj) = input.as_object() {
                                    let name =
                                        obj.get("name").and_then(|v| v.as_str()).unwrap_or("");
                                    let id = obj.get("id").and_then(|v| v.as_str()).unwrap_or("");
                                    let data_qa =
                                        obj.get("dataQa").and_then(|v| v.as_str()).unwrap_or("");
                                    let placeholder = obj
                                        .get("placeholder")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("");
                                    println!(
                                        "  {}: name='{}' id='{}' data-qa='{}' placeholder='{}'",
                                        idx + 1,
                                        name,
                                        id,
                                        data_qa,
                                        placeholder
                                    );
                                }
                            }
                        }
                    }
                } else {
                    println!("⚠️  No result from form inspection script");
                }
            }
            Err(e) => {
                println!("⚠️  Failed to evaluate form inspection script: {}", e);
            }
        }

        Ok(())
    }

    fn fill_text_field(&self, selectors: &[String], value: &str) -> Result<bool> {
        if value.trim().is_empty() {
            return Ok(false);
        }

        // First try direct selectors (fast path)
        let selector_timeout = Duration::from_secs(2).min(self.timeout);
        for selector in selectors {
            let tab = self.current_tab()?;
            if let Ok(element) =
                tab.wait_for_element_with_custom_timeout(selector, selector_timeout)
            {
                element.click().ok();
                let _ = element.call_js_fn("function(){ this.value=''; }", false);
                if element.type_into(value).is_ok() {
                    let _ = element.call_js_fn(
                        "function(){ \
                            this.dispatchEvent(new Event('input', { bubbles: true })); \
                            this.dispatchEvent(new Event('change', { bubbles: true })); \
                        }",
                        false,
                    );
                    println!("✏️  Filled field via selector '{}'", selector);
                    return Ok(true);
                }
            }
        }

        // Fallback: Use JavaScript to find field by name/label/placeholder
        // Determine field type from value and selectors
        let is_email = value.contains('@');
        let is_phone = value.chars().any(|c| c.is_ascii_digit());
        let selector_hints: Vec<&str> = selectors
            .iter()
            .flat_map(|s| s.split(&['[', ']', '=', ' ', '#', '.']))
            .filter(|s| !s.is_empty())
            .collect();
        let looks_like_first = selector_hints.iter().any(|s| s.contains("first"));
        let looks_like_last = selector_hints.iter().any(|s| s.contains("last"));
        let looks_like_email = selector_hints.iter().any(|s| s.contains("email"));
        let looks_like_phone = selector_hints.iter().any(|s| s.contains("phone"));

        let js_fill = format!(
            r#"
            (function() {{
                const value = '{}';
                const isEmail = {};
                const isPhone = {};
                const matchFirst = {};
                const matchLast = {};
                const matchEmail = {};
                const matchPhone = {};
                
                const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea'));
                
                for (const input of inputs) {{
                    if (input.type === 'file' || input.type === 'hidden' || input.disabled) continue;
                    
                    const name = (input.name || '').toLowerCase();
                    const id = (input.id || '').toLowerCase();
                    const placeholder = (input.placeholder || '').toLowerCase();
                    
                    // Find label
                    let labelText = '';
                    const label = input.closest('label') || document.querySelector(`label[for="${{input.id}}"]`);
                    if (label) labelText = label.textContent?.toLowerCase() || '';
                    
                    // Find nearby text
                    const parent = input.closest('div, fieldset, form');
                    const nearbyText = parent?.textContent?.toLowerCase() || '';
                    
                    let shouldFill = false;
                    
                    if (matchFirst && (name.includes('first') || id.includes('first') || placeholder.includes('first') || 
                        labelText.includes('first name') || nearbyText.includes('first name'))) {{
                        shouldFill = !isEmail && !isPhone;
                    }}
                    else if (matchLast && (name.includes('last') || id.includes('last') || placeholder.includes('last') || 
                        labelText.includes('last name') || nearbyText.includes('last name'))) {{
                        shouldFill = !isEmail && !isPhone;
                    }}
                    else if (matchEmail && (name.includes('email') || id.includes('email') || placeholder.includes('email') || 
                        labelText.includes('email') || nearbyText.includes('email') || input.type === 'email')) {{
                        shouldFill = isEmail;
                    }}
                    else if (matchPhone && (name.includes('phone') || id.includes('phone') || placeholder.includes('phone') || 
                        labelText.includes('phone') || input.type === 'tel')) {{
                        shouldFill = isPhone;
                    }}
                    else if (isEmail && (name.includes('email') || id.includes('email') || input.type === 'email')) {{
                        shouldFill = true;
                    }}
                    else if (isPhone && (name.includes('phone') || id.includes('phone') || input.type === 'tel')) {{
                        shouldFill = true;
                    }}
                    
                    if (shouldFill && (!input.value || input.value.trim() === '')) {{
                        input.focus();
                        input.value = value;
                        input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        input.dispatchEvent(new Event('blur', {{ bubbles: true }}));
                        return true;
                    }}
                }}
                return false;
            }})();
        "#,
            value.replace("'", "\\'").replace("\\", "\\\\"),
            is_email,
            is_phone,
            looks_like_first,
            looks_like_last,
            looks_like_email,
            looks_like_phone
        );

        let tab = self.current_tab()?;
        if let Ok(result) = tab.evaluate(&js_fill, false) {
            if let Some(success) = result.value.and_then(|v| v.as_bool()) {
                if success {
                    println!("✏️  Filled field via JavaScript pattern matching");
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    fn upload_file(&self, selectors: &[String], path: Option<String>, label: &str) -> Result<()> {
        let path_string = match path {
            Some(p) if !p.is_empty() => p,
            _ => return Ok(()),
        };
        let file_path = Path::new(&path_string);

        if !file_path.exists() {
            println!("⚠️  {} file not found at {}", label, file_path.display());
            return Ok(());
        }

        let absolute = Path::new(&path_string)
            .canonicalize()
            .unwrap_or_else(|_| Path::new(&path_string).to_path_buf())
            .to_string_lossy()
            .to_string();

        // First, try direct selectors (quick timeout)
        let quick_timeout = Duration::from_secs(2);
        for selector in selectors {
            let tab = self.current_tab()?;
            if let Ok(element) = tab.wait_for_element_with_custom_timeout(selector, quick_timeout) {
                let refs: Vec<&str> = vec![absolute.as_str()];
                if element.set_input_files(&refs).is_ok() {
                    println!("📤 Uploaded {} via {}", label, selector);
                    return Ok(());
                }
            }
        }

        // Fallback: try generic file input
        let tab = self.current_tab()?;
        if let Ok(element) =
            tab.wait_for_element_with_custom_timeout("input[type='file']", quick_timeout)
        {
            let refs: Vec<&str> = vec![absolute.as_str()];
            if element.set_input_files(&refs).is_ok() {
                println!("📤 Uploaded {} via generic file input", label);
                return Ok(());
            }
        }

        // If direct selectors failed, try JavaScript-based approach for Workable drop zones
        // Workable often uses hidden file inputs that need to be triggered via drop zone click
        let tab = self.current_tab()?;
        let js_find_and_upload = format!(
            r#"
            (function() {{
                // Try to find file input by various means
                let fileInput = null;
                
                // First, try direct selectors
                const selectors = [
                    'input[type="file"][name*="resume"]',
                    'input[type="file"][name*="{}"]',
                    'input[type="file"]',
                    'div[data-qa="resume"] input[type="file"]',
                    'div[data-qa="{}"] input[type="file"]'
                ];
                
                for (const sel of selectors) {{
                    const el = document.querySelector(sel);
                    if (el) {{
                        fileInput = el;
                        break;
                    }}
                }}
                
                // If not found, try to find via label or drop zone
                if (!fileInput) {{
                    const labels = document.querySelectorAll('label');
                    for (const label of labels) {{
                        const text = (label.textContent || '').toLowerCase();
                        if (text.includes('resume') || text.includes('{}')) {{
                            const input = label.querySelector('input[type="file"]');
                            if (input) {{
                                fileInput = input;
                                break;
                            }}
                        }}
                    }}
                }}
                
                // Try clicking drop zone to reveal hidden input
                if (!fileInput) {{
                    const dropZones = document.querySelectorAll('div[data-qa*="resume"], div[data-qa*="{}"], div:has(input[type="file"])');
                    for (const zone of dropZones) {{
                        zone.click();
                        const input = zone.querySelector('input[type="file"]');
                        if (input) {{
                            fileInput = input;
                            break;
                        }}
                    }}
                }}
                
                if (fileInput) {{
                    // Make sure it's visible and enabled
                    fileInput.style.display = 'block';
                    fileInput.style.visibility = 'visible';
                    fileInput.style.opacity = '1';
                    fileInput.removeAttribute('hidden');
                    fileInput.removeAttribute('disabled');
                    return true;
                }}
                return false;
            }})();
            "#,
            label.to_lowercase(),
            label.to_lowercase(),
            label.to_lowercase(),
            label.to_lowercase()
        );

        // Try to reveal the file input via JavaScript
        match tab.evaluate(&js_find_and_upload, false) {
            Ok(result) => {
                if let Some(value) = result.value {
                    if let Some(found) = value.as_bool() {
                        if found {
                            println!("🔍 Found file input via JavaScript, attempting upload...");
                            std::thread::sleep(Duration::from_millis(500)); // Give DOM time to update
                                                                            // Now try the generic selector again
                            let tab = self.current_tab()?;
                            match tab.wait_for_element_with_custom_timeout(
                                "input[type='file']",
                                self.timeout,
                            ) {
                                Ok(element) => {
                                    let refs: Vec<&str> = vec![absolute.as_str()];
                                    element.set_input_files(&refs).map_err(|e| {
                                        anyhow!(
                                            "Failed to upload {} after revealing input: {}",
                                            label,
                                            e
                                        )
                                    })?;
                                    println!("📤 Uploaded {} via revealed file input", label);
                                    return Ok(());
                                }
                                Err(_) => {}
                            }
                        }
                    }
                }
            }
            Err(_) => {}
        }

        println!(
            "⚠️  Could not find file input for {}. Selectors tried: {:?}",
            label, selectors
        );
        Ok(())
    }

    fn click_submit(&self, selectors: &[String]) -> Result<()> {
        for selector in selectors {
            let tab = self.current_tab()?;
            match tab.wait_for_element_with_custom_timeout(selector, self.timeout) {
                Ok(element) => {
                    element
                        .click()
                        .map_err(|e| anyhow!("Failed to click submit using {}: {}", selector, e))?;
                    println!("🚀 Submitted using {}", selector);
                    return Ok(());
                }
                Err(_) => continue,
            }
        }

        Err(anyhow!(
            "Unable to locate submit button. Selectors tried: {:?}",
            selectors
        ))
    }

    fn try_import_from_resume(&self) -> Result<bool> {
        let tab = self.current_tab()?;

        // Use JavaScript to find and click the "Import from resume" button in Workable forms
        let find_import_script = r#"
            (function() {
                // Look for buttons/links with text containing "import" and "resume"
                const allElements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                
                for (const el of allElements) {
                    const text = (el.textContent || el.innerText || '').toLowerCase();
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                    const title = (el.getAttribute('title') || '').toLowerCase();
                    const combined = text + ' ' + ariaLabel + ' ' + title;
                    
                    // Check if it mentions both "import" and "resume"
                    if ((combined.includes('import') && combined.includes('resume')) ||
                        (combined.includes('fill') && combined.includes('resume')) ||
                        (combined.includes('extract') && combined.includes('resume'))) {
                        
                        // Make sure it's visible
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            return {
                                found: true,
                                tag: el.tagName.toLowerCase(),
                                text: el.textContent || '',
                                id: el.id || '',
                                className: el.className || ''
                            };
                        }
                    }
                }
                
                // Also check data-qa attributes (Workable uses these)
                const dataQaElements = Array.from(document.querySelectorAll('[data-qa*="import"], [data-qa*="resume"]'));
                for (const el of dataQaElements) {
                    const dataQa = (el.getAttribute('data-qa') || '').toLowerCase();
                    if (dataQa.includes('import') || (dataQa.includes('resume') && el.tagName.toLowerCase() === 'button')) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            return {
                                found: true,
                                tag: el.tagName.toLowerCase(),
                                text: el.textContent || '',
                                id: el.id || '',
                                className: el.className || '',
                                dataQa: dataQa
                            };
                        }
                    }
                }
                
                return { found: false };
            })();
        "#;

        match tab.evaluate(find_import_script, false) {
            Ok(result) => {
                if let Some(value) = result.value {
                    if let Some(found) = value.get("found").and_then(|v| v.as_bool()) {
                        if found {
                            // Found the button, now click it
                            let click_script = r#"
                                (function() {
                                    const allElements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                                    
                                    for (const el of allElements) {
                                        const text = (el.textContent || el.innerText || '').toLowerCase();
                                        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                                        const title = (el.getAttribute('title') || '').toLowerCase();
                                        const combined = text + ' ' + ariaLabel + ' ' + title;
                                        
                                        if ((combined.includes('import') && combined.includes('resume')) ||
                                            (combined.includes('fill') && combined.includes('resume')) ||
                                            (combined.includes('extract') && combined.includes('resume'))) {
                                            const rect = el.getBoundingClientRect();
                                            if (rect.width > 0 && rect.height > 0) {
                                                el.click();
                                                return true;
                                            }
                                        }
                                    }
                                    
                                    // Try data-qa selectors
                                    const dataQaElements = Array.from(document.querySelectorAll('[data-qa*="import"], [data-qa*="resume"]'));
                                    for (const el of dataQaElements) {
                                        const dataQa = (el.getAttribute('data-qa') || '').toLowerCase();
                                        if (dataQa.includes('import') || (dataQa.includes('resume') && el.tagName.toLowerCase() === 'button')) {
                                            const rect = el.getBoundingClientRect();
                                            if (rect.width > 0 && rect.height > 0) {
                                                el.click();
                                                return true;
                                            }
                                        }
                                    }
                                    
                                    return false;
                                })();
                            "#;

                            match tab.evaluate(click_script, false) {
                                Ok(click_result) => {
                                    if let Some(clicked) =
                                        click_result.value.and_then(|v| v.as_bool())
                                    {
                                        if clicked {
                                            println!("🖱️  Clicked 'Import from resume' button");
                                            return Ok(true);
                                        }
                                    }
                                }
                                Err(e) => {
                                    println!("⚠️  Error clicking import button: {}", e);
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                println!("⚠️  Error searching for import button: {}", e);
            }
        }

        Ok(false)
    }

    fn verify_submission(&self) -> Result<bool> {
        let tab = self.current_tab()?;
        let final_url = tab.get_url();

        // Check URL for success indicators
        let url_lower = final_url.to_lowercase();
        if url_lower.contains("success")
            || url_lower.contains("thank")
            || url_lower.contains("confirmation")
            || url_lower.contains("submitted")
        {
            println!("✅ URL indicates success: {}", final_url);
            return Ok(true);
        }

        // Check page content for success messages
        let check_script = r#"
            (function() {
                const bodyText = document.body?.textContent?.toLowerCase() || '';
                const pageText = document.documentElement?.textContent?.toLowerCase() || '';
                const allText = bodyText + ' ' + pageText;
                
                // Look for success indicators
                const successKeywords = [
                    'thank you', 'application received', 'submitted successfully',
                    'we received your application', 'confirmation', 'success',
                    'your application has been', 'application submitted'
                ];
                
                for (const keyword of successKeywords) {
                    if (allText.includes(keyword)) {
                        return true;
                    }
                }
                
                // Check if form is still present (indicates failure)
                const forms = document.querySelectorAll('form');
                if (forms.length > 0) {
                    // Form still exists - might not have submitted
                    return false;
                }
                
                // Check for error messages
                const errorKeywords = ['error', 'required', 'invalid', 'please fill', 'missing'];
                for (const keyword of errorKeywords) {
                    if (allText.includes(keyword) && allText.includes('field')) {
                        return false;
                    }
                }
                
                // Ambiguous - return false to be safe
                return false;
            })();
        "#;

        match tab.evaluate(check_script, false) {
            Ok(result) => {
                if let Some(success) = result.value.and_then(|v| v.as_bool()) {
                    if success {
                        println!("✅ Page content indicates successful submission");
                        return Ok(true);
                    } else {
                        println!("⚠️  Page content suggests submission may have failed");
                        return Ok(false);
                    }
                }
            }
            Err(e) => {
                println!("⚠️  Could not verify submission: {}", e);
            }
        }

        // If we can't determine, check if URL changed (might indicate navigation to success page)
        if !final_url.contains("apply") && !final_url.contains("form") {
            println!(
                "✅ URL changed significantly, likely submitted: {}",
                final_url
            );
            return Ok(true);
        }

        Ok(false)
    }
}

impl ChromeAutomation {
    fn dismiss_known_modals(&self) -> Result<()> {
        const DISMISS_SELECTORS: &[&str] = &[
            "button:has-text(\"No thanks\")",
            "button:has-text(\"Maybe later\")",
            "button:has-text(\"Skip\")",
            "[data-testid='close-button']",
            ".modal [aria-label='Close']",
            ".modal button[aria-label='Close']",
            ".ReactModal__Content button.close",
            ".dialog button[aria-label='Dismiss']",
            "#onetrust-accept-btn-handler",
        ];

        for selector in DISMISS_SELECTORS {
            let tab = self.current_tab()?;
            if let Ok(element) =
                tab.wait_for_element_with_custom_timeout(selector, Duration::from_secs(2))
            {
                let _ = element.click();
                std::thread::sleep(Duration::from_millis(250));
            }
        }
        Ok(())
    }

    fn try_primary_apply_cta(&self) -> Result<bool> {
        if self.try_click_via_script(
            "(() => {
                const primary = document.querySelector('a[onclick*=\"processApplyClick\"], a.remotive-btn-chocolate');
                if (primary) {
                    primary.scrollIntoView({ block: 'center', behavior: 'instant' });
                    primary.click();
                    return true;
                }
                return false;
            })();",
            "Remotive primary Apply CTA",
        )? {
            std::thread::sleep(Duration::from_secs(2));
            return Ok(true);
        }

        if self.try_click_via_script(
            "(() => {
                const buttons = Array.from(document.querySelectorAll('a, button'));
                for (const el of buttons) {
                    const text = (el.innerText || '').trim().toLowerCase();
                    if (!text) continue;
                    if (text.includes('apply') || text.includes('apply now')) {
                        el.scrollIntoView({ block: 'center', behavior: 'instant' });
                        el.click();
                        return true;
                    }
                }
                return false;
            })();",
            "generic Apply button",
        )? {
            std::thread::sleep(Duration::from_secs(2));
            return Ok(true);
        }

        Ok(false)
    }

    fn switch_to_new_tab_if_needed(&self) -> Result<()> {
        // First check if current tab navigated (same tab, new URL)
        let current_tab = self.current_tab()?;
        let current_url = current_tab.get_url();

        // If we're already on job-copilot or a different remotive page, we're good
        if current_url.contains("/job-copilot") || current_url.contains("remotive.com/job-copilot")
        {
            println!("✅ Already on Remotive intermediate page: {}", current_url);
            return Ok(());
        }

        // Otherwise, check for new tabs
        let tabs_arc = self.browser.get_tabs();
        let tabs_guard = tabs_arc
            .lock()
            .map_err(|_| anyhow!("Failed to lock browser tabs"))?;

        if tabs_guard.len() > 1 {
            // Find the tab that's not the current one and has a different URL
            for candidate in tabs_guard.iter() {
                if Arc::ptr_eq(candidate, &current_tab) {
                    continue; // Skip the current tab
                }

                let candidate_url = candidate.get_url();
                // If this tab has a different URL (especially if it's remotive.com/job-copilot or similar)
                if candidate_url != current_url {
                    println!("🔄 Switching to new tab: {}", candidate_url);
                    *self
                        .active_tab
                        .write()
                        .map_err(|_| anyhow!("Tab lock poisoned"))? = candidate.clone();
                    std::thread::sleep(Duration::from_secs(1));
                    return Ok(());
                }
            }
        }

        Ok(())
    }

    fn handle_remotive_handshake(&self) -> Result<()> {
        let mut attempts = 0;
        loop {
            let tab = self.current_tab()?;
            let current_url = tab.get_url();
            println!(
                "🔎 Remotive handshake pass {} at {}",
                attempts + 1,
                current_url
            );

            if !current_url.contains("remotive.com") {
                println!("✅ Left Remotive, continuing.");
                return Ok(());
            }

            if current_url.contains("/job-copilot") {
                println!("🪄 Inside job-copilot flow.");
                if self.handle_job_copilot_page()? {
                    attempts += 1;
                    continue;
                }
            }

            if let Some(urls) = self.extract_application_urls()? {
                for url in urls {
                    if url.trim().is_empty() {
                        continue;
                    }
                    println!("🔀 Navigating to application URL candidate: {}", url);
                    let tab = self.current_tab()?;
                    if let Err(err) = tab.navigate_to(&url) {
                        println!("⚠️  Failed to navigate to candidate {}: {}", url, err);
                        continue;
                    }
                    if let Err(err) = tab.wait_until_navigated() {
                        println!("⚠️  Navigation to {} did not finish: {}", url, err);
                        continue;
                    }
                    std::thread::sleep(Duration::from_secs(2));
                    let new_url = tab.get_url();
                    println!("↷ Landed on {}", new_url);
                    if !new_url.contains("remotive.com") {
                        println!("✅ Candidate succeeded, exiting handshake.");
                        return Ok(());
                    }
                }
            }

            println!("ℹ️  Trying secondary CTA selectors.");
            self.try_secondary_apply_cta()?;
            self.dismiss_known_modals()?;
            attempts += 1;
            if attempts >= 4 {
                break;
            }
            std::thread::sleep(Duration::from_secs(2));
        }

        Err(anyhow!(
            "Still on Remotive after apply flow; unable to locate ATS form."
        ))
    }

    fn extract_application_urls(&self) -> Result<Option<Vec<String>>> {
        let tab = self.current_tab()?;
        let script = r#"
            (() => {
                const candidates = new Set();

                const anchors = Array.from(document.querySelectorAll('a[href]'));
                for (const link of anchors) {
                    const href = link.href || '';
                    const text = (link.innerText || '').toLowerCase();
                    if (
                        href.includes('greenhouse') ||
                        href.includes('lever.co') ||
                        href.includes('myworkdayjobs') ||
                        href.includes('apply') && !href.includes('remotive')
                    ) {
                        candidates.add(href);
                    }
                    if (
                        (text.includes('apply') || text.includes('continue')) &&
                        href.startsWith('http') &&
                        !href.includes('remotive')
                    ) {
                        candidates.add(href);
                    }
                }

                const buttons = Array.from(document.querySelectorAll('button, a'));
                for (const el of buttons) {
                    const onclick = el.getAttribute('onclick') || '';
                    if (onclick.includes('greenhouse') || onclick.includes('lever')) {
            const match = onclick.match(/https?:\/\/[^\s"']+/);
                        if (match) candidates.add(match[0]);
                    }
                }

                const iframes = Array.from(document.querySelectorAll('iframe[src]'));
                for (const iframe of iframes) {
                    const src = iframe.getAttribute('src') || '';
                    if (
                        src.includes('greenhouse') ||
                        src.includes('lever.co') ||
                        (src.includes('apply') && !src.includes('remotive'))
                    ) {
                        if (src.startsWith('http')) {
                            candidates.add(src);
        } else {
                            const origin = window.location.origin;
                            candidates.add(origin + (src.startsWith('/') ? src : '/' + src));
                        }
                    }
                }

                return Array.from(candidates);
            })();
        "#;

        let result = tab.evaluate(script, false).map_err(|e| {
            anyhow!(
                "Failed to evaluate application URL extraction script: {}",
                e
            )
        })?;

        if let Some(value) = result.value {
            let mut urls: Vec<String> =
                serde_json::from_value(value).unwrap_or_else(|_| Vec::new());
            urls.retain(|url| !url.trim().is_empty());
            if !urls.is_empty() {
                println!("🧭 Extracted candidate URLs: {:?}", urls);
                return Ok(Some(urls));
            }
        }

        println!("ℹ️  No application URLs discovered on this pass.");
        Ok(None)
    }

    fn try_secondary_apply_cta(&self) -> Result<()> {
        if self.try_click_via_script(
            "(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                for (const link of anchors) {
                    const href = link.getAttribute('href') || '';
                    if (!href) continue;
                    if (
                        href.includes('greenhouse') ||
                        href.includes('lever.co') ||
                        href.includes('myworkdayjobs') ||
                        (href.includes('apply') && !href.includes('remotive'))
                    ) {
                        link.scrollIntoView({ block: 'center', behavior: 'instant' });
                        link.click();
                        return true;
                    }
                }
                return false;
            })();",
            "Remotive secondary ATS link",
        )? {
            std::thread::sleep(Duration::from_secs(2));
            return Ok(());
        }

        if self.try_click_via_script(
            "(() => {
                const buttons = Array.from(document.querySelectorAll('a, button'));
                for (const el of buttons) {
                    const text = (el.innerText || '').toLowerCase();
                    if (!text) continue;
                    if (text.includes('continue') || text.includes('skip')) {
                        el.scrollIntoView({ block: 'center', behavior: 'instant' });
                        el.click();
                        return true;
                    }
                }
                return false;
            })();",
            "generic Continue/Skip button",
        )? {
            std::thread::sleep(Duration::from_secs(2));
            return Ok(());
        }

        Ok(())
    }

    fn handle_job_copilot_page(&self) -> Result<bool> {
        let tab = self.current_tab()?;
        let url = tab.get_url();
        if !url.contains("remotive.com/job-copilot") {
            return Ok(false);
        }

        if let Some(urls) = self.extract_application_urls()? {
            for url in urls {
                if url.contains("remotive.com") {
                    continue;
                }
                println!("🪄 Remotive job-copilot candidate: {}", url);
                let tab = self.current_tab()?;
                if let Err(err) = tab.navigate_to(&url) {
                    println!(
                        "⚠️  Failed to follow job-copilot candidate {}: {}",
                        url, err
                    );
                    continue;
                }
                if let Err(err) = tab.wait_until_navigated() {
                    println!("⚠️  Navigation after job-copilot candidate failed: {}", err);
                    continue;
                }
                std::thread::sleep(Duration::from_secs(2));
                let new_url = tab.get_url();
                println!("↷ Landed on {}", new_url);
                if !new_url.contains("remotive.com") {
                    return Ok(true);
                }
            }
        }

        const CONTINUE_SELECTORS: &[&str] = &[
            "button:has-text('Continue')",
            "a:has-text('Continue')",
            "button:has-text('Skip this step')",
            "button:has-text('Go to application')",
        ];

        for selector in CONTINUE_SELECTORS {
            if let Ok(element) = self
                .current_tab()?
                .wait_for_element_with_custom_timeout(selector, Duration::from_secs(3))
            {
                if element.click().is_ok() {
                    println!("👉 Clicked job-copilot continue button: {}", selector);
                    std::thread::sleep(Duration::from_secs(2));
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    fn try_click_via_script(&self, script: &str, description: &str) -> Result<bool> {
        let tab = self.current_tab()?;
        let result = tab
            .evaluate(script, false)
            .map_err(|e| anyhow!("Failed to run click script for {}: {}", description, e))?;
        if let Some(value) = result.value {
            if let Ok(clicked) = serde_json::from_value::<bool>(value) {
                if clicked {
                    println!("🖱️  Clicked {} via script", description);
                }
                return Ok(clicked);
            }
        }
        Ok(false)
    }

    /// Special handling for LinkedIn Easy Apply
    fn prepare_linkedin_easy_apply(&self, _task: &mut FormFillTask) -> Result<()> {
        let tab = self.current_tab()?;
        println!("🔗 Preparing LinkedIn Easy Apply form...");

        // Dismiss any modals first
        self.dismiss_known_modals()?;

        // Look for "Easy Apply" button on the job page
        let easy_apply_script = r#"
            (function() {
                // Look for Easy Apply button
                const buttons = Array.from(document.querySelectorAll('button, a'));
                for (const btn of buttons) {
                    const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    
                    if (text.includes('easy apply') || ariaLabel.includes('easy apply') ||
                        text.includes('apply now') || ariaLabel.includes('apply now')) {
                        // Check if it's visible
                        const rect = btn.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            btn.scrollIntoView({ block: 'center', behavior: 'instant' });
                            btn.click();
                            return true;
                        }
                    }
                }
                
                // Also check for data attributes LinkedIn uses
                const dataButtons = document.querySelectorAll('[data-test-modal-trigger], [data-control-name="job_apply"]');
                for (const btn of dataButtons) {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        btn.scrollIntoView({ block: 'center', behavior: 'instant' });
                        btn.click();
                        return true;
                    }
                }
                
                return false;
            })();
        "#;

        match tab.evaluate(easy_apply_script, false) {
            Ok(result) => {
                if let Some(value) = result.value {
                    if let Ok(clicked) = serde_json::from_value::<bool>(value) {
                        if clicked {
                            println!("✅ Clicked LinkedIn Easy Apply button");
                            std::thread::sleep(Duration::from_secs(3)); // Wait for modal to open
                        } else {
                            println!(
                                "⚠️  Easy Apply button not found - may already be on form page"
                            );
                        }
                    }
                }
            }
            Err(e) => {
                println!("⚠️  Error looking for Easy Apply button: {}", e);
            }
        }

        // Wait for the Easy Apply modal to fully load
        std::thread::sleep(Duration::from_secs(2));

        // Check if we're in a modal and need to navigate through steps
        let check_modal_script = r#"
            (function() {
                // LinkedIn Easy Apply uses a multi-step modal
                // Check if we're in step 1 (contact info) or later
                const modals = document.querySelectorAll('[role="dialog"], .jobs-easy-apply-modal, [data-test-modal]');
                if (modals.length > 0) {
                    // Check for "Next" or "Continue" button (means we're on step 1)
                    const nextButtons = Array.from(document.querySelectorAll('button'));
                    for (const btn of nextButtons) {
                        const text = (btn.innerText || '').toLowerCase();
                        if (text.includes('next') || text.includes('continue')) {
                            return { inModal: true, step: 1, hasNext: true };
                        }
                    }
                    return { inModal: true, step: 2, hasNext: false };
                }
                return { inModal: false, step: 0, hasNext: false };
            })();
        "#;

        match tab.evaluate(check_modal_script, false) {
            Ok(result) => {
                if let Some(value) = result.value {
                    if let Some(in_modal) = value.get("inModal").and_then(|v| v.as_bool()) {
                        if in_modal {
                            if let Some(step) = value.get("step").and_then(|v| v.as_u64()) {
                                println!("📋 LinkedIn Easy Apply modal detected - Step {}", step);
                            }
                        }
                    }
                }
            }
            Err(_) => {}
        }

        // Wait for form fields to be ready
        std::thread::sleep(Duration::from_secs(1));

        Ok(())
    }
}

fn write_playwright_script(task: &FormFillTask) -> Result<PathBuf> {
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join(format!(
        "apply_job_{}_playwright.js",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    ));

    let text_fields = json!([
        {
            "selectors": task.selectors.first_name,
            "value": task.first_name
        },
        {
            "selectors": task.selectors.last_name,
            "value": task.last_name
        },
        {
            "selectors": task.selectors.email,
            "value": task.email
        },
        {
            "selectors": task.selectors.phone,
            "value": task.phone
        },
        {
            "selectors": task.selectors.location,
            "value": task.location
        },
        {
            "selectors": task.selectors.linkedin,
            "value": task.linkedin
        },
        {
            "selectors": task.selectors.github,
            "value": task.github
        },
        {
            "selectors": task.selectors.portfolio,
            "value": task.portfolio
        }
    ]);

    let file_fields = json!([
        {
            "selectors": task.selectors.resume_upload,
            "file": task.resume_path
        },
        {
            "selectors": task.selectors.cover_letter_upload,
            "file": task.cover_letter_path
        }
    ]);

    let submit_fields = json!(task.selectors.submit_button);

    let script = format!(
        r###"
const {{ chromium }} = require('playwright');

const APPLY_CTA_SELECTORS = [
                    "a:has-text('Apply')",
                    "a:has-text('Apply now')",
                    "a:has-text('Apply on company site')",
                    "button:has-text('Apply')",
                    "button:has-text('Apply now')",
    ".listing-cta a[href*='apply']",
    "[data-testid='apply-button']",
    "a.apply-now",
    "button.apply-btn"
];

const SECONDARY_APPLY_SELECTORS = [
    "a[href*='greenhouse']",
    "a[href*='lever.co']",
    "a[href*='myworkdayjobs']",
    "a[href*='apply']:not([href*='remotive'])",
    "button:has-text('Continue')",
    "a:has-text('Continue')",
    "button:has-text('Skip')",
    "a:has-text('Skip to application')"
];

const MODAL_DISMISS_SELECTORS = [
    "button:has-text('No thanks')",
    "button:has-text('Maybe later')",
    "button:has-text('Skip')",
    "[data-testid='close-button']",
    ".modal [aria-label='Close']",
    ".modal button[aria-label='Close']",
    ".ReactModal__Content button.close",
    ".dialog button[aria-label='Dismiss']",
    "#onetrust-accept-btn-handler"
];

const OTP_SELECTORS = [
    "input[name*='verification_code']",
    "input[name*='verification']",
    "input[name*='code']",
    "input[type='text'][placeholder*='code']",
    "input[type='text'][placeholder*='Code']",
    "input[id='verification_code']",
    "input[id='code']",
    "input[name='verification_code']"
];

async function dismissBlockingPopups(page) {{
    for (const selector of MODAL_DISMISS_SELECTORS) {{
                    try {{
            const element = await page.$(selector);
            if (element) {{
                await element.click();
                await page.waitForTimeout(250);
            }}
        }} catch (_) {{}}
    }}
}}

async function clickPrimaryCTA(page) {{
    for (const selector of APPLY_CTA_SELECTORS) {{
                    try {{
            const element = await page.$(selector);
            if (element) {{
                await element.click();
                await page.waitForTimeout(1500);
                                return true;
            }}
        }} catch (_) {{}}
                            }}
                            return false;
}}

async function extractApplicationUrls(page) {{
    const urls = await page.evaluate(() => {{
        const candidates = new Set();

        const anchors = Array.from(document.querySelectorAll('a[href]'));
        for (const link of anchors) {{
            const href = link.href || '';
            const text = (link.innerText || '').toLowerCase();
            if (
                href.includes('greenhouse') ||
                href.includes('lever.co') ||
                href.includes('myworkdayjobs') ||
                (href.includes('apply') && !href.includes('remotive'))
            ) {{
                candidates.add(href);
            }}
            if (
                (text.includes('apply') || text.includes('continue')) &&
                href.startsWith('http') &&
                !href.includes('remotive')
            ) {{
                candidates.add(href);
            }}
        }}

        const buttons = Array.from(document.querySelectorAll('button, a'));
        for (const el of buttons) {{
            const onclick = el.getAttribute('onclick') || '';
            if (onclick.includes('greenhouse') || onclick.includes('lever')) {{
            const match = onclick.match(/https?:\/\/[^\s"']+/);
                if (match) candidates.add(match[0]);
            }}
        }}

        const iframes = Array.from(document.querySelectorAll('iframe[src]'));
        for (const iframe of iframes) {{
            let src = iframe.getAttribute('src') || '';
            if (
                src.includes('greenhouse') ||
                src.includes('lever.co') ||
                (src.includes('apply') && !src.includes('remotive'))
            ) {{
                if (!src.startsWith('http')) {{
                    const origin = window.location.origin;
                    src = origin + (src.startsWith('/') ? src : '/' + src);
                }}
                candidates.add(src);
            }}
        }}

        return Array.from(candidates);
    }});

    return urls || [];
}}

async function ensureApplicationPage(page) {{
    const currentUrl = page.url();
    if (!currentUrl.includes('remotive.com')) {{
        return;
    }}

    const urls = await extractApplicationUrls(page);
    for (const url of urls) {{
                            try {{
            console.log(`Navigating to application URL: ${{url}}`);
            await page.goto(url, {{ waitUntil: 'domcontentloaded' }});
            await page.waitForTimeout(1500);
            if (!page.url().includes('remotive.com')) {{
                return;
            }}
        }} catch (err) {{
            console.warn('Failed to navigate to candidate URL', url, err?.message || err);
        }}
    }}

    if (page.url().includes('remotive.com')) {{
        throw new Error('Still on Remotive after Apply flow; unable to locate ATS form.');
    }}
}}

async function handleGreenhouseEmail(page, email) {{
    if (!email) return false;
    for (const selector of [
        "input[name*='email']",
        "input[type='email']",
        "input[id*='email']",
        "#email"
    ]) {{
                        try {{
            const field = await page.$(selector);
            if (field) {{
                const current = (await field.inputValue()) || '';
                if (!current || current.length < 3) {{
                    await field.fill(email);
                    await page.waitForTimeout(500);
                    for (const submit of [
                        "button[type='submit']",
                        "button:has-text('Continue')",
                        "button:has-text('Send code')",
                        "input[type='submit']"
                    ]) {{
                        try {{
                            const btn = await page.$(submit);
                            if (btn) {{
                                await btn.click();
                                await page.waitForTimeout(1500);
                                return true;
                            }}
                        }} catch (_) {{}}
                        }}
                    return true;
                }}
            }}
        }} catch (_) {{}}
                    }}
                    return false;
                }}
                
async function handleGreenhouseOTP(page) {{
    for (const selector of OTP_SELECTORS) {{
        try {{
            const field = await page.$(selector);
            if (field) {{
                console.log('🔐 GREENHOUSE OTP DETECTED');
                console.log('⚠️  Please enter the OTP code manually in the browser.');
                let elapsed = 0;
                while (elapsed < 300000) {{
                    const value = await field.inputValue();
                    if (value && value.length >= 6) {{
                        console.log('✅ OTP code entered, waiting for navigation...');
                        await page.waitForTimeout(1500);
                        return;
                    }}
                    await page.waitForTimeout(2000);
                    elapsed += 2000;
                }}
                console.log('⏰ OTP wait timeout after 5 minutes.');
            }}
        }} catch (_) {{}}
    }}
}}

async function fillField(page, field) {{
    if (!field.value) return;
    for (const selector of field.selectors || []) {{
                        try {{
            const element = await page.$(selector);
            if (element) {{
                await element.fill(field.value);
                // Trigger input events for React-based forms
                await element.evaluate(el => {{
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                }});
                console.log(`Filled ${{selector}}`);
                break;
            }}
        }} catch (_) {{}}
    }}
}}

async function handleLinkedInNext(page) {{
    // LinkedIn Easy Apply requires clicking "Next" after filling contact info
    try {{
        const buttons = await page.$$('button');
        for (const btn of buttons) {{
            const text = (await btn.textContent()) || '';
            const ariaLabel = (await btn.getAttribute('aria-label')) || '';
            const textLower = text.toLowerCase();
            const ariaLower = ariaLabel.toLowerCase();
            
            if ((textLower.includes('next') || textLower.includes('continue')) && 
                !textLower.includes('submit') && !ariaLower.includes('submit')) {{
                const isVisible = await btn.isVisible();
                const isEnabled = await btn.isEnabled();
                if (isVisible && isEnabled) {{
                    await btn.scrollIntoViewIfNeeded();
                    await btn.click();
                    console.log('➡️  Clicked LinkedIn "Next" button');
                    await page.waitForTimeout(2000);
                    return true;
                }}
            }}
        }}
    }} catch (err) {{
        console.warn('Error clicking LinkedIn Next button:', err?.message || err);
    }}
    return false;
}}

async function uploadFile(page, field) {{
    if (!field.file) return;
    for (const selector of field.selectors || []) {{
        try {{
            const element = await page.$(selector);
            if (element) {{
                await element.setInputFiles(field.file);
                console.log(`Uploaded file via ${{selector}}`);
                break;
            }}
        }} catch (_) {{}}
    }}
}}

async function clickSubmit(page, selectors) {{
    for (const selector of selectors || []) {{
        try {{
            const element = await page.$(selector);
            if (element) {{
                await element.click();
                console.log(`Clicked submit: ${{selector}}`);
                return true;
            }}
        }} catch (_) {{}}
    }}

    for (const selector of SECONDARY_APPLY_SELECTORS) {{
        try {{
            const element = await page.$(selector);
            if (element) {{
                await element.click();
                console.log(`Clicked secondary CTA: ${{selector}}`);
                await page.waitForTimeout(1500);
                return true;
            }}
        }} catch (_) {{}}
    }}
    return false;
}}

(async () => {{
    const isHeadless = {headless};
    console.log('🌐 Browser mode: ' + (isHeadless ? 'HEADLESS (invisible)' : 'VISIBLE (you can watch!)'));
    
    const browser = await chromium.launch({{
        headless: isHeadless,
        slowMo: isHeadless ? 0 : 150  // Slow down actions when visible so you can see them
    }});
    const context = await browser.newContext();
    const page = await context.newPage();
                
                try {{
        await page.goto({url}, {{ waitUntil: 'domcontentloaded' }});
        await page.waitForTimeout(1200);

        await dismissBlockingPopups(page);
        const clicked = await clickPrimaryCTA(page);
        if (!clicked) {{
            console.log('No primary Apply CTA found; continuing anyway.');
        }}
        await ensureApplicationPage(page);

        await handleGreenhouseEmail(page, {profile_email});

        const textFields = {text_fields};
        for (const field of textFields) {{
            await fillField(page, field);
        }}

        // For LinkedIn Easy Apply, click "Next" after filling contact info
        const isLinkedIn = page.url().includes('linkedin.com');
        if (isLinkedIn) {{
            await handleLinkedInNext(page);
        }}

        const fileFields = {file_fields};
        for (const field of fileFields) {{
            await uploadFile(page, field);
        }}

        if ({auto_submit}) {{
            const submitted = await clickSubmit(page, {submit_fields});
            if (!submitted) {{
                throw new Error('Submit button not found');
            }}
            await handleGreenhouseOTP(page);
            if ({wait_for_confirmation}) {{
                            await page.waitForTimeout(3000);
                        }}
                    }} else {{
            console.log('🔍 AUTO-SUBMIT DISABLED - Keeping browser open for 30 seconds so you can see the filled form!');
            console.log('📝 Look at the form fields - they should be filled with your data.');
                        await page.waitForTimeout(30000);
            console.log('⏰ Time is up - closing browser now.');
                    }}

                    console.log('SUCCESS');
    }} catch (err) {{
        console.error('ERROR', err.message || err);
                        process.exit(1);
                }} finally {{
        await browser.close();
    }}
}})();
    "###,
        headless = if task.auto_submit { "true" } else { "false" },
        url = serde_json::to_string(&task.url)?,
        text_fields = serde_json::to_string(&text_fields)?,
        file_fields = serde_json::to_string(&file_fields)?,
        submit_fields = serde_json::to_string(&submit_fields)?,
        profile_email = serde_json::to_string(&task.email)?,
        auto_submit = if task.auto_submit { "true" } else { "false" },
        wait_for_confirmation = if task.wait_for_confirmation {
            "true"
        } else {
            "false"
        }
    );

    fs::write(&script_path, script)?;
    Ok(script_path)
}

fn find_project_root() -> Option<PathBuf> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let path = Path::new(manifest_dir);
    path.parent().map(|p| p.to_path_buf())
}

fn build_node_path(project_root: &Option<PathBuf>) -> String {
    let mut parts = Vec::new();

    if let Some(root) = project_root {
        let node_modules = root.join("node_modules");
        if node_modules.exists() {
            parts.push(node_modules.to_string_lossy().to_string());
        }
    }

    if let Ok(home) = env::var("HOME") {
        let user_global = format!("{}/.npm-global/lib/node_modules", home);
        if Path::new(&user_global).exists() {
            parts.push(user_global);
        }
    }

    parts.push("/opt/homebrew/lib/node_modules".to_string());

    parts.join(":")
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::eq;

    fn base_task() -> FormFillTask {
        FormFillTask {
            url: "https://example.com/apply".to_string(),
            selectors: FieldSelectors::generic(),
            ats_type: None,
            first_name: "Alice".to_string(),
            last_name: "Smith".to_string(),
            email: "alice@example.com".to_string(),
            phone: None,
            location: None,
            linkedin: None,
            github: None,
            portfolio: None,
            resume_path: None,
            cover_letter_path: None,
            auto_submit: true,
            wait_for_confirmation: false,
            timeout: Duration::from_secs(30),
        }
    }

    #[test]
    fn orchestrates_required_fields_and_submit() {
        let task = base_task();
        let mut mock = MockAutomationBackend::new();

        mock.expect_navigate()
            .with(eq(task.url.clone()))
            .times(1)
            .returning(|_| Ok(()));

        let url_clone = task.url.clone();
        mock.expect_prepare_application_page()
            .withf(move |t| t.url == url_clone)
            .times(1)
            .returning(|_| Ok(()));

        let first_selectors = task.selectors.first_name.clone();
        let first_value = task.first_name.clone();
        mock.expect_fill_text_field()
            .withf(move |selectors, value| selectors == &first_selectors && value == first_value)
            .times(1)
            .returning(|_, _| Ok(true));

        let last_selectors = task.selectors.last_name.clone();
        let last_value = task.last_name.clone();
        mock.expect_fill_text_field()
            .withf(move |selectors, value| selectors == &last_selectors && value == last_value)
            .times(1)
            .returning(|_, _| Ok(true));

        let email_selectors = task.selectors.email.clone();
        let email_value = task.email.clone();
        mock.expect_fill_text_field()
            .withf(move |selectors, value| selectors == &email_selectors && value == email_value)
            .times(1)
            .returning(|_, _| Ok(true));

        let resume_selectors = task.selectors.resume_upload.clone();
        mock.expect_upload_file()
            .withf(move |selectors, path, label| {
                selectors == &resume_selectors && path.is_none() && label == "resume"
            })
            .times(1)
            .returning(|_, _, _| Ok(()));

        let cover_selectors = task.selectors.cover_letter_upload.clone();
        mock.expect_upload_file()
            .withf(move |selectors, path, label| {
                selectors == &cover_selectors && path.is_none() && label == "cover letter"
            })
            .times(1)
            .returning(|_, _, _| Ok(()));

        let submit_selectors = task.selectors.submit_button.clone();
        mock.expect_click_submit()
            .withf(move |selectors| selectors == &submit_selectors)
            .times(1)
            .returning(|_| Ok(()));

        mock.expect_verify_submission()
            .times(1)
            .returning(|| Ok(true));

        let mut task_mut = task;
        let result = run_form_fill_with_backend(&mock, &mut task_mut);
        assert!(result.is_ok());
    }

    #[test]
    fn optional_fields_are_filled_when_present() {
        let mut task = base_task();
        task.phone = Some("555-0101".into());
        task.location = Some("Planet Earth".into());
        task.linkedin = Some("https://linkedin.com/in/alice".into());
        task.github = Some("https://github.com/alice".into());
        task.portfolio = Some("https://alice.dev".into());

        let mut mock = MockAutomationBackend::new();
        mock.expect_navigate()
            .with(eq(task.url.clone()))
            .times(1)
            .returning(|_| Ok(()));

        let url_clone = task.url.clone();
        mock.expect_prepare_application_page()
            .withf(move |t| t.url == url_clone)
            .times(1)
            .returning(|_| Ok(()));

        let mut expected_calls = vec![
            (task.selectors.first_name.clone(), task.first_name.clone()),
            (task.selectors.last_name.clone(), task.last_name.clone()),
            (task.selectors.email.clone(), task.email.clone()),
            (task.selectors.phone.clone(), task.phone.clone().unwrap()),
            (
                task.selectors.location.clone(),
                task.location.clone().unwrap(),
            ),
            (
                task.selectors.linkedin.clone(),
                task.linkedin.clone().unwrap(),
            ),
            (task.selectors.github.clone(), task.github.clone().unwrap()),
            (
                task.selectors.portfolio.clone(),
                task.portfolio.clone().unwrap(),
            ),
        ];

        for (selectors, value) in expected_calls.drain(..) {
            mock.expect_fill_text_field()
                .withf(move |s, v| s == &selectors && v == value)
                .times(1)
                .returning(|_, _| Ok(true));
        }

        mock.expect_upload_file()
            .times(2)
            .returning(|_, _, _| Ok(()));

        let submit_selectors = task.selectors.submit_button.clone();
        mock.expect_click_submit()
            .withf(move |selectors| selectors == &submit_selectors)
            .times(1)
            .returning(|_| Ok(()));

        mock.expect_verify_submission()
            .times(1)
            .returning(|| Ok(true));

        let mut task_mut = task;
        let result = run_form_fill_with_backend(&mock, &mut task_mut);
        assert!(result.is_ok());
    }

    #[test]
    fn skip_submit_when_auto_submit_disabled() {
        let mut task = base_task();
        task.auto_submit = false;

        let mut mock = MockAutomationBackend::new();
        mock.expect_navigate()
            .with(eq(task.url.clone()))
            .times(1)
            .returning(|_| Ok(()));

        let url_clone = task.url.clone();
        mock.expect_prepare_application_page()
            .withf(move |t| t.url == url_clone)
            .times(1)
            .returning(|_| Ok(()));

        mock.expect_fill_text_field()
            .returning(|_, _| Ok(true))
            .times(3);

        mock.expect_upload_file()
            .times(2)
            .returning(|_, _, _| Ok(()));

        mock.expect_click_submit().times(0).returning(|_| Ok(()));

        let result = run_form_fill_with_backend(&mock, &mut task);
        assert!(result.is_ok());
    }
}

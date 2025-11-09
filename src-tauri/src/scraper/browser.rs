// Browser-based scraping using Playwright or headless Chrome
// This provides an open-source alternative to Firecrawl for JavaScript-rendered pages

use anyhow::{Result, Context, anyhow};
use std::process::Command;

#[derive(Debug, Clone)]
pub enum BrowserType {
    Playwright,
    Chromium, // Headless Chrome/Chromium
}

#[derive(Debug, Clone)]
pub struct BrowserScraper {
    browser_type: BrowserType,
    timeout_secs: u64,
    headless: bool,
}

impl BrowserScraper {
    pub fn new() -> Self {
        Self {
            browser_type: BrowserType::Playwright, // Default to Playwright
            timeout_secs: 60,
            headless: true,
        }
    }

    pub fn with_playwright() -> Self {
        Self {
            browser_type: BrowserType::Playwright,
            timeout_secs: 60,
            headless: true,
        }
    }

    pub fn with_timeout(mut self, timeout_secs: u64) -> Self {
        self.timeout_secs = timeout_secs;
        self
    }

    pub fn with_headless(mut self, headless: bool) -> Self {
        self.headless = headless;
        self
    }

    /// Check if Playwright is installed
    pub fn is_playwright_available() -> bool {
        Command::new("playwright")
            .arg("--version")
            .output()
            .is_ok()
    }

    /// Check if Chromium/Chrome is available
    pub fn is_chromium_available() -> bool {
        // Try common Chrome/Chromium paths
        let paths = [
            "chromium",
            "chromium-browser",
            "google-chrome",
            "chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ];

        for path in &paths {
            if Command::new(path)
                .arg("--version")
                .output()
                .is_ok()
            {
                return true;
            }
        }
        false
    }

    /// Scrape a URL using browser automation
    pub fn scrape(&self, url: &str) -> Result<String> {
        match self.browser_type {
            BrowserType::Playwright => self.scrape_with_playwright(url),
            BrowserType::Chromium => self.scrape_with_chromium(url),
        }
    }

    /// Scrape using Playwright (requires Playwright to be installed)
    fn scrape_with_playwright(&self, url: &str) -> Result<String> {
        // Create a temporary JavaScript file to run Playwright
        let script = format!(
            r#"
            const {{ chromium }} = require('playwright');
            
            (async () => {{
                const browser = await chromium.launch({{
                    headless: {},
                    timeout: {}
                }});
                const page = await browser.newPage();
                
                // Set a realistic viewport
                await page.setViewportSize({{ width: 1920, height: 1080 }});
                
                // Set user agent
                await page.setExtraHTTPHeaders({{
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }});
                
                // Navigate to the page
                await page.goto('{}', {{ waitUntil: 'networkidle', timeout: {} }});
                
                // Wait a bit for JavaScript to render
                await page.waitForTimeout(2000);
                
                // Get the HTML content
                const html = await page.content();
                console.log(html);
                
                await browser.close();
            }})();
            "#,
            self.headless,
            self.timeout_secs * 1000,
            url,
            self.timeout_secs * 1000
        );

        // Write script to temp file
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let script_path = temp_dir.join(format!("playwright_scrape_{}.js", timestamp));
        std::fs::write(&script_path, script)
            .context("Failed to write Playwright script")?;

        // Run Playwright
        let output = Command::new("node")
            .arg(&script_path)
            .output()
            .context("Failed to execute Playwright. Make sure Node.js and Playwright are installed.")?;

        // Clean up
        let _ = std::fs::remove_file(&script_path);

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("Playwright error: {}", error));
        }

        let html = String::from_utf8(output.stdout)
            .context("Failed to parse Playwright output")?;

        Ok(html)
    }

    /// Scrape using headless Chrome/Chromium
    fn scrape_with_chromium(&self, url: &str) -> Result<String> {
        // Find Chrome/Chromium executable
        let chrome_path = Self::find_chrome_executable()
            .ok_or_else(|| anyhow!("Chrome/Chromium not found"))?;

        // Run headless Chrome
        let output = Command::new(&chrome_path)
            .args(&[
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-software-rasterizer",
                "--disable-extensions",
                "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                &format!("--timeout={}", self.timeout_secs * 1000),
                &format!("--dump-dom"),
                url,
            ])
            .output()
            .context("Failed to execute Chrome/Chromium")?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("Chrome error: {}", error));
        }

        let html = String::from_utf8(output.stdout)
            .context("Failed to parse Chrome output")?;

        Ok(html)
    }

    fn find_chrome_executable() -> Option<String> {
        let paths = [
            "chromium",
            "chromium-browser",
            "google-chrome",
            "chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ];

        for path in &paths {
            if Command::new(path)
                .arg("--version")
                .output()
                .is_ok()
            {
                return Some(path.to_string());
            }
        }
        None
    }

    /// Scrape with human-like delays and behavior
    /// Note: Delays are applied in the calling function (LinkedIn scraper)
    pub fn scrape_with_delays(&self, url: &str, _min_delay_secs: u64, _max_delay_secs: u64) -> Result<String> {
        self.scrape(url)
    }
}

// Future: Use headless_chrome crate (Rust-native, no Node.js required)
// This would be a better option for pure Rust implementation
// Currently using Playwright/Chrome command-line as it's more reliable

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_browser_availability() {
        println!("Playwright available: {}", BrowserScraper::is_playwright_available());
        println!("Chromium available: {}", BrowserScraper::is_chromium_available());
    }
}


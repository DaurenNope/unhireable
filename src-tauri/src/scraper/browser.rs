// Browser-based scraping using Playwright or headless Chrome
// This provides an open-source alternative to Firecrawl for JavaScript-rendered pages

use anyhow::{anyhow, Context, Result};
use serde_json::{Map, Value};
use std::process::Command;

#[derive(Debug, Clone)]
pub enum BrowserType {
    Playwright,
    Chromium, // Headless Chrome/Chromium
    Crawl4AI, // Python-based crawl4ai library
}

#[derive(Debug, Clone)]
pub struct BrowserScraper {
    browser_type: BrowserType,
    timeout_secs: u64,
    headless: bool,
    extra_headers: Vec<(String, String)>,
}

impl BrowserScraper {
    pub fn new() -> Self {
        Self {
            browser_type: BrowserType::Playwright, // Default to Playwright
            timeout_secs: 90, // Increased for heavy sites like Indeed/Wellfound
            headless: true,
            extra_headers: Vec::new(),
        }
    }

    pub fn with_playwright() -> Self {
        Self {
            browser_type: BrowserType::Playwright,
            timeout_secs: 90, // Increased for heavy sites
            headless: true,
            extra_headers: Vec::new(),
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

    pub fn with_header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.extra_headers.push((key.into(), value.into()));
        self
    }

    pub fn with_headers<I, K, V>(mut self, headers: I) -> Self
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        for (k, v) in headers {
            self.extra_headers.push((k.into(), v.into()));
        }
        self
    }

    pub fn with_cookie_header(self, cookie: impl Into<String>) -> Self {
        self.with_header("Cookie", cookie)
    }

    /// Check if Playwright is installed
    pub fn is_playwright_available() -> bool {
        Command::new("playwright").arg("--version").output().is_ok()
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
            if Command::new(path).arg("--version").output().is_ok() {
                return true;
            }
        }
        false
    }

    /// Check if crawl4ai is installed (Python package)
    /// Note: crawl4ai requires Python 3.10+ due to union type syntax
    pub fn is_crawl4ai_available() -> bool {
        // First check Python version (crawl4ai needs 3.10+)
        let python_version_check = |cmd: &str| -> bool {
            if let Ok(output) = Command::new(cmd).arg("--version").output() {
                if let Ok(version_str) = String::from_utf8(output.stdout) {
                    // Extract version number (e.g., "Python 3.10.0" -> 3.10)
                    if let Some(version_part) = version_str.split_whitespace().nth(1) {
                        if let Some(major_minor) = version_part
                            .split('.')
                            .take(2)
                            .collect::<Vec<_>>()
                            .join(".")
                            .parse::<f64>()
                            .ok()
                        {
                            if major_minor >= 3.10 {
                                // Check if crawl4ai can be imported (with error handling for version incompatibility)
                                if let Ok(output) = Command::new(cmd)
                                    .args(&["-c", "import crawl4ai; print('OK')"])
                                    .output()
                                {
                                    if let Ok(stdout) = String::from_utf8(output.stdout) {
                                        return stdout.trim() == "OK";
                                    }
                                }
                            }
                        }
                    }
                }
            }
            false
        };

        python_version_check("python3") || python_version_check("python")
    }

    pub fn with_crawl4ai() -> Self {
        Self {
            browser_type: BrowserType::Crawl4AI,
            timeout_secs: 90, // Increased for heavy sites
            headless: true,
            extra_headers: Vec::new(),
        }
    }

    /// Scrape a URL using browser automation
    pub fn scrape(&self, url: &str) -> Result<String> {
        match self.browser_type {
            BrowserType::Playwright => self.scrape_with_playwright(url),
            BrowserType::Chromium => self.scrape_with_chromium(url),
            BrowserType::Crawl4AI => self.scrape_with_crawl4ai(url),
        }
    }

    /// Scrape using Playwright (requires Playwright to be installed)
    /// Enhanced with stealth mode for anti-bot evasion
    fn scrape_with_playwright(&self, url: &str) -> Result<String> {
        // Merge default headers with optional overrides (cookies, custom UA, etc.)
        let mut header_map = Map::new();
        header_map.insert(
            "Accept".to_string(),
            Value::String(
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
                    .to_string(),
            ),
        );
        header_map.insert(
            "Accept-Language".to_string(),
            Value::String("en-US,en;q=0.9".to_string()),
        );
        header_map.insert(
            "Accept-Encoding".to_string(),
            Value::String("gzip, deflate, br".to_string()),
        );
        header_map.insert(
            "Connection".to_string(),
            Value::String("keep-alive".to_string()),
        );
        header_map.insert(
            "Upgrade-Insecure-Requests".to_string(),
            Value::String("1".to_string()),
        );
        header_map.insert(
            "Sec-Fetch-Dest".to_string(),
            Value::String("document".to_string()),
        );
        header_map.insert(
            "Sec-Fetch-Mode".to_string(),
            Value::String("navigate".to_string()),
        );
        header_map.insert(
            "Sec-Fetch-Site".to_string(),
            Value::String("none".to_string()),
        );
        header_map.insert(
            "Sec-Fetch-User".to_string(),
            Value::String("?1".to_string()),
        );
        header_map.insert(
            "Cache-Control".to_string(),
            Value::String("max-age=0".to_string()),
        );
        for (key, value) in &self.extra_headers {
            header_map.insert(key.clone(), Value::String(value.clone()));
        }
        let headers_json = Value::Object(header_map).to_string();

        // Create a temporary JavaScript file to run Playwright with stealth features
        let script = format!(
            r#"
            const {{ chromium }} = require('playwright');
            
            function getProxyConfig() {{
                const raw = process.env.UNHIREABLE_PROXY;
                if (!raw) return null;
                try {{
                    const u = new URL(raw);
                    const cfg = {{ server: `${{u.protocol}}//${{u.host}}` }};
                    if (u.username || u.password) {{
                        cfg.username = decodeURIComponent(u.username || '');
                        cfg.password = decodeURIComponent(u.password || '');
                    }}
                    return cfg;
                }} catch (_e) {{
                    return null;
                }}
            }}
            
            (async () => {{
                // Launch browser with stealth settings
                const proxy = getProxyConfig();
                    const browser = await chromium.launch({{
                        headless: {},
                        timeout: {},
                        proxy: proxy || undefined,
                        args: [
                            '--disable-blink-features=AutomationControlled',
                            '--disable-dev-shm-usage',
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-web-security',
                            '--disable-features=IsolateOrigins,site-per-process',
                            '--disable-site-isolation-trials',
                            '--disable-http2', // Disable HTTP/2 to avoid protocol errors on some sites
                        ]
                    }});
                
                const context = await browser.newContext({{
                    viewport: {{ width: 1920, height: 1080 }},
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    locale: 'en-US',
                    timezoneId: 'America/New_York',
                    permissions: ['geolocation'],
                    geolocation: {{ latitude: 40.7128, longitude: -74.0060 }},
                    colorScheme: 'light',
                }});
                
                const page = await context.newPage();
                
                // Remove webdriver property to avoid detection
                await page.addInitScript(() => {{
                    Object.defineProperty(navigator, 'webdriver', {{
                        get: () => undefined
                    }});
                    
                    // Override plugins to appear more like a real browser
                    Object.defineProperty(navigator, 'plugins', {{
                        get: () => [1, 2, 3, 4, 5]
                    }});
                    
                    // Override languages
                    Object.defineProperty(navigator, 'languages', {{
                        get: () => ['en-US', 'en']
                    }});
                    
                    // Override permissions
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({{ state: Notification.permission }}) :
                            originalQuery(parameters)
                    );
                }});
                
                // Set realistic headers merged with optional overrides
                const extraHeaders = {headers_json};
                await page.setExtraHTTPHeaders(extraHeaders);
                
                // Navigate to the page - use domcontentloaded first (faster, more reliable)
                // networkidle often never fires due to ads/analytics
                await page.goto('{}', {{ 
                    waitUntil: 'domcontentloaded', 
                    timeout: {} 
                }});
                
                // Wait for Cloudflare challenge to pass (if present)
                // Cloudflare usually completes within 5-10 seconds
                let cloudflareDetected = false;
                try {{
                    // Check if Cloudflare challenge is present
                    const cfCheck = await page.evaluate(() => {{
                        return document.body && (
                            document.body.textContent.includes('Please enable JS') ||
                            document.body.textContent.includes('Just a moment') ||
                            document.getElementById('cf-wrapper') !== null ||
                            document.querySelector('[data-cfasync]') !== null
                        );
                    }});
                    
                    if (cfCheck) {{
                        console.log('Cloudflare challenge detected, waiting...');
                        cloudflareDetected = true;
                        // Wait for Cloudflare to complete (up to 20 seconds)
                        await page.waitForFunction(
                            () => {{
                                const bodyText = document.body ? document.body.textContent : '';
                                return !bodyText.includes('Please enable JS') && 
                                       !bodyText.includes('Just a moment') &&
                                       bodyText.length > 1000; // Real content should be larger
                            }},
                            {{ timeout: 20000 }}
                        );
                        console.log('Cloudflare challenge passed');
                    }}
                }} catch (e) {{
                    console.log('Cloudflare check timeout or error:', e.message);
                }}
                
                // Additional wait for JavaScript rendering (React apps need more time)
                if (!cloudflareDetected) {{
                    await page.waitForTimeout(8000); // Increased for React rendering and heavy sites
                }} else {{
                    await page.waitForTimeout(3000); // Less wait if CF already passed
                }}
                
                // Wait for job-related content to appear (with longer timeout for heavy sites)
                try {{
                    // Try to wait for common job listing indicators
                    await Promise.race([
                        page.waitForSelector('a[href*="/jobs/"], a[href*="/job/"]', {{ timeout: 20000 }}).catch(() => null),
                        page.waitForSelector('[class*="job"], [class*="Job"]', {{ timeout: 20000 }}).catch(() => null),
                        page.waitForSelector('div[class*="card"], article', {{ timeout: 20000 }}).catch(() => null),
                        page.waitForFunction(() => document.body && document.body.textContent && document.body.textContent.length > 5000, {{ timeout: 20000 }}).catch(() => null)
                    ]);
                }} catch (e) {{
                    console.log('No job selectors found, continuing anyway');
                }}
                
                // Scroll to trigger lazy loading and simulate human behavior
                await page.evaluate(() => {{
                    window.scrollTo(0, 300);
                }});
                await page.waitForTimeout(1000);
                await page.evaluate(() => {{
                    window.scrollTo(0, 800);
                }});
                await page.waitForTimeout(1000);
                
                // Final check - ensure we have substantial content (not just CF page)
                // But allow smaller pages for sites that might have less content initially
                const html = await page.content();
                const bodyText = await page.evaluate(() => document.body ? document.body.textContent : '');
                
                // More lenient check - only fail if clearly Cloudflare or completely empty
                if (bodyText.includes('Please enable JS') || 
                    bodyText.includes('Just a moment') ||
                    (bodyText.length < 500 && (bodyText.includes('Checking your browser') || bodyText.includes('cf-')))) {{
                    console.error('ERROR: Still showing Cloudflare challenge or empty page');
                    throw new Error('Cloudflare challenge not passed or page empty');
                }}
                
                console.log(html);
                
                await browser.close();
            }})();
            "#,
            self.headless,
            self.timeout_secs * 1000,
            url,
            self.timeout_secs * 1000,
            headers_json = headers_json
        );

        // Write script to temp file
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let script_path = temp_dir.join(format!("playwright_scrape_{}.js", timestamp));
        std::fs::write(&script_path, script).context("Failed to write Playwright script")?;

        // Resolve project root (where node_modules/playwright is installed)
        let project_root = {
            let manifest_dir = env!("CARGO_MANIFEST_DIR"); // points to src-tauri/
            let manifest_path = std::path::Path::new(manifest_dir);
            manifest_path.parent().map(|p| p.to_path_buf())
        }
        .or_else(|| {
            std::env::current_dir().ok().and_then(|mut current| {
                for _ in 0..5 {
                    if current.join("package.json").exists() {
                        return Some(current);
                    }
                    current = current.parent()?.to_path_buf();
                }
                None
            })
        });

        // Build NODE_PATH similar to form_filler so require('playwright') resolves
        let mut node_path_parts: Vec<String> = Vec::new();
        if let Some(root) = &project_root {
            let project_node_modules = root.join("node_modules");
            if project_node_modules.exists() {
                node_path_parts.push(project_node_modules.to_string_lossy().to_string());
            }
        }
        // Add common global module paths (Homebrew on macOS)
        node_path_parts.push("/opt/homebrew/lib/node_modules".to_string());
        if let Ok(home) = std::env::var("HOME") {
            let user_global = format!("{}/.npm-global/lib/node_modules", home);
            if std::path::Path::new(&user_global).exists() {
                node_path_parts.push(user_global);
            }
        }
        let node_path = node_path_parts.join(":");

        // Run Playwright with NODE_PATH and working directory set to project root
        let mut cmd = Command::new("node");
        cmd.env("NODE_PATH", &node_path).arg(&script_path);
        if let Some(root) = &project_root {
            cmd.current_dir(root);
        }
        let output = cmd.output().context(
            "Failed to execute Playwright. Make sure Node.js and Playwright are installed.",
        )?;

        // Clean up
        let _ = std::fs::remove_file(&script_path);

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            let error_str = error.to_string();

            // Categorize Playwright errors
            if error_str.contains("ERR_TIMED_OUT") || error_str.contains("timeout") {
                use crate::scraper::error_handling::ScraperError;
                return Err(anyhow::Error::from(ScraperError::Timeout(format!(
                    "Playwright timeout for {}: {}",
                    url, error_str
                ))));
            } else if error_str.contains("net::ERR") {
                use crate::scraper::error_handling::ScraperError;
                return Err(anyhow::Error::from(ScraperError::Network(format!(
                    "Playwright network error for {}: {}",
                    url, error_str
                ))));
            }

            return Err(anyhow!("Playwright error: {}", error));
        }

        let html = String::from_utf8(output.stdout).context("Failed to parse Playwright output")?;

        Ok(html)
    }

    /// Scrape using headless Chrome/Chromium with stealth mode
    /// Note: Chrome CLI is limited - Playwright is preferred for better stealth
    fn scrape_with_chromium(&self, url: &str) -> Result<String> {
        // Find Chrome/Chromium executable
        let chrome_path =
            Self::find_chrome_executable().ok_or_else(|| anyhow!("Chrome/Chromium not found"))?;

        // Run headless Chrome with enhanced stealth flags
        // Note: --dump-dom directly dumps the DOM of the URL
        let output = Command::new(&chrome_path)
            .args(&[
                "--headless=new", // Use new headless mode (better stealth than old --headless)
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-software-rasterizer",
                "--disable-extensions",
                "--disable-blink-features=AutomationControlled", // Remove automation flags
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "--window-size=1920,1080",
                "--lang=en-US,en",
                "--virtual-time-budget=5000", // Wait up to 5 seconds for page to load
                "--run-all-compositor-stages-before-draw", // Ensure full rendering
                "--dump-dom", // Dump the rendered DOM
                url,
            ])
            .output()
            .context("Failed to execute Chrome/Chromium")?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("Chrome error: {}", error));
        }

        let html = String::from_utf8(output.stdout).context("Failed to parse Chrome output")?;

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
            if Command::new(path).arg("--version").output().is_ok() {
                return Some(path.to_string());
            }
        }
        None
    }

    /// Scrape using crawl4ai (Python-based, no API key required)
    /// crawl4ai is an open-source alternative to Firecrawl with AI-powered extraction
    /// Note: Requires Python 3.10+ due to union type syntax
    fn scrape_with_crawl4ai(&self, url: &str) -> Result<String> {
        // Create a Python script that uses crawl4ai
        // Using the sync API for better compatibility
        let script = format!(
            r#"
import sys
import json
try:
    # Try new API first (for latest crawl4ai)
    from crawl4ai import AsyncWebCrawler
    import asyncio
    
    async def scrape():
        async with AsyncWebCrawler(verbose=False) as crawler:
            result = await crawler.arun(url="{}")
            if result.success:
                print(result.html)
            else:
                error_msg = str(result.error) if hasattr(result, 'error') else 'Unknown error'
                print(f"Error: {{error_msg}}", file=sys.stderr)
                sys.exit(1)
    
    asyncio.run(scrape())
except ImportError as e:
    # Fallback to older API if available
    try:
        from crawl4ai import WebCrawler
        crawler = WebCrawler(verbose=False)
        result = crawler.run(url="{}")
        if result.get('success'):
            print(result.get('html', ''))
        else:
            error_msg = result.get('error', 'Unknown error')
            print(f"Error: {{error_msg}}", file=sys.stderr)
            sys.exit(1)
    except ImportError:
        print(f"Error: crawl4ai not properly installed: {{e}}", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"Error: {{e}}", file=sys.stderr)
    sys.exit(1)
"#,
            url, url
        );

        // Write script to temp file
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let script_path = temp_dir.join(format!("crawl4ai_scrape_{}.py", timestamp));
        std::fs::write(&script_path, script).context("Failed to write crawl4ai script")?;

        // Try python3 first, then python
        let python_cmd = if Command::new("python3").arg("--version").output().is_ok() {
            "python3"
        } else if Command::new("python").arg("--version").output().is_ok() {
            "python"
        } else {
            return Err(anyhow!(
                "Python not found. Install Python 3.7+ to use crawl4ai."
            ));
        };

        let output = Command::new(python_cmd)
            .arg(&script_path)
            .output()
            .context(
                "Failed to execute crawl4ai. Make sure crawl4ai is installed: pip install crawl4ai",
            )?;

        // Clean up
        let _ = std::fs::remove_file(&script_path);

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("crawl4ai error: {}", error));
        }

        let html = String::from_utf8(output.stdout).context("Failed to parse crawl4ai output")?;

        Ok(html)
    }

    /// Scrape with human-like delays and behavior
    /// Note: Delays are applied in the calling function (LinkedIn scraper)
    pub fn scrape_with_delays(
        &self,
        url: &str,
        _min_delay_secs: u64,
        _max_delay_secs: u64,
    ) -> Result<String> {
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
        println!(
            "Playwright available: {}",
            BrowserScraper::is_playwright_available()
        );
        println!(
            "Chromium available: {}",
            BrowserScraper::is_chromium_available()
        );
        println!(
            "crawl4ai available: {}",
            BrowserScraper::is_crawl4ai_available()
        );
    }
}

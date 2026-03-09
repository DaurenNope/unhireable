#!/usr/bin/env node
/**
 * Playwright test for the Unhireable Chrome extension on LinkedIn Easy Apply.
 *
 * Prerequisites:
 * - npm install playwright (or npx playwright install chromium)
 * - Log into LinkedIn in the launched browser when prompted
 *
 * Usage:
 *   node tools/scripts/test-extension-linkedin.mjs
 *   # Or: npx playwright test tools/scripts/test-extension-linkedin.mjs (if using playwright test runner)
 *
 * The script launches Chrome with the extension loaded, navigates to LinkedIn Jobs,
 * sets a test profile, and triggers "Test Apply This Job" via the extension's
 * window.postMessage bridge.
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../chrome-extension');
const PROFILE_DIR = path.join(__dirname, '../../.playwright-chrome-profile');

const TEST_PROFILE = {
  personal_info: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+1 555-123-4567',
    location: 'San Francisco, CA',
  },
  skills: ['JavaScript', 'TypeScript', 'React'],
  summary: 'Test candidate for automation.',
};

async function main() {
  console.log('[test] Launching Chrome with extension...');
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: 'chrome',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = context.pages()[0] || (await context.newPage());

  // Navigate to LinkedIn Jobs - user must be logged in
  const jobsUrl = 'https://www.linkedin.com/jobs/search/?keywords=software%20engineer&f_AL=true';
  console.log('[test] Navigating to LinkedIn Jobs (Easy Apply filter)...');
  await page.goto(jobsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for page to settle (LinkedIn is a heavy SPA)
  await new Promise((r) => setTimeout(r, 3000));

  // Check if we need to log in (Sign in, Join LinkedIn, etc.)
  const isLoginRequired = await page.evaluate(() => {
    const text = (document.body?.innerText || '').toLowerCase();
    const href = window.location?.href || '';
    return (
      text.includes('sign in') ||
      text.includes('join linkedin') ||
      href.includes('/login') ||
      href.includes('/uas/')
    );
  }).catch(() => false);

  if (isLoginRequired) {
    console.log('[test] ⚠️  LOGIN REQUIRED — A Chrome window has opened.');
    console.log('[test] Please log into LinkedIn in that window.');
    console.log('[test] Once you see the jobs search page, press Enter here to continue.');
    await new Promise((r) => process.stdin.once('data', r));
    console.log('[test] Continuing...');
    await page.goto(jobsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4000));
  }

  // Wait for job listings to load (LinkedIn loads dynamically)
  await new Promise((r) => setTimeout(r, 2000));
  let jobLink = null;
  for (const sel of [
    'a[href*="/jobs/view/"]',
    '[class*="job-card-container"] a',
    '[class*="jobs-search-results__list-item"] a',
    'li a[href*="/jobs/"]',
  ]) {
    try {
      const loc = page.locator(sel);
      const count = await loc.count();
      if (count > 0) {
        await loc.first().waitFor({ state: 'visible', timeout: 5000 });
        jobLink = loc.first();
        console.log(`[test] Found ${count} job links via: ${sel}`);
        break;
      }
    } catch {
      continue;
    }
  }

  if (!jobLink) {
    console.log('[test] ❌ No job cards found. Ensure you are logged in and on the jobs search page.');
    await page.screenshot({ path: path.join(__dirname, '../../.test-no-jobs.png') });
    console.log('[test] Screenshot saved: .test-no-jobs.png');
    await context.close();
    process.exit(1);
  }

  // Click first job card to open detail view
  await jobLink.click({ timeout: 5000 });

  await new Promise((r) => setTimeout(r, 2500));

  // Ensure we're on a job detail page (right panel)
  const jobTitle = await page.locator('h1[class*="job-title"], h1[class*="t-24"]').first();
  await jobTitle.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);

  // Set test profile via extension bridge
  console.log('[test] Setting test profile...');
  await page.evaluate((profile) => {
    window.postMessage({ type: 'unhireable', action: 'setTestProfile', profile }, '*');
  }, TEST_PROFILE);

  await new Promise((r) => setTimeout(r, 500));

  // Trigger Test Apply via extension bridge
  console.log('[test] Triggering Test Apply This Job...');
  await page.evaluate(() => {
    window.postMessage({ type: 'unhireable', action: 'testApplySingle' }, '*');
  });

  // Wait for Easy Apply modal to appear
  const modalSelector = '[class*="artdeco-modal"], [role="dialog"], .jobs-easy-apply-content';
  console.log('[test] Waiting for Easy Apply modal...');
  const modal = await page.locator(modalSelector).first();
  await modal.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);

  if (await modal.isVisible()) {
    console.log('[test] ✅ Modal opened! Taking screenshot...');
    await page.screenshot({ path: path.join(__dirname, '../../.test-modal-opened.png') });
  }

  // Wait for fill/submit flow (extension handles this)
  console.log('[test] Waiting 20s for extension to fill and submit...');
  await new Promise((r) => setTimeout(r, 20000));

  // Final screenshot
  await page.screenshot({ path: path.join(__dirname, '../../.test-after-flow.png') });
  console.log('[test] Screenshots saved: .test-modal-opened.png, .test-after-flow.png');

  await context.close();
  console.log('[test] Done.');
}

main().catch((err) => {
  console.error('[test] Error:', err);
  process.exit(1);
});

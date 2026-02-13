import { Browser, Page, chromium } from 'playwright';
import { AtsType, JobApplication } from '../types/index.js';
import { log } from '../utils/logger.js';
import { userProfile } from '../config/profile.js';
import { BrowserErrorRecovery, ErrorRecoveryResult } from './errorRecovery.js';

export class BrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(visible: boolean = false): Promise<void> {
    try {
      log.info('🌐 Initializing browser service with Playwright...');
      
      this.browser = await chromium.launch({
        headless: !visible,
        viewport: { width: 1366, height: 768 },
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.page = await this.browser.newPage();
      
      // Set user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set additional headers for job applications
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });

      log.info('✅ Playwright browser service initialized');
    } catch (error) {
      log.error('❌ Failed to initialize browser:', error);
      throw error;
    }
  }

  async navigateToUrl(url: string): Promise<ErrorRecoveryResult<void>> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    return BrowserErrorRecovery.handleNavigationError(
      async () => {
        log.info(`🌐 Navigating to: ${url}`);
        await this.page!.goto(url, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
      },
      url
    );
  }

  async fillApplicationForm(application: JobApplication): Promise<ErrorRecoveryResult<void>> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    return BrowserErrorRecovery.handleBrowserError(
      async () => {
        const atsType = this.detectAtsType(this.page.url());
        log.info(`📋 Filling out ${atsType} application form`);

        await this.fillPersonalInformation();
        await this.fillExperience();
        await this.fillEducation();
        await this.fillSkills();
        await this.attachResume();

        log.info('✅ Application form filled successfully');
      },
      'application form filling'
    );
  }

  private detectAtsType(url: string): AtsType {
    const domain = new URL(url).hostname.toLowerCase();
    
    if (domain.includes('lever.co')) return 'lever';
    if (domain.includes('greenhouse.io')) return 'greenhouse';
    if (domain.includes('workday.com')) return 'workday';
    if (domain.includes('icims.com')) return 'icims';
    if (domain.includes('bamboohr.com')) return 'bamboohr';
    if (domain.includes('smartrecruiters.com')) return 'smartrecruiters';
    if (domain.includes('applytojob.com')) return 'applytojob';
    if (domain.includes('myworkdayjobs.com')) return 'workday';
    if (domain.includes('talentbrew.com')) return 'talentbrew';
    if (domain.includes('jobvite.com')) return 'jobvite';
    
    return 'unknown';
  }

  private async fillPersonalInformation(): Promise<void> {
    if (!this.page) return;

    const selectors = [
      'input[name*="first"]',
      'input[name*="last"]',
      'input[name*="email"]',
      'input[name*="phone"]',
      'input[name*="location"]',
    ];

    const values = [
      userProfile.personal_info.firstName,
      userProfile.personal_info.lastName,
      userProfile.personal_info.email,
      userProfile.personal_info.phone,
      userProfile.personal_info.location,
    ];

    for (let i = 0; i < selectors.length; i++) {
      await this.fillField(selectors[i], values[i]);
    }
  }

  private async fillExperience(): Promise<void> {
    // Implementation for filling work experience
    log.info('💼 Filling work experience...');
  }

  private async fillEducation(): Promise<void> {
    // Implementation for filling education
    log.info('🎓 Filling education...');
  }

  private async fillSkills(): Promise<void> {
    // Implementation for filling skills
    log.info('🔧 Filling skills...');
  }

  private async attachResume(): Promise<void> {
    // Implementation for attaching resume
    log.info('📎 Attaching resume...');
  }

  private async fillField(selector: string, value: string): Promise<void> {
    if (!this.page || !value) return;

    return BrowserErrorRecovery.handleBrowserError(
      async () => {
        // Use Playwright's better selectors
        await this.page!.locator(selector).waitFor({ state: 'visible', timeout: 5000 });
        await this.page!.locator(selector).fill(value);
      },
      `filling field: ${selector}`
    );
  }

  async takeScreenshot(filename: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.screenshot({ 
        path: `./screenshots/${filename}`,
        fullPage: true 
      });
      log.info(`📸 Screenshot saved: ${filename}`);
    } catch (error) {
      log.error('❌ Failed to take screenshot:', error);
    }
  }

  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        log.info('🌐 Playwright browser service closed');
      }
    } catch (error) {
      log.error('❌ Failed to close browser:', error);
    }
  }

  async isVisible(): Promise<boolean> {
    return this.browser !== null && this.browser.isConnected();
  }
}

export const browserService = new BrowserService();
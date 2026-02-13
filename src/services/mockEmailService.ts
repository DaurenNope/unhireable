import { Email, EmailResponse, EmailTemplate } from '../types';
import { log } from '../utils/logger';

/**
 * Mock email service for development/testing
 * In production, replace with real email service integration
 */
export class MockEmailService {
  /**
   * Send email (mock implementation)
   */
  async sendEmail(email: Email): Promise<EmailResponse> {
    try {
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      log.info(`[MOCK] Email sent successfully to ${email.to}: ${email.subject}`);
      console.log(`📧 [MOCK EMAIL] To: ${email.to}`);
      console.log(`📧 [MOCK EMAIL] Subject: ${email.subject}`);
      console.log(`📧 [MOCK EMAIL] Preview: ${email.text?.substring(0, 100)}...`);
      
      return {
        success: true,
        messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        response: { mock: true },
      };
    } catch (error) {
      log.error('[MOCK] Failed to send email:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate thank you email template
   */
  generateThankYouTemplate(interviewerName: string, interviewType: string, interviewDate: string): EmailTemplate {
    const subject = `Thank You - ${interviewType} Interview`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank You for the Interview</h2>
        <p>Dear ${interviewerName},</p>
        
        <p>Thank you for taking the time to speak with me today about the ${interviewType} interview. I enjoyed our conversation and learning more about the opportunity.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Key Discussion Points:</strong></p>
          <ul>
            <li>The role's responsibilities and team structure</li>
            <li>Company culture and values</li>
            <li>Technical challenges and opportunities</li>
            <li>Next steps in the hiring process</li>
          </ul>
        </div>
        
        <p>I'm very excited about this opportunity and believe my skills would be a great match for your team.</p>
        
        <p>Please let me know if there's any additional information I can provide. I look forward to hearing about the next steps.</p>
        
        <p>Best regards,<br>
        [Your Name]</p>
      </div>
    `;

    return {
      type: 'thank_you',
      subject,
      html,
      text: this.htmlToText(html),
      variables: {
        interviewerName,
        interviewType,
        interviewDate,
      },
    };
  }

  /**
   * Generate status check-in email template
   */
  generateStatusCheckInTemplate(applicationId: string, daysSinceApplication: number): EmailTemplate {
    const subject = `Following Up - Job Application`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Following Up on My Application</h2>
        <p>Dear Hiring Manager,</p>
        
        <p>I hope this email finds you well. I'm writing to follow up on my job application submitted ${daysSinceApplication} days ago.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Application Details:</strong></p>
          <p>Application ID: ${applicationId}</p>
          <p>Submitted: ${new Date(Date.now() - daysSinceApplication * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
        </div>
        
        <p>I remain very interested in this opportunity and would appreciate any updates on the hiring process.</p>
        
        <p>Thank you for your time and consideration.</p>
        
        <p>Best regards,<br>
        [Your Name]</p>
      </div>
    `;

    return {
      type: 'status_check_in',
      subject,
      html,
      text: this.htmlToText(html),
      variables: {
        applicationId,
        daysSinceApplication: daysSinceApplication.toString(),
      },
    };
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const mockEmailService = new MockEmailService();

// Export convenience function
export const sendEmail = (email: Email) => mockEmailService.sendEmail(email);
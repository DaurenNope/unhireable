import nodemailer from 'nodemailer';
import { Email, EmailResponse, EmailTemplate, Interview, InterviewConfirmation } from '../types/index.js';
import { log } from '../utils/logger.js';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Send email using configured transporter
   */
  async sendEmail(email: Email): Promise<EmailResponse> {
    try {
      const mailOptions = {
        from: email.from,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      log.info(`Email sent successfully to ${email.to}: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        response: result,
      };
    } catch (error) {
      log.error('Failed to send email:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate thank you email template
   */
  generateThankYouTemplate(interview: Interview): EmailTemplate {
    const subject = `Thank You - ${interview.type} Interview`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank You for the Interview</h2>
        <p>Dear ${interview.interviewer || 'Hiring Team'},</p>
        
        <p>Thank you for taking the time to speak with me today about the ${interview.type} interview. I enjoyed our conversation and learning more about the opportunity.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Key Discussion Points:</strong></p>
          <ul>
            <li>The role's responsibilities and team structure</li>
            <li>Company culture and values</li>
            <li>Technical challenges and opportunities</li>
            <li>Next steps in the hiring process</li>
          </ul>
        </div>
        
        <p>I'm very excited about this opportunity and believe my skills in [mention 1-2 key skills] would be a great match for your team.</p>
        
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
        interviewerName: interview.interviewer || 'Hiring Team',
        interviewType: interview.type,
        interviewDate: interview.dateTime.toLocaleDateString(),
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
        
        <p>I remain very interested in this opportunity and would appreciate any updates on the hiring process. I'm confident that my skills and experience would be valuable to your team.</p>
        
        <p>Please let me know if there's any additional information I can provide or if you'd like to schedule a conversation to discuss my qualifications further.</p>
        
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
   * Generate interview confirmation template
   */
  generateInterviewConfirmationTemplate(interview: Interview): EmailTemplate {
    const subject = `Interview Confirmation - ${interview.type}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Interview Confirmation</h2>
        <p>Dear ${interview.interviewer || 'Hiring Team'},</p>
        
        <p>Thank you for the interview invitation. I'm writing to confirm my attendance:</p>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3>Interview Details:</h3>
          <p><strong>Type:</strong> ${interview.type}</p>
          <p><strong>Date & Time:</strong> ${interview.dateTime.toLocaleString()}</p>
          ${interview.interviewer ? `<p><strong>Interviewer:</strong> ${interview.interviewer}</p>` : ''}
          ${interview.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${interview.meetingLink}">Join Interview</a></p>` : ''}
          ${interview.location ? `<p><strong>Location:</strong> ${interview.location}</p>` : ''}
          <p><strong>Duration:</strong> ${interview.duration} minutes</p>
        </div>
        
        <p>I confirm my availability and look forward to discussing the opportunity further. I will be prepared at the scheduled time.</p>
        
        <p>If there are any materials I should review in advance or topics I should prepare for, please let me know.</p>
        
        <p>Best regards,<br>
        [Your Name]</p>
      </div>
    `;

    return {
      type: 'interview_confirmation',
      subject,
      html,
      text: this.htmlToText(html),
      variables: {
        interviewerName: interview.interviewer || 'Hiring Team',
        interviewType: interview.type,
        interviewDate: interview.dateTime.toLocaleString(),
        meetingLink: interview.meetingLink || '',
        location: interview.location || '',
      },
    };
  }

  /**
   * Generate reschedule request template
   */
  generateRescheduleRequestTemplate(interview: Interview, reason: string): EmailTemplate {
    const subject = `Request to Reschedule Interview`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Request to Reschedule Interview</h2>
        <p>Dear ${interview.interviewer || 'Hiring Team'},</p>
        
        <p>I'm writing to respectfully request to reschedule our ${interview.type} interview originally scheduled for ${interview.dateTime.toLocaleString()}.</p>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p><strong>Reason for Reschedule:</strong></p>
          <p>${reason}</p>
        </div>
        
        <p>I remain very interested in this opportunity and would like to find an alternative time that works for both of us.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>My Availability:</strong></p>
          <p>I'm generally available during the following times:</p>
          <ul>
            <li>Monday - Friday: 9:00 AM - 12:00 PM, 2:00 PM - 5:00 PM</li>
            <li>Flexible with advance notice</li>
          </ul>
        </div>
        
        <p>Please let me know what alternative times would work for you. I apologize for any inconvenience this may cause.</p>
        
        <p>Thank you for your understanding.</p>
        
        <p>Best regards,<br>
        [Your Name]</p>
      </div>
    `;

    return {
      type: 'reschedule_request',
      subject,
      html,
      text: this.htmlToText(html),
      variables: {
        interviewerName: interview.interviewer || 'Hiring Team',
        originalDateTime: interview.dateTime.toLocaleString(),
        reason,
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

  /**
   * Send interview thank you email
   */
  async sendInterviewThankYou(interview: Interview, recruiterEmail: string): Promise<EmailResponse> {
    const template = this.generateThankYouTemplate(interview);
    
    const email: Email = {
      from: process.env.EMAIL_USER!,
      to: recruiterEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    return this.sendEmail(email);
  }

  /**
   * Send status check-in email
   */
  async sendStatusCheckIn(applicationId: string, recruiterEmail: string, daysSinceApplication: number): Promise<EmailResponse> {
    const template = this.generateStatusCheckInTemplate(applicationId, daysSinceApplication);
    
    const email: Email = {
      from: process.env.EMAIL_USER!,
      to: recruiterEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    return this.sendEmail(email);
  }

  /**
   * Send interview confirmation email
   */
  async sendInterviewConfirmation(interview: Interview, recruiterEmail: string): Promise<EmailResponse> {
    const template = this.generateInterviewConfirmationTemplate(interview);
    
    const email: Email = {
      from: process.env.EMAIL_USER!,
      to: recruiterEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    return this.sendEmail(email);
  }

  /**
   * Send reschedule request email
   */
  async sendRescheduleRequest(interview: Interview, recruiterEmail: string, reason: string): Promise<EmailResponse> {
    const template = this.generateRescheduleRequestTemplate(interview, reason);
    
    const email: Email = {
      from: process.env.EMAIL_USER!,
      to: recruiterEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    return this.sendEmail(email);
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export convenience function
export const sendEmail = (email: Email) => emailService.sendEmail(email);
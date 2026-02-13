import { interviewScheduler } from './interviewScheduler.js';
import { emailService } from './emailService.js';
import { log } from '../utils/logger.js';

/**
 * Autonomous Interview Scheduling Service
 * Handles interview invitations, calendar integration, and confirmations
 */
export class AutonomousInterviewScheduling {
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start autonomous interview scheduling
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Interview scheduling is already running');
      return;
    }

    this.isRunning = true;
    log.info('🗓️ Starting autonomous interview scheduling...');

    // Check for interview invitations every 5 minutes
    this.checkInterval = setInterval(async () => {
      await this.checkForInterviewInvitations();
    }, 5 * 60 * 1000);

    // Initial check
    await this.checkForInterviewInvitations();
  }

  /**
   * Stop autonomous interview scheduling
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      log.warn('Interview scheduling is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    log.info('🛑 Stopped autonomous interview scheduling');
  }

  /**
   * Check for interview invitations in emails
   */
  private async checkForInterviewInvitations(): Promise<void> {
    try {
      log.info('🔍 Checking for interview invitations...');

      // This would integrate with email monitoring service
      // For now, simulate finding interview invitations
      const mockInvitations = await this.findMockInterviewInvitations();

      for (const invitation of mockInvitations) {
        await this.processInterviewInvitation(invitation);
      }

      if (mockInvitations.length > 0) {
        log.info(`✅ Processed ${mockInvitations.length} interview invitations`);
      } else {
        log.info('📭 No new interview invitations found');
      }

    } catch (error) {
      log.error('❌ Error checking interview invitations:', error);
    }
  }

  /**
   * Process interview invitation
   */
  private async processInterviewInvitation(invitation: any): Promise<void> {
    try {
      log.info(`📋 Processing interview invitation: ${invitation.subject}`);

      // Parse interview details from email
      const interview = await interviewScheduler.parseInterviewDetails(invitation.content);
      
      if (!interview) {
        log.warn('Could not parse interview details from invitation');
        return;
      }

      // Create calendar event
      const eventId = await interviewScheduler.createCalendarEvent(interview);
      log.info(`📅 Created calendar event: ${eventId}`);

      // Send confirmation email
      await interviewScheduler.sendInterviewConfirmation(interview);
      log.info(`📧 Sent interview confirmation`);

      // Schedule follow-up reminders
      await this.scheduleInterviewReminders(interview);
      log.info(`⏰ Scheduled interview reminders`);

    } catch (error) {
      log.error('❌ Error processing interview invitation:', error);
    }
  }

  /**
   * Schedule interview reminders
   */
  private async scheduleInterviewReminders(interview: any): Promise<void> {
    try {
      const now = new Date();
      const interviewTime = new Date(interview.dateTime);

      // Schedule reminder 1 day before
      const oneDayBefore = new Date(interviewTime.getTime() - 24 * 60 * 60 * 1000);
      if (oneDayBefore > now) {
        setTimeout(async () => {
          await this.sendInterviewReminder(interview, '1_day_before');
        }, oneDayBefore.getTime() - now.getTime());
      }

      // Schedule reminder 1 hour before
      const oneHourBefore = new Date(interviewTime.getTime() - 60 * 60 * 1000);
      if (oneHourBefore > now) {
        setTimeout(async () => {
          await this.sendInterviewReminder(interview, '1_hour_before');
        }, oneHourBefore.getTime() - now.getTime());
      }

      // Schedule thank you email 4 hours after interview
      const fourHoursAfter = new Date(interviewTime.getTime() + 4 * 60 * 60 * 1000);
      if (fourHoursAfter > now) {
        setTimeout(async () => {
          await this.sendThankYouEmail(interview);
        }, fourHoursAfter.getTime() - now.getTime());
      }

    } catch (error) {
      log.error('❌ Error scheduling interview reminders:', error);
    }
  }

  /**
   * Send interview reminder
   */
  private async sendInterviewReminder(interview: any, timing: string): Promise<void> {
    try {
      log.info(`⏰ Sending ${timing} reminder for interview ${interview.id}`);

      const reminderEmail = {
        to: 'user@example.com', // Would be user's email
        subject: `Interview Reminder: ${interview.type} in ${timing === '1_day_before' ? '1 day' : '1 hour'}`,
        html: this.generateReminderEmail(interview, timing),
      };

      await emailService.sendEmail(reminderEmail);
      log.info(`📧 Sent ${timing} interview reminder`);

    } catch (error) {
      log.error('❌ Error sending interview reminder:', error);
    }
  }

  /**
   * Send thank you email after interview
   */
  private async sendThankYouEmail(interview: any): Promise<void> {
    try {
      log.info(`📧 Sending thank you email for interview ${interview.id}`);

      const thankYouEmail = emailService.generateThankYouTemplate(interview);
      
      await emailService.sendEmail({
        to: 'recruiter@company.com', // Would be interviewer's email
        subject: thankYouEmail.subject,
        html: thankYouEmail.html,
        text: thankYouEmail.text,
      });

      log.info(`📧 Sent thank you email for interview ${interview.id}`);

    } catch (error) {
      log.error('❌ Error sending thank you email:', error);
    }
  }

  /**
   * Generate reminder email content
   */
  private generateReminderEmail(interview: any, timing: string): string {
    const timeText = timing === '1_day_before' ? 'tomorrow' : 'in 1 hour';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>🔔 Interview Reminder</h2>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3>Upcoming Interview:</h3>
          <p><strong>Type:</strong> ${interview.type}</p>
          <p><strong>When:</strong> ${interview.dateTime.toLocaleString()} (${timeText})</p>
          ${interview.interviewer ? `<p><strong>With:</strong> ${interview.interviewer}</p>` : ''}
          ${interview.meetingLink ? `<p><strong>Link:</strong> <a href="${interview.meetingLink}">Join Interview</a></p>` : ''}
          ${interview.location ? `<p><strong>Location:</strong> ${interview.location}</p>` : ''}
        </div>
        
        <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>Preparation Checklist:</h4>
          <ul>
            <li>✅ Test your video/audio setup if virtual</li>
            <li>✅ Review company and role research</li>
            <li>✅ Prepare questions to ask them</li>
            <li>✅ Have your resume and notes ready</li>
            <li>✅ Check interview link/location details</li>
          </ul>
        </div>
        
        <p>Good luck with your interview! 🎯</p>
        
        <p>Best,<br>
        Unhireable Assistant</p>
      </div>
    `;
  }

  /**
   * Find mock interview invitations (for testing)
   */
  private async findMockInterviewInvitations(): Promise<any[]> {
    // Simulate finding interview invitations
    const mockInvitations = [
      {
        id: 'mock_interview_1',
        subject: 'Interview Invitation - Software Engineer',
        content: `
          We'd like to invite you for a technical interview.
          
          Date: Friday, January 24, 2025 at 2:00 PM EST
          Type: Video call via Zoom
          Interviewer: John Smith
          Duration: 60 minutes
          
          Meeting link: https://zoom.us/j/123456789
          
          Please confirm your availability.
        `,
        from: 'recruiter@company.com',
        receivedAt: new Date(),
      },
    ];

    // Only return invitations if we haven't processed them recently
    return Math.random() > 0.7 ? mockInvitations : [];
  }

  /**
   * Get current status
   */
  getStatus(): { isRunning: boolean; nextCheck: Date | null } {
    return {
      isRunning: this.isRunning,
      nextCheck: this.checkInterval ? new Date(Date.now() + 5 * 60 * 1000) : null,
    };
  }

  /**
   * Manually trigger interview invitation check
   */
  async triggerCheck(): Promise<void> {
    log.info('🔍 Manually triggering interview invitation check...');
    await this.checkForInterviewInvitations();
  }
}

// Export singleton instance
export const autonomousInterviewScheduling = new AutonomousInterviewScheduling();
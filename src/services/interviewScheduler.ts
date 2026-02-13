import { google } from 'googleapis';
import { Calendar, Interview, InterviewConfirmation } from '../types/index.js';
import { sendEmail } from './emailService.js';
import { log } from '../utils/logger.js';

export class InterviewScheduler {
  private calendar: Calendar;
  private auth: any;

  constructor() {
    this.calendar = new Calendar();
  }

  /**
   * Initialize Google Calendar API
   */
  async initializeCalendar(): Promise<void> {
    try {
      // For production, use proper OAuth2 flow
      // This is a simplified version for demonstration
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_CALENDAR_KEY_FILE,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      this.auth = await auth.getClient();
      const calendar = google.calendar({ version: 'v3', auth: this.auth });

      log.info('Google Calendar API initialized');
    } catch (error) {
      log.error('Failed to initialize Google Calendar API:', error);
      throw error;
    }
  }

  /**
   * Parse interview details from email
   */
  parseInterviewDetails(emailContent: string): Interview | null {
    try {
      // Common patterns for interview scheduling emails
      const patterns = {
        dateTime: /(\w+,\s+\w+\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+(?:AM|PM)\s+\w+)|(?:\d{1,2}\/\d{1,2}\/\d{4}\s+at\s+\d{1,2}:\d{2}\s+(?:AM|PM))/gi,
        videoCall: /(?:zoom|google meet|teams|webex|video call|video interview)/gi,
        phoneCall: /(?:phone call|phone interview|call you)/gi,
        inPerson: /(?:in-person|in person|office|location)/gi,
        interviewer: /(?:interviewer|with\s+(\w+\s+\w+)|speaking with)/gi,
        meetingLink: /(?:https?:\/\/(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com)\/[^\s]+)/gi,
      };

      const extracted = {
        dateTime: this.extractDateTime(emailContent, patterns.dateTime),
        type: this.determineInterviewType(emailContent, patterns),
        interviewer: this.extractInterviewer(emailContent, patterns.interviewer),
        meetingLink: this.extractMeetingLink(emailContent, patterns.meetingLink),
        location: this.extractLocation(emailContent),
        duration: this.extractDuration(emailContent),
      };

      // Validate we have essential information
      if (!extracted.dateTime) {
        log.warn('Could not extract interview date/time from email');
        return null;
      }

      const interview: Interview = {
        id: this.generateInterviewId(),
        applicationId: this.extractApplicationId(emailContent),
        type: extracted.type,
        dateTime: extracted.dateTime,
        duration: extracted.duration || 60, // Default 60 minutes
        interviewer: extracted.interviewer,
        location: extracted.location,
        meetingLink: extracted.meetingLink,
        status: 'scheduled',
        notes: this.extractNotes(emailContent),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      log.info(`Parsed interview details: ${interview.type} on ${interview.dateTime}`);
      return interview;

    } catch (error) {
      log.error('Failed to parse interview details:', error);
      return null;
    }
  }

  /**
   * Create calendar event for interview
   */
  async createCalendarEvent(interview: Interview): Promise<string> {
    try {
      if (!this.auth) {
        await this.initializeCalendar();
      }

      const calendar = google.calendar({ version: 'v3', auth: this.auth });

      const event = {
        summary: `Interview: ${interview.type} with ${interview.interviewer || 'Hiring Team'}`,
        description: this.buildEventDescription(interview),
        start: {
          dateTime: interview.dateTime.toISOString(),
          timeZone: 'America/New_York', // Should be user's timezone
        },
        end: {
          dateTime: new Date(
            interview.dateTime.getTime() + interview.duration * 60000
          ).toISOString(),
          timeZone: 'America/New_York',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
        conferenceData: interview.meetingLink ? {
          createRequest: {
            requestId: interview.id,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        } : undefined,
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: interview.meetingLink ? 1 : 0,
      });

      const eventId = response.data.id;
      log.info(`Created calendar event: ${eventId}`);

      // Update interview with calendar event ID
      interview.calendarEventId = eventId;

      return eventId;

    } catch (error) {
      log.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  /**
   * Send interview confirmation email
   */
  async sendInterviewConfirmation(interview: Interview): Promise<void> {
    try {
      const confirmation: InterviewConfirmation = {
        interviewId: interview.id,
        applicationId: interview.applicationId,
        status: 'confirmed',
        response: 'accepted',
        message: this.buildConfirmationMessage(interview),
        sentAt: new Date(),
      };

      // Get application details to find recruiter email
      const application = await this.getApplication(interview.applicationId);
      if (!application || !application.recruiterEmail) {
        log.warn('Could not find recruiter email for confirmation');
        return;
      }

      await sendEmail({
        to: application.recruiterEmail,
        subject: `Interview Confirmation - ${interview.type}`,
        html: this.buildConfirmationEmail(interview),
      });

      log.info(`Sent interview confirmation for ${interview.id}`);

    } catch (error) {
      log.error('Failed to send interview confirmation:', error);
      throw error;
    }
  }

  /**
   * Process interview invitation and handle scheduling
   */
  async processInterviewInvitation(emailContent: string): Promise<void> {
    try {
      // Parse interview details
      const interview = this.parseInterviewDetails(emailContent);
      if (!interview) {
        log.warn('Could not parse interview details from email');
        return;
      }

      // Create calendar event
      const eventId = await this.createCalendarEvent(interview);
      interview.calendarEventId = eventId;

      // Save interview to database
      await this.saveInterview(interview);

      // Send confirmation email
      await this.sendInterviewConfirmation(interview);

      log.info(`Successfully processed interview invitation: ${interview.id}`);

    } catch (error) {
      log.error('Failed to process interview invitation:', error);
      throw error;
    }
  }

  /**
   * Extract date and time from email content
   */
  private extractDateTime(content: string, pattern: RegExp): Date | null {
    const matches = content.match(pattern);
    if (!matches || matches.length === 0) return null;

    // Try to parse the first match
    const dateStr = matches[0];
    const date = new Date(dateStr);

    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Determine interview type from content
   */
  private determineInterviewType(content: string, patterns: any): string {
    if (patterns.videoCall.test(content)) return 'video';
    if (patterns.phoneCall.test(content)) return 'phone';
    if (patterns.inPerson.test(content)) return 'in-person';
    return 'unknown';
  }

  /**
   * Extract interviewer name
   */
  private extractInterviewer(content: string, pattern: RegExp): string | undefined {
    const match = content.match(pattern);
    return match ? match[1] || 'Hiring Team' : undefined;
  }

  /**
   * Extract meeting link
   */
  private extractMeetingLink(content: string, pattern: RegExp): string | undefined {
    const match = content.match(pattern);
    return match ? match[0] : undefined;
  }

  /**
   * Extract location information
   */
  private extractLocation(content: string): string | undefined {
    // Look for address patterns
    const addressPattern = /\d+\s+[\w\s]+,\s+[\w\s]+,\s+\w{2}\s+\d{5}/gi;
    const match = content.match(addressPattern);
    return match ? match[0] : undefined;
  }

  /**
   * Extract interview duration
   */
  private extractDuration(content: string): number | undefined {
    const durationPattern = /(\d+)\s+(?:minutes?|hours?)/gi;
    const match = content.match(durationPattern);
    if (match) {
      const value = parseInt(match[0]);
      return match[0].toLowerCase().includes('hour') ? value * 60 : value;
    }
    return undefined;
  }

  /**
   * Extract application ID from email
   */
  private extractApplicationId(content: string): string {
    // Look for application ID patterns
    const patterns = [
      /application[_\s-]?id[:\s]+([a-zA-Z0-9-]+)/gi,
      /job[_\s-]?id[:\s]+([a-zA-Z0-9-]+)/gi,
      /ref[:\s]+([a-zA-Z0-9-]+)/gi,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1];
    }

    return 'unknown';
  }

  /**
   * Extract additional notes
   */
  private extractNotes(content: string): string {
    // Extract relevant information that doesn't fit other categories
    const lines = content.split('\n');
    const notes: string[] = [];

    for (const line of lines) {
      if (line.includes('bring') || line.includes('prepare') || line.includes('please')) {
        notes.push(line.trim());
      }
    }

    return notes.join('\n');
  }

  /**
   * Build calendar event description
   */
  private buildEventDescription(interview: Interview): string {
    let description = `Interview Type: ${interview.type}\n`;
    
    if (interview.interviewer) {
      description += `Interviewer: ${interview.interviewer}\n`;
    }
    
    if (interview.meetingLink) {
      description += `Meeting Link: ${interview.meetingLink}\n`;
    }
    
    if (interview.location) {
      description += `Location: ${interview.location}\n`;
    }
    
    if (interview.notes) {
      description += `\nNotes:\n${interview.notes}`;
    }

    return description;
  }

  /**
   * Build confirmation message
   */
  private buildConfirmationMessage(interview: Interview): string {
    return `Thank you for the interview invitation. I confirm my availability for ${interview.type} interview on ${interview.dateTime.toLocaleString()}${interview.interviewer ? ` with ${interview.interviewer}` : ''}. I look forward to discussing the opportunity further.`;
  }

  /**
   * Build confirmation email HTML
   */
  private buildConfirmationEmail(interview: Interview): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Interview Confirmation</h2>
        <p>Thank you for the interview invitation. I'm writing to confirm my attendance:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Interview Details:</h3>
          <p><strong>Type:</strong> ${interview.type}</p>
          <p><strong>Date & Time:</strong> ${interview.dateTime.toLocaleString()}</p>
          ${interview.interviewer ? `<p><strong>Interviewer:</strong> ${interview.interviewer}</p>` : ''}
          ${interview.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${interview.meetingLink}">Join Interview</a></p>` : ''}
          ${interview.location ? `<p><strong>Location:</strong> ${interview.location}</p>` : ''}
        </div>
        
        <p>I look forward to discussing the opportunity further and will be prepared at the scheduled time.</p>
        
        <p>Best regards,<br>
        [Your Name]</p>
      </div>
    `;
  }

  /**
   * Generate unique interview ID
   */
  private generateInterviewId(): string {
    return `interview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get application from database
   */
  private async getApplication(applicationId: string): Promise<any> {
    // This would integrate with your database
    // For now, return mock data
    return {
      id: applicationId,
      recruiterEmail: 'recruiter@company.com',
    };
  }

  /**
   * Save interview to database
   */
  private async saveInterview(interview: Interview): Promise<void> {
    // This would integrate with your database
    log.info(`Saving interview to database: ${interview.id}`);
  }

  /**
   * Update interview in calendar
   */
  async updateCalendarEvent(interviewId: string, updates: Partial<Interview>): Promise<void> {
    try {
      if (!this.auth) {
        await this.initializeCalendar();
      }

      const calendar = google.calendar({ version: 'v3', auth: this.auth });

      // Get existing event
      const event = await calendar.events.get({
        calendarId: 'primary',
        eventId: interviewId,
      });

      // Update event with new details
      const updatedEvent = {
        ...event.data,
        ...updates,
      };

      await calendar.events.update({
        calendarId: 'primary',
        eventId: interviewId,
        resource: updatedEvent,
      });

      log.info(`Updated calendar event: ${interviewId}`);

    } catch (error) {
      log.error('Failed to update calendar event:', error);
      throw error;
    }
  }

  /**
   * Cancel calendar event
   */
  async cancelCalendarEvent(eventId: string): Promise<void> {
    try {
      if (!this.auth) {
        await this.initializeCalendar();
      }

      const calendar = google.calendar({ version: 'v3', auth: this.auth });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      log.info(`Cancelled calendar event: ${eventId}`);

    } catch (error) {
      log.error('Failed to cancel calendar event:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const interviewScheduler = new InterviewScheduler();
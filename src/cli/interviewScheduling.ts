import { autonomousInterviewScheduling } from '../services/autonomousInterviewScheduling';
import { log } from '../utils/logger';

/**
 * CLI command for interview scheduling
 */
export async function runInterviewScheduling(): Promise<void> {
  try {
    console.log('🗓️ Starting Interview Scheduling Service...\n');

    // Start the autonomous interview scheduling
    await autonomousInterviewScheduling.start();

    console.log('✅ Interview scheduling service started successfully!');
    console.log('📡 Monitoring for interview invitations...');
    console.log('📅 Will automatically create calendar events and send confirmations');
    console.log('⏰ Will schedule reminders and follow-up emails\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down interview scheduling service...');
      await autonomousInterviewScheduling.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down interview scheduling service...');
      await autonomousInterviewScheduling.stop();
      process.exit(0);
    });

    // Keep the process running
    console.log('Press Ctrl+C to stop the service');
    
    // Periodically show status
    setInterval(() => {
      const status = autonomousInterviewScheduling.getStatus();
      console.log(`📊 Status: ${status.isRunning ? 'Running' : 'Stopped'} | Next check: ${status.nextCheck?.toLocaleTimeString() || 'N/A'}`);
    }, 60000); // Every minute

  } catch (error) {
    console.error('❌ Error starting interview scheduling:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runInterviewScheduling();
}
import { autonomousInterviewScheduling } from '../services/autonomousInterviewScheduling.js';
import { log } from '../utils/logger.js';

/**
 * Test script for interview scheduling functionality
 */
async function testInterviewScheduling(): Promise<void> {
  try {
    console.log('🧪 Testing Interview Scheduling Service...\n');

    // Test 1: Start the service
    console.log('1️⃣ Starting interview scheduling service...');
    await autonomousInterviewScheduling.start();
    console.log('✅ Service started successfully\n');

    // Test 2: Check status
    console.log('2️⃣ Checking service status...');
    const status = autonomousInterviewScheduling.getStatus();
    console.log(`📊 Status: ${status.isRunning ? 'Running' : 'Stopped'}`);
    console.log(`📅 Next check: ${status.nextCheck?.toLocaleString() || 'N/A'}\n`);

    // Test 3: Manually trigger check
    console.log('3️⃣ Manually triggering interview invitation check...');
    await autonomousInterviewScheduling.triggerCheck();
    console.log('✅ Manual check completed\n');

    // Test 4: Wait and observe
    console.log('4️⃣ Waiting 10 seconds to observe service behavior...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Test 5: Final status check
    console.log('5️⃣ Final status check...');
    const finalStatus = autonomousInterviewScheduling.getStatus();
    console.log(`📊 Final Status: ${finalStatus.isRunning ? 'Running' : 'Stopped'}`);

    // Test 6: Stop the service
    console.log('\n6️⃣ Stopping interview scheduling service...');
    await autonomousInterviewScheduling.stop();
    console.log('✅ Service stopped successfully\n');

    console.log('🎉 Interview scheduling test completed successfully!');

  } catch (error) {
    console.error('❌ Interview scheduling test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testInterviewScheduling()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testInterviewScheduling };
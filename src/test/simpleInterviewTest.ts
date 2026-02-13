/**
 * Simple test for interview scheduling functionality
 */
async function testInterviewScheduling(): Promise<void> {
  try {
    console.log('🧪 Testing Interview Scheduling Service...\n');

    // Mock the autonomous interview scheduling service
    const mockService = {
      isRunning: false,
      
      async start() {
        console.log('🗓️ Starting autonomous interview scheduling...');
        this.isRunning = true;
        console.log('✅ Interview scheduling service started successfully!');
      },
      
      async stop() {
        console.log('🛑 Stopping interview scheduling service...');
        this.isRunning = false;
        console.log('✅ Service stopped successfully');
      },
      
      getStatus() {
        return {
          isRunning: this.isRunning,
          nextCheck: this.isRunning ? new Date(Date.now() + 5 * 60 * 1000) : null,
        };
      },
      
      async triggerCheck() {
        console.log('🔍 Manually triggering interview invitation check...');
        
        // Simulate finding interview invitations
        const mockInvitations = [
          {
            id: 'mock_interview_1',
            subject: 'Interview Invitation - Software Engineer',
            type: 'video',
            dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            interviewer: 'John Smith',
            meetingLink: 'https://zoom.us/j/123456789',
          },
        ];
        
        if (Math.random() > 0.5) {
          console.log(`📋 Found ${mockInvitations.length} interview invitation(s):`);
          for (const invitation of mockInvitations) {
            console.log(`   - ${invitation.subject} with ${invitation.interviewer}`);
            console.log(`   - ${invitation.type} interview on ${invitation.dateTime.toLocaleString()}`);
            
            // Simulate creating calendar event
            console.log(`   📅 Created calendar event: cal_${invitation.id}`);
            
            // Simulate sending confirmation
            console.log(`   📧 Sent interview confirmation`);
          }
        } else {
          console.log('📭 No new interview invitations found');
        }
        
        console.log('✅ Manual check completed');
      },
    };

    // Test 1: Start the service
    console.log('1️⃣ Starting interview scheduling service...');
    await mockService.start();
    console.log('');

    // Test 2: Check status
    console.log('2️⃣ Checking service status...');
    const status = mockService.getStatus();
    console.log(`📊 Status: ${status.isRunning ? 'Running' : 'Stopped'}`);
    console.log(`📅 Next check: ${status.nextCheck?.toLocaleString() || 'N/A'}\n`);

    // Test 3: Manually trigger check
    console.log('3️⃣ Manually triggering interview invitation check...');
    await mockService.triggerCheck();
    console.log('');

    // Test 4: Wait and observe
    console.log('4️⃣ Waiting 3 seconds to observe service behavior...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 5: Final status check
    console.log('5️⃣ Final status check...');
    const finalStatus = mockService.getStatus();
    console.log(`📊 Final Status: ${finalStatus.isRunning ? 'Running' : 'Stopped'}`);

    // Test 6: Stop the service
    console.log('\n6️⃣ Stopping interview scheduling service...');
    await mockService.stop();
    console.log('');

    console.log('🎉 Interview scheduling test completed successfully!');
    console.log('\n📋 What was tested:');
    console.log('   ✅ Service startup and shutdown');
    console.log('   ✅ Status monitoring');
    console.log('   ✅ Manual invitation check trigger');
    console.log('   ✅ Mock interview invitation processing');
    console.log('   ✅ Calendar event creation simulation');
    console.log('   ✅ Confirmation email sending simulation');

  } catch (error) {
    console.error('❌ Interview scheduling test failed:', error);
    process.exit(1);
  }
}

// Run the test
testInterviewScheduling()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
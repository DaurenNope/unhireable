// Simple test script to invoke auto_apply_to_jobs via Tauri
// This can be run in the browser console when the Tauri app is running

async function testAutoApply() {
  try {
    console.log('🚀 Starting auto-apply test...');
    
    const { invoke } = await import('@tauri-apps/api/core');
    
    const result = await invoke('auto_apply_to_jobs', {
      query: 'remote senior backend engineer',
      max_applications: 5
    });
    
    console.log('✅ Auto-apply result:', result);
    console.log(`📊 Jobs scraped: ${result.jobs_scraped}`);
    console.log(`🎯 Jobs filtered: ${result.jobs_filtered}`);
    console.log(`✅ Applications submitted: ${result.applications_submitted}`);
    console.log(`❌ Applications failed: ${result.applications_failed}`);
    
    return result;
  } catch (error) {
    console.error('❌ Auto-apply failed:', error);
    throw error;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testAutoApply = testAutoApply;
}

// For Node.js testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testAutoApply };
}



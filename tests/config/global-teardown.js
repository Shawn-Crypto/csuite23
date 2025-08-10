// Global Test Teardown
// Runs after all tests to clean up the test environment

async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up any test data if needed
  // This could include database cleanup, file cleanup, etc.
  
  // Reset environment variables if needed
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  
  console.log('✅ Global test teardown completed');
}

module.exports = globalTeardown;
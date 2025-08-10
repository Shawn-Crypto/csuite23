// Global Test Setup
// Runs before all tests to prepare the test environment

const { chromium } = require('@playwright/test');

async function globalSetup() {
  console.log('🚀 Setting up test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_12345';
  
  // Start browser for global setup if needed
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Verify test server is running
    await page.goto('http://localhost:3000', { timeout: 10000 });
    console.log('✅ Test server is accessible');
    
    // Verify health endpoint
    const response = await page.request.get('http://localhost:3000/api/health');
    if (response.status() === 200) {
      console.log('✅ Health endpoint is working');
    } else {
      console.warn('⚠️  Health endpoint returned status:', response.status());
    }
    
    // Clear any existing test data if needed
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    console.log('✅ Browser storage cleared');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('✅ Global test setup completed');
}

module.exports = globalSetup;
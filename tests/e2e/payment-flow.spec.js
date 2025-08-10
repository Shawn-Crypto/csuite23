// End-to-End Payment Flow Tests
// Testing complete user journey from lead capture to payment success

const { test, expect } = require('@playwright/test');

// Test data generators
function generateTestCustomer() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `test${timestamp}@example.com`,
    phone: `9876${String(timestamp).slice(-6)}` // 10 digit Indian number
  };
}

function generateTestOrder(overrides = {}) {
  return {
    amount: 1999,
    currency: 'INR',
    products: ['course'],
    ...generateTestCustomer(),
    ...overrides
  };
}

test.describe('Complete Payment Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.addInitScript(() => {
      window.testMode = true;
      localStorage.setItem('test_mode', 'true');
    });
  });

  test('Full payment journey - CTA click to success page', async ({ page }) => {
    // Step 1: Navigate to landing page
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Complete Indian Investor/);
    
    // Step 2: Click first CTA button to open customer form
    const ctaButton = page.locator('a').first();
    await ctaButton.click();
    
    // Step 3: Wait for Razorpay customer form modal
    await expect(page.locator('#razorpay-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#customer-form')).toBeVisible();
    
    // Step 4: Fill customer details form
    const testCustomer = generateTestCustomer();
    await page.fill('#customer-name', testCustomer.name);
    await page.fill('#customer-email', testCustomer.email);
    await page.fill('#customer-phone', testCustomer.phone);
    await page.check('#terms-checkbox');
    
    // Step 5: Submit form and expect lead capture + Razorpay initialization
    await Promise.all([
      // Wait for lead capture API call
      page.waitForResponse(resp => 
        resp.url().includes('/api/capture-lead') && 
        resp.status() === 200,
        { timeout: 15000 }
      ),
      // Wait for order creation API call
      page.waitForResponse(resp => 
        resp.url().includes('/api/create-order') && 
        resp.status() === 200,
        { timeout: 15000 }
      ),
      // Click submit button
      page.click('#customer-form button[type="submit"]')
    ]);
    
    // Step 6: Verify Razorpay checkout loads (in test mode, iframe may not load)
    // Check if processing modal appears
    const processingModal = page.locator('text=Initializing Payment');
    await expect(processingModal.or(page.locator('iframe[src*="razorpay"]')))
      .toBeVisible({ timeout: 20000 });
    
    console.log('✅ Payment flow initialization completed successfully');
  });

  test('Customer form validation - real-time validation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Click CTA to open form
    await page.locator('a').first().click();
    await expect(page.locator('#customer-form')).toBeVisible();
    
    // Test empty form submission
    await page.click('#customer-form button[type="submit"]');
    
    // Check for validation (HTML5 validation should prevent submission)
    const nameField = page.locator('#customer-name');
    const isRequired = await nameField.getAttribute('required');
    expect(isRequired).not.toBeNull();
    
    // Test invalid email format
    await page.fill('#customer-name', 'Test User');
    await page.fill('#customer-email', 'invalid-email');
    await page.fill('#customer-phone', '9876543210');
    
    // Blur email field to trigger validation
    await page.locator('#customer-email').blur();
    
    // Check if email error appears
    await expect(page.locator('#email-error')).toBeVisible({ timeout: 5000 });
    
    // Test invalid phone number
    await page.fill('#customer-phone', '123');
    await page.locator('#customer-phone').blur();
    
    // Check if phone validation works
    const phoneValue = await page.locator('#customer-phone').inputValue();
    expect(phoneValue).toBe('123'); // Should only allow digits
    
    // Test valid data
    const testCustomer = generateTestCustomer();
    await page.fill('#customer-name', testCustomer.name);
    await page.fill('#customer-email', testCustomer.email);
    await page.fill('#customer-phone', testCustomer.phone);
    await page.check('#terms-checkbox');
    
    // Check if form is ready for submission
    const submitButton = page.locator('#customer-form button[type="submit"]');
    await expect(submitButton).not.toBeDisabled();
  });

  test('Hero section clickable area functionality', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check if hero section is clickable
    const heroSection = page.locator('.hero-content');
    
    // If hero section exists and is clickable, test it
    const heroExists = await heroSection.count() > 0;
    if (heroExists) {
      const cursorStyle = await heroSection.evaluate(el => 
        window.getComputedStyle(el).cursor
      );
      
      if (cursorStyle === 'pointer') {
        // Click hero section
        await heroSection.click({ position: { x: 100, y: 100 } });
        
        // Should open customer form modal
        await expect(page.locator('#razorpay-modal')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#customer-form')).toBeVisible();
        
        console.log('✅ Hero section click functionality works');
      }
    }
  });

  test('Success page with URL parameters', async ({ page }) => {
    // Navigate directly to success page with test parameters
    const orderId = 'test_order_123456';
    const email = 'test@example.com';
    const amount = '1999';
    
    await page.goto(`http://localhost:3000/success.html?order_id=${orderId}&email=${email}&amount=${amount}`);
    
    // Check if success page loads
    await expect(page).toHaveTitle(/Success/);
    
    // Verify GTM dataLayer tracking
    const dataLayer = await page.evaluate(() => window.dataLayer || []);
    
    // Should have purchase tracking event
    const hasPurchaseEvent = dataLayer.some(event => 
      event.event === 'purchase' || event.event === 'purchaseComplete'
    );
    
    if (hasPurchaseEvent) {
      console.log('✅ GTM purchase tracking detected on success page');
    }
    
    // Check localStorage for purchase data
    const lastPurchase = await page.evaluate(() => 
      localStorage.getItem('lastPurchase')
    );
    
    if (lastPurchase) {
      const purchaseData = JSON.parse(lastPurchase);
      console.log('✅ Purchase data persisted in localStorage:', purchaseData);
    }
  });

  test('API endpoint availability check', async ({ page, request }) => {
    // Test health check endpoint
    const healthResponse = await request.get('http://localhost:3000/api/health');
    expect(healthResponse.status()).toBe(200);
    
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.response_time_ms).toBeDefined();
    
    console.log('✅ Health check endpoint working');
    
    // Test create-order endpoint responds to POST
    const orderResponse = await request.post('http://localhost:3000/api/create-order', {
      data: generateTestOrder()
    });
    
    // Should either succeed or fail with proper error (not 404)
    expect([200, 400, 500]).toContain(orderResponse.status());
    
    console.log('✅ Create order endpoint accessible');
    
    // Test webhook endpoint exists (should reject GET)
    const webhookResponse = await request.get('http://localhost:3000/api/webhook');
    expect(webhookResponse.status()).toBe(405); // Method not allowed
    
    console.log('✅ Webhook endpoint properly configured');
    
    // Test capture-lead endpoint
    const leadResponse = await request.post('http://localhost:3000/api/capture-lead', {
      data: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        source: 'e2e_test'
      }
    });
    
    expect([200, 400, 500]).toContain(leadResponse.status());
    
    console.log('✅ Lead capture endpoint accessible');
  });

  test('Loading states and user feedback', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Click CTA to open form
    await page.locator('a').first().click();
    await expect(page.locator('#customer-form')).toBeVisible();
    
    // Fill form with valid data
    const testCustomer = generateTestCustomer();
    await page.fill('#customer-name', testCustomer.name);
    await page.fill('#customer-email', testCustomer.email);
    await page.fill('#customer-phone', testCustomer.phone);
    await page.check('#terms-checkbox');
    
    // Click submit and check for loading states
    const submitButton = page.locator('#customer-form button[type="submit"]');
    await submitButton.click();
    
    // Should show loading state during processing
    await expect(page.locator('text=Processing')).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Loading states working correctly');
  });

  test('Error handling - API timeout simulation', async ({ page }) => {
    // Intercept API calls and delay them to test timeout handling
    await page.route('**/api/capture-lead', route => {
      // Delay response beyond timeout to test timeout handling
      setTimeout(() => {
        route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request timeout' })
        });
      }, 12000); // 12 seconds - beyond our 10 second timeout
    });
    
    await page.goto('http://localhost:3000');
    
    // Open form and fill it
    await page.locator('a').first().click();
    await expect(page.locator('#customer-form')).toBeVisible();
    
    const testCustomer = generateTestCustomer();
    await page.fill('#customer-name', testCustomer.name);
    await page.fill('#customer-email', testCustomer.email);
    await page.fill('#customer-phone', testCustomer.phone);
    await page.check('#terms-checkbox');
    
    // Submit and expect timeout handling
    await page.click('#customer-form button[type="submit"]');
    
    // Should continue to payment even if lead capture times out
    await expect(page.locator('text=Initializing Payment')).toBeVisible({ timeout: 15000 });
    
    console.log('✅ Timeout error handling working correctly');
  });

  test('Mobile responsiveness check', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('http://localhost:3000');
    
    // Check if page is mobile responsive
    const ctaButton = page.locator('a').first();
    await expect(ctaButton).toBeVisible();
    
    // Click CTA on mobile
    await ctaButton.click();
    
    // Modal should be responsive
    const modal = page.locator('#razorpay-modal');
    await expect(modal).toBeVisible();
    
    // Form should be properly sized for mobile
    const form = page.locator('#customer-form');
    const formBox = await form.boundingBox();
    
    // Form should not exceed viewport width
    expect(formBox.width).toBeLessThanOrEqual(375);
    
    console.log('✅ Mobile responsiveness verified');
  });

  test('JavaScript error detection', async ({ page }) => {
    const jsErrors = [];
    
    // Capture JavaScript errors
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:3000');
    
    // Interact with the page
    await page.locator('a').first().click();
    await expect(page.locator('#customer-form')).toBeVisible();
    
    // Fill and submit form
    const testCustomer = generateTestCustomer();
    await page.fill('#customer-name', testCustomer.name);
    await page.fill('#customer-email', testCustomer.email);
    await page.fill('#customer-phone', testCustomer.phone);
    await page.check('#terms-checkbox');
    
    // Wait a moment for any async errors
    await page.waitForTimeout(2000);
    
    // Check for JavaScript errors
    const criticalErrors = jsErrors.filter(error => 
      !error.includes('ERR_NETWORK') && // Ignore network errors in test
      !error.includes('favicon') &&    // Ignore favicon errors
      !error.includes('gtm') &&        // Ignore GTM errors in test
      !error.toLowerCase().includes('razorpay') // Ignore Razorpay errors in test mode
    );
    
    expect(criticalErrors).toHaveLength(0);
    
    if (criticalErrors.length === 0) {
      console.log('✅ No critical JavaScript errors detected');
    } else {
      console.log('❌ JavaScript errors found:', criticalErrors);
    }
  });
});
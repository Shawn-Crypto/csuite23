// Basic Razorpay Integration Tests
const { test, expect } = require('@playwright/test');

test.describe('Basic Razorpay Integration', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the landing page successfully', async ({ page }) => {
    // Check if page loads
    await expect(page).toHaveTitle(/Complete Indian Investor/i);
    
    // Check if CTA buttons are present
    const ctaButtons = page.locator('.cta-button');
    const count = await ctaButtons.count();
    expect(count).toBeGreaterThan(0);
    
    console.log(`Found ${count} CTA buttons`);
  });

  test('should have Razorpay checkout script loaded', async ({ page }) => {
    // Check if our razorpay-checkout.js is loaded
    await page.waitForLoadState('networkidle');
    
    const hasRazorpayCheckout = await page.evaluate(() => {
      return typeof window.razorpayCheckout !== 'undefined';
    });
    
    expect(hasRazorpayCheckout).toBeTruthy();
  });

  test('should find correct CTA button and trigger customer form', async ({ page }) => {
    // Find the pricing section CTA button specifically
    const pricingCTA = page.locator('.cta-button').filter({ hasText: 'ENROLL NOW' }).first();
    await expect(pricingCTA).toBeVisible();
    
    // Click the button
    await pricingCTA.click();
    
    // Wait for modal to appear
    await page.waitForSelector('#razorpay-modal', { state: 'visible', timeout: 10000 });
    
    // Check if customer form is displayed
    await expect(page.locator('text=Complete Your Enrollment')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test('should fill customer form and initiate order creation', async ({ page }) => {
    // Mock API response for successful order creation
    await page.route('**/api/create-order', async route => {
      const request = route.request();
      console.log('API called with:', await request.postData());
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          order: {
            id: 'order_test_123',
            amount: 199900,
            currency: 'INR',
            receipt: 'receipt_test_123'
          },
          key_id: 'rzp_test_SWb5ypxKYwCUKK'
        })
      });
    });

    // Click CTA button
    const pricingCTA = page.locator('.cta-button').filter({ hasText: 'ENROLL NOW' }).first();
    await pricingCTA.click();
    
    // Wait for modal and fill form
    await page.waitForSelector('#razorpay-modal', { state: 'visible' });
    
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="phone"]', '9999999999');
    await page.check('input[type="checkbox"]');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show loading state
    await expect(page.locator('text=Initializing Payment')).toBeVisible({ timeout: 5000 });
  });

  test('should track checkout initiation in dataLayer', async ({ page }) => {
    // Initialize dataLayer
    await page.evaluate(() => {
      window.dataLayer = [];
    });

    // Click CTA
    const pricingCTA = page.locator('.cta-button').filter({ hasText: 'ENROLL NOW' }).first();
    await pricingCTA.click();
    
    // Check dataLayer event
    const dataLayerEvents = await page.evaluate(() => window.dataLayer);
    const checkoutEvent = dataLayerEvents.find(e => e.event === 'begin_checkout');
    
    expect(checkoutEvent).toBeDefined();
    expect(checkoutEvent.value).toBe(1999);
    expect(checkoutEvent.currency).toBe('INR');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/create-order', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Server error'
        })
      });
    });

    // Click CTA and fill form
    const pricingCTA = page.locator('.cta-button').filter({ hasText: 'ENROLL NOW' }).first();
    await pricingCTA.click();
    
    await page.waitForSelector('#razorpay-modal', { state: 'visible' });
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="phone"]', '9999999999');
    await page.check('input[type="checkbox"]');
    
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('text=Failed to initialize payment')).toBeVisible({ timeout: 10000 });
  });
});
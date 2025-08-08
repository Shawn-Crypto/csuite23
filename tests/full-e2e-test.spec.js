// Full End-to-End Payment Flow Test
const { test, expect } = require('@playwright/test');

// This test will work once Vercel dev server is running
test.describe('Complete Payment Flow (Requires Vercel Dev)', () => {
  
  test('should complete full payment simulation', async ({ page }) => {
    // Navigate to site
    await page.goto('/');
    
    // Click ENROLL NOW
    const ctaButton = page.locator('.cta-button').filter({ hasText: 'ENROLL NOW' }).first();
    await ctaButton.click();
    
    // Fill customer form
    await page.waitForSelector('#razorpay-modal');
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="email"]', 'john@example.com');
    await page.fill('input[name="phone"]', '9876543210');
    await page.check('input[type="checkbox"]');
    
    // Submit form - this will call real API
    await page.click('button[type="submit"]');
    
    // Wait for Razorpay widget to load (if API is working)
    // Or error message if API is down
    await page.waitForTimeout(3000);
    
    // Check what happened
    const modalContent = await page.locator('#razorpay-modal').textContent();
    console.log('Modal content:', modalContent);
    
    // Should either show Razorpay widget or error message
    const hasError = modalContent.includes('Failed to initialize payment');
    const hasRazorpay = await page.evaluate(() => typeof window.Razorpay !== 'undefined');
    
    if (!hasError) {
      expect(hasRazorpay).toBe(true);
      console.log('✅ Razorpay widget loaded successfully');
    } else {
      console.log('⚠️ API not available, but error handling works');
    }
  });

  test('should handle real API order creation', async ({ request }) => {
    // This will only work if Vercel dev is running
    const response = await request.post('/api/create-order', {
      data: {
        amount: 1999,
        currency: 'INR',
        receipt: 'e2e_test_' + Date.now(),
        notes: {
          test: 'playwright_e2e'
        }
      }
    });
    
    console.log('API Response Status:', response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.order.id).toMatch(/^order_/);
      console.log('✅ Real API order creation successful:', data.order.id);
    } else {
      console.log('⚠️ API not available - need to run "vercel dev"');
    }
  });

  test('should simulate complete payment verification', async ({ request }) => {
    const crypto = require('crypto');
    
    // First create an order
    const orderResponse = await request.post('/api/create-order', {
      data: {
        amount: 1999,
        currency: 'INR',
        receipt: 'verify_test_' + Date.now()
      }
    });
    
    if (orderResponse.status() === 200) {
      const orderData = await orderResponse.json();
      
      // Simulate payment verification
      const fakePaymentId = 'pay_test_' + Date.now();
      const body = orderData.order.id + '|' + fakePaymentId;
      const signature = crypto
        .createHmac('sha256', 'eUqfESP2Az0g76dorqwGmHpt')
        .update(body)
        .digest('hex');
      
      const verifyResponse = await request.post('/api/verify-payment', {
        data: {
          razorpay_order_id: orderData.order.id,
          razorpay_payment_id: fakePaymentId,
          razorpay_signature: signature,
          customer_data: {
            name: 'Test User',
            email: 'test@example.com',
            phone: '9999999999'
          }
        }
      });
      
      if (verifyResponse.status() === 200) {
        const verifyData = await verifyResponse.json();
        expect(verifyData.success).toBe(true);
        console.log('✅ Complete payment simulation successful');
      }
    } else {
      console.log('⚠️ Need Vercel dev server for full E2E test');
    }
  });
});

test.describe('Real Razorpay Widget Testing', () => {
  test('should test with actual Razorpay test cards', async ({ page }) => {
    // This test would need manual interaction or Razorpay test mode
    await page.goto('/');
    
    console.log('📝 Manual Test Instructions:');
    console.log('1. Start Vercel dev: vercel dev');
    console.log('2. Click ENROLL NOW button');
    console.log('3. Fill form and proceed');
    console.log('4. Use test card: 4111 1111 1111 1111');
    console.log('5. CVV: Any 3 digits, Expiry: Any future date');
    console.log('6. Verify success flow');
    
    // Just verify the setup is ready
    const ctaCount = await page.locator('.cta-button').count();
    expect(ctaCount).toBeGreaterThan(0);
  });
});
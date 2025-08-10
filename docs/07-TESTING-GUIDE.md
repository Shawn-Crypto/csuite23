# Testing & Validation Guide

**Target**: Claude Code sessions needing comprehensive testing strategies  
**Guide 7 of 8**: End-to-End Testing, Performance Testing, and Validation

## Testing Environment Setup

### Environment Configuration
```bash
# .env.test
RAZORPAY_TEST_KEY_ID=rzp_test_xxxxx
RAZORPAY_TEST_KEY_SECRET=xxxxx
RAZORPAY_TEST_WEBHOOK_SECRET=xxxxx
META_TEST_EVENT_CODE=TEST12345
DATABASE_URL=postgresql://test_database
NODE_ENV=test
```

### Test Data Generators
```javascript
// utils/test-helpers.js
export function generateTestCustomer() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `test${timestamp}@example.com`,
    phone: `+9198765${String(timestamp).slice(-5)}`
  };
}

export function generateTestOrder(overrides = {}) {
  return {
    amount: 1499,
    currency: 'INR',
    products: ['course'],
    ...generateTestCustomer(),
    ...overrides
  };
}

export function generateTestWebhook(orderId, paymentId) {
  const timestamp = Math.floor(Date.now() / 1000);
  
  return {
    entity: 'event',
    account_id: 'acc_test',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: paymentId || `pay_test_${timestamp}`,
          amount: 149900, // in paise
          currency: 'INR',
          status: 'captured',
          order_id: orderId || `order_test_${timestamp}`,
          method: 'upi',
          email: 'test@example.com',
          contact: '+919876543210',
          created_at: timestamp,
          notes: {
            products: JSON.stringify(['course'])
          }
        }
      }
    },
    created_at: timestamp
  };
}

export function generateWebhookSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
```

## End-to-End Testing Suite

### Complete Payment Flow Test
```javascript
// tests/e2e/payment-flow.test.js
import { test, expect } from '@playwright/test';

test.describe('Complete Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.addInitScript(() => {
      window.testMode = true;
      localStorage.setItem('test_mode', 'true');
    });
  });

  test('Full payment journey from lead to success', async ({ page }) => {
    // Step 1: Navigate to landing page
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/LFG Ventures/);
    
    // Step 2: Click CTA to open lead modal
    await page.click('[data-trigger="lead-capture"]');
    await expect(page.locator('#leadCaptureModal')).toBeVisible();
    
    // Step 3: Fill lead capture form
    const testCustomer = generateTestCustomer();
    await page.fill('#leadName', testCustomer.name);
    await page.fill('#leadEmail', testCustomer.email);
    await page.fill('#leadPhone', testCustomer.phone);
    
    // Step 4: Submit lead form
    await Promise.all([
      page.waitForResponse(resp => 
        resp.url().includes('/api/capture-lead-async') && 
        resp.status() === 200
      ),
      page.click('#leadSubmitBtn')
    ]);
    
    // Step 5: Wait for Razorpay checkout
    await page.waitForSelector('iframe[src*="razorpay"]', { 
      timeout: 15000 
    });
    
    // Step 6: Verify Razorpay iframe loaded
    const razorpayFrame = page.frameLocator('iframe[src*="razorpay"]');
    await expect(razorpayFrame.locator('text=Pay Now')).toBeVisible();
    
    // Note: Can't complete actual payment in test mode
    // Would need Razorpay test cards and sandbox environment
    
    console.log('✅ Payment flow test completed');
  });

  test('Lead capture with validation errors', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('[data-trigger="lead-capture"]');
    
    // Test empty submission
    await page.click('#leadSubmitBtn');
    await expect(page.locator('#nameError')).toContainText('required');
    
    // Test invalid email
    await page.fill('#leadEmail', 'invalid-email');
    await page.click('#leadSubmitBtn');
    await expect(page.locator('#emailError')).toContainText('valid email');
    
    // Test invalid phone
    await page.fill('#leadPhone', '123');
    await page.click('#leadSubmitBtn');
    await expect(page.locator('#phoneError')).toContainText('valid phone');
  });

  test('Payment success page tracking', async ({ page }) => {
    // Navigate directly to success page with params
    const orderId = 'test_order_123';
    const email = 'test@example.com';
    const amount = '1499';
    
    await page.goto(`http://localhost:3000/success.html?order_id=${orderId}&email=${email}&amount=${amount}`);
    
    // Verify order details displayed
    await expect(page.locator('#orderIdDisplay')).toContainText(orderId);
    await expect(page.locator('#emailDisplay')).toContainText(email);
    await expect(page.locator('#amountDisplay')).toContainText(amount);
    
    // Check if tracking fired
    const dataLayer = await page.evaluate(() => window.dataLayer);
    const purchaseEvent = dataLayer.find(e => e.event === 'purchaseComplete');
    
    expect(purchaseEvent).toBeDefined();
    expect(purchaseEvent.transaction_id).toBe(orderId);
    expect(purchaseEvent.value).toBe(parseFloat(amount));
  });
});
```

## API Endpoint Testing

### Order Creation Tests
```javascript
// tests/api/create-order.test.js
import request from 'supertest';
import app from '../../api/server';

describe('POST /api/create-razorpay-order', () => {
  test('creates order with valid data', async () => {
    const orderData = generateTestOrder();
    
    const response = await request(app)
      .post('/api/create-razorpay-order')
      .send(orderData)
      .expect(200);
    
    expect(response.body).toMatchObject({
      success: true,
      order_id: expect.stringMatching(/^order_/),
      amount: orderData.amount * 100,
      currency: 'INR',
      key_id: expect.any(String)
    });
  });

  test('rejects invalid amount', async () => {
    const response = await request(app)
      .post('/api/create-razorpay-order')
      .send({
        ...generateTestOrder(),
        amount: -100
      })
      .expect(400);
    
    expect(response.body.error).toContain('Invalid amount');
  });

  test('rejects missing email', async () => {
    const response = await request(app)
      .post('/api/create-razorpay-order')
      .send({
        amount: 1499,
        customer_name: 'Test User'
      })
      .expect(400);
    
    expect(response.body.error).toContain('email');
  });

  test('handles Razorpay API errors', async () => {
    // Mock Razorpay to return error
    jest.spyOn(razorpay.orders, 'create').mockRejectedValue({
      statusCode: 400,
      error: { description: 'Invalid request' }
    });
    
    const response = await request(app)
      .post('/api/create-razorpay-order')
      .send(generateTestOrder())
      .expect(400);
    
    expect(response.body.error).toBeDefined();
  });
});
```

### Webhook Processing Tests
```javascript
// tests/api/webhook.test.js
describe('POST /api/razorpay-webhook', () => {
  const webhookSecret = process.env.RAZORPAY_TEST_WEBHOOK_SECRET;
  
  test('processes valid webhook with correct signature', async () => {
    const webhookData = generateTestWebhook();
    const signature = generateWebhookSignature(webhookData, webhookSecret);
    
    const response = await request(app)
      .post('/api/razorpay-webhook')
      .set('x-razorpay-signature', signature)
      .send(webhookData)
      .expect(200);
    
    expect(response.body).toMatchObject({
      success: true,
      event: 'payment.captured',
      processing_time_ms: expect.any(Number)
    });
    
    // Verify response time is under 200ms
    expect(response.body.processing_time_ms).toBeLessThan(200);
  });

  test('rejects webhook with invalid signature', async () => {
    const webhookData = generateTestWebhook();
    
    await request(app)
      .post('/api/razorpay-webhook')
      .set('x-razorpay-signature', 'invalid_signature')
      .send(webhookData)
      .expect(401);
  });

  test('rejects webhook without signature', async () => {
    await request(app)
      .post('/api/razorpay-webhook')
      .send(generateTestWebhook())
      .expect(400);
  });

  test('handles malformed webhook data', async () => {
    const signature = generateWebhookSignature('invalid', webhookSecret);
    
    await request(app)
      .post('/api/razorpay-webhook')
      .set('x-razorpay-signature', signature)
      .send('invalid')
      .expect(500);
  });
});
```

## Performance Testing

### Webhook Performance Test
```javascript
// tests/performance/webhook-performance.test.js
import autocannon from 'autocannon';

describe('Webhook Performance', () => {
  test('handles 100 concurrent webhooks under 200ms', async () => {
    const webhookData = generateTestWebhook();
    const signature = generateWebhookSignature(webhookData, webhookSecret);
    
    const result = await autocannon({
      url: 'http://localhost:3000/api/razorpay-webhook',
      connections: 10,
      duration: 10,
      pipelining: 1,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': signature
      },
      body: JSON.stringify(webhookData)
    });
    
    // Assert performance metrics
    expect(result.latency.p99).toBeLessThan(500); // 99th percentile < 500ms
    expect(result.latency.mean).toBeLessThan(200); // Average < 200ms
    expect(result.errors).toBe(0); // No errors
    expect(result.non2xx).toBe(0); // All successful
    
    console.log('Performance results:', {
      avgLatency: result.latency.mean,
      p99Latency: result.latency.p99,
      requests: result.requests.total,
      throughput: result.throughput.mean
    });
  });
});
```

### API Load Testing
```javascript
// tests/performance/load-test.js
import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },  // Stay at 20 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  // Test order creation
  const orderPayload = JSON.stringify(generateTestOrder());
  
  const orderResponse = http.post(
    'http://localhost:3000/api/create-razorpay-order',
    orderPayload,
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(orderResponse, {
    'order creation successful': (r) => r.status === 200,
    'order has ID': (r) => JSON.parse(r.body).order_id !== undefined,
  });
  
  sleep(1);
}
```

## Meta Pixel Testing

### Meta CAPI Validation
```javascript
// tests/tracking/meta-pixel.test.js
describe('Meta Pixel Integration', () => {
  test('sends correct event format to Meta CAPI', async () => {
    const testData = {
      order_id: 'test_order_123',
      customer_email: 'test@example.com',
      customer_name: 'Test User',
      customer_phone: '+919876543210',
      amount: 1499,
      products: ['course']
    };
    
    const response = await request(app)
      .post('/api/meta-capi-server')
      .send(testData)
      .expect(200);
    
    expect(response.body).toMatchObject({
      success: true,
      event_id: `purchase_${testData.order_id}`
    });
  });

  test('event deduplication works correctly', async () => {
    const orderId = 'dedup_test_123';
    const eventId = `purchase_${orderId}`;
    
    // Simulate client-side event
    await page.evaluate((eventId) => {
      fbq('track', 'Purchase', {
        value: 1499,
        currency: 'INR'
      }, { eventID: eventId });
    }, eventId);
    
    // Simulate server-side event with same ID
    await request(app)
      .post('/api/meta-capi-server')
      .send({
        order_id: orderId,
        amount: 1499,
        customer_email: 'test@example.com'
      });
    
    // Check Events Manager for deduplication
    // This would need manual verification or Meta API access
    console.log(`Check Events Manager for event ID: ${eventId}`);
  });
});
```

## Integration Testing

### Database Integration Tests
```javascript
// tests/integration/database.test.js
import { supabase } from '../../utils/supabase-client';

describe('Database Operations', () => {
  beforeEach(async () => {
    // Clean test data
    await supabase
      .from('webhook_events')
      .delete()
      .like('order_id', 'test_%');
  });

  test('webhook event logging', async () => {
    const webhookData = {
      order_id: 'test_db_123',
      event_type: 'payment.captured',
      amount: 1499,
      customer_email: 'test@example.com'
    };
    
    const { data, error } = await supabase
      .from('webhook_events')
      .insert([webhookData])
      .select();
    
    expect(error).toBeNull();
    expect(data[0]).toMatchObject(webhookData);
  });

  test('prevents duplicate processing', async () => {
    const orderId = 'test_duplicate_123';
    
    // First insert
    await supabase
      .from('webhook_events')
      .insert([{ order_id: orderId, processed: true }]);
    
    // Try to process again
    const { data } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('order_id', orderId)
      .eq('processed', false);
    
    expect(data).toHaveLength(0); // Should not process again
  });
});
```

## Manual Testing Checklist

### Payment Flow Testing
```markdown
## Payment Flow Checklist

### Lead Capture Modal
- [ ] Modal opens on CTA click
- [ ] Form validation works (empty, invalid)
- [ ] Loading state appears during submission
- [ ] Error messages display correctly
- [ ] Modal closes after successful submission
- [ ] Data persists to sessionStorage

### Razorpay Checkout
- [ ] Checkout opens with correct amount
- [ ] Customer details are prefilled
- [ ] Test card works: 4111 1111 1111 1111
- [ ] Payment processes successfully
- [ ] Cancellation handled gracefully

### Success Page
- [ ] Redirects to success page after payment
- [ ] Order details display correctly
- [ ] Tracking events fire (check console)
- [ ] Email confirmation mentioned

### Webhook Processing
- [ ] Check Vercel logs for webhook receipt
- [ ] Verify response time < 200ms
- [ ] Check database for webhook event
- [ ] Verify Zapier webhook triggered
- [ ] Check Meta Events Manager
```

### Testing Different Products
```markdown
## Product Testing Matrix

| Products | Amount | Expected Delivery |
|----------|--------|------------------|
| Course Only | ₹1,499 | Kajabi access email |
| Course + Database | ₹3,998 | Kajabi + Database email |
| Course + Strategy | ₹6,498 | Kajabi + Cal.com link |
| Full Bundle | ₹8,997 | All three deliverables |

For each combination:
- [ ] Correct amount charged
- [ ] Correct products detected in webhook
- [ ] Correct emails sent via Zapier
- [ ] Correct Meta CAPI data
```

## Testing Tools & Commands

### Local Testing Setup
```bash
# Start local server with test environment
NODE_ENV=test npm run dev

# Run all tests
npm test

# Run specific test suite
npm test -- tests/api/webhook.test.js

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance
```

### Webhook Testing with ngrok
```bash
# Expose local webhook endpoint
ngrok http 3000

# Update Razorpay webhook URL to ngrok URL
# https://xxxxx.ngrok.io/api/razorpay-webhook

# Test with real Razorpay events
```

### Meta Pixel Testing
```bash
# Use Meta Pixel Helper Chrome Extension
# 1. Install from Chrome Web Store
# 2. Navigate to your site
# 3. Check for pixel fires
# 4. Verify event parameters

# Check Events Manager
# 1. Go to Events Manager
# 2. Select your pixel
# 3. Click "Test Events"
# 4. Enter test code: TEST12345
# 5. Verify events appear
```

## Monitoring & Validation

### Production Monitoring Script
```javascript
// scripts/monitor-production.js
async function monitorProduction() {
  console.log('🔍 Running production checks...');
  
  // 1. Check API health
  const healthCheck = await fetch('https://yoursite.com/api/health-check');
  console.log('API Health:', await healthCheck.json());
  
  // 2. Test order creation (with test flag)
  const orderTest = await fetch('https://yoursite.com/api/create-razorpay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...generateTestOrder(),
      test_mode: true
    })
  });
  console.log('Order Creation:', orderTest.status === 200 ? '✅' : '❌');
  
  // 3. Check webhook endpoint
  const webhookTest = await fetch('https://yoursite.com/api/razorpay-webhook', {
    method: 'POST'
  });
  console.log('Webhook Endpoint:', webhookTest.status === 405 ? '✅' : '❌');
  
  // 4. Check Meta CAPI
  const metaTest = await fetch('https://yoursite.com/api/meta-capi-server', {
    method: 'GET'
  });
  console.log('Meta CAPI Endpoint:', metaTest.status === 405 ? '✅' : '❌');
  
  console.log('✅ Production monitoring complete');
}

// Run every hour
setInterval(monitorProduction, 3600000);
```

## Test Coverage Requirements

### Minimum Coverage Targets
- **Unit Tests**: 80% coverage
- **Integration Tests**: Core flows covered
- **E2E Tests**: Happy path + error cases
- **Performance Tests**: < 200ms webhook response

### Critical Paths to Test
1. Lead capture → Payment → Success
2. Webhook signature verification
3. Product detection logic
4. Meta CAPI event formatting
5. Error handling and timeouts
6. Database operations
7. External API integrations

## Next Steps

1. **Set up test environment** with test credentials
2. **Write unit tests** for all utility functions
3. **Create E2E tests** for complete payment flow
4. **Run performance tests** on webhook endpoints
5. **Set up monitoring** for production
6. **Create test data** generators
7. **Document test scenarios** for manual testing

This comprehensive testing approach ensures reliability and catches issues before production deployment.
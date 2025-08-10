const crypto = require('crypto');
const { createMocks } = require('node-mocks-http');

// Mock the webhook handler
const webhookHandler = require('../api/webhook.js');

describe('Webhook Performance Tests', () => {
  const mockWebhookSecret = 'test_webhook_secret_12345';
  const mockPayload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_123456789',
          order_id: 'order_test_987654321',
          amount: 199900,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
          email: 'test@example.com',
          contact: '9876543210'
        }
      }
    }
  };

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = mockWebhookSecret;
    // Clear processed events cache for each test
    webhookHandler.clearProcessedEvents();
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  function generateValidSignature(body, secret) {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  test('responds under 200ms with valid signature', async () => {
    const body = JSON.stringify(mockPayload);
    const signature = generateValidSignature(body, mockWebhookSecret);
    
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'x-razorpay-signature': signature,
        'content-type': 'application/json'
      }
    });

    // Mock the stream methods for raw body parsing
    const chunks = [Buffer.from(body)];
    req.on = jest.fn((event, callback) => {
      if (event === 'data') {
        chunks.forEach(chunk => callback(chunk));
      } else if (event === 'end') {
        callback();
      }
    });

    const startTime = Date.now();
    await webhookHandler(req, res);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(200);
    expect(res._getStatusCode()).toBe(200);
    
    const responseData = JSON.parse(res._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.processing_time_ms).toBeLessThan(200);
  });

  test('validates signature using raw body correctly', async () => {
    const body = JSON.stringify(mockPayload);
    const validSignature = generateValidSignature(body, mockWebhookSecret);
    const invalidSignature = 'invalid_signature_123';
    
    // Test with valid signature
    const { req: validReq, res: validRes } = createMocks({
      method: 'POST',
      headers: { 'x-razorpay-signature': validSignature }
    });
    
    const chunks = [Buffer.from(body)];
    validReq.on = jest.fn((event, callback) => {
      if (event === 'data') chunks.forEach(chunk => callback(chunk));
      else if (event === 'end') callback();
    });

    await webhookHandler(validReq, validRes);
    expect(validRes._getStatusCode()).toBe(200);

    // Test with invalid signature  
    const { req: invalidReq, res: invalidRes } = createMocks({
      method: 'POST',
      headers: { 'x-razorpay-signature': invalidSignature }
    });
    
    invalidReq.on = jest.fn((event, callback) => {
      if (event === 'data') chunks.forEach(chunk => callback(chunk));
      else if (event === 'end') callback();
    });

    await webhookHandler(invalidReq, invalidRes);
    expect(invalidRes._getStatusCode()).toBe(401);
  });

  test('handles malformed payload gracefully under 200ms', async () => {
    const malformedBody = '{"invalid": json}';
    const signature = generateValidSignature(malformedBody, mockWebhookSecret);
    
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-razorpay-signature': signature }
    });

    const chunks = [Buffer.from(malformedBody)];
    req.on = jest.fn((event, callback) => {
      if (event === 'data') chunks.forEach(chunk => callback(chunk));
      else if (event === 'end') callback();
    });

    const startTime = Date.now();
    await webhookHandler(req, res);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(200);
    expect(res._getStatusCode()).toBe(500);
  });

  test('processes payment captured event asynchronously', async () => {
    // Create unique payload for this test
    const uniquePayload = {
      ...mockPayload,
      payload: {
        payment: {
          entity: {
            ...mockPayload.payload.payment.entity,
            id: `pay_unique_${Date.now()}`,
            order_id: `order_unique_${Date.now()}`
          }
        }
      }
    };
    
    const body = JSON.stringify(uniquePayload);
    const signature = generateValidSignature(body, mockWebhookSecret);
    
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-razorpay-signature': signature }
    });

    const chunks = [Buffer.from(body)];
    req.on = jest.fn((event, callback) => {
      if (event === 'data') chunks.forEach(chunk => callback(chunk));
      else if (event === 'end') callback();
    });

    await webhookHandler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.processing_time_ms).toBeDefined();
    
    // Allow async processing to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('deduplicates webhook events by payment ID', async () => {
    const body = JSON.stringify(mockPayload);
    const signature = generateValidSignature(body, mockWebhookSecret);
    
    const createRequest = () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-razorpay-signature': signature }
      });
      
      const chunks = [Buffer.from(body)];
      req.on = jest.fn((event, callback) => {
        if (event === 'data') chunks.forEach(chunk => callback(chunk));
        else if (event === 'end') callback();
      });
      
      return { req, res };
    };

    // First request
    const { req: req1, res: res1 } = createRequest();
    await webhookHandler(req1, res1);
    expect(res1._getStatusCode()).toBe(200);

    // Second request (duplicate)
    const { req: req2, res: res2 } = createRequest();
    await webhookHandler(req2, res2);
    expect(res2._getStatusCode()).toBe(200);
    
    const responseData = JSON.parse(res2._getData());
    expect(responseData.status).toBe('duplicate_skipped');
  });
});
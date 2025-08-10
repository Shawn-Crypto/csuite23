// Webhook Performance & Load Testing
// Tests webhook response time under load and concurrent requests

const { test, expect } = require('@playwright/test');
const crypto = require('crypto');

// Test data generators
function generateTestWebhook(orderId, paymentId) {
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
          amount: 199900, // in paise
          currency: 'INR',
          status: 'captured',
          order_id: orderId || `order_test_${timestamp}`,
          method: 'upi',
          email: 'test@example.com',
          contact: '+919876543210',
          created_at: timestamp,
          notes: {
            products: JSON.stringify(['course']),
            customer_name: 'Test User',
            customer_email: 'test@example.com'
          }
        }
      }
    },
    created_at: timestamp
  };
}

function generateWebhookSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret || 'test_webhook_secret')
    .update(JSON.stringify(payload))
    .digest('hex');
}

test.describe('Webhook Performance Tests', () => {
  const TEST_WEBHOOK_SECRET = 'test_webhook_secret_12345';
  
  test('Single webhook response time < 200ms', async ({ request }) => {
    const webhookData = generateTestWebhook();
    const signature = generateWebhookSignature(webhookData, TEST_WEBHOOK_SECRET);
    
    const startTime = Date.now();
    
    const response = await request.post('http://localhost:3000/api/webhook', {
      headers: {
        'x-razorpay-signature': signature,
        'content-type': 'application/json'
      },
      data: webhookData
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Verify response
    expect(response.status()).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.processing_time_ms).toBeDefined();
    
    // Critical performance requirement: < 200ms
    expect(responseTime).toBeLessThan(200);
    
    console.log(`✅ Webhook response time: ${responseTime}ms (server reported: ${responseData.processing_time_ms}ms)`);
  });

  test('Concurrent webhook processing - 10 parallel requests', async ({ request }) => {
    const webhookPromises = [];
    const responseTimes = [];
    
    // Create 10 concurrent webhook requests
    for (let i = 0; i < 10; i++) {
      const webhookData = generateTestWebhook(`order_concurrent_${i}`, `pay_concurrent_${i}`);
      const signature = generateWebhookSignature(webhookData, TEST_WEBHOOK_SECRET);
      
      const promise = (async () => {
        const startTime = Date.now();
        
        const response = await request.post('http://localhost:3000/api/webhook', {
          headers: {
            'x-razorpay-signature': signature,
            'content-type': 'application/json'
          },
          data: webhookData
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        responseTimes.push(responseTime);
        
        return { response, responseTime };
      })();
      
      webhookPromises.push(promise);
    }
    
    // Wait for all requests to complete
    const results = await Promise.all(webhookPromises);
    
    // Verify all responses succeeded
    results.forEach(({ response }, index) => {
      expect(response.status()).toBe(200);
    });
    
    // Calculate performance metrics
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    // Performance requirements under load
    expect(avgResponseTime).toBeLessThan(300); // Average < 300ms under load
    expect(maxResponseTime).toBeLessThan(500);  // Max < 500ms under load
    
    console.log(`✅ Concurrent performance:`);\n    console.log(`   - Average: ${avgResponseTime.toFixed(1)}ms`);\n    console.log(`   - Min: ${minResponseTime}ms`);\n    console.log(`   - Max: ${maxResponseTime}ms`);\n    console.log(`   - All ${results.length} requests succeeded`);\n  });

  test('Webhook with large payload processing', async ({ request }) => {
    // Create webhook with large notes data
    const largeNotes = {};\n    for (let i = 0; i < 100; i++) {\n      largeNotes[`field_${i}`] = `value_${i}_`.repeat(50); // Create large data\n    }\n    \n    const webhookData = generateTestWebhook();\n    webhookData.payload.payment.entity.notes = {\n      ...webhookData.payload.payment.entity.notes,\n      ...largeNotes,\n      large_data: JSON.stringify(largeNotes)\n    };\n    \n    const signature = generateWebhookSignature(webhookData, TEST_WEBHOOK_SECRET);\n    \n    const startTime = Date.now();\n    \n    const response = await request.post('http://localhost:3000/api/webhook', {\n      headers: {\n        'x-razorpay-signature': signature,\n        'content-type': 'application/json'\n      },\n      data: webhookData\n    });\n    \n    const endTime = Date.now();\n    const responseTime = endTime - startTime;\n    \n    expect(response.status()).toBe(200);\n    \n    // Should still be fast even with large payloads\n    expect(responseTime).toBeLessThan(500);\n    \n    console.log(`✅ Large payload processing time: ${responseTime}ms`);\n  });

  test('Invalid signature rejection speed', async ({ request }) => {\n    const webhookData = generateTestWebhook();\n    const invalidSignature = 'invalid_signature_12345';\n    \n    const startTime = Date.now();\n    \n    const response = await request.post('http://localhost:3000/api/webhook', {\n      headers: {\n        'x-razorpay-signature': invalidSignature,\n        'content-type': 'application/json'\n      },\n      data: webhookData\n    });\n    \n    const endTime = Date.now();\n    const responseTime = endTime - startTime;\n    \n    // Should reject quickly\n    expect(response.status()).toBe(401);\n    expect(responseTime).toBeLessThan(100); // Very fast rejection\n    \n    console.log(`✅ Invalid signature rejection time: ${responseTime}ms`);\n  });

  test('Missing signature handling speed', async ({ request }) => {\n    const webhookData = generateTestWebhook();\n    \n    const startTime = Date.now();\n    \n    const response = await request.post('http://localhost:3000/api/webhook', {\n      headers: {\n        'content-type': 'application/json'\n        // No signature header\n      },\n      data: webhookData\n    });\n    \n    const endTime = Date.now();\n    const responseTime = endTime - startTime;\n    \n    // Should reject very quickly\n    expect(response.status()).toBe(400);\n    expect(responseTime).toBeLessThan(50); // Even faster rejection\n    \n    console.log(`✅ Missing signature rejection time: ${responseTime}ms`);\n  });

  test('Malformed JSON handling speed', async ({ request }) => {\n    const invalidJson = '{ invalid json data';\n    const signature = crypto\n      .createHmac('sha256', TEST_WEBHOOK_SECRET)\n      .update(invalidJson)\n      .digest('hex');\n    \n    const startTime = Date.now();\n    \n    const response = await request.post('http://localhost:3000/api/webhook', {\n      headers: {\n        'x-razorpay-signature': signature,\n        'content-type': 'application/json'\n      },\n      data: invalidJson\n    });\n    \n    const endTime = Date.now();\n    const responseTime = endTime - startTime;\n    \n    // Should handle gracefully and quickly\n    expect([400, 500]).toContain(response.status());\n    expect(responseTime).toBeLessThan(200);\n    \n    console.log(`✅ Malformed JSON handling time: ${responseTime}ms`);\n  });

  test('Stress test - 50 webhooks in rapid succession', async ({ request }) => {\n    const results = [];\n    const startTime = Date.now();\n    \n    // Send 50 webhooks as fast as possible (not parallel, but rapid succession)\n    for (let i = 0; i < 50; i++) {\n      const webhookData = generateTestWebhook(`order_stress_${i}`, `pay_stress_${i}`);\n      const signature = generateWebhookSignature(webhookData, TEST_WEBHOOK_SECRET);\n      \n      const requestStart = Date.now();\n      \n      try {\n        const response = await request.post('http://localhost:3000/api/webhook', {\n          headers: {\n            'x-razorpay-signature': signature,\n            'content-type': 'application/json'\n          },\n          data: webhookData\n        });\n        \n        const requestTime = Date.now() - requestStart;\n        \n        results.push({\n          index: i,\n          status: response.status(),\n          time: requestTime,\n          success: response.status() === 200\n        });\n        \n      } catch (error) {\n        results.push({\n          index: i,\n          status: 0,\n          time: Date.now() - requestStart,\n          success: false,\n          error: error.message\n        });\n      }\n    }\n    \n    const totalTime = Date.now() - startTime;\n    const successCount = results.filter(r => r.success).length;\n    const avgResponseTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;\n    \n    // Performance requirements under stress\n    expect(successCount).toBeGreaterThanOrEqual(45); // At least 90% success rate\n    expect(avgResponseTime).toBeLessThan(400); // Average < 400ms under stress\n    \n    console.log(`✅ Stress test results:`);\n    console.log(`   - Total time: ${totalTime}ms for 50 requests`);\n    console.log(`   - Success rate: ${successCount}/50 (${(successCount/50*100).toFixed(1)}%)`);\n    console.log(`   - Average response time: ${avgResponseTime.toFixed(1)}ms`);\n    console.log(`   - Throughput: ${(50000/totalTime).toFixed(1)} requests/second`);\n  });

  test('Health check endpoint performance', async ({ request }) => {\n    const responseTimes = [];\n    \n    // Test health check response time multiple times\n    for (let i = 0; i < 10; i++) {\n      const startTime = Date.now();\n      \n      const response = await request.get('http://localhost:3000/api/health');\n      \n      const responseTime = Date.now() - startTime;\n      responseTimes.push(responseTime);\n      \n      expect(response.status()).toBe(200);\n      \n      const data = await response.json();\n      expect(data.status).toBe('healthy');\n      expect(data.response_time_ms).toBeDefined();\n    }\n    \n    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;\n    const maxTime = Math.max(...responseTimes);\n    \n    // Health check should be very fast\n    expect(avgTime).toBeLessThan(100); // < 100ms average\n    expect(maxTime).toBeLessThan(200);  // < 200ms max\n    \n    console.log(`✅ Health check performance: avg ${avgTime.toFixed(1)}ms, max ${maxTime}ms`);\n  });

  test('Detailed health check performance', async ({ request }) => {\n    const startTime = Date.now();\n    \n    const response = await request.get('http://localhost:3000/api/health?detailed=true');\n    \n    const responseTime = Date.now() - startTime;\n    \n    expect(response.status()).toBe(200);\n    \n    const data = await response.json();\n    expect(data.integrations).toBeDefined();\n    \n    // Detailed check can be slower but should still be reasonable\n    expect(responseTime).toBeLessThan(2000); // < 2 seconds\n    \n    console.log(`✅ Detailed health check time: ${responseTime}ms`);\n  });\n});
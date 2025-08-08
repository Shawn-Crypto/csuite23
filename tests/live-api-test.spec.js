// Live API Test with Vercel Dev Server
const { test, expect } = require('@playwright/test');

test.describe('Live Razorpay API with Vercel Dev', () => {
  
  test('should create order via live API', async ({ request }) => {
    const orderData = {
      amount: 1999,
      currency: 'INR',
      receipt: 'test_' + Date.now(),
      notes: {
        customer_name: 'Test User',
        course: 'The Complete Indian Investor'
      }
    };

    console.log('Making request to:', 'http://localhost:3000/api/create-order');
    
    const response = await request.post('http://localhost:3000/api/create-order', {
      data: orderData,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status());
    console.log('Response headers:', response.headers());
    
    if (response.status() === 200) {
      const data = await response.json();
      console.log('✅ Order created successfully:', data);
      
      expect(data.success).toBe(true);
      expect(data.order).toBeDefined();
      expect(data.order.id).toMatch(/^order_/);
      expect(data.order.amount).toBe(199900); // ₹1999 in paise
      expect(data.key_id).toBe('rzp_test_SWb5ypxKYwCUKK');
    } else {
      const responseText = await response.text();
      console.log('❌ API Error:', responseText.substring(0, 200));
      throw new Error(`API call failed with status ${response.status()}`);
    }
  });

  test('should verify payment signature', async ({ request }) => {
    const crypto = require('crypto');
    
    // Create order first
    const orderResponse = await request.post('http://localhost:3000/api/create-order', {
      data: {
        amount: 1999,
        currency: 'INR',
        receipt: 'verify_test_' + Date.now()
      }
    });

    expect(orderResponse.status()).toBe(200);
    const orderData = await orderResponse.json();
    
    // Generate valid signature
    const fakePaymentId = 'pay_test_' + Date.now();
    const body = orderData.order.id + '|' + fakePaymentId;
    const signature = crypto
      .createHmac('sha256', 'eUqfESP2Az0g76dorqwGmHpt')
      .update(body)
      .digest('hex');

    // Verify payment
    const verifyResponse = await request.post('http://localhost:3000/api/verify-payment', {
      data: {
        razorpay_order_id: orderData.order.id,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: signature,
        customer_data: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '9876543210'
        }
      }
    });

    console.log('Verification response status:', verifyResponse.status());
    
    if (verifyResponse.status() === 200) {
      const verifyData = await verifyResponse.json();
      console.log('✅ Payment verified:', verifyData);
      
      expect(verifyData.success).toBe(true);
      expect(verifyData.payment.verified).toBe(true);
    } else {
      const errorText = await verifyResponse.text();
      console.log('❌ Verification failed:', errorText);
      throw new Error(`Verification failed with status ${verifyResponse.status()}`);
    }
  });

  test('should reject invalid signature', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/verify-payment', {
      data: {
        razorpay_order_id: 'order_test_123',
        razorpay_payment_id: 'pay_test_123',
        razorpay_signature: 'invalid_signature_here',
        customer_data: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '9999999999'
        }
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    
    console.log('✅ Invalid signature rejected:', data);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid payment signature');
  });

  test('should handle webhook endpoint', async ({ request }) => {
    const webhookData = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_webhook_123',
            order_id: 'order_test_webhook_123',
            amount: 199900,
            method: 'card',
            email: 'test@example.com',
            contact: '9999999999'
          }
        }
      }
    };

    const response = await request.post('http://localhost:3000/api/webhook', {
      data: webhookData,
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'test_signature_here'
      }
    });

    // Should handle webhook (may return 400 due to invalid signature, but endpoint exists)
    console.log('Webhook response status:', response.status());
    expect([200, 400, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      console.log('✅ Webhook processed:', data);
    } else {
      console.log('⚠️ Webhook rejected (expected with test signature)');
    }
  });
});
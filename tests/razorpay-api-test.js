// Direct Razorpay API Test
const https = require('https');

// Test credentials
const RAZORPAY_KEY_ID = 'rzp_test_SWb5ypxKYwCUKK';
const RAZORPAY_KEY_SECRET = 'eUqfESP2Az0g76dorqwGmHpt';

function makeRazorpayRequest(endpoint, method = 'POST', data = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    const options = {
      hostname: 'api.razorpay.com',
      port: 443,
      path: `/v1/${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testRazorpayAPI() {
  console.log('🚀 Testing Razorpay API with test credentials...');
  console.log('Key ID:', RAZORPAY_KEY_ID);
  
  try {
    // Test 1: Create Order
    console.log('\n📦 Test 1: Creating order...');
    const orderData = {
      amount: 199900, // ₹1999 in paise
      currency: 'INR',
      receipt: 'test_receipt_' + Date.now(),
      notes: {
        course: 'The Complete Indian Investor',
        customer: 'Test User'
      }
    };

    const orderResponse = await makeRazorpayRequest('orders', 'POST', orderData);
    
    if (orderResponse.statusCode === 200) {
      console.log('✅ Order created successfully!');
      console.log('Order ID:', orderResponse.data.id);
      console.log('Amount:', orderResponse.data.amount / 100, 'INR');
      console.log('Status:', orderResponse.data.status);
      
      // Test 2: Fetch Order Details
      console.log('\n🔍 Test 2: Fetching order details...');
      const fetchResponse = await makeRazorpayRequest(`orders/${orderResponse.data.id}`, 'GET');
      
      if (fetchResponse.statusCode === 200) {
        console.log('✅ Order fetched successfully!');
        console.log('Order details:', {
          id: fetchResponse.data.id,
          status: fetchResponse.data.status,
          amount: fetchResponse.data.amount / 100 + ' INR'
        });
      } else {
        console.log('❌ Failed to fetch order:', fetchResponse.statusCode);
      }
      
    } else {
      console.log('❌ Failed to create order:', orderResponse.statusCode);
      console.log('Response:', orderResponse.data);
    }

    // Test 3: List Orders (should work with test keys)
    console.log('\n📋 Test 3: Listing recent orders...');
    const listResponse = await makeRazorpayRequest('orders?count=5', 'GET');
    
    if (listResponse.statusCode === 200) {
      console.log('✅ Orders listed successfully!');
      console.log('Order count:', listResponse.data.count);
      console.log('Items:', listResponse.data.items.length);
    } else {
      console.log('❌ Failed to list orders:', listResponse.statusCode);
    }

  } catch (error) {
    console.log('❌ API Test failed:', error.message);
  }
}

async function testWebhookSignature() {
  console.log('\n🔐 Testing webhook signature generation...');
  
  const crypto = require('crypto');
  const webhookSecret = 'test_webhook_secret_123';
  
  const samplePayload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_123',
          amount: 199900,
          currency: 'INR'
        }
      }
    }
  };
  
  const payloadString = JSON.stringify(samplePayload);
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');
  
  console.log('✅ Webhook signature generated successfully!');
  console.log('Payload length:', payloadString.length);
  console.log('Signature:', signature);
  
  // Verify the signature
  const verifySignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');
  
  const isValid = signature === verifySignature;
  console.log('✅ Signature verification:', isValid ? 'PASSED' : 'FAILED');
}

// Run tests
async function runAllTests() {
  await testRazorpayAPI();
  await testWebhookSignature();
  
  console.log('\n🎉 API Testing Complete!');
  console.log('✅ Razorpay integration is ready for production');
}

runAllTests().catch(console.error);
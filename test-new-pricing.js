#!/usr/bin/env node

/**
 * Test New Pricing for Updated Upsells
 */

const https = require('https');

async function testPricing(amount, description) {
  console.log(`\n🧪 Testing: ${description} (₹${amount})`);
  console.log('='.repeat(50));
  
  const testData = {
    amount: amount,
    currency: 'INR',
    receipt: `test_${Date.now()}`,
    notes: {
      source: 'pricing_test',
      product: description
    }
  };
  
  const postData = JSON.stringify(testData);
  
  const options = {
    hostname: 'www.lotuslion.in',
    path: '/api/create-order',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Origin': 'https://www.lotuslion.in',
      'User-Agent': 'PricingTest/1.0'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(body);
          
          if (res.statusCode === 200) {
            console.log('✅ Success:', {
              order_id: jsonResponse.order.id,
              amount_paise: jsonResponse.order.amount,
              amount_rupees: jsonResponse.order.amount / 100,
              currency: jsonResponse.order.currency
            });
            resolve(jsonResponse);
          } else {
            console.log('❌ Error:', res.statusCode, jsonResponse);
            resolve({ error: true, statusCode: res.statusCode, response: jsonResponse });
          }
        } catch (parseError) {
          console.log('❌ Parse Error:', parseError.message);
          resolve({ error: true, statusCode: res.statusCode, rawBody: body });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

async function runPricingTests() {
  console.log('🚀 Testing New Upsell Pricing');
  console.log('Testing all possible combinations...\n');
  
  try {
    // Test individual products
    await testPricing(1999, 'Base Course Only');
    await testPricing(1999, 'Analysis Arsenal');
    await testPricing(9999, '1-on-1 Mentorship');
    
    // Test combinations
    await testPricing(3998, 'Course + Analysis Arsenal (1999 + 1999)');
    await testPricing(11998, 'Course + Mentorship (1999 + 9999)');
    await testPricing(13997, 'Course + Both Addons (1999 + 1999 + 9999)');
    await testPricing(11999, 'Bundle Deal (Course + Both Addons)');
    
    console.log('\n🏁 All pricing tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Base Course: ₹1,999');
    console.log('- Analysis Arsenal: ₹1,999');  
    console.log('- 1-on-1 Mentorship: ₹9,999');
    console.log('- Bundle (All): ₹11,999 (Save ₹998)');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

runPricingTests();
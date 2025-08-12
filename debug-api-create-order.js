#!/usr/bin/env node

/**
 * Debug API Create Order Endpoint
 * Test the deployed /api/create-order endpoint
 */

const https = require('https');

async function testCreateOrderAPI() {
  console.log('🧪 Testing /api/create-order endpoint');
  console.log('=====================================');
  
  const testData = {
    amount: 1499,
    currency: 'INR',
    receipt: `test_${Date.now()}`,
    notes: {
      source: 'debug_test'
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
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  };
  
  console.log('📝 Request details:');
  console.log('URL:', `https://${options.hostname}${options.path}`);
  console.log('Method:', options.method);
  console.log('Headers:', options.headers);
  console.log('Body:', testData);
  console.log('');
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('📡 Response Status:', res.statusCode);
      console.log('📡 Response Headers:', res.headers);
      
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        console.log('📡 Response Body:', body);
        
        try {
          const jsonResponse = JSON.parse(body);
          console.log('📡 Parsed Response:', JSON.stringify(jsonResponse, null, 2));
          
          if (res.statusCode === 200) {
            console.log('✅ API endpoint working correctly!');
            resolve(jsonResponse);
          } else {
            console.log(`❌ API returned error ${res.statusCode}:`, jsonResponse);
            resolve({ error: true, statusCode: res.statusCode, response: jsonResponse });
          }
        } catch (parseError) {
          console.log('❌ Failed to parse JSON response:', parseError.message);
          console.log('Raw body:', body);
          resolve({ error: true, statusCode: res.statusCode, rawBody: body });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });
    
    // Send the request
    req.write(postData);
    req.end();
  });
}

// Test with different amounts
async function runTests() {
  try {
    console.log('🧪 Test 1: Standard amount (₹1499)\n');
    const result1 = await testCreateOrderAPI();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Small amount
    console.log('🧪 Test 2: Small amount (₹1)\n');
    const result2 = await testCreateOrderAPI();
    
    console.log('\n🏁 Testing complete');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTests();
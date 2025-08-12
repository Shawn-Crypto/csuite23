#!/usr/bin/env node

/**
 * Test Live Razorpay Credentials
 * Verifies that live Razorpay credentials are working correctly
 */

require('dotenv').config();
const Razorpay = require('razorpay');

async function testLiveRazorpay() {
  console.log('🔍 Testing Live Razorpay Credentials');
  console.log('=====================================');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log('RAZORPAY_MODE:', process.env.RAZORPAY_MODE);
  console.log('RAZORPAY_LIVE_KEY_ID:', process.env.RAZORPAY_LIVE_KEY_ID ? '✓ Set' : '❌ Missing');
  console.log('RAZORPAY_LIVE_KEY_SECRET:', process.env.RAZORPAY_LIVE_KEY_SECRET ? '✓ Set' : '❌ Missing');
  console.log('');
  
  if (!process.env.RAZORPAY_LIVE_KEY_ID || !process.env.RAZORPAY_LIVE_KEY_SECRET) {
    console.error('❌ Missing live Razorpay credentials');
    process.exit(1);
  }
  
  try {
    // Initialize Razorpay with live credentials
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_LIVE_KEY_ID,
      key_secret: process.env.RAZORPAY_LIVE_KEY_SECRET
    });
    
    console.log('✅ Razorpay instance created successfully');
    console.log('Using Key ID:', process.env.RAZORPAY_LIVE_KEY_ID);
    console.log('');
    
    // Test with a small order creation (₹1)
    console.log('🧪 Testing Order Creation (₹1 test order)');
    
    const orderData = {
      amount: 100, // ₹1 in paise
      currency: 'INR',
      receipt: `test_live_${Date.now()}`,
      notes: {
        test: 'live_credentials_verification',
        environment: 'production_test'
      }
    };
    
    const order = await razorpay.orders.create(orderData);
    
    console.log('✅ Order created successfully!');
    console.log('Order Details:');
    console.log('- Order ID:', order.id);
    console.log('- Amount: ₹' + (order.amount / 100));
    console.log('- Currency:', order.currency);
    console.log('- Status:', order.status);
    console.log('- Receipt:', order.receipt);
    console.log('- Created At:', new Date(order.created_at * 1000).toISOString());
    console.log('');
    
    console.log('🎉 Live Razorpay credentials are working correctly!');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Set up webhook endpoint in Razorpay dashboard');
    console.log('2. Configure webhook secret in environment variables');
    console.log('3. Test complete payment flow');
    console.log('4. Deploy to production with live credentials');
    
  } catch (error) {
    console.error('❌ Razorpay API Error:');
    console.error('Error Code:', error.statusCode);
    console.error('Error Message:', error.error?.description || error.message);
    console.error('');
    
    if (error.statusCode === 400) {
      console.log('Possible Issues:');
      console.log('- Invalid API credentials');
      console.log('- Account not activated for live mode');
      console.log('- Insufficient permissions');
    } else if (error.statusCode === 401) {
      console.log('Authentication failed - check your credentials');
    } else {
      console.log('Unexpected error - check Razorpay API status');
    }
    
    process.exit(1);
  }
}

testLiveRazorpay();
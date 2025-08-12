#!/usr/bin/env node

/**
 * Debug Order Creation Issue
 */

require('dotenv').config();
const Razorpay = require('razorpay');

async function debugOrderCreation() {
  console.log('🔍 Debug Order Creation');
  console.log('=========================');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('RAZORPAY_MODE:', process.env.RAZORPAY_MODE);
  console.log('RAZORPAY_LIVE_KEY_ID:', process.env.RAZORPAY_LIVE_KEY_ID ? '✓ Set' : '❌ Missing');
  console.log('RAZORPAY_LIVE_KEY_SECRET:', process.env.RAZORPAY_LIVE_KEY_SECRET ? '✓ Set' : '❌ Missing');
  console.log('');
  
  try {
    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_LIVE_KEY_ID,
      key_secret: process.env.RAZORPAY_LIVE_KEY_SECRET
    });
    
    console.log('✅ Razorpay initialized with live credentials');
    console.log('Key ID:', process.env.RAZORPAY_LIVE_KEY_ID);
    console.log('');
    
    // Test order creation with minimal data
    const orderData = {
      amount: 149900, // ₹1499 in paise
      currency: 'INR',
      receipt: `debug_${Date.now()}`,
      notes: {
        source: 'debug_test'
      }
    };
    
    console.log('📝 Creating order with data:', orderData);
    
    const order = await razorpay.orders.create(orderData);
    
    console.log('✅ Order created successfully!');
    console.log('Order Details:', {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      receipt: order.receipt
    });
    
  } catch (error) {
    console.error('❌ Order Creation Error:');
    console.error('Status Code:', error.statusCode);
    console.error('Error:', error.error);
    
    if (error.statusCode === 400) {
      console.log('\n🔍 Possible Issues:');
      console.log('- Invalid live API credentials');
      console.log('- Live mode not activated on Razorpay account');
      console.log('- Missing required fields');
      console.log('- Account verification incomplete');
    }
    
    // Test with different data
    console.log('\n🧪 Testing with different amount...');
    try {
      const testOrder = await razorpay.orders.create({
        amount: 100, // ₹1 in paise
        currency: 'INR',
        receipt: `test_${Date.now()}`
      });
      console.log('✅ Small amount order worked:', testOrder.id);
    } catch (testError) {
      console.error('❌ Small amount test also failed:', testError.error);
    }
  }
}

debugOrderCreation();
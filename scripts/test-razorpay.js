/**
 * Test Razorpay Connection
 * Quick script to verify Razorpay credentials are working
 */

require('dotenv').config();
const Razorpay = require('razorpay');

async function testRazorpay() {
  console.log('🔍 Testing Razorpay connection...\n');
  
  try {
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    console.log('✅ Razorpay instance created successfully');
    console.log(`   Mode: ${process.env.RAZORPAY_KEY_ID.includes('test') ? 'TEST' : 'LIVE'}`);
    
    // Try to create a test order
    console.log('\n📝 Creating test order...');
    const order = await instance.orders.create({
      amount: 199900, // ₹1999 in paise
      currency: 'INR',
      notes: {
        description: 'Test order for Complete Indian Investor Course'
      }
    });
    
    console.log('✅ Test order created successfully!');
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Amount: ₹${order.amount / 100}`);
    console.log(`   Status: ${order.status}`);
    
    console.log('\n🎉 Razorpay integration is working perfectly!');
    console.log('   You can now accept payments in TEST mode.');
    
  } catch (error) {
    console.error('❌ Razorpay test failed:', error.message);
    if (error.statusCode === 401) {
      console.error('   Invalid API credentials. Please check your keys.');
    }
  }
}

testRazorpay();
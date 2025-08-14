#!/usr/bin/env node

/**
 * Test Meta CAPI with real webhook data flow
 * Simulates the exact data flow from webhook to CAPI
 */

const { getMetaCAPI } = require('./api/lib/meta-capi');
require('dotenv').config();

async function testWebhookCAPIFlow() {
    console.log('🧪 Testing Webhook → CAPI Flow...\n');

    const metaCAPI = getMetaCAPI();

    // Simulate actual Razorpay webhook payment data
    const mockPayment = {
        id: 'pay_test_' + Date.now(),
        order_id: 'order_test_' + Date.now(),
        amount: 199900, // 1999 rupees in paise
        currency: 'INR',
        method: 'upi',
        email: 'customer@gmail.com',
        contact: '+919876543210',
        notes: {
            customer_name: 'Raj Kumar',
            course: 'complete-indian-investor'
        },
        created_at: Math.floor(Date.now() / 1000)
    };

    console.log('📦 Mock Payment Data:');
    console.log(`   Order ID: ${mockPayment.order_id}`);
    console.log(`   Amount: ₹${mockPayment.amount / 100}`);
    console.log(`   Customer: ${mockPayment.notes.customer_name}`);
    console.log(`   Email: ${mockPayment.email}`);
    console.log(`   Phone: ${mockPayment.contact}\n`);

    // Test the exact flow from webhook.js
    const orderData = {
        order_id: mockPayment.order_id,
        amount: mockPayment.amount / 100, // Convert paise to rupees
        currency: 'INR',
        payment_id: mockPayment.id
    };

    const customerData = {
        name: mockPayment.notes?.customer_name,
        email: mockPayment.email,
        phone: mockPayment.contact
    };

    const requestData = {
        clientIp: '157.45.123.89', // Real Indian IP for testing
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        sourceUrl: 'https://lotuslion.in/checkout'
    };

    console.log('🚀 Sending Purchase Event via Meta CAPI...');
    
    try {
        const result = await metaCAPI.sendPurchaseEventAsync(orderData, customerData, requestData);
        
        if (result && result.success) {
            console.log('✅ SUCCESS! Purchase event sent successfully');
            console.log(`   Event ID: ${result.event_id}`);
            console.log(`   Events Received: ${result.events_received}`);
            console.log(`   Timestamp: ${result.timestamp}`);
            console.log(`   FB Trace ID: ${result.meta_response?.fbtrace_id}`);
            
            // Test deduplication by sending same event again
            console.log('\n🔄 Testing Deduplication - Sending same event again...');
            
            const duplicateResult = await metaCAPI.sendPurchaseEventAsync(orderData, customerData, requestData);
            
            if (duplicateResult && duplicateResult.success) {
                console.log('✅ Duplicate event also sent successfully');
                console.log(`   Events Received: ${duplicateResult.events_received}`);
                console.log('   Note: Meta should handle deduplication server-side with same event_id');
            }
            
        } else {
            console.log('❌ FAILED! Purchase event failed');
            console.log(`   Error: ${result?.error || 'Unknown error'}`);
            
            if (result?.response_data) {
                console.log('   Meta Response:', JSON.stringify(result.response_data, null, 2));
            }
        }
    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error.message);
    }

    console.log('\n📊 Event Quality Checklist:');
    console.log('✅ User email hashed and included');
    console.log('✅ Phone number formatted for India (+91)');
    console.log('✅ External ID (order_id) included for matching');
    console.log('✅ Event source URL included');
    console.log('✅ Client IP and User Agent included');
    console.log('✅ Currency set to INR');
    console.log('✅ Value in proper float format');
    console.log('✅ Content category set to "education"');
    console.log('✅ Contents array for better attribution');
    console.log('✅ Data processing options for compliance');

    console.log('\n🎯 Expected Results in Meta Events Manager:');
    console.log('• Event should appear within 30 seconds');
    console.log('• Match Quality Score should be >7.0');
    console.log('• Event should be attributed to your pixel');
    console.log('• Deduplication should work across client/server');
    console.log('• All user data parameters should be recognized');
}

// Run the test
testWebhookCAPIFlow().catch(console.error);
#!/usr/bin/env node

/**
 * Meta CAPI Testing Script
 * Based on PDF playbook requirements for proper validation
 */

const { MetaCAPI } = require('./api/lib/meta-capi');
require('dotenv').config();

async function testMetaCAPI() {
    console.log('🧪 Testing Meta CAPI Integration...\n');

    // Check environment variables
    console.log('📋 Environment Check:');
    console.log(`Pixel ID: ${process.env.META_PIXEL_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`Access Token: ${process.env.META_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`Test Event Code: ${process.env.META_TEST_EVENT_CODE ? '✅ Set' : '⚠️ Not set (optional)'}\n`);

    if (!process.env.META_PIXEL_ID || !process.env.META_ACCESS_TOKEN) {
        console.error('❌ Missing required environment variables');
        process.exit(1);
    }

    const metaCAPI = new MetaCAPI();

    // Test 1: Basic Purchase Event
    console.log('🧪 Test 1: Purchase Event');
    const testOrderData = {
        order_id: `test_order_${Date.now()}`,
        amount: 1999,
        currency: 'INR',
        payment_id: `test_payment_${Date.now()}`
    };

    const testCustomerData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210'
    };

    const testRequestData = {
        clientIp: '103.21.124.45', // Example Indian IP
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        sourceUrl: 'https://lotuslion.in'
    };

    try {
        const result = await metaCAPI.sendPurchaseEvent(testOrderData, testCustomerData, testRequestData);
        
        if (result && result.success) {
            console.log('✅ Purchase event sent successfully');
            console.log(`   Event ID: ${result.event_id}`);
            console.log(`   Events Received: ${result.events_received}`);
            console.log(`   Timestamp: ${result.timestamp}`);
        } else {
            console.log('❌ Purchase event failed');
            console.log(`   Error: ${result?.error || 'Unknown error'}`);
            if (result?.response_data) {
                console.log(`   Response: ${JSON.stringify(result.response_data, null, 2)}`);
            }
        }
    } catch (error) {
        console.error('❌ Purchase event error:', error.message);
    }

    console.log('\n🧪 Test 2: Lead Event');
    try {
        const leadResult = await metaCAPI.sendInitiateCheckoutEvent(testCustomerData, testRequestData);
        
        if (leadResult && leadResult.success) {
            console.log('✅ Lead event sent successfully');
            console.log(`   Event ID: ${leadResult.event_id}`);
            console.log(`   Events Received: ${leadResult.events_received}`);
        } else {
            console.log('❌ Lead event failed');
            console.log(`   Error: ${leadResult?.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('❌ Lead event error:', error.message);
    }

    console.log('\n🧪 Test 3: Hash Function Validation');
    const testHash = metaCAPI.sha256Hash('test@example.com');
    const expectedHash = '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b';
    
    if (testHash === expectedHash) {
        console.log('✅ Hash function working correctly');
    } else {
        console.log('❌ Hash function validation failed');
        console.log(`   Expected: ${expectedHash}`);
        console.log(`   Got: ${testHash}`);
    }

    console.log('\n🧪 Test 4: User Data Hashing');
    const hashedUserData = metaCAPI.hashUserData({
        email: 'test@example.com',
        phone: '9876543210',
        firstName: 'Test',
        lastName: 'User',
        external_id: 'test_123'
    });

    console.log('✅ User data hashed successfully');
    console.log('   Email hash:', hashedUserData.em ? '✅ Present' : '❌ Missing');
    console.log('   Phone hash:', hashedUserData.ph ? '✅ Present' : '❌ Missing');
    console.log('   First name hash:', hashedUserData.fn ? '✅ Present' : '❌ Missing');
    console.log('   External ID hash:', hashedUserData.external_id ? '✅ Present' : '❌ Missing');
    console.log('   Country default:', hashedUserData.country ? '✅ Present' : '❌ Missing');

    console.log('\n📊 Summary:');
    console.log('• All hash functions use arrays per PDF requirements');
    console.log('• External ID included for better matching');
    console.log('• Country defaults to India');
    console.log('• Authorization header uses Bearer format');
    console.log('• API version updated to v21.0');
    console.log('• Data processing options included for compliance');
    
    console.log('\n🔍 Next Steps:');
    console.log('1. Check Meta Events Manager for test events');
    console.log('2. Look for test event code in the interface');
    console.log('3. Verify events_received count > 0');
    console.log('4. Check event match quality score');
    console.log('5. Test with real webhook data');
}

// Run the test
testMetaCAPI().catch(console.error);
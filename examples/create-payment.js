// Payment API - Sandbox-enabled for comprehensive testing
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        // Use raw HTTP instead of SDK to avoid authentication issues
        
        // Extract and validate order data
        const { 
            customer_email = "test@example.com", 
            customer_name = "Test User", 
            customer_phone = "+919876543210",
            products = ['beyond-the-deck-course'],
            totalAmount,
            order_amount = 1499.00,
            order_currency = 'INR'
        } = req.body;

        const finalAmount = totalAmount || order_amount;
        
        // Environment-aware credential selection
        const environment = process.env.CASHFREE_ENVIRONMENT || 'SANDBOX';
        const isProduction = environment === 'PRODUCTION';
        
        const clientId = isProduction 
            ? process.env.CASHFREE_CLIENT_ID 
            : process.env.CASHFREE_CLIENT_ID_SANDBOX;
            
        const clientSecret = isProduction 
            ? process.env.CASHFREE_CLIENT_SECRET 
            : process.env.CASHFREE_CLIENT_SECRET_SANDBOX;
        
        if (!clientId || !clientSecret) {
            throw new Error(`Missing ${environment} credentials`);
        }

        // Determine Cashfree API endpoint based on environment
        const cashfreeApiUrl = isProduction 
            ? 'https://api.cashfree.com/pg/orders'
            : 'https://sandbox.cashfree.com/pg/orders';

        // Generate environment-prefixed order ID
        const orderPrefix = isProduction ? 'BTD_PROD' : 'BTD_TEST';
        const orderId = `${orderPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Create order request
        const orderRequest = {
            order_id: orderId,
            order_amount: parseFloat(finalAmount),
            order_currency: order_currency,
            customer_details: {
                customer_id: `customer_${Date.now()}`,
                customer_email: customer_email,
                customer_phone: customer_phone,
                customer_name: customer_name
            },
            order_meta: {
                return_url: `https://www.lfgventures.in/success.html?order_id={order_id}`,
                notify_url: 'https://www.lfgventures.in/api/cashfree-webhook-optimized'
            }
        };

        console.log(`Creating ${environment} order:`, { orderId, amount: finalAmount });

        // Create order using raw HTTP API (SDK has authentication issues)
        const response = await fetch(cashfreeApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-version': '2025-01-01',
                'x-client-id': clientId,
                'x-client-secret': clientSecret
            },
            body: JSON.stringify(orderRequest)
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(`Cashfree API error: ${responseData.message || responseData.code || 'Unknown error'}`);
        }
        
        console.log(`${environment} order created successfully:`, responseData.cf_order_id);

        res.status(200).json({
            success: true,
            environment: environment,
            order_id: orderId,
            payment_session_id: responseData.payment_session_id,
            cf_order_id: responseData.cf_order_id,
            amount: finalAmount,
            currency: order_currency
        });

    } catch (error) {
        console.error('Payment creation error:', error.message);
        console.error('Error details:', error.response?.data || error);
        
        res.status(500).json({
            error: 'Payment creation failed',
            environment: process.env.CASHFREE_ENVIRONMENT || 'SANDBOX',
            message: error.message || 'Unknown error occurred',
            details: error.response?.data?.message || error.message,
            timestamp: new Date().toISOString()
        });
    }
}
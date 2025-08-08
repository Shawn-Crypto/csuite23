import Razorpay from 'razorpay';

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Validate environment variables
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Missing Razorpay credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Extract client-side data from request body
    const { fbp, fbc, customer_info } = req.body;

    // Capture additional client context
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress ||
                     'unknown';
    
    const userAgent = req.headers['user-agent'] || 'unknown';
    const timestamp = new Date().toISOString();

    // Create order with ₹1,999 amount (199900 paise) and INR currency
    const orderOptions = {
      amount: 199900, // ₹1,999 in paise (smallest currency unit)
      currency: 'INR',
      receipt: `lotuslion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notes: {
        // Client-side Meta tracking data
        fbp: fbp || null,
        fbc: fbc || null,
        
        // Client context for Meta CAPI
        client_ip_address: clientIp,
        client_user_agent: userAgent,
        
        // Customer information (if provided)
        customer_name: customer_info?.name || null,
        customer_email: customer_info?.email || null,
        customer_phone: customer_info?.phone || null,
        
        // Business context
        product_name: 'The Complete Indian Investor Course',
        product_price: '1999',
        currency: 'INR',
        
        // Tracking metadata
        order_created_at: timestamp,
        source: 'lotuslion_website',
        integration_version: '1.0.0'
      },
      // Enable partial payments if needed in future
      partial_payment: false
    };

    console.log('Creating Razorpay order with options:', {
      amount: orderOptions.amount,
      currency: orderOptions.currency,
      receipt: orderOptions.receipt,
      notes_keys: Object.keys(orderOptions.notes)
    });

    // Create order using Razorpay Orders API
    const order = await razorpay.orders.create(orderOptions);

    console.log('Razorpay order created successfully:', {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status
    });

    // Return order details along with key_id for frontend checkout
    const response = {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID, // Frontend needs this for checkout
      receipt: order.receipt,
      status: order.status,
      created_at: order.created_at,
      // Don't expose sensitive notes in response
      success: true
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error creating Razorpay order:', {
      message: error.message,
      stack: error.stack,
      code: error.code || 'UNKNOWN_ERROR'
    });

    // Handle specific Razorpay API errors
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: 'Razorpay API Error',
        message: error.error?.description || error.message,
        code: error.error?.code || 'RAZORPAY_ERROR'
      });
    }

    // Handle general errors
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create payment order',
      code: 'ORDER_CREATION_FAILED'
    });
  }
}

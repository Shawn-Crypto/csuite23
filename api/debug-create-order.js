const Razorpay = require('razorpay');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 Debug Create Order API');
    console.log('Environment variables:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('RAZORPAY_MODE:', process.env.RAZORPAY_MODE);
    console.log('RAZORPAY_LIVE_KEY_ID present:', !!process.env.RAZORPAY_LIVE_KEY_ID);
    console.log('RAZORPAY_LIVE_KEY_SECRET present:', !!process.env.RAZORPAY_LIVE_KEY_SECRET);
    console.log('Request body:', req.body);

    const { amount, currency = 'INR', receipt, notes = {} } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Initialize Razorpay with explicit credentials
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_LIVE_KEY_ID,
      key_secret: process.env.RAZORPAY_LIVE_KEY_SECRET
    });

    console.log('✅ Razorpay initialized with live credentials');
    console.log('Key ID:', process.env.RAZORPAY_LIVE_KEY_ID);

    const orderData = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt: receipt || `debug_${Date.now()}`,
      notes: {
        ...notes,
        source: 'debug_api',
        course: 'The Complete Indian Investor'
      }
    };

    console.log('📝 Creating order with data:', orderData);

    const order = await razorpay.orders.create(orderData);

    console.log('✅ Order created successfully:', {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status
    });

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      key_id: process.env.RAZORPAY_LIVE_KEY_ID,
      debug: {
        razorpayMode: process.env.RAZORPAY_MODE,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Raw error details:');
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error statusCode:', error.statusCode);
    console.error('Error details:', error.error);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    console.error('Error stack:', error.stack);

    // Return raw error for debugging
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.error,
        type: typeof error
      },
      debug: {
        rawError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
        environment: process.env.NODE_ENV,
        credentials: {
          key_id_present: !!process.env.RAZORPAY_LIVE_KEY_ID,
          key_secret_present: !!process.env.RAZORPAY_LIVE_KEY_SECRET,
          mode: process.env.RAZORPAY_MODE
        }
      }
    });
  }
};
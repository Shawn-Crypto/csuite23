const Razorpay = require('razorpay');
const errorHandler = require('./lib/error-handler');

// Initialize Razorpay directly from environment variables for robustness
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_LIVE_KEY_ID || process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_LIVE_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET
});

// Log initialization status
if (process.env.RAZORPAY_LIVE_KEY_ID || process.env.RAZORPAY_KEY_ID) {
    console.log('🔧 Razorpay initialized using environment variables.');
} else {
    console.error('❌ Razorpay KEY_ID is not configured in environment variables.');
}


module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    const { response, statusCode } = errorHandler.createAPIResponse(
      'Method not allowed. Use POST request.',
      { method: req.method, endpoint: '/api/create-order' },
      405
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { amount, currency = 'INR', receipt, notes = {} } = req.body;

    if (!amount) {
      const { response, statusCode } = errorHandler.createAPIResponse(
        'REQUIRED_FIELD_MISSING',
        { field: 'amount', endpoint: '/api/create-order' }
      );
      return res.status(statusCode).json(response);
    }

    if (typeof amount !== 'number' || amount <= 0) {
      const { response, statusCode } = errorHandler.createAPIResponse(
        'VALIDATION_ERROR',
        { field: 'amount', value: amount, endpoint: '/api/create-order' }
      );
      return res.status(statusCode).json(response);
    }

    const orderData = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: receipt || `order_${Date.now()}`,
      notes: {
        ...notes,
        source: 'lotuslion.in',
        course: 'The Complete Indian Investor'
      }
    };

    const order = await razorpay.orders.create(orderData);

    // Log order creation for tracking
    console.log('Order created:', {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      key_id: process.env.RAZORPAY_LIVE_KEY_ID || process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    const context = {
      endpoint: '/api/create-order',
      amount: req.body?.amount,
      currency: req.body?.currency,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    };
    
    const { response, statusCode } = errorHandler.createAPIResponse(error, context);
    return res.status(statusCode).json(response);
  }
};
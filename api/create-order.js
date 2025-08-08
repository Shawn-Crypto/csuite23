// Razorpay Order Creation API Endpoint
// POST /api/create-order
// Creates a new Razorpay order for checkout

const { initializeRazorpay, createErrorResponse, createSuccessResponse, generateOrderId } = require('./_lib/razorpay-config');
const logger = require('./_lib/logger');

// Course configuration - matching existing pricing from the site
const COURSE_CONFIG = {
  amount: 999900, // ₹9999 in paise (99900 paise)
  currency: 'INR',
  item_id: 'lotuslion-course',
  item_name: 'The Complete Indian Investor',
  description: 'LotusLion Course - The Complete Indian Investor',
};

/**
 * Handle OPTIONS requests for CORS preflight
 */
const handleOptions = () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
    body: '',
  };
};

/**
 * Validate request payload
 */
const validateRequest = (body) => {
  // For order creation, we don't require specific fields from client
  // The order details are predefined for the course
  return true;
};

/**
 * Create Razorpay order
 */
const createOrder = async (razorpay) => {
  try {
    const orderOptions = {
      amount: COURSE_CONFIG.amount,
      currency: COURSE_CONFIG.currency,
      receipt: generateOrderId(), // Use our consistent order_id format
      notes: {
        course_id: COURSE_CONFIG.item_id,
        course_name: COURSE_CONFIG.item_name,
        description: COURSE_CONFIG.description,
        created_via: 'lotuslion_website',
      },
    };

    const order = await razorpay.orders.create(orderOptions);
    
    logger.info('Order created successfully', {
      order_id: order.id,
      receipt: order.receipt,
      amount: order.amount,
      currency: order.currency,
    });

    return {
      order_id: order.id,
      receipt: order.receipt,
      amount: order.amount,
      amount_display: '₹9,999', // Human readable amount
      currency: order.currency,
      course: {
        id: COURSE_CONFIG.item_id,
        name: COURSE_CONFIG.item_name,
        description: COURSE_CONFIG.description,
      },
      razorpay_key_id: process.env.RAZORPAY_KEY_ID, // Needed for frontend checkout
      created_at: order.created_at,
    };
  } catch (error) {
    logger.error('Failed to create Razorpay order', {
      error: error.message,
      code: error.code,
      description: error.description,
    });
    throw error;
  }
};

/**
 * Main handler function
 */
module.exports = async (req, res) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      const response = handleOptions();
      return res.status(response.statusCode).set(response.headers).send(response.body);
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      const response = createErrorResponse(405, 'Method not allowed. Only POST requests are supported.');
      return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
    }

    logger.info('Order creation request received', {
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    // Validate request
    if (!validateRequest(req.body)) {
      const response = createErrorResponse(400, 'Invalid request payload');
      return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
    }

    // Initialize Razorpay
    let razorpay;
    try {
      razorpay = initializeRazorpay();
    } catch (error) {
      logger.error('Failed to initialize Razorpay', { error: error.message });
      const response = createErrorResponse(500, 'Payment service configuration error');
      return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
    }

    // Create order
    const orderData = await createOrder(razorpay);
    
    // Return success response
    const response = createSuccessResponse(orderData);
    return res.status(response.status).set(response.headers).json(JSON.parse(response.body));

  } catch (error) {
    logger.error('Order creation failed', {
      error: error.message,
      stack: error.stack,
    });

    // Handle Razorpay specific errors
    let errorMessage = 'Failed to create order';
    let statusCode = 500;
    
    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.error?.description || error.message || errorMessage;
    }

    const response = createErrorResponse(statusCode, errorMessage, {
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    
    return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
  }
};

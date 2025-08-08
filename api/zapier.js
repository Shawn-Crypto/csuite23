// Zapier Webhook Integration for Kajabi Course Access Provisioning
// POST /api/zapier
// Forwards payment data to Zapier webhook for automated course enrollment

const { createErrorResponse, createSuccessResponse } = require('./_lib/razorpay-config');
const logger = require('./_lib/logger');

// Course configuration for Kajabi integration
const COURSE_CONFIG = {
  course_id: 'lotuslion-course',
  course_name: 'The Complete Indian Investor',
  course_description: 'LotusLion Course - The Complete Indian Investor',
  course_price: 9999, // ₹9999
  currency: 'INR',
  access_type: 'lifetime',
  platform: 'kajabi',
};

// Retry configuration
const RETRY_CONFIG = {
  max_attempts: 3,
  initial_delay: 1000, // 1 second
  backoff_multiplier: 2, // exponential backoff
  max_delay: 10000, // 10 seconds maximum
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
 * Validate Zapier webhook configuration
 */
const validateZapierConfig = () => {
  if (!process.env.ZAPIER_WEBHOOK_URL) {
    throw new Error('ZAPIER_WEBHOOK_URL environment variable is not configured');
  }
  
  // Validate URL format
  try {
    new URL(process.env.ZAPIER_WEBHOOK_URL);
  } catch (error) {
    throw new Error('ZAPIER_WEBHOOK_URL is not a valid URL');
  }
  
  return true;
};

/**
 * Validate incoming webhook data
 * @param {object} data - Webhook payload data
 * @returns {boolean} - Whether data is valid
 */
const validateWebhookData = (data) => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Required fields for course enrollment
  const requiredFields = ['payment_id', 'order_id', 'amount'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      logger.error('Missing required field in webhook data', { field, data });
      return false;
    }
  }

  return true;
};

/**
 * Sanitize customer data for PII compliance
 * @param {object} data - Raw payment data
 * @returns {object} - Sanitized data safe for Zapier/Kajabi
 */
const sanitizeCustomerData = (data) => {
  // Extract and sanitize customer information
  const sanitized = {
    // Transaction details
    payment_id: data.payment_id,
    order_id: data.order_id,
    amount: data.amount_rupees || (data.amount / 100), // Convert to rupees if needed
    currency: data.currency || 'INR',
    payment_method: data.payment_method,
    payment_status: data.status || 'captured',
    
    // Course details
    course: {
      id: COURSE_CONFIG.course_id,
      name: COURSE_CONFIG.course_name,
      description: COURSE_CONFIG.course_description,
      price: COURSE_CONFIG.course_price,
      access_type: COURSE_CONFIG.access_type,
      platform: COURSE_CONFIG.platform,
    },

    // Customer information (PII compliant)
    customer: {
      email: data.customer_email || null, // Required for Kajabi enrollment
      contact: data.customer_contact || null, // Phone number if available
      // Note: Only include essential data needed for course enrollment
      // Full name and other PII should be collected separately if needed
    },

    // Timestamps
    payment_created_at: data.payment_created_at,
    payment_captured_at: data.payment_captured_at,
    enrollment_requested_at: new Date().toISOString(),
    
    // Integration metadata
    source: 'lotuslion_website',
    integration_version: '1.0',
    webhook_source: 'razorpay_payment_captured',
  };

  // Remove any fields with null/undefined values to keep payload clean
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === null || sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });

  // Clean nested objects
  if (sanitized.customer) {
    Object.keys(sanitized.customer).forEach(key => {
      if (sanitized.customer[key] === null || sanitized.customer[key] === undefined) {
        delete sanitized.customer[key];
      }
    });
    
    // Remove customer object if empty
    if (Object.keys(sanitized.customer).length === 0) {
      delete sanitized.customer;
    }
  }

  return sanitized;
};

/**
 * Send data to Zapier webhook with retry logic
 * @param {object} data - Sanitized data to send
 * @param {number} attempt - Current attempt number
 * @returns {object} - Response from Zapier
 */
const sendToZapier = async (data, attempt = 1) => {
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  try {
    logger.info('Sending data to Zapier webhook', {
      attempt,
      order_id: data.order_id,
      payment_id: data.payment_id,
      url: zapierUrl.replace(/\/[^\/]*$/, '/***'), // Mask webhook ID for security
    });

    const response = await fetch(zapierUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LotusLion-Razorpay-Integration/1.0',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Zapier webhook failed with status: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.text();
    
    logger.info('Successfully sent data to Zapier', {
      order_id: data.order_id,
      payment_id: data.payment_id,
      response_status: response.status,
      attempt,
    });

    return {
      success: true,
      status: response.status,
      response: responseData,
      attempt,
    };

  } catch (error) {
    logger.error('Failed to send data to Zapier', {
      error: error.message,
      attempt,
      order_id: data.order_id,
      payment_id: data.payment_id,
    });

    // Implement retry logic with exponential backoff
    if (attempt < RETRY_CONFIG.max_attempts) {
      const delay = Math.min(
        RETRY_CONFIG.initial_delay * Math.pow(RETRY_CONFIG.backoff_multiplier, attempt - 1),
        RETRY_CONFIG.max_delay
      );
      
      logger.info('Retrying Zapier webhook after delay', {
        attempt: attempt + 1,
        delay_ms: delay,
        order_id: data.order_id,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      return sendToZapier(data, attempt + 1);
    }

    // All retries exhausted
    throw new Error(`Failed to send to Zapier after ${attempt} attempts: ${error.message}`);
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

    logger.info('Zapier webhook integration request received', {
      method: req.method,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
    });

    // Validate Zapier configuration
    validateZapierConfig();

    // Validate request payload
    if (!validateWebhookData(req.body)) {
      const response = createErrorResponse(400, 'Invalid webhook data payload');
      return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
    }

    // Sanitize customer data for PII compliance
    const sanitizedData = sanitizeCustomerData(req.body);
    
    logger.info('Processing Zapier webhook request', {
      order_id: sanitizedData.order_id,
      payment_id: sanitizedData.payment_id,
      amount: sanitizedData.amount,
      has_customer_email: !!sanitizedData.customer?.email,
    });

    // Send to Zapier with retry logic
    const zapierResponse = await sendToZapier(sanitizedData);

    // Return success response
    const response = createSuccessResponse({
      message: 'Course enrollment request sent to Zapier successfully',
      zapier_response: {
        status: zapierResponse.status,
        attempts: zapierResponse.attempt,
      },
      enrollment_data: {
        order_id: sanitizedData.order_id,
        payment_id: sanitizedData.payment_id,
        course_id: sanitizedData.course.id,
        course_name: sanitizedData.course.name,
        amount: sanitizedData.amount,
        currency: sanitizedData.currency,
      },
      processed_at: new Date().toISOString(),
    });

    return res.status(response.status).set(response.headers).json(JSON.parse(response.body));

  } catch (error) {
    logger.error('Zapier integration failed', {
      error: error.message,
      stack: error.stack,
    });

    // Handle different error types
    let errorMessage = 'Failed to process course enrollment request';
    let statusCode = 500;
    
    if (error.message.includes('ZAPIER_WEBHOOK_URL')) {
      statusCode = 500;
      errorMessage = 'Zapier integration configuration error';
    } else if (error.message.includes('Invalid webhook data')) {
      statusCode = 400;
      errorMessage = error.message;
    }

    const response = createErrorResponse(statusCode, errorMessage, {
      timestamp: new Date().toISOString(),
      retry_after: '300', // Suggest retry after 5 minutes
    });
    
    return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
  }
};

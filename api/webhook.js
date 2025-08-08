// Razorpay Webhook Handler for Payment Confirmation
// POST /api/webhook
// Handles Razorpay webhook events with signature verification and event deduplication

const { verifyWebhookSignature, isEventProcessed, markEventProcessed, extractPaymentData } = require('./_lib/webhook-utils');
const { createErrorResponse, createSuccessResponse, getSecurityHeaders } = require('./_lib/razorpay-config');
const logger = require('./_lib/logger');

/**
 * Handle OPTIONS requests for CORS preflight
 */
const handleOptions = () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Razorpay-Signature',
      'Access-Control-Max-Age': '86400', // 24 hours
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
    body: '',
  };
};

/**
 * Validate webhook configuration
 */
const validateWebhookConfig = () => {
  if (!process.env.WEBHOOK_SECRET) {
    throw new Error('WEBHOOK_SECRET environment variable is not configured');
  }
  return true;
};

/**
 * Process payment.captured event
 * @param {object} paymentData - Extracted payment data
 * @returns {object} - Processing result
 */
const processPaymentCaptured = async (paymentData) => {
  try {
    logger.info('Processing payment.captured event', {
      payment_id: paymentData.payment_id,
      order_id: paymentData.order_id,
      amount: paymentData.amount,
      method: paymentData.method,
    });

    // Extract order_id, payment_id, and amount for downstream processing
    const processedData = {
      event_type: 'payment.captured',
      payment_id: paymentData.payment_id,
      order_id: paymentData.order_id,
      amount: paymentData.amount,
      amount_rupees: paymentData.amount / 100, // Convert paise to rupees
      currency: paymentData.currency,
      payment_method: paymentData.method,
      status: paymentData.status,
      customer_email: paymentData.email,
      customer_contact: paymentData.contact,
      payment_created_at: paymentData.created_at,
      payment_captured_at: paymentData.captured_at,
      processed_at: new Date().toISOString(),
    };

    // Here we would normally trigger downstream processes:
    // 1. Zapier webhook for Kajabi course access provisioning
    // 2. Meta CAPI conversion event
    // These will be handled by separate API endpoints in tasks 3 and 4

    logger.info('Payment captured event processed successfully', {
      payment_id: processedData.payment_id,
      order_id: processedData.order_id,
      amount_rupees: processedData.amount_rupees,
    });

    return processedData;

  } catch (error) {
    logger.error('Failed to process payment.captured event', {
      error: error.message,
      payment_id: paymentData.payment_id,
      order_id: paymentData.order_id,
    });
    throw error;
  }
};

/**
 * Generate unique event identifier for deduplication
 * @param {object} payload - Webhook payload
 * @returns {string} - Unique event identifier
 */
const generateEventId = (payload) => {
  try {
    const { event, created_at, payload: eventPayload } = payload;
    const payment = eventPayload.payment.entity;
    
    // Create unique ID based on event type, payment ID, and timestamp
    return `${event}_${payment.id}_${created_at}`;
  } catch (error) {
    // Fallback to timestamp-based ID if payload parsing fails
    return `unknown_event_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
};

/**
 * Main webhook handler function
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

    // Validate webhook configuration
    validateWebhookConfig();

    // Get raw body and signature
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = JSON.stringify(req.body);

    logger.info('Webhook request received', {
      method: req.method,
      hasSignature: !!signature,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
    });

    // Verify webhook signature
    const isValidSignature = verifyWebhookSignature(rawBody, signature, process.env.WEBHOOK_SECRET);
    
    if (!isValidSignature) {
      logger.warn('Invalid webhook signature', {
        signature: signature?.substring(0, 10) + '...', // Log only first 10 chars for security
      });
      const response = createErrorResponse(401, 'Invalid webhook signature');
      return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
    }

    // Parse payload
    let payload;
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (error) {
      logger.error('Failed to parse webhook payload', { error: error.message });
      const response = createErrorResponse(400, 'Invalid JSON payload');
      return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
    }

    // Generate unique event ID for deduplication
    const eventId = generateEventId(payload);

    // Check for event deduplication
    if (isEventProcessed(eventId)) {
      logger.info('Duplicate event detected, skipping processing', {
        eventId,
        event: payload.event,
      });
      const response = createSuccessResponse({
        message: 'Event already processed',
        eventId,
        status: 'duplicate',
      });
      return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
    }

    // Extract payment data (validates event is payment.captured)
    const paymentData = extractPaymentData(payload);
    
    if (!paymentData) {
      logger.info('Webhook event is not payment.captured, ignoring', {
        event: payload.event,
        eventId,
      });
      const response = createSuccessResponse({
        message: 'Event type not processed',
        event: payload.event,
        status: 'ignored',
      });
      return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
    }

    // Mark event as processed to prevent duplicate processing
    markEventProcessed(eventId);

    // Process the payment.captured event
    const processedData = await processPaymentCaptured(paymentData);

    // Return success response
    const response = createSuccessResponse({
      message: 'Webhook processed successfully',
      eventId,
      event: payload.event,
      processed_data: processedData,
      status: 'processed',
    });

    return res.status(response.status).set(response.headers).json(JSON.parse(response.body));

  } catch (error) {
    logger.error('Webhook processing failed', {
      error: error.message,
      stack: error.stack,
    });

    // Handle different error types
    let errorMessage = 'Webhook processing failed';
    let statusCode = 500;
    
    if (error.message.includes('WEBHOOK_SECRET')) {
      statusCode = 500;
      errorMessage = 'Webhook configuration error';
    }

    const response = createErrorResponse(statusCode, errorMessage, {
      timestamp: new Date().toISOString(),
    });
    
    return res.status(response.status).set(response.headers).json(JSON.parse(response.body));
  }
};

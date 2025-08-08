// Webhook utilities for signature verification and event processing
const crypto = require('crypto');

/**
 * Verify Razorpay webhook signature
 * @param {string} payload - Raw webhook payload
 * @param {string} signature - X-Razorpay-Signature header value
 * @param {string} secret - Webhook secret from environment variables
 * @returns {boolean} - Whether signature is valid
 */
const verifyWebhookSignature = (payload, signature, secret) => {
  if (!payload || !signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

/**
 * Event deduplication storage (in-memory for serverless)
 * In production, use Redis or database for persistence
 */
const processedEvents = new Map();
const EVENT_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if event has been processed (deduplication)
 * @param {string} eventId - Unique event identifier
 * @returns {boolean} - Whether event was already processed
 */
const isEventProcessed = (eventId) => {
  const now = Date.now();
  
  // Clean expired events
  for (const [id, timestamp] of processedEvents.entries()) {
    if (now - timestamp > EVENT_EXPIRY_TIME) {
      processedEvents.delete(id);
    }
  }

  return processedEvents.has(eventId);
};

/**
 * Mark event as processed
 * @param {string} eventId - Unique event identifier
 */
const markEventProcessed = (eventId) => {
  processedEvents.set(eventId, Date.now());
};

/**
 * Extract relevant data from payment.captured event
 * @param {object} payload - Razorpay webhook payload
 * @returns {object|null} - Extracted payment data or null if invalid
 */
const extractPaymentData = (payload) => {
  try {
    const { event, payload: eventPayload } = payload;
    
    if (event !== 'payment.captured') {
      return null;
    }

    const payment = eventPayload.payment.entity;
    
    return {
      payment_id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount, // Amount in paise
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      email: payment.email || null,
      contact: payment.contact || null,
      created_at: payment.created_at,
      captured_at: payment.captured_at || Date.now(),
    };
  } catch (error) {
    console.error('Error extracting payment data:', error);
    return null;
  }
};

module.exports = {
  verifyWebhookSignature,
  isEventProcessed,
  markEventProcessed,
  extractPaymentData,
};

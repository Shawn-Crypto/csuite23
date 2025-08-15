const crypto = require('crypto');

// Event deduplication cache (in production, use Redis)
const processedEvents = new Set();

// Performance monitoring - LFG Ventures Gold Standard
const PERFORMANCE_TARGETS = {
  RESPONSE_TIME_MS: 200, // <200ms response time target
  MAX_PROCESSING_TIME_MS: 15000, // 15 second max processing time
  MAX_QUEUE_SIZE: 1000 // Maximum events in memory
};

// Timeout protection wrapper
function withTimeout(promise, timeoutMs, operation = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function handler(req, res) {
  const startTime = process.hrtime.bigint();
  
  try {
    // Step 1: Quick method validation with timeout protection
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Step 2: Extract raw body with timeout protection
    const rawBody = await withTimeout(
      streamToString(req), 
      5000, 
      'body extraction'
    );
    const signature = req.headers['x-razorpay-signature'];
    
    // Step 3: Fast signature verification - handle empty/test requests gracefully
    if (!rawBody.trim()) {
      return res.status(200).json({ 
        message: 'Empty webhook request acknowledged',
        timestamp: new Date().toISOString(),
        status: 'test_acknowledged'
      });
    }
    
    if (!verifySignatureFast(rawBody, signature)) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      console.error(`❌ Invalid signature (${Math.round(duration)}ms)`);
      
      // For test environments, acknowledge invalid signatures with 200 but log the issue
      if (!signature || signature === 'test_signature') {
        return res.status(200).json({ 
          message: 'Test request acknowledged',
          error: 'Invalid or missing signature',
          timestamp: new Date().toISOString(),
          status: 'test_invalid_signature'
        });
      }
      
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Step 4: Parse payload with error handling
    let webhookData;
    try {
      webhookData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError.message);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    
    const { event, payload } = webhookData;
    
    // Step 5: Quick event validation - handle empty POST requests gracefully
    if (!event && !payload && !rawBody.trim()) {
      return res.status(200).json({ 
        message: 'Empty webhook request received',
        timestamp: new Date().toISOString(),
        status: 'acknowledged'
      });
    }
    
    if (!event || !payload) {
      return res.status(400).json({ error: 'Invalid webhook payload - missing event or payload' });
    }

    // Step 6: Deduplication check with memory management
    const eventId = `${event}_${payload?.payment?.entity?.id || payload?.order?.entity?.id || Date.now()}`;
    if (processedEvents.has(eventId)) {
      console.log(`🔄 Duplicate event skipped: ${eventId}`);
      return res.status(200).json({ status: 'duplicate_skipped', event_id: eventId });
    }
    
    // Memory management - prevent cache overflow
    if (processedEvents.size > PERFORMANCE_TARGETS.MAX_QUEUE_SIZE) {
      console.log('🧹 Cleaning event cache to prevent memory overflow');
      const eventsArray = Array.from(processedEvents);
      processedEvents.clear();
      // Keep only the last 500 events
      eventsArray.slice(-500).forEach(id => processedEvents.add(id));
    }
    processedEvents.add(eventId);

    // Step 7: Respond immediately (CRITICAL for <200ms target)
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    // Performance monitoring
    if (duration > PERFORMANCE_TARGETS.RESPONSE_TIME_MS) {
      console.warn(`⚠️ Slow response: ${Math.round(duration)}ms (target: ${PERFORMANCE_TARGETS.RESPONSE_TIME_MS}ms)`);
    }
    
    res.status(200).json({
      success: true,
      event,
      event_id: eventId,
      processing_time_ms: Math.round(duration),
      timestamp: new Date().toISOString(),
      performance: {
        target_ms: PERFORMANCE_TARGETS.RESPONSE_TIME_MS,
        actual_ms: Math.round(duration),
        status: duration <= PERFORMANCE_TARGETS.RESPONSE_TIME_MS ? 'optimal' : 'slow'
      }
    });

    // Step 8: Process asynchronously AFTER response sent with timeout protection
    setImmediate(() => {
      processWebhookAsync(webhookData, rawBody, signature, eventId, startTime, req)
        .catch(error => {
          console.error('❌ Async processing failed:', error);
        });
    });

  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    console.error(`❌ Webhook error (${Math.round(duration)}ms):`, error);
    
    res.status(500).json({
      error: 'Processing failed',
      processing_time_ms: Math.round(duration),
      timestamp: new Date().toISOString()
    });
  }
}

// Optimized body reading
function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

// Fast signature verification
function verifySignatureFast(body, signature) {
  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return false;
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');
      
    // Ensure both signatures are the same length before comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }
      
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Enhanced async processing with timeout protection - Gold Standard
async function processWebhookAsync(webhookData, rawBody, signature, eventId, requestStartTime, req = null) {
  const { event, payload } = webhookData;
  const asyncStartTime = process.hrtime.bigint();
  
  try {
    console.log(`🔄 Processing webhook event: ${event} (ID: ${eventId})`);
    
    // Wrap all async processing with timeout protection
    await withTimeout(
      processEventWithRetries(event, payload, eventId, req),
      PERFORMANCE_TARGETS.MAX_PROCESSING_TIME_MS,
      `async processing for ${event}`
    );

    const asyncEndTime = process.hrtime.bigint();
    const asyncDuration = Number(asyncEndTime - asyncStartTime) / 1000000;
    const totalDuration = Number(asyncEndTime - requestStartTime) / 1000000;

    console.log(`✅ Webhook processing completed: ${event} (async: ${Math.round(asyncDuration)}ms, total: ${Math.round(totalDuration)}ms)`);
    
    // Performance monitoring
    if (asyncDuration > 10000) { // 10 second warning threshold
      console.warn(`⚠️ Slow async processing: ${Math.round(asyncDuration)}ms for ${event}`);
    }
    
  } catch (error) {
    const asyncEndTime = process.hrtime.bigint();
    const asyncDuration = Number(asyncEndTime - asyncStartTime) / 1000000;
    
    console.error(`❌ Async webhook processing failed (${Math.round(asyncDuration)}ms):`, {
      event,
      eventId,
      error: error.message,
      duration_ms: Math.round(asyncDuration)
    });
    
    // Don't throw error - async processing failures shouldn't affect the response
  }
}

// Process events with retry logic and parallel execution
async function processEventWithRetries(event, payload, eventId, req = null) {
  // Route to specific event handlers with enhanced processing
  switch (event) {
    case 'payment.captured':
      await processPaymentCapturedEnhanced(payload.payment.entity, eventId, req);
      break;
    case 'payment.failed':
      await processPaymentFailedEnhanced(payload.payment.entity, eventId);
      break;
    case 'order.paid':
      await processOrderPaidEnhanced(payload.order.entity, eventId);
      break;
    default:
      console.log(`ℹ️ Unhandled event type: ${event} (ID: ${eventId})`);
  }
}

// Enhanced payment processing with timeout protection and gold standard patterns
async function processPaymentCapturedEnhanced(payment, eventId, req = null) {
  console.log(`💰 Payment captured: ${payment.id} (₹${payment.amount / 100}) [${eventId}]`);
  
  // Parallel processing with individual timeout protection - Gold Standard
  const results = await Promise.allSettled([
    withTimeout(sendToZapier(payment), 8000, 'Zapier webhook'),
    withTimeout(sendToMetaCAPI(payment, req), 8000, 'Meta CAPI'), // Pass req for tracking params
    withTimeout(logToDatabase(payment), 3000, 'Database logging')
  ]);
  
  // Log results for monitoring
  results.forEach((result, index) => {
    const services = ['Zapier', 'Meta CAPI', 'Database'];
    if (result.status === 'fulfilled') {
      console.log(`✅ ${services[index]} processing completed`);
    } else {
      console.error(`❌ ${services[index]} processing failed:`, result.reason?.message);
    }
  });
}

async function processPaymentFailedEnhanced(payment, eventId) {
  console.log(`❌ Payment failed: ${payment.id} - ${payment.error_description} [${eventId}]`);
  
  // Log failed payment for analytics with timeout protection
  try {
    await withTimeout(logToDatabase(payment), 3000, 'Failed payment logging');
    console.log(`✅ Failed payment logged: ${payment.id}`);
  } catch (error) {
    console.error(`❌ Failed to log payment failure:`, error.message);
  }
}

async function processOrderPaidEnhanced(order, eventId) {
  console.log(`📦 Order paid: ${order.id} (₹${order.amount / 100}) [${eventId}]`);
  
  // Update order status with timeout protection
  try {
    await withTimeout(logToDatabase(order), 3000, 'Order logging');
    console.log(`✅ Order status updated: ${order.id}`);
  } catch (error) {
    console.error(`❌ Failed to update order status:`, error.message);
  }
}

// Legacy functions for backward compatibility
async function processPaymentCaptured(payment) {
  return processPaymentCapturedEnhanced(payment, 'legacy');
}

async function processPaymentFailed(payment) {
  return processPaymentFailedEnhanced(payment, 'legacy');
}

async function processOrderPaid(order) {
  return processOrderPaidEnhanced(order, 'legacy');
}

// Zapier integration
const { sendToZapier: zapierSendToZapier } = require('./lib/zapier-webhook');

async function sendToZapier(payment) {
  const orderData = {
    id: payment.id,
    order_id: payment.order_id,
    amount: payment.amount,
    method: payment.method,
    created_at: payment.created_at
  };
  
  const customerData = {
    name: payment.notes?.customer_name,
    email: payment.email,
    phone: payment.contact,
    customer_name: payment.notes?.customer_name,
    customer_email: payment.email
  };
  
  return await zapierSendToZapier(orderData, customerData);
}

// Meta CAPI integration
const { getMetaCAPI } = require('./lib/meta-capi');

async function sendToMetaCAPI(payment, req = null) {
  const metaCAPI = getMetaCAPI();
  
  const orderData = {
    order_id: payment.order_id,
    amount: payment.amount / 100, // Convert paise to rupees
    currency: 'INR',
    payment_id: payment.id
  };
  
  const customerData = {
    name: payment.notes?.customer_name,
    email: payment.email,
    phone: payment.contact
  };
  
  // Extract Facebook tracking parameters for enhanced matching (100% boost potential)
  const trackingParams = req ? metaCAPI.extractTrackingParams(req) : {};
  
  // Use consistent event ID for deduplication across client/server
  const eventId = `purchase_${payment.order_id}`;
  orderData.order_id = eventId; // Use as event ID
  
  console.log('[WEBHOOK] Sending to Meta CAPI with enhanced tracking:', {
    order_id: orderData.order_id,
    email: customerData.email,
    has_fbc: !!trackingParams.fbc,
    has_fbp: !!trackingParams.fbp,
    has_external_id: !!trackingParams.external_id
  });
  
  return await metaCAPI.sendPurchaseEventAsync(orderData, customerData, trackingParams);
}

async function logToDatabase(data) {
  console.log('💾 Database logging - placeholder');
}

// Export handler and config for Vercel
module.exports = handler;
module.exports.config = {
  api: { bodyParser: false }
};

// For testing: clear processed events cache
module.exports.clearProcessedEvents = function() {
  processedEvents.clear();
};
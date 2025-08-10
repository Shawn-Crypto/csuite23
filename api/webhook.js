const crypto = require('crypto');

// Event deduplication cache (in production, use Redis)
const processedEvents = new Set();

async function handler(req, res) {
  const startTime = process.hrtime.bigint();
  
  try {
    // Step 1: Quick method validation
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Step 2: Extract raw body and signature
    const rawBody = await streamToString(req);
    const signature = req.headers['x-razorpay-signature'];
    
    // Step 3: Fast signature verification
    if (!verifySignatureFast(rawBody, signature)) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      console.error(`❌ Invalid signature (${Math.round(duration)}ms)`);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Step 4: Parse payload
    const webhookData = JSON.parse(rawBody);
    const { event, payload } = webhookData;
    
    // Step 5: Quick event validation
    if (!event || !payload) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Step 6: Deduplication check
    const eventId = `${event}_${payload?.payment?.entity?.id || payload?.order?.entity?.id || Date.now()}`;
    if (processedEvents.has(eventId)) {
      console.log(`🔄 Duplicate event skipped: ${eventId}`);
      return res.status(200).json({ status: 'duplicate_skipped', event_id: eventId });
    }
    processedEvents.add(eventId);

    // Step 7: Respond immediately (CRITICAL for performance)
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    res.status(200).json({
      success: true,
      event,
      processing_time_ms: Math.round(duration),
      timestamp: new Date().toISOString()
    });

    // Step 8: Process asynchronously AFTER response sent
    setImmediate(() => processWebhookAsync(webhookData, rawBody, signature));

  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    console.error(`❌ Webhook error (${Math.round(duration)}ms):`, error);
    
    res.status(500).json({
      error: 'Processing failed',
      processing_time_ms: Math.round(duration)
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

// Async processing after response sent
async function processWebhookAsync(webhookData, rawBody, signature) {
  const { event, payload } = webhookData;
  
  try {
    console.log(`🔄 Processing webhook event: ${event}`);
    
    // Route to specific event handlers
    switch (event) {
      case 'payment.captured':
        await processPaymentCaptured(payload.payment.entity);
        break;
      case 'payment.failed':
        await processPaymentFailed(payload.payment.entity);
        break;
      case 'order.paid':
        await processOrderPaid(payload.order.entity);
        break;
      default:
        console.log(`ℹ️ Unhandled event type: ${event}`);
    }

    console.log(`✅ Webhook processing completed: ${event}`);
    
  } catch (error) {
    console.error(`❌ Async webhook processing failed:`, error);
  }
}

async function processPaymentCaptured(payment) {
  console.log(`💰 Payment captured: ${payment.id} (₹${payment.amount / 100})`);
  
  // Parallel processing of external APIs
  await Promise.allSettled([
    sendToZapier(payment),
    sendToMetaCAPI(payment),
    logToDatabase(payment)
  ]);
}

async function processPaymentFailed(payment) {
  console.log(`❌ Payment failed: ${payment.id} - ${payment.error_description}`);
  
  // Log failed payment for analytics
  await logToDatabase(payment);
}

async function processOrderPaid(order) {
  console.log(`📦 Order paid: ${order.id} (₹${order.amount / 100})`);
  
  // Update order status
  await logToDatabase(order);
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

async function sendToMetaCAPI(payment) {
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
  
  // Use consistent event ID for deduplication across client/server
  const eventId = `purchase_${payment.order_id}`;
  orderData.order_id = eventId; // Use as event ID
  
  return await metaCAPI.sendPurchaseEventAsync(orderData, customerData);
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
/**
 * Secure Razorpay Webhook Endpoint
 * Path: /api/webhook-rzp-secure-7k9m
 * Enhanced security through obscurity + signature verification
 */

import crypto from 'crypto';

// Disable Vercel body parser for raw body access (CRITICAL for signature verification)
export const config = {
  api: { bodyParser: false }
};

// Pre-compile regex for performance
const ORDER_ID_REGEX = /^order_[A-Za-z0-9]+$/;

export default async function handler(req, res) {
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

    // Step 6: Respond immediately (CRITICAL for performance)
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    res.status(200).json({
      success: true,
      event,
      processing_time_ms: Math.round(duration),
      timestamp: new Date().toISOString()
    });

    // Step 7: Process asynchronously AFTER response sent
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
  if (!signature || !process.env.RAZORPAY_LIVE_WEBHOOK_SECRET) {
    return false;
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_LIVE_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');
      
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Async webhook processing
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
    await handleWebhookError(webhookData, error);
  }
}

async function processPaymentCaptured(payment) {
  const { order_id, amount, currency, email, contact } = payment;
  const amountInRupees = amount / 100; // Convert from paise
  
  console.log(`💰 Processing payment: ${payment.id} for ₹${amountInRupees}`);
  
  // Extract product information
  const products = detectProducts(amountInRupees, payment.notes);
  
  // Execute tracking and analytics in parallel (no Zapier - that's handled directly)
  const results = await Promise.allSettled([
    sendToMetaCAPI(order_id, email, products, amountInRupees, payment),
    updateDatabase(order_id, payment, products),
    logWebhookEvent(order_id, payment, products)
  ]);
  
  // Log any failures without throwing errors
  results.forEach((result, index) => {
    const services = ['Meta CAPI', 'Database', 'Event Log'];
    if (result.status === 'rejected') {
      console.error(`❌ ${services[index]} processing failed:`, result.reason);
    } else {
      console.log(`✅ ${services[index]} processing successful`);
    }
  });
  
  console.log(`📋 Payment processed: ₹${amountInRupees} for ${products.products.join(', ')} - Razorpay will handle Zapier → Kajabi delivery`);
}

async function processPaymentFailed(payment) {
  console.log(`❌ Payment failed: ${payment.id}`);
  // Handle failed payment logic here
}

async function processOrderPaid(order) {
  console.log(`✅ Order paid: ${order.id}`);
  // Handle order paid logic here
}

// Simple product detection for logging (Razorpay → Zapier → Kajabi handles delivery)
function detectProducts(amount, notes = {}) {
  const products = [];
  
  // Simple detection for logging purposes only
  if (amount >= 11999) {
    products.push('Bundle: Course + Analysis Arsenal + Mentorship');
  } else if (amount >= 11998) {
    products.push('Course + Mentorship');
  } else if (amount >= 9999) {
    products.push('1-on-1 Mentorship');
  } else if (amount >= 3998) {
    products.push('Course + Analysis Arsenal');
  } else if (amount >= 1999) {
    products.push('Course OR Analysis Arsenal');
  } else {
    products.push('Course (Legacy)');
  }

  return { 
    products, 
    amount, 
    description: products.join(', '),
    note: 'Product delivery handled by Razorpay → Zapier → Kajabi'
  };
}

// External service integrations (simplified - no Zapier)
// Note: Zapier integration removed - Razorpay → Zapier → Kajabi happens directly

async function sendToMetaCAPI(orderId, email, productData, amount, payment) {
  console.log(`📤 Meta CAPI: ${orderId} - ₹${amount}`);
  // Meta CAPI integration for Facebook tracking
  // This tracks purchase conversions for ad optimization
  return { success: true, service: 'meta_capi' };
}

async function updateDatabase(orderId, payment, productData) {
  console.log(`💾 Database: ${orderId}`);
  // Store payment record for analytics and support
  return { success: true, service: 'database' };
}

async function logWebhookEvent(orderId, payment, productData) {
  console.log(`📝 Event Log: ${orderId}`);
  // Log webhook events for monitoring and debugging
  return { success: true, service: 'event_log' };
}

async function handleWebhookError(webhookData, error) {
  console.error('❌ Webhook processing error:', error.message);
  // Error handling logic here
}
# Webhook System Implementation Guide

**Target**: Claude Code sessions building high-performance webhook systems  
**Guide 3 of 8**: Webhook Processing & Performance Optimization

## CRITICAL Performance Requirements

**Response Time Target**: < 200ms (MANDATORY)  
**Success Rate Target**: > 99%  
**Async Processing**: ALL external API calls MUST be async

## High-Performance Webhook Handler

### /api/razorpay-webhook.js (Optimized)
```javascript
import crypto from 'crypto';

// CRITICAL: Disable Vercel body parser for raw body access
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
  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return false;
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
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
```

## Async Processing Implementation

### Event Processing Strategy
```javascript
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
    
    // Optional: Implement retry mechanism or dead letter queue
    await handleWebhookError(webhookData, error);
  }
}

async function processPaymentCaptured(payment) {
  const { order_id, amount, currency, email, contact } = payment;
  const amountInRupees = amount / 100; // Convert from paise
  
  console.log(`💰 Processing payment: ${payment.id} for ₹${amountInRupees}`);
  
  // Extract product information
  const products = detectProducts(amountInRupees, payment.notes);
  
  // Execute all external calls in parallel for maximum performance
  const results = await Promise.allSettled([
    sendToZapier(order_id, email, products, amountInRupees),
    sendToMetaCAPI(order_id, email, products, amountInRupees, payment),
    updateDatabase(order_id, payment, products),
    logWebhookEvent(order_id, payment, products)
  ]);
  
  // Log any failures without throwing errors
  results.forEach((result, index) => {
    const services = ['Zapier', 'Meta CAPI', 'Database', 'Event Log'];
    if (result.status === 'rejected') {
      console.error(`❌ ${services[index]} processing failed:`, result.reason);
    } else {
      console.log(`✅ ${services[index]} processing successful`);
    }
  });
}
```

## Product Detection System

### Multi-Strategy Product Detection
```javascript
// utils/product-detector.js
export function detectProducts(amount, notes = {}) {
  // Strategy 1: Amount-based detection (Primary)
  const amountBasedProducts = detectByAmount(amount);
  
  // Strategy 2: Notes validation (Secondary)
  const notesProducts = detectByNotes(notes);
  
  // Strategy 3: Validation and reconciliation
  const finalProducts = reconcileProducts(amountBasedProducts, notesProducts, amount);
  
  return finalProducts;
}

function detectByAmount(amount) {
  const products = [];
  let flags = {
    send_course_access: false,
    send_database: false,
    send_calendar_link: false
  };

  if (amount >= 8997) {
    // Full bundle: Course + Database + Strategy Call
    products.push('course', 'database', 'strategy_call');
    flags = { send_course_access: true, send_database: true, send_calendar_link: true };
  } else if (amount >= 6498 && amount < 8997) {
    // Course + Strategy Call
    products.push('course', 'strategy_call');
    flags = { send_course_access: true, send_database: false, send_calendar_link: true };
  } else if (amount >= 3998 && amount < 6498) {
    // Course + Database
    products.push('course', 'database');
    flags = { send_course_access: true, send_database: true, send_calendar_link: false };
  } else if (amount >= 1499 && amount < 3998) {
    // Course only
    products.push('course');
    flags = { send_course_access: true, send_database: false, send_calendar_link: false };
  } else {
    console.warn(`⚠️ Unexpected amount: ₹${amount}`);
    // Default to course only for unknown amounts
    products.push('course');
    flags = { send_course_access: true, send_database: false, send_calendar_link: false };
  }

  return { products, flags, amount, detection_method: 'amount_based' };
}

function detectByNotes(notes) {
  if (!notes?.products) return null;
  
  try {
    const notesProducts = JSON.parse(notes.products);
    if (Array.isArray(notesProducts) && notesProducts.length > 0) {
      const flags = {
        send_course_access: notesProducts.includes('course'),
        send_database: notesProducts.includes('database'),
        send_calendar_link: notesProducts.includes('strategy_call')
      };
      
      return { products: notesProducts, flags, detection_method: 'notes_based' };
    }
  } catch (error) {
    console.warn('Failed to parse notes products:', error);
  }
  
  return null;
}

function reconcileProducts(amountBased, notesBased, amount) {
  // If notes are invalid or missing, use amount-based
  if (!notesBased) {
    console.log('✅ Using amount-based product detection');
    return amountBased;
  }
  
  // Validate notes against amount
  const expectedAmount = calculateExpectedAmount(notesBased.products);
  const amountDifference = Math.abs(expectedAmount - amount);
  
  if (amountDifference <= 1) { // Allow ₹1 variance
    console.log('✅ Notes products validated against amount');
    return { ...notesBased, amount };
  } else {
    console.warn(`⚠️ Notes products (₹${expectedAmount}) don't match amount (₹${amount}), using amount-based`);
    return amountBased;
  }
}

function calculateExpectedAmount(products) {
  let total = 0;
  const prices = { course: 1499, database: 2499, strategy_call: 4999 };
  
  products.forEach(product => {
    if (prices[product]) {
      total += prices[product];
    }
  });
  
  return total;
}
```

## External Service Integration

### Zapier Integration
```javascript
async function sendToZapier(orderId, customerEmail, productData, amount) {
  try {
    const payload = {
      order_id: orderId,
      customer_email: customerEmail,
      customer_name: extractNameFromEmail(customerEmail),
      amount: amount,
      currency: 'INR',
      products: productData.products,
      send_course_access: productData.flags.send_course_access,
      send_database: productData.flags.send_database,
      send_calendar_link: productData.flags.send_calendar_link,
      timestamp: new Date().toISOString(),
      source: 'razorpay_webhook'
    };

    console.log('📤 Sending to Zapier:', { order_id: orderId, products: productData.products });

    const response = await fetch(process.env.ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Zapier webhook failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.text();
    console.log('✅ Zapier webhook successful:', result);
    
    return { success: true, response: result };

  } catch (error) {
    console.error('❌ Zapier webhook failed:', error);
    throw error;
  }
}

function extractNameFromEmail(email) {
  // Extract name from email (fallback approach)
  const localPart = email.split('@')[0];
  return localPart.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
```

### Meta CAPI Integration
```javascript
async function sendToMetaCAPI(orderId, customerEmail, productData, amount, paymentData) {
  try {
    const eventData = {
      order_id: orderId,
      customer_email: customerEmail,
      customer_name: extractNameFromEmail(customerEmail),
      customer_phone: paymentData.contact,
      amount: amount,
      products: productData.products,
      payment_data: {
        payment_id: paymentData.id,
        method: paymentData.method,
        created_at: paymentData.created_at
      }
    };

    console.log('📤 Sending to Meta CAPI:', { order_id: orderId, amount });

    const response = await fetch('/api/meta-capi-server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
      timeout: 8000 // 8 second timeout
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta CAPI failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('✅ Meta CAPI event sent successfully');
    
    return { success: true, result };

  } catch (error) {
    console.error('❌ Meta CAPI failed:', error);
    throw error;
  }
}
```

## Database Logging System

### Comprehensive Webhook Logging
```javascript
async function updateDatabase(orderId, payment, productData) {
  try {
    const webhookEvent = {
      order_id: orderId,
      event_type: 'payment.captured',
      payment_id: payment.id,
      amount: payment.amount / 100,
      currency: payment.currency,
      customer_email: payment.email,
      customer_phone: payment.contact,
      payment_method: payment.method,
      products: JSON.stringify(productData.products),
      product_flags: JSON.stringify(productData.flags),
      razorpay_payment_status: payment.status,
      processed_at: new Date().toISOString(),
      processing_time_ms: Date.now() - startTime
    };

    // Using Supabase client (adjust for your database)
    const { data, error } = await supabase
      .from('webhook_events')
      .insert([webhookEvent])
      .select();

    if (error) throw error;

    console.log('✅ Database updated successfully:', data[0]?.id);
    return { success: true, data };

  } catch (error) {
    console.error('❌ Database update failed:', error);
    throw error;
  }
}

async function logWebhookEvent(orderId, payment, productData) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      order_id: orderId,
      payment_id: payment.id,
      amount: payment.amount / 100,
      products: productData.products,
      status: 'processed',
      source: 'webhook'
    };

    // Log to multiple destinations for reliability
    await Promise.allSettled([
      logToSupabase(logEntry),
      logToConsole(logEntry),
      // logToCloudWatch(logEntry), // If using AWS
      // logToSentry(logEntry) // If using Sentry
    ]);

  } catch (error) {
    console.error('❌ Event logging failed:', error);
  }
}
```

## Error Handling & Recovery

### Webhook Error Handler
```javascript
async function handleWebhookError(webhookData, error) {
  const errorDetails = {
    timestamp: new Date().toISOString(),
    event: webhookData.event,
    order_id: webhookData.payload?.payment?.entity?.order_id,
    error_message: error.message,
    error_stack: error.stack,
    webhook_data: JSON.stringify(webhookData)
  };

  try {
    // Log error to database
    await supabase
      .from('webhook_errors')
      .insert([errorDetails]);

    // Send alert (optional)
    if (process.env.WEBHOOK_ERROR_ALERT_URL) {
      await fetch(process.env.WEBHOOK_ERROR_ALERT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Webhook processing failed: ${error.message}`,
          order_id: errorDetails.order_id,
          event: errorDetails.event
        })
      });
    }

  } catch (logError) {
    console.error('❌ Error logging failed:', logError);
  }
}
```

### Retry Mechanism
```javascript
// utils/retry-mechanism.js
export async function withRetry(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.warn(`Attempt ${attempt}/${maxRetries} failed, retrying in ${Math.round(delay)}ms:`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage in external API calls
async function sendToZapierWithRetry(orderId, email, productData, amount) {
  return withRetry(
    () => sendToZapier(orderId, email, productData, amount),
    3, // 3 attempts
    2000 // 2 second base delay
  );
}
```

## Performance Monitoring

### Webhook Performance Tracking
```javascript
// utils/performance-tracker.js
export function trackWebhookPerformance(event, duration, success = true) {
  const perfData = {
    event,
    duration_ms: duration,
    success,
    timestamp: new Date().toISOString()
  };

  // Log performance metrics
  console.log(`📊 Webhook performance: ${event} - ${duration}ms - ${success ? 'SUCCESS' : 'FAILED'}`);

  // Send to monitoring service (optional)
  if (process.env.PERFORMANCE_MONITORING_URL) {
    fetch(process.env.PERFORMANCE_MONITORING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(perfData)
    }).catch(error => console.error('Performance tracking failed:', error));
  }
}

// Usage in webhook handler
const startTime = Date.now();
try {
  // Process webhook
  const endTime = Date.now();
  trackWebhookPerformance(event, endTime - startTime, true);
} catch (error) {
  const endTime = Date.now();
  trackWebhookPerformance(event, endTime - startTime, false);
  throw error;
}
```

## Next Steps

1. **Implement webhook handler** using the optimized pattern
2. **Set up product detection** with multi-strategy approach
3. **Configure external integrations** (Zapier, Meta CAPI)
4. **Add database logging** for comprehensive tracking
5. **Test webhook performance** to ensure < 200ms response times
6. **Set up error handling** and monitoring

## Critical Performance Rules

1. **NEVER await external API calls** in webhook response path
2. **Always respond within 200ms** to prevent timeouts
3. **Use setImmediate()** for async processing after response
4. **Implement comprehensive error handling** without blocking
5. **Log everything** for debugging production issues
6. **Use parallel processing** for multiple external calls
7. **Validate signatures** before processing payload

This webhook system is designed for production reliability and performance based on lessons learned from Cashfree implementation.
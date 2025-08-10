# Critical Pitfalls & Avoidance Guide

**Target**: Claude Code sessions to avoid painful debugging sessions  
**Guide 6 of 8**: Lessons Learned from Production Failures

## CRITICAL PITFALL #1: Webhook Response Time

### ❌ THE MISTAKE THAT KILLS
```javascript
// THIS WILL DESTROY YOUR WEBHOOK SUCCESS RATE
export default async function webhookHandler(req, res) {
  const webhookData = req.body;
  
  // These blocking calls cause 1.7 MILLION ms response times!
  await sendToZapier(webhookData);      // 5-10 seconds
  await sendToMetaCAPI(webhookData);    // 3-5 seconds  
  await updateDatabase(webhookData);    // 2-3 seconds
  await sendEmailNotification(webhookData); // 5+ seconds
  
  res.status(200).json({ success: true }); // 20+ seconds later = TIMEOUT
}
```

### ✅ THE CORRECT PATTERN
```javascript
export default async function webhookHandler(req, res) {
  // Validate and respond IMMEDIATELY (under 200ms)
  res.status(200).json({ success: true });
  
  // Process everything AFTER response
  setImmediate(async () => {
    await Promise.allSettled([
      sendToZapier(webhookData),
      sendToMetaCAPI(webhookData),
      updateDatabase(webhookData)
    ]);
  });
}
```

**Real Impact**: Success rate went from 33% → 100%, response time from 1,700,000ms → 200ms

---

## CRITICAL PITFALL #2: Webhook Signature Verification

### ❌ THE MISTAKE
```javascript
// Vercel auto-parses body = SIGNATURE MISMATCH
export default async function handler(req, res) {
  const body = req.body; // Already parsed JSON object
  const signature = req.headers['x-razorpay-signature'];
  
  // This will NEVER match because body is not raw
  const hash = crypto.createHmac('sha256', secret)
    .update(JSON.stringify(body)) // Different from original!
    .digest('hex');
}
```

### ✅ THE CORRECT PATTERN
```javascript
// MUST disable bodyParser
export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  const rawBody = await getRawBody(req); // Exact bytes
  const signature = req.headers['x-razorpay-signature'];
  
  const hash = crypto.createHmac('sha256', secret)
    .update(rawBody) // Original bytes preserved
    .digest('hex');
}
```

**Real Impact**: 100% of webhooks were failing signature validation silently

---

## CRITICAL PITFALL #3: Lead Capture Modal Hanging

### ❌ THE MISTAKE
```javascript
// Modal hangs forever, user can't proceed
async function submitLead(data) {
  // No timeout = infinite wait if API is slow
  const response = await fetch('/api/capture-lead', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  // If API is calling external services synchronously...
  // User waits 30+ seconds staring at spinner
}
```

### ✅ THE CORRECT PATTERN
```javascript
async function submitLead(data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch('/api/capture-lead-async', {
      method: 'POST',
      body: JSON.stringify(data),
      signal: controller.signal // Timeout protection
    });
    clearTimeout(timeoutId);
    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw error;
  }
}

// API endpoint responds immediately
export default async function handler(req, res) {
  // Respond first
  res.status(200).json({ success: true });
  
  // Process async
  setImmediate(() => {
    sendToZapier(data);
    sendToMetaCAPI(data);
  });
}
```

**Real Impact**: Lead capture completion rate increased by 40%

---

## CRITICAL PITFALL #4: Meta Pixel Event Duplication

### ❌ THE MISTAKE
```javascript
// Client-side sends one event ID
fbq('track', 'Purchase', data, { 
  eventID: 'client_' + Date.now() 
});

// Server-side sends different event ID
const eventData = {
  event_id: 'server_' + orderId,
  // Meta sees these as 2 separate purchases!
};

// GTM sends THIRD event with another ID
dataLayer.push({
  event: 'purchase',
  // No event ID coordination!
});
```

### ✅ THE CORRECT PATTERN
```javascript
// EVERYONE uses the same format
const eventId = `purchase_${orderId}`;

// Client-side
fbq('track', 'Purchase', data, { eventID: eventId });

// Server-side
const eventData = { event_id: eventId };

// GTM
dataLayer.push({
  meta_pixel: { event_id: eventId }
});
```

**Real Impact**: Reduced duplicate conversions from 3x to 1x, saving ad budget

---

## CRITICAL PITFALL #5: API Version Deprecation

### ❌ THE MISTAKE
```javascript
// Using outdated API version
const cashfree = new Cashfree({
  apiVersion: '2023-08-01' // DEPRECATED!
});

// Suddenly stops working with HTTP 401/500 errors
// "It was working yesterday!"
```

### ✅ THE CORRECT PATTERN
```javascript
// Always use latest stable version
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
  // SDK handles version internally
});

// For direct API calls, check documentation
const API_VERSION = 'v1'; // Current Razorpay version
```

**Real Impact**: Complete payment failure for 24 hours until discovered

---

## CRITICAL PITFALL #6: Environment Variable Confusion

### ❌ THE MISTAKE
```javascript
// Mixing test and production credentials
const config = {
  razorpay_key: process.env.RAZORPAY_KEY, // Which one?
  webhook_secret: 'hardcoded_secret', // NEVER DO THIS
  meta_pixel: '1234567890', // Hardcoded = bad
};

// No validation = silent failures
const razorpay = new Razorpay({
  key_id: undefined, // Fails silently
  key_secret: undefined // No error until API call
});
```

### ✅ THE CORRECT PATTERN
```javascript
// Clear environment separation
const environment = process.env.NODE_ENV || 'development';

const config = {
  razorpay: {
    key_id: environment === 'production' 
      ? process.env.RAZORPAY_LIVE_KEY_ID
      : process.env.RAZORPAY_TEST_KEY_ID,
    key_secret: environment === 'production'
      ? process.env.RAZORPAY_LIVE_KEY_SECRET
      : process.env.RAZORPAY_TEST_KEY_SECRET
  }
};

// Validate on startup
if (!config.razorpay.key_id || !config.razorpay.key_secret) {
  throw new Error('Missing Razorpay credentials');
}
```

**Real Impact**: Processed test payments thinking they were real

---

## CRITICAL PITFALL #7: Serverless Cold Starts

### ❌ THE MISTAKE
```javascript
// Creating new connections every invocation
export default async function handler(req, res) {
  // Cold start: 3-5 seconds
  const supabase = createClient(url, key);
  
  // Another cold start: 2-3 seconds
  const razorpay = new Razorpay(config);
  
  // Total cold start penalty: 5-8 seconds!
}
```

### ✅ THE CORRECT PATTERN
```javascript
// Initialize OUTSIDE handler (reused across invocations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  { auth: { persistSession: false } } // Important for serverless
);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export default async function handler(req, res) {
  // No cold start, instant execution
  const order = await razorpay.orders.create(data);
}
```

**Real Impact**: Reduced API response time by 60%

---

## CRITICAL PITFALL #8: Missing Error Context

### ❌ THE MISTAKE
```javascript
try {
  const result = await someOperation();
} catch (error) {
  console.error('Error occurred'); // Useless!
  res.status(500).json({ error: 'Something went wrong' }); // No context!
}
```

### ✅ THE CORRECT PATTERN
```javascript
try {
  const result = await someOperation();
} catch (error) {
  // Log with full context
  console.error('Payment order creation failed:', {
    error: error.message,
    stack: error.stack,
    orderId: orderData.id,
    customerId: customerEmail,
    amount: amount,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
  
  // User-friendly but informative error
  res.status(500).json({ 
    error: 'Payment order creation failed',
    code: 'ORDER_CREATION_FAILED',
    reference: orderId,
    timestamp: new Date().toISOString()
  });
}
```

**Real Impact**: Reduced debugging time from hours to minutes

---

## CRITICAL PITFALL #9: Race Conditions

### ❌ THE MISTAKE
```javascript
// Success page and webhook race to process payment
// Success page:
trackPurchase(orderId); // Fires immediately
sendToMetaCAPI(orderId); // Duplicate!

// Webhook (fires at same time):
processPayment(orderId);
sendToMetaCAPI(orderId); // Another duplicate!
```

### ✅ THE CORRECT PATTERN
```javascript
// Use idempotency and deduplication
const processedOrders = new Set();

async function processOnce(orderId) {
  if (processedOrders.has(orderId)) {
    console.log('Order already processed:', orderId);
    return;
  }
  
  processedOrders.add(orderId);
  
  // Process with consistent event ID
  const eventId = `purchase_${orderId}`;
  await sendToMetaCAPI(eventId);
}

// Or use database flag
const { data, error } = await supabase
  .from('orders')
  .update({ processed: true })
  .eq('id', orderId)
  .eq('processed', false); // Only if not processed

if (data?.length > 0) {
  // First to process wins
  await processPayment(orderId);
}
```

**Real Impact**: Eliminated duplicate processing and tracking events

---

## CRITICAL PITFALL #10: Browser Caching Issues

### ❌ THE MISTAKE
```javascript
// Deploying new code but browsers use cached version
// User: "The bug is still there!"
// Developer: "But I fixed it!"

// Old cached main.js still running in browser
// CDN serving stale content
// GTM container not updated
```

### ✅ THE CORRECT PATTERN
```javascript
// Version your assets
<script src="/js/main.js?v=1.2.3"></script>

// Or use content hash
<script src="/js/main.abc123.js"></script>

// Set proper cache headers
res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

// For testing, always hard refresh
// Tell users: "Please press Ctrl+Shift+R (Cmd+Shift+R on Mac)"

// Add version endpoint for debugging
app.get('/api/version', (req, res) => {
  res.json({ 
    version: process.env.APP_VERSION,
    deployed: process.env.DEPLOY_TIME
  });
});
```

**Real Impact**: Wasted 4 hours debugging an already-fixed issue

---

## Quick Reference: Error Priority

### 🔴 CRITICAL (Fix Immediately)
1. Webhook timeout (>5s response time)
2. Signature verification failure
3. Payment API authentication errors
4. Database connection failures

### 🟡 HIGH (Fix Soon)
1. Event duplication
2. Missing error handling
3. No timeout on API calls
4. Hardcoded credentials

### 🟢 MEDIUM (Fix Eventually)
1. Cold start performance
2. Missing logging context
3. No retry logic
4. Cache invalidation

## Debug Checklist

When something fails, check in this order:

1. **Environment Variables**: Are they set correctly?
2. **API Credentials**: Test vs Production?
3. **Webhook Response Time**: Under 200ms?
4. **Signature Verification**: Using raw body?
5. **Event IDs**: Consistent across client/server?
6. **Browser Cache**: Hard refresh executed?
7. **API Version**: Using latest/stable?
8. **Error Logs**: Full context available?
9. **Network Tab**: What's actually being sent?
10. **Events Manager**: What is Meta receiving?

## Golden Rules

1. **Always respond to webhooks in <200ms**
2. **Never trust parsed bodies for signatures**
3. **Always implement timeouts on external calls**
4. **Use consistent event IDs everywhere**
5. **Log everything with context**
6. **Validate environment variables on startup**
7. **Test with real webhook data**
8. **Monitor production constantly**
9. **Document weird behaviors**
10. **Keep this guide updated**

These pitfalls cost us 50+ hours of debugging. Learn from our pain!
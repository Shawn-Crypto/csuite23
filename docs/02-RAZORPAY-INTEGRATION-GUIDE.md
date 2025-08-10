# Razorpay Integration Patterns Guide

**Target**: Claude Code sessions building Razorpay payment systems  
**Guide 2 of 8**: Razorpay API Integration Patterns

## SDK vs Direct API Decision Matrix

### When to Use Razorpay SDK
- ✅ **Order Creation**: Better error handling and validation
- ✅ **Payment Fetching**: Built-in retry logic and formatting
- ✅ **Refund Processing**: Structured response handling

### When to Use Direct API Calls
- ✅ **Webhook Processing**: Better control over raw body handling
- ✅ **Signature Verification**: Direct access to cryptographic functions
- ✅ **Custom Error Handling**: Full control over error responses

```javascript
// RECOMMENDED PATTERN: Mixed approach
import Razorpay from 'razorpay';  // For operations
import crypto from 'crypto';      // For webhooks
```

## Order Creation Implementation

### /api/create-razorpay-order.js
```javascript
import Razorpay from 'razorpay';

export default async function handler(req, res) {
  // Method validation
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      amount, 
      currency = 'INR', 
      customer_email, 
      customer_name, 
      customer_phone, 
      products = ['course']
    } = req.body;
    
    // Input validation
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (!customer_email || !isValidEmail(customer_email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    if (!customer_name || customer_name.trim().length < 2) {
      return res.status(400).json({ error: 'Invalid customer name' });
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Generate unique receipt ID
    const receipt = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create order with comprehensive metadata
    const orderData = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt,
      notes: {
        customer_email,
        customer_name,
        customer_phone: formatPhoneNumber(customer_phone),
        products: JSON.stringify(products),
        created_at: new Date().toISOString(),
        source: 'website_lead_capture',
        environment: process.env.RAZORPAY_ENVIRONMENT || 'test'
      }
    };

    console.log('Creating Razorpay order:', { 
      amount: orderData.amount, 
      currency, 
      receipt,
      customer: customer_email 
    });

    const order = await razorpay.orders.create(orderData);
    
    console.log('✅ Order created successfully:', order.id);
    
    // Return structured response for frontend
    res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      customer: {
        name: customer_name,
        email: customer_email,
        contact: formatPhoneNumber(customer_phone)
      },
      created_at: order.created_at,
      receipt: order.receipt
    });

  } catch (error) {
    console.error('❌ Order creation error:', error);
    
    // Handle specific Razorpay errors
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: 'Payment gateway error',
        details: error.error?.description || error.message,
        code: error.error?.code
      });
    }
    
    // Handle general errors
    res.status(500).json({ 
      error: 'Order creation failed',
      details: error.message 
    });
  }
}

// Phone number formatting utility
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle Indian numbers (10 digits)
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  
  // Handle international format
  if (digits.length > 10 && !digits.startsWith('91')) {
    return `+${digits}`;
  }
  
  // Already has country code
  if (digits.length > 10 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  
  return `+${digits}`;
}

// Email validation utility
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

## Payment Verification Implementation

### /api/verify-razorpay-payment.js
```javascript
import Razorpay from 'razorpay';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;
    
    // Input validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required payment parameters' 
      });
    }

    console.log('Verifying payment:', { 
      order_id: razorpay_order_id, 
      payment_id: razorpay_payment_id 
    });

    // Step 1: Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );
    
    if (!isValidSignature) {
      console.error('❌ Invalid payment signature');
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid payment signature' 
      });
    }

    console.log('✅ Payment signature verified');

    // Step 2: Fetch payment and order details from Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const [payment, order] = await Promise.all([
      razorpay.payments.fetch(razorpay_payment_id),
      razorpay.orders.fetch(razorpay_order_id)
    ]);

    console.log('Payment status:', payment.status);
    console.log('Order status:', order.status);

    // Step 3: Verify payment and order status
    if (payment.status === 'captured' && order.status === 'paid') {
      
      console.log('✅ Payment verification successful');
      
      // Extract customer details from order notes
      const customerEmail = order.notes?.customer_email || payment.email;
      const customerName = order.notes?.customer_name || '';
      
      res.status(200).json({
        success: true,
        payment_verified: true,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        customer_email: customerEmail,
        customer_name: customerName,
        amount: order.amount / 100, // Convert back to rupees
        currency: order.currency,
        receipt: order.receipt,
        payment_method: payment.method,
        created_at: new Date(payment.created_at * 1000).toISOString()
      });

    } else {
      console.error('❌ Payment not completed:', { 
        payment_status: payment.status, 
        order_status: order.status 
      });
      
      res.status(400).json({
        success: false,
        error: 'Payment not completed',
        payment_status: payment.status,
        order_status: order.status,
        order_id: razorpay_order_id
      });
    }

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    // Handle Razorpay API errors
    if (error.statusCode && error.error) {
      return res.status(error.statusCode).json({
        error: 'Payment verification failed',
        details: error.error.description,
        code: error.error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Payment verification failed',
      details: error.message 
    });
  }
}
```

## Webhook Signature Verification (CRITICAL)

### Raw Body Extraction Pattern
```javascript
// CRITICAL: Disable Vercel body parser for webhooks
export const config = {
  api: {
    bodyParser: false,
  },
};

// Efficient raw body reading
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Alternative stream approach for large payloads
function getRawBodyStream(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
```

### Signature Verification Implementation
```javascript
import crypto from 'crypto';

export function verifyRazorpayWebhook(rawBody, signature, secret) {
  // Input validation
  if (!signature || !secret || !rawBody) {
    console.error('❌ Missing webhook verification parameters');
    return false;
  }

  try {
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (isValid) {
      console.log('✅ Webhook signature verified');
      return true;
    } else {
      console.error('❌ Invalid webhook signature');
      return false;
    }

  } catch (error) {
    console.error('❌ Webhook signature verification error:', error);
    return false;
  }
}

// Usage in webhook endpoint
export default async function handler(req, res) {
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-razorpay-signature'];
    
    if (!verifyRazorpayWebhook(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhookData = JSON.parse(rawBody);
    // Process webhook data...
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}
```

## Error Handling Patterns

### Razorpay-Specific Error Handling
```javascript
// utils/razorpay-error-handler.js
export function handleRazorpayError(error, context = 'razorpay_operation') {
  console.error(`Razorpay error in ${context}:`, {
    statusCode: error.statusCode,
    error: error.error,
    message: error.message,
    timestamp: new Date().toISOString()
  });

  // Map Razorpay errors to user-friendly messages
  const errorMappings = {
    'BAD_REQUEST_ERROR': 'Invalid request parameters',
    'GATEWAY_ERROR': 'Payment gateway temporarily unavailable',
    'SERVER_ERROR': 'Payment service temporarily unavailable',
    'RATE_LIMIT_ERROR': 'Too many requests, please try again later'
  };

  const userMessage = errorMappings[error.error?.code] || 'Payment processing failed';
  
  return {
    statusCode: error.statusCode || 500,
    userMessage,
    internalError: error.error?.description || error.message,
    code: error.error?.code || 'UNKNOWN_ERROR'
  };
}

// Usage example
try {
  const order = await razorpay.orders.create(orderData);
} catch (error) {
  const { statusCode, userMessage, internalError, code } = handleRazorpayError(error, 'order_creation');
  
  return res.status(statusCode).json({
    error: userMessage,
    code,
    details: internalError
  });
}
```

### Retry Logic Implementation
```javascript
// utils/retry-helper.js
export async function withRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error;
      
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Usage example
const order = await withRetry(
  () => razorpay.orders.create(orderData),
  3,  // 3 attempts
  1000 // 1 second initial delay
);
```

## Configuration Management

### Environment-Specific Configuration
```javascript
// config/razorpay.js
export function getRazorpayConfig() {
  const environment = process.env.RAZORPAY_ENVIRONMENT || 'test';
  
  const config = {
    key_id: environment === 'live' 
      ? process.env.RAZORPAY_KEY_ID 
      : process.env.RAZORPAY_TEST_KEY_ID,
    key_secret: environment === 'live' 
      ? process.env.RAZORPAY_KEY_SECRET 
      : process.env.RAZORPAY_TEST_KEY_SECRET,
    webhook_secret: environment === 'live'
      ? process.env.RAZORPAY_WEBHOOK_SECRET
      : process.env.RAZORPAY_TEST_WEBHOOK_SECRET
  };

  // Validate configuration
  const missing = Object.entries(config)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Razorpay configuration: ${missing.join(', ')}`);
  }

  return { ...config, environment };
}

// Usage
const razorpayConfig = getRazorpayConfig();
const razorpay = new Razorpay(razorpayConfig);
```

## Testing Helpers

### Razorpay Test Data Generator
```javascript
// utils/test-data.js
export function generateTestOrderData(overrides = {}) {
  const timestamp = Date.now();
  
  return {
    amount: 1499,
    currency: 'INR',
    customer_email: `test${timestamp}@example.com`,
    customer_name: 'Test User',
    customer_phone: '+919876543210',
    products: ['course'],
    ...overrides
  };
}

export function generateTestWebhookPayload(orderData) {
  const timestamp = Math.floor(Date.now() / 1000);
  
  return {
    entity: 'event',
    account_id: 'acc_test',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: `pay_test_${timestamp}`,
          amount: orderData.amount * 100,
          currency: orderData.currency,
          status: 'captured',
          order_id: `order_test_${timestamp}`,
          method: 'upi',
          email: orderData.customer_email,
          contact: orderData.customer_phone,
          created_at: timestamp
        }
      }
    },
    created_at: timestamp
  };
}
```

## Next Steps

1. **Implement Order Creation**: Use the create-razorpay-order.js pattern
2. **Add Payment Verification**: Implement verify-razorpay-payment.js 
3. **Set Up Webhook Handler**: Follow Guide 3 for webhook implementation
4. **Test Integration**: Use the test data generators for validation
5. **Configure Error Handling**: Implement comprehensive error management

## Critical Implementation Notes

1. **Always validate inputs** before calling Razorpay APIs
2. **Use timing-safe comparison** for signature verification
3. **Handle phone number formatting** consistently
4. **Implement proper error mapping** for user-friendly messages
5. **Use retry logic** for network-related failures
6. **Store comprehensive order notes** for webhook processing
7. **Log all operations** for debugging production issues

This guide provides production-ready Razorpay integration patterns based on successful Cashfree implementation experience.
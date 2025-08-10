# System Architecture Guide - Razorpay Integration

**Target**: Claude Code sessions building Razorpay → Kajabi → Vercel → Meta CAPI systems  
**Guide 1 of 8**: System Architecture Overview

## Core System Flow

```
Lead Capture Modal → Razorpay Payment → Webhook Processing → Product Delivery → Meta CAPI Tracking
```

## Component Architecture

### Frontend Layer (Static HTML/JS)
```
Frontend Components
├── Lead Capture Modal (components/lead-capture-modal.html)
├── Payment Integration (js/razorpay-integration.js)  
├── Success Page (success.html)
└── Tracking Scripts (js/tracking.js)
```

### API Layer (Vercel Serverless Functions)
```
Vercel API Endpoints
├── /api/create-razorpay-order.js     (Order creation - 30s timeout)
├── /api/verify-razorpay-payment.js   (Payment verification - 10s timeout)
├── /api/razorpay-webhook.js          (Webhook handler - 10s timeout)
├── /api/capture-lead-async.js        (Lead capture with async processing)
├── /api/meta-capi-server.js          (Server-side Meta tracking)
├── /api/zapier-delivery.js           (Product delivery trigger)
└── /api/health-check.js              (System monitoring)
```

### External Integrations
```
Third-Party Services
├── Razorpay Payment Gateway (Orders, Payments, Webhooks)
├── Kajabi (Course delivery via API)
├── Zapier (Automation workflows)
├── Meta CAPI (Server-side tracking)
├── Cal.com (Strategy call booking)
└── Supabase (Database logging)
```

## Data Flow Architecture

### 1. Lead Capture Flow
```
User Action → Modal Open → Form Submit → /api/capture-lead-async → Success Response
                                      ↓ (async)
                            Zapier Lead Webhook + Meta Lead Event
```

### 2. Payment Flow  
```
Lead Data → /api/create-razorpay-order → Razorpay Checkout → Payment Success
                                                                    ↓
Success Page ← /api/verify-razorpay-payment ← Razorpay Signature Verification
```

### 3. Webhook Processing Flow
```
Razorpay Webhook → Signature Verification → Quick Response (200ms)
                                                      ↓ (async)
                                          Product Detection → Parallel Processing:
                                          ├── Zapier Delivery
                                          ├── Meta CAPI Event  
                                          └── Database Logging
```

## Environment Configuration Pattern

### Production Environment Structure
```javascript
// Environment configuration template
const config = {
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,              // rzp_live_xxxxx
    keySecret: process.env.RAZORPAY_KEY_SECRET,       // Live secret key
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET, // Webhook secret
    environment: process.env.RAZORPAY_ENVIRONMENT     // 'live' or 'test'
  },
  meta: {
    pixelId: process.env.META_PIXEL_ID,               // Your pixel ID
    accessToken: process.env.META_ACCESS_TOKEN,       // Long-lived token
    testEventCode: process.env.META_TEST_EVENT_CODE   // Remove in production
  },
  zapier: {
    webhookUrl: process.env.ZAPIER_WEBHOOK_URL,       // Zapier catch hook
    leadWebhookUrl: process.env.ZAPIER_LEAD_WEBHOOK_URL
  },
  database: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY
  }
};
```

### Environment Validation
```javascript
// utils/config-validator.js
export function validateConfig() {
  const required = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET', 
    'RAZORPAY_WEBHOOK_SECRET',
    'META_PIXEL_ID',
    'META_ACCESS_TOKEN',
    'ZAPIER_WEBHOOK_URL'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ All required environment variables configured');
}
```

## Product Detection Strategy

### Amount-Based Product Detection
```javascript
// Core product detection logic (customize for your pricing)
function detectProductsFromAmount(amount) {
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
  } else if (amount >= 6498) {
    // Course + Strategy Call
    products.push('course', 'strategy_call');
    flags = { send_course_access: true, send_database: false, send_calendar_link: true };
  } else if (amount >= 3998) {
    // Course + Database  
    products.push('course', 'database');
    flags = { send_course_access: true, send_database: true, send_calendar_link: false };
  } else if (amount >= 1499) {
    // Course only
    products.push('course');
    flags = { send_course_access: true, send_database: false, send_calendar_link: false };
  }

  return { products, flags, amount, detection_method: 'amount_based' };
}
```

## Security Architecture

### API Security Layers
```javascript
// 1. Webhook Signature Verification (CRITICAL)
function verifyWebhookSignature(rawBody, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// 2. Rate Limiting
const rateLimitStore = new Map();
function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
  // Implementation in webhook guide
}

// 3. Input Validation
function validatePaymentData(data) {
  const { amount, customer_email, customer_name } = data;
  
  if (!amount || amount < 1) throw new Error('Invalid amount');
  if (!customer_email || !isValidEmail(customer_email)) throw new Error('Invalid email');
  if (!customer_name || customer_name.length < 2) throw new Error('Invalid name');
  
  return true;
}
```

## Performance Architecture

### Response Time Targets
- **Lead Capture API**: < 2 seconds (with async processing)
- **Order Creation API**: < 5 seconds  
- **Payment Verification**: < 3 seconds
- **Webhook Response**: < 200ms (CRITICAL)
- **Health Check**: < 1 second

### Async Processing Pattern
```javascript
// CRITICAL: Never block webhook responses
export default async function webhookHandler(req, res) {
  // 1. Quick validation & signature verification
  // 2. Immediate response (within 200ms)
  res.status(200).json({ success: true });
  
  // 3. Async processing after response
  setImmediate(async () => {
    await Promise.allSettled([
      sendToZapier(data),
      sendToMetaCAPI(data),
      updateDatabase(data)
    ]);
  });
}
```

## Database Schema Overview

### Core Tables Structure
```sql
-- Webhook events logging
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  customer_email VARCHAR(255),
  products JSONB,
  webhook_signature VARCHAR(255),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_time_ms INTEGER,
  status VARCHAR(50) DEFAULT 'processed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead captures
CREATE TABLE lead_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  source VARCHAR(100) DEFAULT 'website',
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  zapier_sent BOOLEAN DEFAULT FALSE,
  meta_event_sent BOOLEAN DEFAULT FALSE
);

-- Payment verifications
CREATE TABLE payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(255) NOT NULL,
  payment_id VARCHAR(255) NOT NULL,
  razorpay_signature VARCHAR(255),
  verification_status VARCHAR(50),
  amount DECIMAL(10,2),
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Error Handling Architecture

### Centralized Error Handler
```javascript
// utils/error-handler.js
export class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'APIError';
  }
}

export function handleAPIError(error, res) {
  // Log error details
  console.error('API Error:', {
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Send appropriate response
  res.status(error.statusCode || 500).json({
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
}
```

## Next Steps

After understanding this architecture:
1. **Read Guide 2**: Razorpay Integration Patterns
2. **Read Guide 3**: Webhook System Implementation  
3. **Read Guide 4**: Frontend Integration Patterns
4. **Read Guide 5**: Meta CAPI & Tracking Integration
5. **Read Guide 6**: Critical Pitfalls & Avoidance
6. **Read Guide 7**: Testing & Validation Protocols
7. **Read Guide 8**: Production Deployment Checklist

## Key Architecture Decisions

1. **Vercel Serverless**: Chosen for auto-scaling and zero maintenance
2. **Async Webhook Processing**: Critical for performance and reliability
3. **Amount-Based Product Detection**: Most reliable method vs order notes
4. **Raw Body Signature Verification**: Required for security
5. **Parallel External API Calls**: Maximizes performance
6. **Consistent Event IDs**: Prevents Meta Pixel duplication
7. **Comprehensive Error Logging**: Essential for debugging production issues

This architecture has been battle-tested with Cashfree integration and optimized for production reliability.
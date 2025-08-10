// Test Helper Functions
// Utilities for generating test data and common test operations

const crypto = require('crypto');

/**
 * Generate test customer data
 * @returns {Object} Customer data with unique timestamp-based values
 */
function generateTestCustomer() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `test${timestamp}@example.com`,
    phone: `9876${String(timestamp).slice(-6)}` // 10-digit Indian phone number
  };
}

/**
 * Generate test order data
 * @param {Object} overrides - Properties to override
 * @returns {Object} Order data
 */
function generateTestOrder(overrides = {}) {
  return {
    amount: 1999,
    currency: 'INR',
    products: ['course'],
    ...generateTestCustomer(),
    ...overrides
  };
}

/**
 * Generate test webhook payload
 * @param {string} orderId - Order ID (optional)
 * @param {string} paymentId - Payment ID (optional)
 * @returns {Object} Webhook payload matching Razorpay format
 */
function generateTestWebhook(orderId, paymentId) {
  const timestamp = Math.floor(Date.now() / 1000);
  
  return {
    entity: 'event',
    account_id: 'acc_test',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: paymentId || `pay_test_${timestamp}`,
          amount: 199900, // in paise (₹1999)
          currency: 'INR',
          status: 'captured',
          order_id: orderId || `order_test_${timestamp}`,
          method: 'upi',
          email: 'test@example.com',
          contact: '+919876543210',
          created_at: timestamp,
          notes: {
            products: JSON.stringify(['course']),
            customer_name: 'Test User',
            customer_email: 'test@example.com',
            customer_phone: '+919876543210'
          }
        }
      }
    },
    created_at: timestamp
  };
}

/**
 * Generate webhook signature for testing
 * @param {Object} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {string} HMAC signature
 */
function generateWebhookSignature(payload, secret) {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret || 'test_webhook_secret')
    .update(payloadString)
    .digest('hex');
}

/**
 * Generate test lead data
 * @param {Object} overrides - Properties to override
 * @returns {Object} Lead data
 */
function generateTestLead(overrides = {}) {
  const customer = generateTestCustomer();
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    source: 'test_form',
    utm_source: 'test',
    utm_medium: 'test',
    utm_campaign: 'test_campaign',
    ...overrides
  };
}

/**
 * Generate Meta CAPI event data
 * @param {string} eventName - Event name (Purchase, InitiateCheckout, etc.)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Meta CAPI event data
 */
function generateMetaEvent(eventName = 'Purchase', overrides = {}) {
  const customer = generateTestCustomer();
  const timestamp = Math.floor(Date.now() / 1000);
  
  return {
    event_name: eventName,
    event_time: timestamp,
    event_id: `${eventName.toLowerCase()}_${Date.now()}`,
    user_data: {
      em: hashData(customer.email),
      ph: hashData(customer.phone),
      fn: hashData(customer.name.split(' ')[0]),
      ln: hashData(customer.name.split(' ')[1] || ''),
      country: 'in',
      ct: hashData('mumbai')
    },
    custom_data: {
      currency: 'INR',
      value: 1999,
      content_type: 'product',
      content_ids: ['complete-indian-investor']
    },
    action_source: 'website',
    ...overrides
  };
}

/**
 * Hash data for Meta CAPI (SHA256)
 * @param {string} data - Data to hash
 * @returns {string} SHA256 hash
 */
function hashData(data) {
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}

/**
 * Wait for specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after timeout
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random string
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Indian phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether phone is valid
 */
function isValidIndianPhone(phone) {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's 10 digits starting with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * Clean phone number to digits only
 * @param {string} phone - Phone number
 * @returns {string} Digits only
 */
function cleanPhoneNumber(phone) {
  return phone.replace(/\D/g, '');
}

/**
 * Generate test environment variables
 * @returns {Object} Test environment variables
 */
function generateTestEnv() {
  return {
    RAZORPAY_KEY_ID: 'rzp_test_' + randomString(14),
    RAZORPAY_KEY_SECRET: randomString(24),
    RAZORPAY_WEBHOOK_SECRET: randomString(32),
    META_PIXEL_ID: '1234567890123456',
    META_ACCESS_TOKEN: 'EAA' + randomString(200),
    META_TEST_EVENT_CODE: 'TEST' + randomString(6),
    ZAPIER_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/test/' + randomString(10),
    ZAPIER_LEAD_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/test/' + randomString(10),
    NODE_ENV: 'test'
  };
}

/**
 * Mock fetch response
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {boolean} ok - Whether response is ok
 * @returns {Object} Mock fetch response
 */
function mockFetchResponse(data, status = 200, ok = true) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
    headers: new Map([
      ['content-type', 'application/json']
    ])
  };
}

/**
 * Create mock HTTP request/response objects
 * @param {Object} reqData - Request data
 * @returns {Object} Mock req/res objects
 */
function createMockReqRes(reqData = {}) {
  const req = {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    ...reqData
  };
  
  const res = {
    statusCode: 200,
    _headers: {},
    _data: null,
    
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    
    json: function(data) {
      this._data = data;
      this._headers['content-type'] = 'application/json';
      return this;
    },
    
    setHeader: function(key, value) {
      this._headers[key.toLowerCase()] = value;
      return this;
    },
    
    end: function(data) {
      this._data = data;
      return this;
    }
  };
  
  return { req, res };
}

/**
 * Performance timing helper
 */
class PerformanceTimer {
  constructor() {
    this.startTime = null;
    this.endTime = null;
  }
  
  start() {
    this.startTime = process.hrtime.bigint();
    return this;
  }
  
  end() {
    this.endTime = process.hrtime.bigint();
    return this;
  }
  
  getDuration() {
    if (!this.startTime || !this.endTime) {
      throw new Error('Timer not properly started/ended');
    }
    return Number(this.endTime - this.startTime) / 1000000; // Convert to milliseconds
  }
}

/**
 * Async timeout helper
 * @param {Promise} promise - Promise to timeout
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise with timeout
 */
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  
  return Promise.race([promise, timeout]);
}

module.exports = {
  generateTestCustomer,
  generateTestOrder,
  generateTestWebhook,
  generateWebhookSignature,
  generateTestLead,
  generateMetaEvent,
  hashData,
  delay,
  randomString,
  isValidEmail,
  isValidIndianPhone,
  cleanPhoneNumber,
  generateTestEnv,
  mockFetchResponse,
  createMockReqRes,
  PerformanceTimer,
  withTimeout
};
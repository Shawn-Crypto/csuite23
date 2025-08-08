// Razorpay configuration and initialization
const Razorpay = require('razorpay');

// Initialize Razorpay instance
const initializeRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay API keys are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// Common response headers for CORS and security (matching vercel.json pattern)
const getSecurityHeaders = () => {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
};

// Error response helper
const createErrorResponse = (status, message, details = null) => {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders(),
    },
    body: JSON.stringify({
      error: true,
      message,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    }),
  };
};

// Success response helper
const createSuccessResponse = (data, status = 200) => {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders(),
    },
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
  };
};

// Generate consistent order ID with 'order_' prefix
const generateOrderId = () => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `order_${timestamp}_${randomSuffix}`;
};

module.exports = {
  initializeRazorpay,
  getSecurityHeaders,
  createErrorResponse,
  createSuccessResponse,
  generateOrderId,
};

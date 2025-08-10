const crypto = require('crypto');
const { getLogger } = require('./lib/logger');
const { ErrorHandler } = require('./lib/error-handler');

module.exports = async (req, res) => {
  const logger = getLogger();
  const errorHandler = new ErrorHandler();
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    const { response, statusCode } = errorHandler.createAPIResponse('METHOD_NOT_ALLOWED', { method: req.method });
    return res.status(statusCode).json(response);
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customer_data } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      const { response, statusCode } = errorHandler.createAPIResponse('REQUIRED_FIELD_MISSING', { 
        missing_fields: [
          !razorpay_order_id && 'order_id',
          !razorpay_payment_id && 'payment_id', 
          !razorpay_signature && 'signature'
        ].filter(Boolean)
      });
      return res.status(statusCode).json(response);
    }

    // Verify signature
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'eUqfESP2Az0g76dorqwGmHpt';
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      const { response, statusCode } = errorHandler.createAPIResponse('UNAUTHORIZED_ERROR', {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        reason: 'signature_verification_failed'
      });
      return res.status(statusCode).json(response);
    }

    // Log successful payment verification with deduplication
    const paymentEvent = logger.logPaymentEvent('payment_verified', {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      customer: customer_data
    });

    if (paymentEvent) {
      // Log conversion for analytics
      logger.logConversion(
        { order_id: razorpay_order_id, amount: 1999, currency: 'INR' },
        { payment_id: razorpay_payment_id },
        customer_data
      );
    }

    // Here you would typically:
    // 1. Store the payment details in your database
    // 2. Send confirmation email to customer
    // 3. Trigger any post-payment workflows (Zapier, Kajabi, etc.)
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        verified: true
      }
    });

  } catch (error) {
    const { response, statusCode } = errorHandler.createAPIResponse('SERVER_ERROR', {
      operation: 'payment_verification',
      order_id: req.body?.razorpay_order_id,
      payment_id: req.body?.razorpay_payment_id,
      originalError: error.message
    });
    return res.status(statusCode).json(response);
  }
};
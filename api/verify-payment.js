const crypto = require('crypto');
const { getLogger } = require('./lib/logger');

module.exports = async (req, res) => {
  const logger = getLogger();
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customer_data } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment parameters'
      });
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
      console.error('Invalid payment signature:', {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
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
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      message: error.message
    });
  }
};
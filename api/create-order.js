const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SWb5ypxKYwCUKK',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'eUqfESP2Az0g76dorqwGmHpt'
});

module.exports = async (req, res) => {
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
    const { amount, currency = 'INR', receipt, notes = {} } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const orderData = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: receipt || `order_${Date.now()}`,
      notes: {
        ...notes,
        source: 'lotuslion.in',
        course: 'The Complete Indian Investor'
      }
    };

    const order = await razorpay.orders.create(orderData);

    // Log order creation for tracking
    console.log('Order created:', {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SWb5ypxKYwCUKK'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
};
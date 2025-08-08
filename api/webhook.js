const crypto = require('crypto');

// Event deduplication cache (in production, use Redis or similar)
const processedEvents = new Set();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSignature = req.headers['x-razorpay-signature'];
    
    if (!webhookSignature) {
      console.error('Missing webhook signature');
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        console.error('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const { event, payload } = req.body;
    
    // Implement idempotency - prevent duplicate processing
    const eventId = `${event}_${payload?.payment?.entity?.id || payload?.order?.entity?.id}`;
    if (processedEvents.has(eventId)) {
      console.log('Duplicate event, skipping:', eventId);
      return res.status(200).json({ status: 'duplicate_skipped' });
    }
    processedEvents.add(eventId);

    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity);
        break;
      
      case 'order.paid':
        await handleOrderPaid(payload.order.entity);
        break;
      
      case 'refund.created':
        await handleRefundCreated(payload.refund.entity);
        break;
      
      default:
        console.log('Unhandled webhook event:', event);
    }

    // Log webhook for Vercel analytics
    console.log('Webhook processed:', {
      event,
      payment_id: payload?.payment?.entity?.id,
      order_id: payload?.order?.entity?.id,
      amount: payload?.payment?.entity?.amount || payload?.order?.entity?.amount,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

async function handlePaymentCaptured(payment) {
  console.log('Payment captured:', {
    id: payment.id,
    order_id: payment.order_id,
    amount: payment.amount / 100,
    method: payment.method,
    email: payment.email,
    contact: payment.contact,
    timestamp: new Date().toISOString()
  });

  // TODO: Implement these actions
  // 1. Update order status in database
  // 2. Send confirmation email
  // 3. Trigger Zapier webhook for Kajabi integration
  // 4. Send event to Meta CAPI
  // 5. Log conversion in Google Analytics
}

async function handlePaymentFailed(payment) {
  console.log('Payment failed:', {
    id: payment.id,
    order_id: payment.order_id,
    amount: payment.amount / 100,
    error_code: payment.error_code,
    error_description: payment.error_description,
    timestamp: new Date().toISOString()
  });

  // TODO: Log failed payment for analytics
}

async function handleOrderPaid(order) {
  console.log('Order paid:', {
    id: order.id,
    amount: order.amount / 100,
    amount_paid: order.amount_paid / 100,
    timestamp: new Date().toISOString()
  });

  // TODO: Update order status
}

async function handleRefundCreated(refund) {
  console.log('Refund created:', {
    id: refund.id,
    payment_id: refund.payment_id,
    amount: refund.amount / 100,
    timestamp: new Date().toISOString()
  });

  // TODO: Update order/payment status
  // TODO: Send refund confirmation email
}
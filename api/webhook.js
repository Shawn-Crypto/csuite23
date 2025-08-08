import crypto from 'crypto';
import axios from 'axios';

// In-memory event deduplication store (in production, use Redis or database)
const processedEvents = new Set();

// Meta CAPI integration service
class MetaCAPIService {
  constructor() {
    this.pixelId = process.env.META_PIXEL_ID;
    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.apiUrl = `https://graph.facebook.com/v18.0/${this.pixelId}/events`;
  }

  async sendPurchaseEvent(eventData) {
    if (!this.pixelId || !this.accessToken) {
      console.warn('Meta CAPI credentials not configured, skipping Meta event');
      return { success: false, reason: 'credentials_missing' };
    }

    try {
      const payload = {
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventData.event_id,
          event_source_url: 'https://lotuslion.in',
          action_source: 'website',
          user_data: {
            // PII compliance - hash sensitive data
            em: eventData.customer_email ? this.hashData(eventData.customer_email.toLowerCase()) : null,
            ph: eventData.customer_phone ? this.hashData(eventData.customer_phone.replace(/\D/g, '')) : null,
            fn: eventData.customer_name ? this.hashData(eventData.customer_name.split(' ')[0].toLowerCase()) : null,
            ln: eventData.customer_name ? this.hashData(eventData.customer_name.split(' ').slice(1).join(' ').toLowerCase()) : null,
            client_ip_address: eventData.client_ip_address,
            client_user_agent: eventData.client_user_agent,
            fbp: eventData.fbp,
            fbc: eventData.fbc
          },
          custom_data: {
            currency: 'INR',
            value: eventData.amount / 100, // Convert paise to rupees
            content_type: 'product',
            content_ids: ['lotuslion-course'],
            content_name: 'The Complete Indian Investor Course',
            num_items: 1
          }
        }],
        test_event_code: process.env.NODE_ENV === 'development' ? 'TEST12345' : undefined
      };

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('Meta CAPI event sent successfully:', {
        event_id: eventData.event_id,
        response_status: response.status,
        events_received: response.data.events_received,
        messages: response.data.messages
      });

      return { success: true, response: response.data };
    } catch (error) {
      console.error('Meta CAPI event failed:', {
        event_id: eventData.event_id,
        error: error.message,
        response: error.response?.data
      });
      return { success: false, error: error.message };
    }
  }

  hashData(data) {
    if (!data) return null;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// Zapier integration service
class ZapierService {
  constructor() {
    this.webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  }

  async sendKajabiAccessRequest(customerData) {
    if (!this.webhookUrl) {
      console.warn('Zapier webhook URL not configured, skipping Kajabi access provisioning');
      return { success: false, reason: 'webhook_url_missing' };
    }

    try {
      const payload = {
        event_type: 'course_purchase',
        timestamp: new Date().toISOString(),
        customer: {
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone
        },
        course: {
          name: 'The Complete Indian Investor Course',
          price: customerData.amount / 100,
          currency: 'INR'
        },
        payment: {
          order_id: customerData.order_id,
          payment_id: customerData.payment_id,
          signature: customerData.signature,
          status: 'completed'
        },
        metadata: {
          source: 'lotuslion_website',
          integration_version: '1.0.0'
        }
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LotusLion-Webhook/1.0'
        },
        timeout: 15000
      });

      console.log('Zapier webhook sent successfully:', {
        order_id: customerData.order_id,
        response_status: response.status,
        zapier_response: response.data
      });

      return { success: true, response: response.data };
    } catch (error) {
      console.error('Zapier webhook failed:', {
        order_id: customerData.order_id,
        error: error.message,
        response: error.response?.data
      });
      return { success: false, error: error.message };
    }
  }
}

// Main webhook handler
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Razorpay-Signature');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  console.log(`[${requestId}] Webhook request received:`, {
    timestamp: new Date().toISOString(),
    headers: {
      'x-razorpay-signature': req.headers['x-razorpay-signature'] ? 'present' : 'missing',
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    body_size: JSON.stringify(req.body).length
  });

  try {
    // Validate environment variables
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.error(`[${requestId}] Missing RAZORPAY_WEBHOOK_SECRET`);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.error(`[${requestId}] Missing webhook signature`);
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error(`[${requestId}] Invalid webhook signature`);
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    console.log(`[${requestId}] Webhook signature verified successfully`);

    // Parse webhook event
    const event = req.body;
    const eventType = event.event;
    const eventId = `${event.payload?.payment?.entity?.order_id || 'unknown'}_${Date.now()}`;

    // Event deduplication check
    if (processedEvents.has(eventId)) {
      console.log(`[${requestId}] Duplicate event detected, skipping:`, eventId);
      return res.status(200).json({ 
        success: true, 
        message: 'Event already processed',
        event_id: eventId 
      });
    }

    console.log(`[${requestId}] Processing webhook event:`, {
      event_type: eventType,
      event_id: eventId,
      payload_keys: Object.keys(event.payload || {})
    });

    // Handle payment.captured event (successful payment)
    if (eventType === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const order = event.payload.order?.entity;

      // Extract customer and payment data
      const customerData = {
        order_id: payment.order_id,
        payment_id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        // Extract from order notes if available
        name: order?.notes?.customer_name || null,
        client_ip_address: order?.notes?.client_ip_address || null,
        client_user_agent: order?.notes?.client_user_agent || null,
        fbp: order?.notes?.fbp || null,
        fbc: order?.notes?.fbc || null
      };

      console.log(`[${requestId}] Payment captured:`, {
        order_id: customerData.order_id,
        payment_id: customerData.payment_id,
        amount: customerData.amount,
        currency: customerData.currency,
        method: customerData.method,
        customer_email: customerData.email ? 'present' : 'missing'
      });

      // Initialize services
      const metaService = new MetaCAPIService();
      const zapierService = new ZapierService();

      // Parallel execution of integrations for better performance
      const integrationPromises = [];

      // Send to Meta CAPI
      integrationPromises.push(
        metaService.sendPurchaseEvent({
          event_id: eventId,
          customer_email: customerData.email,
          customer_phone: customerData.contact,
          customer_name: customerData.name,
          amount: customerData.amount,
          client_ip_address: customerData.client_ip_address,
          client_user_agent: customerData.client_user_agent,
          fbp: customerData.fbp,
          fbc: customerData.fbc
        }).catch(error => ({ success: false, service: 'meta', error: error.message }))
      );

      // Send to Zapier for Kajabi access
      integrationPromises.push(
        zapierService.sendKajabiAccessRequest({
          order_id: customerData.order_id,
          payment_id: customerData.payment_id,
          name: customerData.name || 'Customer',
          email: customerData.email,
          phone: customerData.contact,
          amount: customerData.amount
        }).catch(error => ({ success: false, service: 'zapier', error: error.message }))
      );

      // Wait for all integrations to complete
      const integrationResults = await Promise.all(integrationPromises);
      const [metaResult, zapierResult] = integrationResults;

      // Mark event as processed
      processedEvents.add(eventId);

      // Clean up old processed events (keep last 1000)
      if (processedEvents.size > 1000) {
        const eventsArray = Array.from(processedEvents);
        processedEvents.clear();
        eventsArray.slice(-500).forEach(id => processedEvents.add(id));
      }

      const processingTime = Date.now() - startTime;

      console.log(`[${requestId}] Webhook processing completed:`, {
        event_id: eventId,
        processing_time_ms: processingTime,
        meta_success: metaResult.success,
        zapier_success: zapierResult.success,
        integrations_completed: integrationResults.length
      });

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        event_id: eventId,
        processing_time_ms: processingTime,
        integrations: {
          meta_capi: metaResult.success,
          zapier_kajabi: zapierResult.success
        }
      });
    }

    // Handle other event types
    else if (eventType === 'payment.failed') {
      const payment = event.payload.payment.entity;
      
      console.log(`[${requestId}] Payment failed:`, {
        order_id: payment.order_id,
        payment_id: payment.id,
        error_code: payment.error_code,
        error_description: payment.error_description
      });

      // Mark as processed to avoid reprocessing
      processedEvents.add(eventId);

      return res.status(200).json({
        success: true,
        message: 'Payment failure event logged',
        event_id: eventId
      });
    }

    // Handle order.paid event (backup for payment.captured)
    else if (eventType === 'order.paid') {
      console.log(`[${requestId}] Order paid event received (backup trigger):`, {
        order_id: event.payload.order.entity.id
      });

      // Mark as processed but don't duplicate business logic
      processedEvents.add(eventId);

      return res.status(200).json({
        success: true,
        message: 'Order paid event acknowledged',
        event_id: eventId
      });
    }

    // Handle unrecognized events
    else {
      console.log(`[${requestId}] Unhandled event type:`, eventType);
      
      return res.status(200).json({
        success: true,
        message: 'Event acknowledged but not processed',
        event_type: eventType,
        event_id: eventId
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`[${requestId}] Webhook processing error:`, {
      error: error.message,
      stack: error.stack,
      processing_time_ms: processingTime
    });

    // Return error response
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
      request_id: requestId,
      processing_time_ms: processingTime
    });
  }
}

// Zapier Webhook Integration - Triggers Kajabi course delivery
// Based on Guide patterns for external API integration with retry logic

const { detectFromAmount, getDeliveryFlags, validateDetection } = require('./product-detector');
const { retryStandard } = require('./retry-handler');

/**
 * Send payment data to Zapier webhook for Kajabi integration
 * @param {Object} orderData - Order/payment data from Razorpay
 * @param {Object} customerData - Customer information
 * @returns {Promise<Object>} Zapier response result
 */
async function sendToZapier(orderData, customerData) {
  const zapierWebhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  if (!zapierWebhookUrl) {
    console.log('📝 Zapier webhook URL not configured, skipping...');
    return { success: false, reason: 'no_webhook_url' };
  }

  try {
    // Detect products based on payment amount
    const productDetection = detectFromAmount(orderData.amount);
    
    if (!validateDetection(productDetection)) {
      throw new Error('Invalid product detection result');
    }

    // Format payload for Zapier consumption
    const zapierPayload = formatZapierPayload(orderData, customerData, productDetection);
    
    console.log(`🔗 Sending to Zapier: ${productDetection.products.join(', ')} for ${customerData.email}`);

    // Send HTTP POST request to Zapier webhook with retry logic
    const response = await retryStandard(
      async () => {
        const fetchResponse = await fetch(zapierWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LotusLion-Razorpay-Integration/1.0'
          },
          body: JSON.stringify(zapierPayload)
        });
        
        if (!fetchResponse.ok) {
          const error = new Error(`Zapier webhook failed: ${fetchResponse.status} ${fetchResponse.statusText}`);
          error.response = fetchResponse;
          throw error;
        }
        
        return fetchResponse;
      },
      {
        operation: 'Zapier Webhook',
        orderId: orderData.id,
        customerEmail: customerData.email,
        startTime: Date.now()
      }
    );

    // Response is already validated in retry logic

    const result = await response.json().catch(() => ({ success: true }));
    
    console.log(`✅ Zapier webhook successful for order ${orderData.id}`);
    
    return {
      success: true,
      zapier_response: result,
      products_delivered: productDetection.products,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Zapier webhook failed for order ${orderData.id}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      order_id: orderData.id,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Format data for Zapier webhook consumption
 * @param {Object} orderData - Razorpay order/payment data
 * @param {Object} customerData - Customer information
 * @param {Object} productDetection - Product detection result
 * @returns {Object} Formatted Zapier payload
 */
function formatZapierPayload(orderData, customerData, productDetection) {
  const deliveryConfig = getDeliveryFlags(productDetection.products);
  
  return {
    // Transaction details
    transaction: {
      order_id: orderData.order_id || orderData.id,
      payment_id: orderData.id,
      amount: productDetection.amount,
      amount_paise: productDetection.amount_paise,
      currency: 'INR',
      status: 'captured',
      payment_method: orderData.method || 'unknown',
      created_at: orderData.created_at || new Date().toISOString()
    },

    // Customer information
    customer: {
      name: customerData.name || customerData.customer_name,
      email: customerData.email || customerData.customer_email,
      phone: customerData.phone || customerData.contact,
      country: 'India'
    },

    // Product and delivery configuration
    products: {
      purchased: productDetection.products,
      detection_method: productDetection.detection_method,
      course_access: deliveryConfig.kajabi.grant_course_access,
      send_database: deliveryConfig.additional.send_database,
      send_calendar: deliveryConfig.additional.send_calendar_link,
      course_name: 'The Complete Indian Investor'
    },

    // Kajabi-specific settings
    kajabi: {
      grant_access: deliveryConfig.kajabi.grant_course_access,
      course_id: deliveryConfig.kajabi.add_to_course,
      send_welcome_email: deliveryConfig.kajabi.send_welcome_email,
      student_email: customerData.email || customerData.customer_email
    },

    // Metadata for tracking
    metadata: {
      source: 'razorpay_webhook',
      integration_version: '1.0',
      processed_at: new Date().toISOString(),
      webhook_id: `zapier_${orderData.id}_${Date.now()}`
    }
  };
}

/**
 * Send lead capture data to Zapier (separate webhook)
 * @param {Object} leadData - Lead information
 * @returns {Promise<Object>} Zapier response result
 */
async function sendLeadToZapier(leadData) {
  const zapierLeadWebhookUrl = process.env.ZAPIER_LEAD_WEBHOOK_URL;
  
  if (!zapierLeadWebhookUrl) {
    console.log('📝 Zapier lead webhook URL not configured, skipping...');
    return { success: false, reason: 'no_lead_webhook_url' };
  }

  try {
    const leadPayload = {
      lead: {
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        source: 'website_form',
        captured_at: new Date().toISOString()
      },
      metadata: {
        source: 'lead_capture',
        integration_version: '1.0',
        lead_id: `lead_${Date.now()}`
      }
    };

    const response = await fetch(zapierLeadWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LotusLion-Lead-Capture/1.0'
      },
      body: JSON.stringify(leadPayload),
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Zapier lead webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`✅ Lead sent to Zapier: ${leadData.email}`);
    return { success: true, timestamp: new Date().toISOString() };

  } catch (error) {
    console.error(`❌ Zapier lead webhook failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test Zapier webhook connectivity
 * @returns {Promise<Object>} Test result
 */
async function testZapierConnection() {
  const zapierWebhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  if (!zapierWebhookUrl) {
    return { success: false, reason: 'webhook_url_not_configured' };
  }

  try {
    const testPayload = {
      test: true,
      message: 'Zapier webhook connectivity test',
      timestamp: new Date().toISOString()
    };

    const response = await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      timeout: 5000
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  sendToZapier,
  sendLeadToZapier,
  formatZapierPayload,
  testZapierConnection
};
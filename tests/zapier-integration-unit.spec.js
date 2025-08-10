const { sendToZapier, formatZapierPayload, sendLeadToZapier, testZapierConnection } = require('../api/lib/zapier-webhook');
const { detectFromAmount, getDeliveryFlags, validateDetection } = require('../api/lib/product-detector');

// Mock fetch for testing
global.fetch = jest.fn();

describe('Zapier Integration Tests', () => {
  const mockOrderData = {
    id: 'pay_test_123456789',
    order_id: 'order_test_987654321',
    amount: 199900, // ₹1999 in paise
    method: 'upi',
    created_at: '2025-01-15T10:30:00Z'
  };

  const mockCustomerData = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210',
    customer_name: 'John Doe',
    customer_email: 'john@example.com'
  };

  beforeEach(() => {
    fetch.mockClear();
    process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/test/webhook';
    process.env.ZAPIER_LEAD_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/test/lead';
  });

  afterEach(() => {
    delete process.env.ZAPIER_WEBHOOK_URL;
    delete process.env.ZAPIER_LEAD_WEBHOOK_URL;
  });

  describe('Product Detection', () => {
    test('detects course product for ₹1999 payment', () => {
      const detection = detectFromAmount(199900);
      
      expect(detection.products).toEqual(['course']);
      expect(detection.flags.send_course_access).toBe(true);
      expect(detection.flags.send_database).toBe(false);
      expect(detection.flags.send_calendar_link).toBe(false);
      expect(detection.amount).toBe(1999);
    });

    test('detects course plus database for ₹3998 payment', () => {
      const detection = detectFromAmount(399800);
      
      expect(detection.products).toEqual(['course', 'database']);
      expect(detection.flags.send_course_access).toBe(true);
      expect(detection.flags.send_database).toBe(true);
      expect(detection.flags.send_calendar_link).toBe(false);
    });

    test('detects full bundle for ₹8997 payment', () => {
      const detection = detectFromAmount(899700);
      
      expect(detection.products).toEqual(['course', 'database', 'strategy_call']);
      expect(detection.flags.send_course_access).toBe(true);
      expect(detection.flags.send_database).toBe(true);
      expect(detection.flags.send_calendar_link).toBe(true);
    });

    test('validates detection result structure', () => {
      const detection = detectFromAmount(199900);
      
      expect(validateDetection(detection)).toBe(true);
      expect(detection.detection_method).toBe('amount_based');
      expect(detection.detected_at).toBeDefined();
    });
  });

  describe('Zapier Payload Formatting', () => {
    test('formats zapier payload correctly for course purchase', () => {
      const productDetection = detectFromAmount(199900);
      const payload = formatZapierPayload(mockOrderData, mockCustomerData, productDetection);

      expect(payload.transaction.order_id).toBe('order_test_987654321');
      expect(payload.transaction.payment_id).toBe('pay_test_123456789');
      expect(payload.transaction.amount).toBe(1999);
      expect(payload.customer.name).toBe('John Doe');
      expect(payload.customer.email).toBe('john@example.com');
      expect(payload.products.purchased).toEqual(['course']);
      expect(payload.kajabi.grant_access).toBe(true);
      expect(payload.kajabi.course_id).toBe('complete-indian-investor');
    });

    test('includes proper metadata in payload', () => {
      const productDetection = detectFromAmount(199900);
      const payload = formatZapierPayload(mockOrderData, mockCustomerData, productDetection);

      expect(payload.metadata.source).toBe('razorpay_webhook');
      expect(payload.metadata.integration_version).toBe('1.0');
      expect(payload.metadata.processed_at).toBeDefined();
      expect(payload.metadata.webhook_id).toMatch(/^zapier_pay_test_123456789_/);
    });
  });

  describe('Zapier Webhook Sending', () => {
    test('sends successful webhook to zapier', async () => {
      // Mock successful fetch response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, id: 'zapier_123' })
      });

      const result = await sendToZapier(mockOrderData, mockCustomerData);

      expect(fetch).toHaveBeenCalledWith(
        'https://hooks.zapier.com/hooks/catch/test/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LotusLion-Razorpay-Integration/1.0'
          }
        })
      );

      expect(result.success).toBe(true);
      expect(result.products_delivered).toEqual(['course']);
    });

    test('handles zapier webhook failure gracefully', async () => {
      // Mock failed fetch response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      const result = await sendToZapier(mockOrderData, mockCustomerData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Zapier webhook failed: 400');
      expect(result.order_id).toBe('pay_test_123456789');
    });

    test('handles network error during webhook send', async () => {
      // Mock network error
      fetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await sendToZapier(mockOrderData, mockCustomerData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    test('skips zapier if webhook url not configured', async () => {
      delete process.env.ZAPIER_WEBHOOK_URL;

      const result = await sendToZapier(mockOrderData, mockCustomerData);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_webhook_url');
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Lead Capture Integration', () => {
    test('sends lead data to zapier successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const leadData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '9123456789'
      };

      const result = await sendLeadToZapier(leadData);

      expect(fetch).toHaveBeenCalledWith(
        'https://hooks.zapier.com/hooks/catch/test/lead',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LotusLion-Lead-Capture/1.0'
          }
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Connection Testing', () => {
    test('tests zapier connection successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await testZapierConnection();

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
    });

    test('handles connection test failure', async () => {
      fetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await testZapierConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });
});
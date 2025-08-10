const { MetaCAPI, getMetaCAPI } = require('../api/lib/meta-capi');

// Mock fetch for testing
global.fetch = jest.fn();

describe('Meta CAPI Integration Tests', () => {
  const mockPixelId = '1234567890123456';
  const mockAccessToken = 'test_access_token_12345';
  const mockTestEventCode = 'TEST12345';

  const mockOrderData = {
    order_id: 'purchase_order_test_123',
    amount: 1999,
    currency: 'INR',
    payment_id: 'pay_test_456'
  };

  const mockCustomerData = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210'
  };

  let metaCAPI;

  beforeEach(() => {
    fetch.mockClear();
    process.env.META_PIXEL_ID = mockPixelId;
    process.env.META_ACCESS_TOKEN = mockAccessToken;
    process.env.META_TEST_EVENT_CODE = mockTestEventCode;
    
    metaCAPI = new MetaCAPI();
  });

  afterEach(() => {
    delete process.env.META_PIXEL_ID;
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_TEST_EVENT_CODE;
  });

  describe('Hash User Data', () => {
    test('hashes email correctly', () => {
      const userData = { email: 'test@example.com' };
      const hashed = metaCAPI.hashUserData(userData);
      
      expect(hashed.em).toBeDefined();
      expect(hashed.em).not.toBe(userData.email);
      expect(hashed.em.length).toBe(64); // SHA256 hex string
    });

    test('formats Indian phone number correctly', () => {
      const userData = { phone: '9876543210' };
      const hashed = metaCAPI.hashUserData(userData);
      
      expect(hashed.ph).toBeDefined();
      // Should add 91 prefix for Indian numbers
      expect(hashed.ph.length).toBe(64);
    });

    test('handles phone number with 91 prefix', () => {
      const userData = { phone: '919876543210' };
      const hashed = metaCAPI.hashUserData(userData);
      
      expect(hashed.ph).toBeDefined();
      expect(hashed.ph.length).toBe(64);
    });

    test('splits name into first and last name', () => {
      const userData = { name: 'John Doe Smith' };
      const hashed = metaCAPI.hashUserData({ 
        firstName: userData.name.split(' ')[0],
        lastName: userData.name.split(' ').slice(1).join(' ')
      });
      
      expect(hashed.fn).toBeDefined();
      expect(hashed.ln).toBeDefined();
    });
  });

  describe('Purchase Event', () => {
    test('sends purchase event with correct payload structure', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          events_received: 1,
          messages: [],
          fbtrace_id: 'test_trace_123'
        })
      });

      const result = await metaCAPI.sendPurchaseEvent(mockOrderData, mockCustomerData);

      expect(fetch).toHaveBeenCalledWith(
        `https://graph.facebook.com/v18.0/${mockPixelId}/events`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LotusLion-Meta-CAPI/1.0'
          }
        })
      );

      // Check payload structure
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].event_name).toBe('Purchase');
      expect(payload.data[0].event_id).toBe(mockOrderData.order_id);
      expect(payload.data[0].custom_data.value).toBe(mockOrderData.amount);
      expect(payload.data[0].custom_data.currency).toBe('INR');
      expect(payload.access_token).toBe(mockAccessToken);
      expect(payload.test_event_code).toBe(mockTestEventCode);

      expect(result.success).toBe(true);
      expect(result.event_id).toBe(mockOrderData.order_id);
    });

    test('handles Meta API error response', async () => {
      // Mock error response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          error: {
            message: 'Invalid access token',
            type: 'OAuthException',
            code: 190
          }
        })
      });

      const result = await metaCAPI.sendPurchaseEvent(mockOrderData, mockCustomerData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid access token');
    });

    test('handles HTTP error responses', async () => {
      // Mock HTTP error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      const result = await metaCAPI.sendPurchaseEvent(mockOrderData, mockCustomerData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Meta CAPI request failed: 400');
    });

    test('handles network errors', async () => {
      // Mock network error
      fetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await metaCAPI.sendPurchaseEvent(mockOrderData, mockCustomerData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });
  });

  describe('Retry Logic', () => {
    test('retries failed requests up to max attempts', async () => {
      // Mock failures then success
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ events_received: 1 })
        });

      const result = await metaCAPI.sendPurchaseEventAsync(mockOrderData, mockCustomerData);

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    test('returns failure after max attempts exhausted', async () => {
      // Mock all failures
      fetch
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'));

      const result = await metaCAPI.withRetry(() => 
        metaCAPI.sendPurchaseEvent(mockOrderData, mockCustomerData), 3
      );

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
    });
  });

  describe('Event ID Consistency', () => {
    test('uses order_id as event_id for deduplication', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      });

      await metaCAPI.sendPurchaseEvent(mockOrderData, mockCustomerData);

      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.data[0].event_id).toBe(mockOrderData.order_id);
    });
  });

  describe('Configuration Validation', () => {
    test('skips sending if no pixel ID configured', async () => {
      delete process.env.META_PIXEL_ID;
      const metaCAPINoPixel = new MetaCAPI();
      
      const result = await metaCAPINoPixel.sendPurchaseEvent(mockOrderData, mockCustomerData);
      
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    test('skips sending if no access token configured', async () => {
      delete process.env.META_ACCESS_TOKEN;
      const metaCAPINoToken = new MetaCAPI();
      
      const result = await metaCAPINoToken.sendPurchaseEvent(mockOrderData, mockCustomerData);
      
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Singleton Pattern', () => {
    test('getMetaCAPI returns same instance', () => {
      const instance1 = getMetaCAPI();
      const instance2 = getMetaCAPI();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Other Events', () => {
    test('sends checkout initiation event', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      });

      const result = await metaCAPI.sendInitiateCheckoutEvent(mockCustomerData);

      expect(fetch).toHaveBeenCalled();
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.data[0].event_name).toBe('InitiateCheckout');
      expect(payload.data[0].custom_data.value).toBe(1999); // Default course price
    });

    test('sends page view event', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      });

      const result = await metaCAPI.sendPageViewEvent({ sourceUrl: 'https://lotuslion.in' });

      expect(fetch).toHaveBeenCalled();
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.data[0].event_name).toBe('PageView');
      expect(payload.data[0].event_source_url).toBe('https://lotuslion.in');
    });
  });
});
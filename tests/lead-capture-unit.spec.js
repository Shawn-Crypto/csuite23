const { createMocks } = require('node-mocks-http');
const leadCaptureHandler = require('../api/capture-lead.js');

// Mock dependencies
jest.mock('../api/lib/zapier-webhook', () => ({
  sendLeadToZapier: jest.fn()
}));

jest.mock('../api/lib/meta-capi', () => ({
  getMetaCAPI: jest.fn(() => ({
    sendInitiateCheckoutEvent: jest.fn()
  }))
}));

const { sendLeadToZapier } = require('../api/lib/zapier-webhook');
const { getMetaCAPI } = require('../api/lib/meta-capi');

describe('Lead Capture API Tests', () => {
  const validLeadData = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendLeadToZapier.mockResolvedValue({ success: true });
    getMetaCAPI().sendInitiateCheckoutEvent.mockResolvedValue({ success: true });
  });

  describe('Request Processing', () => {
    test('responds under 2 seconds with valid data', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: validLeadData
      });

      const startTime = Date.now();
      await leadCaptureHandler(req, res);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.processing_time_ms).toBeLessThan(2000);
    });

    test('handles OPTIONS request for CORS', async () => {
      const { req, res } = createMocks({
        method: 'OPTIONS'
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getHeaders()['access-control-allow-origin']).toBe('*');
    });

    test('returns 405 for non-POST methods', async () => {
      const { req, res } = createMocks({
        method: 'GET'
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const responseData = JSON.parse(res._getData());
      expect(responseData.error).toBe('Method not allowed');
    });
  });

  describe('Data Validation', () => {
    test('validates required name field', async () => {
      const invalidData = { ...validLeadData, name: '' };
      
      const { req, res } = createMocks({
        method: 'POST',
        body: invalidData
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const responseData = JSON.parse(res._getData());
      expect(responseData.error).toContain('Name is required');
    });

    test('validates email format', async () => {
      const invalidData = { ...validLeadData, email: 'invalid-email' };
      
      const { req, res } = createMocks({
        method: 'POST',
        body: invalidData
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const responseData = JSON.parse(res._getData());
      expect(responseData.error).toContain('Valid email address is required');
    });

    test('validates Indian phone number format', async () => {
      const testCases = [
        { phone: '9876543210', valid: true }, // 10 digits starting with 6-9
        { phone: '919876543210', valid: true }, // 12 digits with 91 prefix
        { phone: '+91 9876 543 210', valid: true }, // Formatted number
        { phone: '1234567890', valid: false }, // Invalid starting digit
        { phone: '98765', valid: false }, // Too short
        { phone: 'abcd1234567890', valid: false } // Contains letters
      ];

      for (const testCase of testCases) {
        const testData = { ...validLeadData, phone: testCase.phone };
        
        const { req, res } = createMocks({
          method: 'POST',
          body: testData
        });

        await leadCaptureHandler(req, res);

        if (testCase.valid) {
          expect(res._getStatusCode()).toBe(200);
        } else {
          expect(res._getStatusCode()).toBe(400);
          const responseData = JSON.parse(res._getData());
          expect(responseData.error).toContain('Valid Indian phone number is required');
        }
      }
    });

    test('accepts valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.in',
        'test+tag@gmail.com',
        'user123@company-name.org'
      ];

      for (const email of validEmails) {
        const testData = { ...validLeadData, email };
        
        const { req, res } = createMocks({
          method: 'POST',
          body: testData
        });

        await leadCaptureHandler(req, res);
        expect(res._getStatusCode()).toBe(200);
      }
    });
  });

  describe('Tracking Parameters', () => {
    test('extracts client IP and user agent', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 (Test Browser)',
          'referer': 'https://lotuslion.in/landing'
        },
        body: validLeadData
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      // Allow async processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(getMetaCAPI().sendInitiateCheckoutEvent).toHaveBeenCalledWith(
        validLeadData,
        expect.objectContaining({
          clientIp: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          sourceUrl: 'https://lotuslion.in/landing'
        })
      );
    });

    test('extracts Facebook tracking parameters', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: { fbclid: 'test_fbclid_123' },
        body: { ...validLeadData, fbp: 'fb.1.test.fbp' }
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      // Allow async processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(getMetaCAPI().sendInitiateCheckoutEvent).toHaveBeenCalledWith(
        validLeadData,
        expect.objectContaining({
          fbc: expect.stringContaining('test_fbclid_123'),
          fbp: 'fb.1.test.fbp'
        })
      );
    });
  });

  describe('Async Processing', () => {
    test('triggers zapier integration asynchronously', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: validLeadData
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      // Allow async processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(sendLeadToZapier).toHaveBeenCalledWith(validLeadData);
    });

    test('triggers meta capi event asynchronously', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: validLeadData
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      // Allow async processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(getMetaCAPI().sendInitiateCheckoutEvent).toHaveBeenCalledWith(
        validLeadData,
        expect.any(Object)
      );
    });

    test('handles async processing errors gracefully', async () => {
      // Mock errors in async processing
      sendLeadToZapier.mockRejectedValueOnce(new Error('Zapier error'));
      getMetaCAPI().sendInitiateCheckoutEvent.mockRejectedValueOnce(new Error('Meta error'));

      const { req, res } = createMocks({
        method: 'POST',
        body: validLeadData
      });

      await leadCaptureHandler(req, res);

      // Should still respond successfully to user
      expect(res._getStatusCode()).toBe(200);
      
      // Allow async processing to complete (errors should be handled gracefully)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(sendLeadToZapier).toHaveBeenCalled();
      expect(getMetaCAPI().sendInitiateCheckoutEvent).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('handles unexpected errors with 500 response', async () => {
      // Force an unexpected error by passing invalid request object
      const invalidReq = { method: 'POST' }; // Missing body and other properties
      const { res } = createMocks();

      await leadCaptureHandler(invalidReq, res);

      expect(res._getStatusCode()).toBe(500);
      const responseData = JSON.parse(res._getData());
      expect(responseData.error).toBe('Failed to process lead');
      expect(responseData.processing_time_ms).toBeDefined();
    });

    test('includes processing time in all responses', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: validLeadData
      });

      await leadCaptureHandler(req, res);

      const responseData = JSON.parse(res._getData());
      expect(responseData.processing_time_ms).toBeDefined();
      expect(typeof responseData.processing_time_ms).toBe('number');
      expect(responseData.processing_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Response Format', () => {
    test('returns proper success response structure', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: validLeadData
      });

      await leadCaptureHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData).toEqual({
        success: true,
        message: 'Lead captured successfully',
        processing_time_ms: expect.any(Number),
        timestamp: expect.any(String)
      });
    });
  });
});
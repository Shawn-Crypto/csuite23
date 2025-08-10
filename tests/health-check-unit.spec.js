const { createMocks } = require('node-mocks-http');
const healthCheckHandler = require('../api/health.js');

// Mock dependencies
jest.mock('../api/lib/zapier-webhook', () => ({
  testZapierConnection: jest.fn()
}));

jest.mock('../api/lib/meta-capi', () => ({
  getMetaCAPI: jest.fn(() => ({}))
}));

const { testZapierConnection } = require('../api/lib/zapier-webhook');

describe('Health Check API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.ZAPIER_WEBHOOK_URL;
    delete process.env.META_PIXEL_ID;
    delete process.env.META_ACCESS_TOKEN;
  });

  describe('Basic Health Check', () => {
    test('responds with basic health status', async () => {
      const { req, res } = createMocks({
        method: 'GET'
      });

      await healthCheckHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.status).toBe('healthy');
      expect(responseData.timestamp).toBeDefined();
      expect(responseData.version).toBe('1.0.0');
      expect(responseData.uptime).toBeDefined();
      expect(responseData.memory).toEqual({
        used: expect.any(Number),
        total: expect.any(Number),
        unit: 'MB'
      });
      expect(responseData.response_time_ms).toBeDefined();
      expect(responseData.configuration).toBeDefined();
    });

    test('handles OPTIONS request for CORS', async () => {
      const { req, res } = createMocks({
        method: 'OPTIONS'
      });

      await healthCheckHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getHeaders()['access-control-allow-origin']).toBe('*');
    });

    test('returns 405 for non-GET methods', async () => {
      const { req, res } = createMocks({
        method: 'POST'
      });

      await healthCheckHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const responseData = JSON.parse(res._getData());
      expect(responseData.error).toBe('Method not allowed');
    });
  });

  describe('Configuration Checking', () => {
    test('reports razorpay configuration status', async () => {
      // Test with no config
      const { req, res } = createMocks({ method: 'GET' });
      await healthCheckHandler(req, res);
      
      let responseData = JSON.parse(res._getData());
      expect(responseData.configuration.razorpay.key_configured).toBe(false);
      expect(responseData.configuration.razorpay.secret_configured).toBe(false);

      // Test with config
      process.env.RAZORPAY_KEY_ID = 'rzp_test_123456';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret';

      const { req: req2, res: res2 } = createMocks({ method: 'GET' });
      await healthCheckHandler(req2, res2);
      
      responseData = JSON.parse(res2._getData());
      expect(responseData.configuration.razorpay.key_configured).toBe(true);
      expect(responseData.configuration.razorpay.secret_configured).toBe(true);
      expect(responseData.configuration.razorpay.webhook_secret_configured).toBe(true);
    });

    test('reports zapier configuration status', async () => {
      process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/test';
      process.env.ZAPIER_LEAD_WEBHOOK_URL = 'https://hooks.zapier.com/lead';

      const { req, res } = createMocks({ method: 'GET' });
      await healthCheckHandler(req, res);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.configuration.zapier.webhook_configured).toBe(true);
      expect(responseData.configuration.zapier.lead_webhook_configured).toBe(true);
    });

    test('reports meta capi configuration status', async () => {
      process.env.META_PIXEL_ID = '1234567890123456';
      process.env.META_ACCESS_TOKEN = 'EAA123456789';
      process.env.META_TEST_EVENT_CODE = 'TEST123';

      const { req, res } = createMocks({ method: 'GET' });
      await healthCheckHandler(req, res);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.configuration.meta_capi.pixel_id_configured).toBe(true);
      expect(responseData.configuration.meta_capi.access_token_configured).toBe(true);
      expect(responseData.configuration.meta_capi.test_mode).toBe(true);
    });

    test('calculates overall configuration percentage', async () => {
      // Configure half the services
      process.env.RAZORPAY_KEY_ID = 'rzp_test_123456';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';
      process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/test';

      const { req, res } = createMocks({ method: 'GET' });
      await healthCheckHandler(req, res);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.configuration.overall.configured_percentage).toBeGreaterThan(0);
      expect(responseData.configuration.overall.configured_percentage).toBeLessThan(100);
      expect(['ready', 'incomplete']).toContain(responseData.configuration.overall.status);
    });
  });

  describe('Detailed Health Check', () => {
    test('performs detailed integration checks when requested', async () => {
      // Setup environment
      process.env.RAZORPAY_KEY_ID = 'rzp_test_123456';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';
      process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/test';
      process.env.META_PIXEL_ID = '1234567890123456';
      process.env.META_ACCESS_TOKEN = 'EAA123456789';

      // Mock Zapier test success
      testZapierConnection.mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString()
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.integrations).toBeDefined();
      expect(responseData.integrations.razorpay).toBeDefined();
      expect(responseData.integrations.zapier).toBeDefined();
      expect(responseData.integrations.meta_capi).toBeDefined();
      expect(responseData.integrations.database).toBeDefined();
    });

    test('validates razorpay key formats', async () => {
      // Test with valid test key
      process.env.RAZORPAY_KEY_ID = 'rzp_test_123456';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';

      const { req, res } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req, res);
      
      let responseData = JSON.parse(res._getData());
      expect(responseData.integrations.razorpay.status).toBe('healthy');
      expect(responseData.integrations.razorpay.environment).toBe('test');

      // Test with valid live key
      process.env.RAZORPAY_KEY_ID = 'rzp_live_123456';

      const { req: req2, res: res2 } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req2, res2);
      
      responseData = JSON.parse(res2._getData());
      expect(responseData.integrations.razorpay.environment).toBe('live');
    });

    test('detects invalid razorpay key format', async () => {
      process.env.RAZORPAY_KEY_ID = 'invalid_key_format';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';

      const { req, res } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req, res);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.integrations.razorpay.status).toBe('misconfigured');
    });

    test('tests zapier webhook connectivity', async () => {
      process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/test';
      
      testZapierConnection.mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString()
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req, res);

      expect(testZapierConnection).toHaveBeenCalled();
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.integrations.zapier.status).toBe('healthy');
    });

    test('handles zapier connection failures', async () => {
      process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/test';
      
      testZapierConnection.mockResolvedValue({
        success: false,
        error: 'Connection timeout',
        timestamp: new Date().toISOString()
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req, res);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.integrations.zapier.status).toBe('unhealthy');
    });

    test('validates meta capi credential formats', async () => {
      // Valid credentials
      process.env.META_PIXEL_ID = '1234567890123456';
      process.env.META_ACCESS_TOKEN = 'EAA123456789';

      const { req, res } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req, res);
      
      let responseData = JSON.parse(res._getData());
      expect(responseData.integrations.meta_capi.status).toBe('healthy');

      // Invalid credentials
      process.env.META_PIXEL_ID = '123';  // Too short
      process.env.META_ACCESS_TOKEN = 'invalid';  // Wrong format

      const { req: req2, res: res2 } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req2, res2);
      
      responseData = JSON.parse(res2._getData());
      expect(responseData.integrations.meta_capi.status).toBe('misconfigured');
    });

    test('reports degraded status when critical services fail', async () => {
      // Setup invalid Razorpay config (critical service)
      process.env.RAZORPAY_KEY_ID = 'invalid_key';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';
      process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/test';
      
      testZapierConnection.mockResolvedValue({ success: true });

      const { req, res } = createMocks({
        method: 'GET',
        query: { detailed: 'true' }
      });

      await healthCheckHandler(req, res);

      expect(res._getStatusCode()).toBe(503);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.status).toBe('degraded');
    });
  });

  describe('Error Handling', () => {
    test('handles unexpected errors gracefully', async () => {
      // Force an error by mocking process.uptime to throw
      const originalUptime = process.uptime;
      process.uptime = jest.fn(() => {
        throw new Error('System error');
      });

      const { req, res } = createMocks({ method: 'GET' });

      await healthCheckHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const responseData = JSON.parse(res._getData());
      expect(responseData.status).toBe('unhealthy');
      expect(responseData.error).toBe('Health check failed');

      // Restore original function
      process.uptime = originalUptime;
    });

    test('includes response time in all responses', async () => {
      const { req, res } = createMocks({ method: 'GET' });

      await healthCheckHandler(req, res);

      const responseData = JSON.parse(res._getData());
      expect(responseData.response_time_ms).toBeDefined();
      expect(typeof responseData.response_time_ms).toBe('number');
      expect(responseData.response_time_ms).toBeGreaterThanOrEqual(0);
    });
  });
});
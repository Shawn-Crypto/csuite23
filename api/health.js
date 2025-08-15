// Health Check API - System status and integration monitoring
// Provides visibility into system status and external dependencies

const { testZapierConnection } = require('./lib/zapier-webhook');
const { getMetaCAPI } = require('./lib/meta-capi');

module.exports = async function handler(req, res) {
  const startTime = process.hrtime.bigint();
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if detailed health check is requested
    const detailed = req.query.detailed === 'true';
    
    // Basic system status
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    };

    // Configuration status
    const config = checkConfiguration();
    healthStatus.configuration = config;

    // If detailed check requested, test integrations
    if (detailed) {
      console.log('🔍 Performing detailed health check...');
      const integrations = await checkIntegrations();
      healthStatus.integrations = integrations;
      
      // Overall status based on critical integrations
      if (integrations.razorpay.status !== 'healthy' || 
          (integrations.zapier.configured && integrations.zapier.status !== 'healthy')) {
        healthStatus.status = 'degraded';
      }
    }

    // Response time
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    healthStatus.response_time_ms = Math.round(duration);

    // Set appropriate status code
    const httpStatus = healthStatus.status === 'healthy' ? 200 : 503;
    
    res.status(httpStatus).json(healthStatus);

  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    console.error(`❌ Health check error (${Math.round(duration)}ms):`, error);
    
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      response_time_ms: Math.round(duration)
    });
  }
};

/**
 * Check configuration status
 * @returns {Object} Configuration status
 */
function checkConfiguration() {
  const config = {
    razorpay: {
      key_configured: !!process.env.RAZORPAY_KEY_ID,
      secret_configured: !!process.env.RAZORPAY_KEY_SECRET,
      webhook_secret_configured: !!process.env.RAZORPAY_WEBHOOK_SECRET,
      environment: process.env.RAZORPAY_ENVIRONMENT || 'not_set'
    },
    zapier: {
      webhook_configured: !!process.env.ZAPIER_LEAD_WEBHOOK_URL,
      lead_webhook_configured: !!process.env.ZAPIER_LEAD_WEBHOOK_URL
    },
    meta_capi: {
      pixel_id_configured: !!process.env.META_PIXEL_ID,
      access_token_configured: !!process.env.META_ACCESS_TOKEN,
      test_mode: !!process.env.META_TEST_EVENT_CODE
    },
    database: {
      supabase_url_configured: !!process.env.SUPABASE_URL,
      supabase_key_configured: !!process.env.SUPABASE_KEY
    }
  };

  // Calculate overall configuration score
  const totalFields = Object.values(config).reduce((acc, service) => {
    return acc + Object.keys(service).length;
  }, 0);

  const configuredFields = Object.values(config).reduce((acc, service) => {
    return acc + Object.values(service).filter(val => val === true).length;
  }, 0);

  config.overall = {
    configured_percentage: Math.round((configuredFields / totalFields) * 100),
    status: configuredFields / totalFields > 0.7 ? 'ready' : 'incomplete'
  };

  return config;
}

/**
 * Check external integrations status
 * @returns {Promise<Object>} Integration status
 */
async function checkIntegrations() {
  const integrations = {
    razorpay: await checkRazorpayIntegration(),
    zapier: await checkZapierIntegration(),
    meta_capi: await checkMetaCAPIIntegration(),
    database: await checkDatabaseIntegration()
  };

  return integrations;
}

/**
 * Check Razorpay integration status
 * @returns {Promise<Object>} Razorpay status
 */
async function checkRazorpayIntegration() {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keyId || !keySecret) {
      return {
        status: 'not_configured',
        message: 'Razorpay credentials not configured',
        configured: false
      };
    }

    // Basic credential validation (key format check)
    const isTestKey = keyId.startsWith('rzp_test_');
    const isLiveKey = keyId.startsWith('rzp_live_');
    
    if (!isTestKey && !isLiveKey) {
      return {
        status: 'misconfigured',
        message: 'Invalid Razorpay key format',
        configured: true
      };
    }

    return {
      status: 'healthy',
      message: 'Razorpay integration configured',
      configured: true,
      environment: isTestKey ? 'test' : 'live',
      key_type: isTestKey ? 'test' : 'live'
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      configured: true
    };
  }
}

/**
 * Check Zapier integration status
 * @returns {Promise<Object>} Zapier status
 */
async function checkZapierIntegration() {
  try {
    const webhookUrl = process.env.ZAPIER_LEAD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      return {
        status: 'not_configured',
        message: 'Zapier webhook URL not configured',
        configured: false
      };
    }

    // Test connection to Zapier webhook
    const testResult = await testZapierConnection();
    
    return {
      status: testResult.success ? 'healthy' : 'unhealthy',
      message: testResult.success ? 'Zapier webhook accessible' : `Zapier webhook failed: ${testResult.error}`,
      configured: true,
      webhook_url_configured: !!webhookUrl,
      lead_webhook_configured: !!process.env.ZAPIER_LEAD_WEBHOOK_URL,
      last_test_time: testResult.timestamp
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      configured: true
    };
  }
}

/**
 * Check Meta CAPI integration status
 * @returns {Promise<Object>} Meta CAPI status
 */
async function checkMetaCAPIIntegration() {
  try {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;
    
    if (!pixelId || !accessToken) {
      return {
        status: 'not_configured',
        message: 'Meta CAPI credentials not configured',
        configured: false
      };
    }

    // Basic validation
    if (pixelId.length < 15 || !accessToken.startsWith('EAA')) {
      return {
        status: 'misconfigured',
        message: 'Invalid Meta CAPI credentials format',
        configured: true
      };
    }

    const metaCAPI = getMetaCAPI();
    
    return {
      status: 'healthy',
      message: 'Meta CAPI integration configured',
      configured: true,
      pixel_id_configured: true,
      access_token_configured: true,
      test_mode: !!process.env.META_TEST_EVENT_CODE,
      api_version: 'v18.0'
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      configured: true
    };
  }
}

/**
 * Check database integration status
 * @returns {Promise<Object>} Database status
 */
async function checkDatabaseIntegration() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'not_configured',
        message: 'Database credentials not configured (optional)',
        configured: false
      };
    }

    // Basic URL validation
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase.co')) {
      return {
        status: 'misconfigured',
        message: 'Invalid Supabase URL format',
        configured: true
      };
    }

    return {
      status: 'healthy',
      message: 'Database integration configured',
      configured: true,
      url_configured: true,
      key_configured: true
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      configured: true
    };
  }
}
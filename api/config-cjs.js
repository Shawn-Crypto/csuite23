/**
 * Production Configuration Handler (CommonJS)
 * Manages environment-specific credentials and settings
 */

const environment = process.env.NODE_ENV || 'development';
const razorpayMode = process.env.RAZORPAY_MODE || 'test';

// Razorpay Configuration
const getRazorpayConfig = () => {
  const isLiveMode = razorpayMode === 'live';
  
  const config = {
    key_id: isLiveMode 
      ? process.env.RAZORPAY_LIVE_KEY_ID 
      : process.env.RAZORPAY_TEST_KEY_ID || process.env.RAZORPAY_KEY_ID,
    key_secret: isLiveMode 
      ? process.env.RAZORPAY_LIVE_KEY_SECRET 
      : process.env.RAZORPAY_TEST_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET,
    webhook_secret: isLiveMode 
      ? process.env.RAZORPAY_LIVE_WEBHOOK_SECRET 
      : process.env.RAZORPAY_TEST_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET,
    mode: razorpayMode
  };

  // Validation
  if (!config.key_id || !config.key_secret) {
    throw new Error(`Missing Razorpay ${razorpayMode} credentials`);
  }

  return config;
};

// Meta Pixel Configuration
const getMetaConfig = () => {
  const config = {
    pixel_id: process.env.META_PIXEL_ID,
    access_token: process.env.META_ACCESS_TOKEN,
    test_event_code: environment !== 'production' ? process.env.META_TEST_EVENT_CODE : undefined
  };

  // Validation
  if (!config.pixel_id || !config.access_token) {
    throw new Error('Missing Meta Pixel credentials');
  }

  return config;
};

// Database Configuration
const getDatabaseConfig = () => {
  const config = {
    supabase_url: process.env.SUPABASE_URL,
    supabase_key: process.env.SUPABASE_KEY
  };

  // Validation
  if (!config.supabase_url || !config.supabase_key) {
    throw new Error('Missing Supabase credentials');
  }

  return config;
};

// Zapier Configuration
const getZapierConfig = () => {
  return {
    purchase_webhook: process.env.ZAPIER_WEBHOOK_URL,
    lead_webhook: process.env.ZAPIER_LEAD_WEBHOOK_URL
  };
};

// Environment Info
const getEnvironmentInfo = () => {
  return {
    environment,
    razorpay_mode: razorpayMode,
    is_production: environment === 'production',
    is_live_payments: razorpayMode === 'live',
    app_version: process.env.APP_VERSION || '1.0.0',
    deploy_time: process.env.DEPLOY_TIME || new Date().toISOString()
  };
};

// Configuration validation
const validateConfiguration = () => {
  try {
    const razorpay = getRazorpayConfig();
    const meta = getMetaConfig();
    const database = getDatabaseConfig();
    const zapier = getZapierConfig();
    
    console.log('✅ Configuration validation passed:', {
      environment,
      razorpay_mode: razorpay.mode,
      has_meta_credentials: !!meta.pixel_id,
      has_database_credentials: !!database.supabase_url,
      has_zapier_webhooks: !!zapier.purchase_webhook
    });
    
    return true;
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    return false;
  }
};

module.exports = {
  getRazorpayConfig,
  getMetaConfig,
  getDatabaseConfig,
  getZapierConfig,
  getEnvironmentInfo,
  validateConfiguration
};
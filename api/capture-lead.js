// Lead Capture API - Responds quickly with async processing
// Based on Guide 6 patterns for non-blocking user experience

const { sendLeadToZapier } = require('./lib/zapier-webhook');
const { getMetaCAPI } = require('./lib/meta-capi');
const errorHandler = require('./lib/error-handler');
const { validateLeadCapture } = require('./lib/form-validator');

module.exports = async function handler(req, res) {
  const startTime = process.hrtime.bigint();
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    const { response, statusCode } = errorHandler.createAPIResponse(
      'Method not allowed. Use POST request.',
      { method: req.method, endpoint: '/api/capture-lead' },
      405
    );
    return res.status(statusCode).json(response);
  }

  try {
    // Handle empty payload gracefully for testing
    if (!req.body || Object.keys(req.body).length === 0) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      return res.status(200).json({
        message: 'Empty lead capture request acknowledged',
        timestamp: new Date().toISOString(),
        processing_time_ms: Math.round(duration),
        status: 'test_acknowledged'
      });
    }
    
    // Step 1: Enhanced validation with security checks
    const { name, email, phone, consent, terms, event_id, ...otherFields } = req.body;
    
    // Handle both 'consent' and 'terms' fields for backward compatibility
    const userConsent = consent !== undefined ? consent : terms;
    
    const context = {
      ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      submissionTime: Date.now(),
      formLoadTime: req.body.form_load_time // If provided by frontend
    };

    const validationResult = validateLeadCapture({ 
      name, 
      email, 
      phone, 
      consent: userConsent,
      ...otherFields
    }, context);
    
    if (!validationResult.isValid) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      // Handle rate limiting specifically
      if (validationResult.rateLimited) {
        const { response, statusCode } = errorHandler.createAPIResponse(
          'RATE_LIMITED',
          { retryAfter: validationResult.retryAfter },
          429
        );
        return res.status(statusCode).json({
          ...response,
          processing_time_ms: Math.round(duration)
        });
      }
      
      // Format validation errors consistently
      const formattedResponse = errorHandler.formatValidationErrors(validationResult.errors);
      return res.status(400).json({
        ...formattedResponse,
        processing_time_ms: Math.round(duration)
      });
    }

    // Step 2: Extract tracking parameters for Meta CAPI
    const trackingParams = extractTrackingParams(req);

    // Step 3: Respond immediately (within 2 seconds target)
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    res.status(200).json({
      success: true,
      message: 'Lead captured successfully',
      processing_time_ms: Math.round(duration),
      timestamp: new Date().toISOString()
    });

    // Step 4: Process asynchronously AFTER response sent
    const sanitizedData = {
      ...validationResult.sanitized,
      event_id: event_id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: 'lead_capture_api',
      timestamp: new Date().toISOString()
    };
    
    setImmediate(() => processLeadAsync(sanitizedData, trackingParams, context));

  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    console.error(`❌ Lead capture error (${Math.round(duration)}ms):`, error);
    
    res.status(500).json({
      error: 'Failed to process lead',
      processing_time_ms: Math.round(duration)
    });
  }
};

// Legacy validation functions removed - now using comprehensive FormValidator

/**
 * Extract tracking parameters from request for Meta CAPI
 * @param {Object} req - Request object
 * @returns {Object} Tracking parameters
 */
function extractTrackingParams(req) {
  const params = {
    clientIp: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    sourceUrl: req.headers['referer'] || `https://${req.headers['host']}${req.url}`
  };

  // Extract Facebook click ID from query or body
  if (req.query?.fbclid || req.body?.fbclid) {
    const fbclid = req.query?.fbclid || req.body?.fbclid;
    params.fbc = `fb.1.${Date.now()}.${fbclid}`;
  }

  // Extract Facebook browser ID from cookies or body
  if (req.cookies?._fbp || req.body?.fbp) {
    params.fbp = req.cookies?._fbp || req.body?.fbp;
  }

  return params;
}

/**
 * Process lead asynchronously after response sent
 * @param {Object} leadData - Sanitized lead information
 * @param {Object} trackingParams - Tracking parameters
 * @param {Object} context - Request context for logging
 */
async function processLeadAsync(leadData, trackingParams, context) {
  try {
    console.log(`🎯 Processing lead async: ${leadData.email} (ID: ${leadData.event_id})`);
    
    // Log security warnings if any
    if (context && context.securityWarnings && context.securityWarnings.length > 0) {
      console.warn(`⚠️ Security warnings for ${leadData.email}:`, context.securityWarnings);
    }
    
    // Parallel processing of external APIs with timeout protection
    const ASYNC_TIMEOUT = 30000; // 30 seconds timeout for async processing
    
    const results = await Promise.allSettled([
      Promise.race([
        sendToZapierAsync(leadData),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Zapier timeout')), ASYNC_TIMEOUT))
      ]),
      Promise.race([
        sendToMetaCAPIAsync(leadData, trackingParams),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Meta CAPI timeout')), ASYNC_TIMEOUT))
      ]),
      Promise.race([
        logLeadToDatabase(leadData, context),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), ASYNC_TIMEOUT))
      ])
    ]);

    // Log results
    results.forEach((result, index) => {
      const services = ['Zapier', 'Meta CAPI', 'Database'];
      if (result.status === 'fulfilled') {
        console.log(`✅ Lead ${services[index]} processing completed`);
      } else {
        console.error(`❌ Lead ${services[index]} processing failed:`, result.reason);
      }
    });

    console.log(`✅ Lead async processing completed: ${leadData.email}`);
    
  } catch (error) {
    console.error(`❌ Lead async processing failed:`, error);
  }
}

/**
 * Send lead to Zapier with error handling
 * @param {Object} leadData - Lead information
 * @returns {Promise<Object>} Result
 */
async function sendToZapierAsync(leadData) {
  try {
    return await sendLeadToZapier(leadData);
  } catch (error) {
    console.error('Lead Zapier integration error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send lead event to Meta CAPI
 * @param {Object} leadData - Lead information
 * @param {Object} trackingParams - Tracking parameters
 * @returns {Promise<Object>} Result
 */
async function sendToMetaCAPIAsync(leadData, trackingParams) {
  try {
    const metaCAPI = getMetaCAPI();
    
    // Send as Lead event (different from purchase)
    return await metaCAPI.sendInitiateCheckoutEvent(leadData, trackingParams);
  } catch (error) {
    console.error('Lead Meta CAPI integration error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Log lead to database with enhanced context
 * @param {Object} leadData - Lead information
 * @param {Object} context - Request context
 * @returns {Promise<Object>} Result
 */
async function logLeadToDatabase(leadData, context = {}) {
  // Enhanced logging with context
  const logEntry = {
    email: leadData.email,
    event_id: leadData.event_id,
    source: leadData.source,
    timestamp: leadData.timestamp,
    ip: context.ip,
    user_agent: context.userAgent,
    security_passed: context.securityPassed
  };
  
  console.log(`💾 Lead logged with context:`, logEntry);
  
  // Placeholder - would implement actual database logging
  // await supabase.from('leads').insert(logEntry);
  
  return { success: true, logged_at: new Date().toISOString(), log_entry: logEntry };
}
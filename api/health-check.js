/**
 * Health Check API Endpoint
 * Provides system status and configuration validation
 */

import { validateConfiguration, getEnvironmentInfo, getRazorpayConfig, getMetaConfig } from './config.js';

export default async function handler(req, res) {
  try {
    // Basic health check
    const timestamp = new Date().toISOString();
    const environmentInfo = getEnvironmentInfo();
    
    // Configuration validation
    const configValid = validateConfiguration();
    
    // Check database connectivity (optional)
    let databaseStatus = 'unknown';
    try {
      const { getDatabaseConfig } = await import('./config.js');
      const dbConfig = getDatabaseConfig();
      databaseStatus = 'configured';
    } catch (error) {
      databaseStatus = 'error: ' + error.message;
    }
    
    // Check API credentials
    let razorpayStatus = 'unknown';
    try {
      const razorpayConfig = getRazorpayConfig();
      razorpayStatus = `configured (${razorpayConfig.mode} mode)`;
    } catch (error) {
      razorpayStatus = 'error: ' + error.message;
    }
    
    let metaStatus = 'unknown';
    try {
      const metaConfig = getMetaConfig();
      metaStatus = 'configured';
    } catch (error) {
      metaStatus = 'error: ' + error.message;
    }
    
    const healthStatus = {
      status: 'healthy',
      timestamp,
      environment: environmentInfo,
      services: {
        razorpay: razorpayStatus,
        meta_pixel: metaStatus,
        database: databaseStatus,
        configuration: configValid ? 'valid' : 'invalid'
      },
      endpoints: {
        webhook: '/api/razorpay-webhook',
        order_creation: '/api/create-order', 
        meta_capi: '/api/meta-capi-server',
        lead_capture: '/api/capture-lead-async'
      }
    };
    
    // Set appropriate status code
    const statusCode = configValid ? 200 : 500;
    
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
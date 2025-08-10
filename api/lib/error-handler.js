/**
 * Centralized Error Handler - Guide 2 & 6 Implementation
 * Provides user-friendly error messages and consistent API responses
 */

/**
 * Error Handler class for centralized error management
 */
class ErrorHandler {
  constructor() {
    this.errorMappings = this.initializeErrorMappings();
  }

  /**
   * Initialize error message mappings for user-friendly responses
   * @returns {object} Error mappings configuration
   */
  initializeErrorMappings() {
    return {
      // Razorpay specific errors
      'BAD_REQUEST_ERROR': {
        userMessage: 'Invalid payment information. Please check your details and try again.',
        category: 'validation',
        severity: 'medium'
      },
      'GATEWAY_ERROR': {
        userMessage: 'Payment gateway is temporarily unavailable. Please try again in a few minutes.',
        category: 'gateway',
        severity: 'high'
      },
      'SERVER_ERROR': {
        userMessage: 'Our servers are experiencing issues. Please try again shortly.',
        category: 'server',
        severity: 'high'
      },
      'UNAUTHORIZED_ERROR': {
        userMessage: 'Payment authorization failed. Please contact support if this continues.',
        category: 'auth',
        severity: 'high'
      },

      // HTTP method errors
      'METHOD_NOT_ALLOWED': {
        userMessage: 'This request method is not supported for this endpoint.',
        category: 'validation',
        severity: 'low'
      },

      // Validation errors
      'VALIDATION_ERROR': {
        userMessage: 'Please check the information you provided and try again.',
        category: 'validation',
        severity: 'low'
      },
      'REQUIRED_FIELD_MISSING': {
        userMessage: 'Required information is missing. Please fill in all required fields.',
        category: 'validation',
        severity: 'low'
      },
      'INVALID_EMAIL_FORMAT': {
        userMessage: 'Please enter a valid email address.',
        category: 'validation',
        severity: 'low'
      },
      'INVALID_PHONE_FORMAT': {
        userMessage: 'Please enter a valid 10-digit Indian mobile number.',
        category: 'validation',
        severity: 'low'
      },

      // Network and timeout errors
      'NETWORK_ERROR': {
        userMessage: 'Network connection issue. Please check your internet and try again.',
        category: 'network',
        severity: 'medium'
      },
      'TIMEOUT_ERROR': {
        userMessage: 'Request timed out. Please try again.',
        category: 'network',
        severity: 'medium'
      },
      'CONNECTION_ERROR': {
        userMessage: 'Unable to connect to payment services. Please try again.',
        category: 'network',
        severity: 'medium'
      },

      // Business logic errors
      'DUPLICATE_ORDER': {
        userMessage: 'This order has already been processed.',
        category: 'business',
        severity: 'low'
      },
      'ORDER_NOT_FOUND': {
        userMessage: 'Order not found. Please start a new payment process.',
        category: 'business',
        severity: 'medium'
      },
      'PAYMENT_ALREADY_CAPTURED': {
        userMessage: 'This payment has already been completed.',
        category: 'business',
        severity: 'low'
      },

      // External service errors
      'ZAPIER_ERROR': {
        userMessage: 'Course enrollment is processing. You will receive access details shortly.',
        category: 'external',
        severity: 'low',
        internal: true // Don't show to user, handle internally
      },
      'META_CAPI_ERROR': {
        userMessage: 'Payment completed successfully.',
        category: 'external', 
        severity: 'low',
        internal: true
      },
      'EMAIL_SERVICE_ERROR': {
        userMessage: 'Payment completed. If you don\'t receive confirmation email, please contact support.',
        category: 'external',
        severity: 'medium'
      },

      // Database errors
      'DATABASE_ERROR': {
        userMessage: 'Data processing issue. Your payment was successful, please contact support for access.',
        category: 'database',
        severity: 'high'
      },
      'DATABASE_CONNECTION_ERROR': {
        userMessage: 'System temporarily unavailable. Please try again shortly.',
        category: 'database',
        severity: 'high'
      },

      // Generic fallbacks
      'UNKNOWN_ERROR': {
        userMessage: 'Something unexpected happened. Please try again or contact support.',
        category: 'unknown',
        severity: 'medium'
      }
    };
  }

  /**
   * Maps technical errors to user-friendly messages
   * @param {Error|string} error - Error object or message
   * @param {object} context - Additional error context
   * @returns {object} User-friendly error response
   */
  mapToUserMessage(error, context = {}) {
    let errorCode, errorMessage, originalError;

    if (typeof error === 'string') {
      errorMessage = error;
      errorCode = this.detectErrorCode(error);
    } else if (error && typeof error === 'object') {
      errorMessage = error.message || error.description || 'Unknown error';
      errorCode = error.code || error.error?.code || this.detectErrorCode(errorMessage);
      originalError = error;
    } else {
      errorCode = 'UNKNOWN_ERROR';
      errorMessage = 'Unknown error occurred';
    }

    const mapping = this.errorMappings[errorCode] || this.errorMappings['UNKNOWN_ERROR'];
    
    return {
      userMessage: mapping.userMessage,
      errorCode,
      category: mapping.category,
      severity: mapping.severity,
      internal: mapping.internal || false,
      context: this.sanitizeContext(context),
      originalMessage: errorMessage,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Detects error code from error message
   * @param {string} message - Error message
   * @returns {string} Detected error code
   */
  detectErrorCode(message) {
    const msg = message.toLowerCase();
    
    if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT_ERROR';
    if (msg.includes('network') || msg.includes('connection')) return 'NETWORK_ERROR';
    if (msg.includes('validation') || msg.includes('invalid')) return 'VALIDATION_ERROR';
    if (msg.includes('required') || msg.includes('missing')) return 'REQUIRED_FIELD_MISSING';
    if (msg.includes('email')) return 'INVALID_EMAIL_FORMAT';
    if (msg.includes('phone')) return 'INVALID_PHONE_FORMAT';
    if (msg.includes('duplicate')) return 'DUPLICATE_ORDER';
    if (msg.includes('not found')) return 'ORDER_NOT_FOUND';
    if (msg.includes('unauthorized')) return 'UNAUTHORIZED_ERROR';
    if (msg.includes('gateway')) return 'GATEWAY_ERROR';
    if (msg.includes('server')) return 'SERVER_ERROR';
    if (msg.includes('database') || msg.includes('db')) return 'DATABASE_ERROR';
    if (msg.includes('zapier')) return 'ZAPIER_ERROR';
    if (msg.includes('meta')) return 'META_CAPI_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Logs error with comprehensive context
   * @param {Error|string} error - Error to log
   * @param {object} context - Request/operation context
   */
  logWithContext(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: this.getLogLevel(error),
      error: {
        message: error?.message || error,
        code: error?.code,
        stack: error?.stack
      },
      context: this.sanitizeContext(context),
      environment: process.env.NODE_ENV || 'development'
    };

    // Different logging based on severity
    const errorMapping = this.mapToUserMessage(error, context);
    
    switch (errorMapping.severity) {
      case 'high':
        console.error('🚨 HIGH SEVERITY ERROR:', JSON.stringify(logEntry, null, 2));
        break;
      case 'medium':
        console.error('⚠️  MEDIUM SEVERITY ERROR:', JSON.stringify(logEntry, null, 2));
        break;
      case 'low':
        if (process.env.NODE_ENV !== 'production' || !errorMapping.internal) {
          console.warn('ℹ️  LOW SEVERITY ERROR:', JSON.stringify(logEntry, null, 2));
        }
        break;
      default:
        console.error('❌ ERROR:', JSON.stringify(logEntry, null, 2));
    }

    // In production, send to external error tracking
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      // Sentry integration would go here
      console.log('📤 Sending to error tracking service...');
    }
  }

  /**
   * Creates consistent API error response
   * @param {Error|string} error - Error to format
   * @param {object} context - Additional context
   * @param {number} statusCode - HTTP status code
   * @returns {object} Formatted API response
   */
  createAPIResponse(error, context = {}, statusCode = null) {
    const mappedError = this.mapToUserMessage(error, context);
    const responseCode = statusCode || this.getStatusCode(mappedError);

    const response = {
      success: false,
      error: {
        message: mappedError.userMessage,
        code: mappedError.errorCode,
        category: mappedError.category
      },
      timestamp: mappedError.timestamp,
      requestId: context.requestId || this.generateRequestId()
    };

    // Add debug info in development
    if (process.env.NODE_ENV !== 'production') {
      response.debug = {
        originalMessage: mappedError.originalMessage,
        context: mappedError.context
      };
    }

    // Log the error
    this.logWithContext(error, {
      ...context,
      statusCode: responseCode,
      userMessage: mappedError.userMessage
    });

    return { response, statusCode: responseCode };
  }

  /**
   * Gets appropriate HTTP status code for error
   * @param {object} mappedError - Mapped error object
   * @returns {number} HTTP status code
   */
  getStatusCode(mappedError) {
    switch (mappedError.category) {
      case 'validation':
        return 400;
      case 'auth':
        return 401;
      case 'business':
        return 409;
      case 'network':
      case 'gateway':
        return 502;
      case 'database':
      case 'server':
        return 500;
      case 'external':
        return mappedError.internal ? 200 : 502; // Internal errors shouldn't fail user request
      default:
        return 500;
    }
  }

  /**
   * Gets log level based on error severity
   * @param {Error|string} error - Error object
   * @returns {string} Log level
   */
  getLogLevel(error) {
    const mapping = this.mapToUserMessage(error);
    switch (mapping.severity) {
      case 'high': return 'error';
      case 'medium': return 'warn';
      case 'low': return 'info';
      default: return 'error';
    }
  }

  /**
   * Sanitizes context to remove sensitive information
   * @param {object} context - Context object
   * @returns {object} Sanitized context
   */
  sanitizeContext(context) {
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'authorization', 
      'cookie', 'session', 'credit_card', 'card_number'
    ];

    const sanitized = { ...context };
    
    const sanitizeObject = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        const keyLower = key.toLowerCase();
        
        if (sensitiveFields.some(field => keyLower.includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          sanitizeObject(value, fullPath);
        }
      }
    };

    if (typeof sanitized === 'object' && sanitized !== null) {
      sanitizeObject(sanitized);
    }

    return sanitized;
  }

  /**
   * Generates unique request ID for tracking
   * @returns {string} Unique request identifier
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handles async errors with proper logging
   * @param {Function} asyncFunction - Async function to wrap
   * @param {object} context - Execution context
   * @returns {Function} Wrapped function
   */
  wrapAsync(asyncFunction, context = {}) {
    return async (...args) => {
      try {
        return await asyncFunction(...args);
      } catch (error) {
        this.logWithContext(error, {
          ...context,
          functionName: asyncFunction.name,
          arguments: args.length
        });
        throw error;
      }
    };
  }

  /**
   * Validates and formats validation errors
   * @param {object} validationErrors - Validation error object
   * @returns {object} Formatted validation response
   */
  formatValidationErrors(validationErrors) {
    const errors = [];
    
    Object.keys(validationErrors).forEach(field => {
      const fieldErrors = Array.isArray(validationErrors[field]) 
        ? validationErrors[field] 
        : [validationErrors[field]];
      
      fieldErrors.forEach(error => {
        errors.push({
          field,
          message: this.mapToUserMessage(error).userMessage,
          code: this.detectErrorCode(error)
        });
      });
    });

    return {
      success: false,
      error: {
        message: 'Please correct the following errors:',
        code: 'VALIDATION_ERROR',
        category: 'validation',
        fields: errors
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
const errorHandler = new ErrorHandler();

module.exports = errorHandler;

// For testing
module.exports.ErrorHandler = ErrorHandler;
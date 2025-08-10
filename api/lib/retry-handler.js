/**
 * Retry Logic with Exponential Backoff - Guide 2 & 3 Implementation
 * Provides resilient external API call handling with configurable retry strategies
 */

class RetryHandler {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000, // 1 second
      maxDelay: options.maxDelay || 30000, // 30 seconds
      backoffFactor: options.backoffFactor || 2,
      jitterMax: options.jitterMax || 1000, // Random jitter up to 1 second
      timeoutMs: options.timeoutMs || 10000, // 10 second timeout per attempt
      retryCondition: options.retryCondition || this.defaultRetryCondition,
      onRetry: options.onRetry || this.defaultOnRetry,
      ...options
    };
  }

  /**
   * Execute function with retry logic and exponential backoff
   * @param {Function} fn - Async function to execute
   * @param {Object} context - Context for logging and debugging
   * @returns {Promise} Result of successful execution
   */
  async execute(fn, context = {}) {
    let lastError = null;
    let attempt = 0;

    for (attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Add timeout protection to each attempt
        const result = await this.withTimeout(fn(), this.options.timeoutMs);
        
        // Log successful execution after retries
        if (attempt > 0) {
          this.options.onRetry({
            attempt,
            success: true,
            context,
            totalTime: this.getTotalElapsedTime(context.startTime)
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this error
        if (!this.options.retryCondition(error, attempt)) {
          throw error;
        }
        
        // Don't wait after the last attempt
        if (attempt < this.options.maxRetries) {
          const delay = this.calculateDelay(attempt);
          
          this.options.onRetry({
            attempt: attempt + 1,
            error,
            delay,
            willRetry: true,
            context
          });
          
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    const finalError = new Error(`Max retries (${this.options.maxRetries}) exhausted. Last error: ${lastError.message}`);
    finalError.originalError = lastError;
    finalError.attempts = attempt;
    finalError.context = context;
    
    throw finalError;
  }

  /**
   * Calculate delay for next retry using exponential backoff with jitter
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    // Exponential backoff: initialDelay * backoffFactor^attempt
    const exponentialDelay = this.options.initialDelay * Math.pow(this.options.backoffFactor, attempt);
    
    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, this.options.maxDelay);
    
    // Add random jitter to avoid thundering herd
    const jitter = Math.random() * this.options.jitterMax;
    
    return Math.round(cappedDelay + jitter);
  }

  /**
   * Add timeout protection to a promise
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise} Promise with timeout
   */
  async withTimeout(promise, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Default retry condition - determines if error should trigger retry
   * @param {Error} error - Error that occurred
   * @param {number} attempt - Current attempt number
   * @returns {boolean} Whether to retry
   */
  defaultRetryCondition(error, attempt) {
    // Don't retry on the last attempt
    if (attempt >= this.options.maxRetries) {
      return false;
    }

    // Retry on network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT') {
      return true;
    }

    // Retry on timeout errors
    if (error.message && error.message.includes('timed out')) {
      return true;
    }

    // Retry on HTTP 5xx errors (server errors)
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Retry on specific HTTP 4xx errors that are transient
    const retryableClientErrors = [408, 429, 423]; // Timeout, Rate Limited, Locked
    if (error.response && retryableClientErrors.includes(error.response.status)) {
      return true;
    }

    // Retry on rate limiting (from APIs like Razorpay, Meta, Zapier)
    if (error.message && (
        error.message.includes('rate limit') ||
        error.message.includes('quota') ||
        error.message.includes('throttle')
    )) {
      return true;
    }

    // Don't retry on other errors (4xx client errors, validation errors, etc.)
    return false;
  }

  /**
   * Default retry callback for logging
   * @param {Object} retryInfo - Information about the retry
   */
  defaultOnRetry(retryInfo) {
    const { attempt, error, delay, willRetry, success, context } = retryInfo;
    
    if (success) {
      console.log(`✅ Retry succeeded after ${attempt} attempts for ${context.operation || 'operation'}`);
    } else if (willRetry) {
      console.warn(`⏳ Retry ${attempt}/${this.options.maxRetries} failed for ${context.operation || 'operation'}: ${error.message}. Retrying in ${delay}ms...`);
    } else {
      console.error(`❌ All retries exhausted for ${context.operation || 'operation'}: ${error.message}`);
    }
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get total elapsed time since start
   * @param {number} startTime - Start time from Date.now()
   * @returns {number} Elapsed time in milliseconds
   */
  getTotalElapsedTime(startTime) {
    return startTime ? Date.now() - startTime : 0;
  }
}

/**
 * Pre-configured retry handlers for different use cases
 */
class RetryHandlerFactory {
  /**
   * Fast retry for lightweight operations (API calls, database queries)
   * @returns {RetryHandler} Configured retry handler
   */
  static createFastRetry() {
    return new RetryHandler({
      maxRetries: 3,
      initialDelay: 500,
      maxDelay: 5000,
      backoffFactor: 2,
      jitterMax: 500,
      timeoutMs: 5000
    });
  }

  /**
   * Standard retry for most API operations (webhooks, payments)
   * @returns {RetryHandler} Configured retry handler
   */
  static createStandardRetry() {
    return new RetryHandler({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 15000,
      backoffFactor: 2,
      jitterMax: 1000,
      timeoutMs: 10000
    });
  }

  /**
   * Patient retry for heavy operations (file uploads, batch processing)
   * @returns {RetryHandler} Configured retry handler
   */
  static createPatientRetry() {
    return new RetryHandler({
      maxRetries: 5,
      initialDelay: 2000,
      maxDelay: 60000,
      backoffFactor: 1.5,
      jitterMax: 2000,
      timeoutMs: 30000
    });
  }

  /**
   * Aggressive retry for critical operations (payment confirmations)
   * @returns {RetryHandler} Configured retry handler
   */
  static createAggressiveRetry() {
    return new RetryHandler({
      maxRetries: 5,
      initialDelay: 200,
      maxDelay: 10000,
      backoffFactor: 1.8,
      jitterMax: 300,
      timeoutMs: 8000
    });
  }

  /**
   * Custom retry with specific configuration
   * @param {Object} config - Custom configuration
   * @returns {RetryHandler} Configured retry handler
   */
  static createCustomRetry(config) {
    return new RetryHandler(config);
  }
}

/**
 * Utility functions for common retry scenarios
 */
class RetryUtils {
  /**
   * Retry an HTTP request with appropriate configuration
   * @param {Function} requestFn - Function that makes HTTP request
   * @param {Object} options - Retry options
   * @returns {Promise} Response from successful request
   */
  static async retryHttpRequest(requestFn, options = {}) {
    const retryHandler = new RetryHandler({
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000,
      retryCondition: (error, attempt) => {
        // Custom condition for HTTP requests
        if (attempt >= (options.maxRetries || 3)) return false;
        
        // Retry on network errors
        if (error.code && ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)) {
          return true;
        }
        
        // Retry on 5xx server errors
        if (error.response && error.response.status >= 500) {
          return true;
        }
        
        // Retry on specific 4xx errors
        if (error.response && [408, 423, 429].includes(error.response.status)) {
          return true;
        }
        
        return false;
      },
      ...options
    });

    return retryHandler.execute(requestFn, { 
      operation: 'HTTP Request',
      startTime: Date.now()
    });
  }

  /**
   * Retry a database operation
   * @param {Function} dbOperation - Database operation function
   * @param {Object} options - Retry options
   * @returns {Promise} Result of successful operation
   */
  static async retryDatabaseOperation(dbOperation, options = {}) {
    const retryHandler = new RetryHandler({
      maxRetries: options.maxRetries || 2,
      initialDelay: options.initialDelay || 500,
      maxDelay: 5000,
      retryCondition: (error, attempt) => {
        if (attempt >= (options.maxRetries || 2)) return false;
        
        // Retry on connection errors
        if (error.message && (
            error.message.includes('connection') ||
            error.message.includes('timeout') ||
            error.message.includes('network')
        )) {
          return true;
        }
        
        // Don't retry on data integrity errors
        return false;
      },
      ...options
    });

    return retryHandler.execute(dbOperation, {
      operation: 'Database Operation',
      startTime: Date.now()
    });
  }

  /**
   * Retry with circuit breaker pattern
   * @param {Function} operation - Operation to retry
   * @param {Object} options - Options including circuit breaker config
   * @returns {Promise} Result of successful operation
   */
  static async retryWithCircuitBreaker(operation, options = {}) {
    // Simple circuit breaker implementation
    const circuitBreaker = options.circuitBreaker || {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 600000
    };

    // This would integrate with a proper circuit breaker library in production
    const retryHandler = new RetryHandler({
      maxRetries: options.maxRetries || 2,
      retryCondition: (error, attempt) => {
        // Circuit breaker would check failure rate here
        // For now, use standard retry condition
        return RetryHandler.prototype.defaultRetryCondition(error, attempt);
      },
      ...options
    });

    return retryHandler.execute(operation, {
      operation: 'Circuit Breaker Protected Operation',
      startTime: Date.now()
    });
  }
}

// Global instances for common scenarios
const standardRetry = RetryHandlerFactory.createStandardRetry();
const fastRetry = RetryHandlerFactory.createFastRetry();
const patientRetry = RetryHandlerFactory.createPatientRetry();
const aggressiveRetry = RetryHandlerFactory.createAggressiveRetry();

// Export everything
module.exports = {
  RetryHandler,
  RetryHandlerFactory,
  RetryUtils,
  
  // Pre-configured instances
  standardRetry,
  fastRetry,
  patientRetry,
  aggressiveRetry,
  
  // Convenience functions
  retryStandard: (fn, context) => standardRetry.execute(fn, context),
  retryFast: (fn, context) => fastRetry.execute(fn, context),
  retryPatient: (fn, context) => patientRetry.execute(fn, context),
  retryAggressive: (fn, context) => aggressiveRetry.execute(fn, context),
  
  // Utility functions
  retryHttp: RetryUtils.retryHttpRequest,
  retryDb: RetryUtils.retryDatabaseOperation,
  retryWithCircuitBreaker: RetryUtils.retryWithCircuitBreaker
};
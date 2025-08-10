/**
 * Unit Tests - Retry Handler with Exponential Backoff
 * Tests resilient external API call handling and retry strategies
 */

const { 
  RetryHandler, 
  RetryHandlerFactory, 
  RetryUtils,
  retryStandard,
  retryFast,
  retryPatient,
  retryAggressive
} = require('../../api/lib/retry-handler');

describe('Retry Handler System - Unit Tests', () => {
  
  describe('Basic Retry Handler', () => {
    test('should succeed on first attempt without retries', async () => {
      const retryHandler = new RetryHandler();
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await retryHandler.execute(mockFn, { operation: 'test' });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should retry on network errors', async () => {
      const retryHandler = new RetryHandler({ maxRetries: 2 });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Network error'), { code: 'ECONNRESET' }))
        .mockResolvedValue('success');
      
      const result = await retryHandler.execute(mockFn, { operation: 'test' });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should retry on 5xx HTTP errors', async () => {
      const retryHandler = new RetryHandler({ maxRetries: 2 });
      const error = new Error('Server Error');
      error.response = { status: 503 };
      
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const result = await retryHandler.execute(mockFn, { operation: 'test' });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should not retry on 4xx client errors', async () => {
      const retryHandler = new RetryHandler({ maxRetries: 2 });
      const error = new Error('Bad Request');
      error.response = { status: 400 };
      
      const mockFn = jest.fn().mockRejectedValue(error);
      
      await expect(retryHandler.execute(mockFn, { operation: 'test' }))
        .rejects.toThrow('Bad Request');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should retry on rate limiting errors', async () => {
      const retryHandler = new RetryHandler({ maxRetries: 2 });
      const error = new Error('Rate limit exceeded');
      error.response = { status: 429 };
      
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const result = await retryHandler.execute(mockFn, { operation: 'test' });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should exhaust all retries and throw final error', async () => {
      const retryHandler = new RetryHandler({ 
        maxRetries: 2,
        initialDelay: 10 // Fast for testing
      });
      const error = Object.assign(new Error('Persistent error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn().mockRejectedValue(error);
      
      const startTime = Date.now();
      await expect(retryHandler.execute(mockFn, { operation: 'test' }))
        .rejects.toThrow('Max retries (2) exhausted');
      const endTime = Date.now();
      
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(endTime - startTime).toBeGreaterThan(20); // Should have waited for delays
    });
  });

  describe('Exponential Backoff', () => {
    test('should calculate correct delays with exponential backoff', () => {
      const retryHandler = new RetryHandler({
        initialDelay: 1000,
        backoffFactor: 2,
        jitterMax: 0 // No jitter for predictable testing
      });
      
      expect(retryHandler.calculateDelay(0)).toBe(1000); // 1000 * 2^0
      expect(retryHandler.calculateDelay(1)).toBe(2000); // 1000 * 2^1
      expect(retryHandler.calculateDelay(2)).toBe(4000); // 1000 * 2^2
    });

    test('should cap delays at maximum', () => {
      const retryHandler = new RetryHandler({
        initialDelay: 1000,
        maxDelay: 3000,
        backoffFactor: 2,
        jitterMax: 0
      });
      
      expect(retryHandler.calculateDelay(0)).toBe(1000);
      expect(retryHandler.calculateDelay(1)).toBe(2000);
      expect(retryHandler.calculateDelay(2)).toBe(3000); // Capped at maxDelay
      expect(retryHandler.calculateDelay(10)).toBe(3000); // Still capped
    });

    test('should add jitter to delays', () => {
      const retryHandler = new RetryHandler({
        initialDelay: 1000,
        backoffFactor: 2,
        jitterMax: 500
      });
      
      const delay1 = retryHandler.calculateDelay(0);
      const delay2 = retryHandler.calculateDelay(0);
      
      // Both should be in range [1000, 1500] but likely different due to jitter
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1500);
      expect(delay2).toBeGreaterThanOrEqual(1000);
      expect(delay2).toBeLessThanOrEqual(1500);
    });
  });

  describe('Timeout Protection', () => {
    test('should timeout long-running operations', async () => {
      const retryHandler = new RetryHandler({ timeoutMs: 100 });
      const mockFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200))
      );
      
      await expect(retryHandler.execute(mockFn, { operation: 'test' }))
        .rejects.toThrow('Operation timed out after 100ms');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should not timeout fast operations', async () => {
      const retryHandler = new RetryHandler({ timeoutMs: 100 });
      const mockFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 50))
      );
      
      const result = await retryHandler.execute(mockFn, { operation: 'test' });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Retry Conditions', () => {
    test('should use custom retry condition', async () => {
      const retryHandler = new RetryHandler({
        maxRetries: 2,
        retryCondition: (error, attempt) => {
          // Only retry if error message contains 'retry'
          return attempt < 2 && error.message.includes('retry');
        }
      });

      // This error should be retried
      const retryableError = new Error('Please retry this operation');
      const mockRetryableFn = jest.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');
      
      const result = await retryHandler.execute(mockRetryableFn, { operation: 'test' });
      expect(result).toBe('success');
      expect(mockRetryableFn).toHaveBeenCalledTimes(2);

      // This error should not be retried
      const nonRetryableError = new Error('Do not retry this');
      const mockNonRetryableFn = jest.fn().mockRejectedValue(nonRetryableError);
      
      await expect(retryHandler.execute(mockNonRetryableFn, { operation: 'test' }))
        .rejects.toThrow('Do not retry this');
      expect(mockNonRetryableFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Retry Callbacks', () => {
    test('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const retryHandler = new RetryHandler({
        maxRetries: 2,
        initialDelay: 10,
        onRetry
      });

      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      await retryHandler.execute(mockFn, { operation: 'test' });
      
      expect(onRetry).toHaveBeenCalledTimes(2); // Once for retry, once for success
      expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
        attempt: 1,
        error,
        willRetry: true
      }));
      expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
        attempt: 1,
        success: true
      }));
    });
  });

  describe('Pre-configured Retry Handlers', () => {
    test('should provide fast retry handler', async () => {
      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('fast success');
      
      const result = await retryFast(mockFn, { operation: 'test' });
      
      expect(result).toBe('fast success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should provide standard retry handler', async () => {
      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('standard success');
      
      const result = await retryStandard(mockFn, { operation: 'test' });
      
      expect(result).toBe('standard success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should provide patient retry handler', async () => {
      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('patient success');
      
      const result = await retryPatient(mockFn, { operation: 'test' });
      
      expect(result).toBe('patient success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should provide aggressive retry handler', async () => {
      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('aggressive success');
      
      const result = await retryAggressive(mockFn, { operation: 'test' });
      
      expect(result).toBe('aggressive success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Handler Factory', () => {
    test('should create handlers with different configurations', () => {
      const fast = RetryHandlerFactory.createFastRetry();
      const standard = RetryHandlerFactory.createStandardRetry();
      const patient = RetryHandlerFactory.createPatientRetry();
      const aggressive = RetryHandlerFactory.createAggressiveRetry();
      
      expect(fast.options.maxRetries).toBe(3);
      expect(fast.options.initialDelay).toBe(500);
      
      expect(standard.options.maxRetries).toBe(3);
      expect(standard.options.initialDelay).toBe(1000);
      
      expect(patient.options.maxRetries).toBe(5);
      expect(patient.options.initialDelay).toBe(2000);
      
      expect(aggressive.options.maxRetries).toBe(5);
      expect(aggressive.options.initialDelay).toBe(200);
    });

    test('should create custom retry handler', () => {
      const custom = RetryHandlerFactory.createCustomRetry({
        maxRetries: 10,
        initialDelay: 100,
        maxDelay: 60000
      });
      
      expect(custom.options.maxRetries).toBe(10);
      expect(custom.options.initialDelay).toBe(100);
      expect(custom.options.maxDelay).toBe(60000);
    });
  });

  describe('Retry Utilities', () => {
    test('should retry HTTP requests', async () => {
      const mockRequest = jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Network error'), { code: 'ECONNRESET' }))
        .mockResolvedValue({ status: 200, data: 'success' });
      
      const result = await RetryUtils.retryHttpRequest(mockRequest, { maxRetries: 2 });
      
      expect(result.status).toBe(200);
      expect(result.data).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    test('should retry database operations', async () => {
      const mockDbOp = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValue({ id: 1, name: 'test' });
      
      const result = await RetryUtils.retryDatabaseOperation(mockDbOp, { maxRetries: 2 });
      
      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
      expect(mockDbOp).toHaveBeenCalledTimes(2);
    });

    test('should not retry database integrity errors', async () => {
      const mockDbOp = jest.fn().mockRejectedValue(new Error('Unique constraint violation'));
      
      await expect(RetryUtils.retryDatabaseOperation(mockDbOp, { maxRetries: 2 }))
        .rejects.toThrow('Unique constraint violation');
      
      expect(mockDbOp).toHaveBeenCalledTimes(1); // Should not retry
    });
  });

  describe('Error Scenarios', () => {
    test('should handle null/undefined functions gracefully', async () => {
      const retryHandler = new RetryHandler();
      
      await expect(retryHandler.execute(null, { operation: 'test' }))
        .rejects.toThrow();
      
      await expect(retryHandler.execute(undefined, { operation: 'test' }))
        .rejects.toThrow();
    });

    test('should preserve original error properties', async () => {
      const retryHandler = new RetryHandler({ maxRetries: 1 });
      const originalError = Object.assign(new Error('Original error'), {
        code: 'CUSTOM_ERROR',
        statusCode: 500,
        details: { important: 'data' }
      });
      
      const mockFn = jest.fn().mockRejectedValue(originalError);
      
      try {
        await retryHandler.execute(mockFn, { operation: 'test' });
      } catch (finalError) {
        expect(finalError.originalError).toBe(originalError);
        expect(finalError.originalError.code).toBe('CUSTOM_ERROR');
        expect(finalError.originalError.statusCode).toBe(500);
        expect(finalError.originalError.details).toEqual({ important: 'data' });
        expect(finalError.attempts).toBe(2); // Initial + 1 retry
      }
    });

    test('should handle async errors correctly', async () => {
      const retryHandler = new RetryHandler({ maxRetries: 1, initialDelay: 10 });
      const mockFn = jest.fn().mockImplementation(async () => {
        throw new Error('Async error');
      });
      
      await expect(retryHandler.execute(mockFn, { operation: 'test' }))
        .rejects.toThrow('Max retries (1) exhausted');
      
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Timing', () => {
    test('should respect minimum delays between retries', async () => {
      const retryHandler = new RetryHandler({
        maxRetries: 2,
        initialDelay: 50,
        jitterMax: 0
      });
      
      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn().mockRejectedValue(error);
      
      const startTime = Date.now();
      
      try {
        await retryHandler.execute(mockFn, { operation: 'test' });
      } catch (e) {
        // Expected to fail
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should have waited at least for the delays: 50ms + 100ms = 150ms
      expect(totalTime).toBeGreaterThanOrEqual(150);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('should not add delay after successful retry', async () => {
      const retryHandler = new RetryHandler({
        maxRetries: 2,
        initialDelay: 100
      });
      
      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      const result = await retryHandler.execute(mockFn, { operation: 'test' });
      const endTime = Date.now();
      
      expect(result).toBe('success');
      // Should have waited for first retry delay but not after success
      expect(endTime - startTime).toBeGreaterThan(100);
      expect(endTime - startTime).toBeLessThan(200); // But not two delays
    });
  });

  describe('Context Handling', () => {
    test('should preserve and enhance context information', async () => {
      const onRetry = jest.fn();
      const retryHandler = new RetryHandler({ maxRetries: 1, onRetry });
      
      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const context = { operation: 'test', userId: '123', requestId: 'req_456' };
      const result = await retryHandler.execute(mockFn, context);
      
      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
        context: expect.objectContaining(context)
      }));
    });
  });
});
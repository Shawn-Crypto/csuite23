/**
 * Unit Tests - Centralized Error Handler
 * Tests error mapping, logging, and API response formatting
 */

const errorHandler = require('../../api/lib/error-handler');

describe('Centralized Error Handler - Unit Tests', () => {
  
  describe('Error Mapping', () => {
    test('should map Razorpay errors to user-friendly messages', () => {
      const result = errorHandler.mapToUserMessage('BAD_REQUEST_ERROR');
      
      expect(result.userMessage).toBe('Invalid payment information. Please check your details and try again.');
      expect(result.errorCode).toBe('BAD_REQUEST_ERROR');
      expect(result.category).toBe('validation');
      expect(result.severity).toBe('medium');
    });

    test('should detect error codes from messages', () => {
      const timeoutError = errorHandler.mapToUserMessage('Connection timed out after 10 seconds');
      expect(timeoutError.errorCode).toBe('TIMEOUT_ERROR');
      
      const validationError = errorHandler.mapToUserMessage('Email format is invalid');
      expect(validationError.errorCode).toBe('INVALID_EMAIL_FORMAT');
    });

    test('should handle unknown errors gracefully', () => {
      const result = errorHandler.mapToUserMessage('Some unknown error occurred');
      
      expect(result.errorCode).toBe('UNKNOWN_ERROR');
      expect(result.userMessage).toBe('Something unexpected happened. Please try again or contact support.');
    });
  });

  describe('API Response Creation', () => {
    test('should create consistent API error responses', () => {
      const { response, statusCode } = errorHandler.createAPIResponse(
        'VALIDATION_ERROR',
        { field: 'email', value: 'invalid-email' }
      );
      
      expect(statusCode).toBe(400);
      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Please check the information you provided and try again.');
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.category).toBe('validation');
      expect(response.requestId).toMatch(/^req_/);
    });

    test('should return appropriate status codes for different error categories', () => {
      const validationError = errorHandler.createAPIResponse('VALIDATION_ERROR');
      expect(validationError.statusCode).toBe(400);
      
      const authError = errorHandler.createAPIResponse('UNAUTHORIZED_ERROR');
      expect(authError.statusCode).toBe(401);
      
      const serverError = errorHandler.createAPIResponse('SERVER_ERROR');
      expect(serverError.statusCode).toBe(500);
    });

    test('should handle internal errors without failing user request', () => {
      const { response, statusCode } = errorHandler.createAPIResponse('ZAPIER_ERROR');
      
      expect(statusCode).toBe(200); // Internal error shouldn't fail user request
      expect(response.error.message).toBe('Course enrollment is processing. You will receive access details shortly.');
    });
  });

  describe('Context Sanitization', () => {
    test('should sanitize sensitive information from context', () => {
      const context = {
        email: 'user@example.com',
        password: 'secret123',
        razorpay_key_secret: 'secret_key',
        authorization: 'Bearer token123',
        normalField: 'safe_value'
      };
      
      const sanitized = errorHandler.sanitizeContext(context);
      
      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.razorpay_key_secret).toBe('[REDACTED]');
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized.normalField).toBe('safe_value');
    });

    test('should handle nested objects in context', () => {
      const context = {
        user: {
          email: 'user@example.com',
          password: 'secret'
        },
        payment: {
          amount: 1999,
          card_number: '4111111111111111'
        }
      };
      
      const sanitized = errorHandler.sanitizeContext(context);
      
      expect(sanitized.user.email).toBe('user@example.com');
      expect(sanitized.user.password).toBe('[REDACTED]');
      expect(sanitized.payment.amount).toBe(1999);
      expect(sanitized.payment.card_number).toBe('[REDACTED]');
    });
  });

  describe('Validation Error Formatting', () => {
    test('should format validation errors correctly', () => {
      const validationErrors = {
        email: 'Invalid email format',
        phone: ['Phone is required', 'Phone must be 10 digits']
      };
      
      const formatted = errorHandler.formatValidationErrors(validationErrors);
      
      expect(formatted.success).toBe(false);
      expect(formatted.error.code).toBe('VALIDATION_ERROR');
      expect(formatted.error.fields).toHaveLength(3);
      expect(formatted.error.fields[0].field).toBe('email');
      expect(formatted.error.fields[1].field).toBe('phone');
      expect(formatted.error.fields[2].field).toBe('phone');
    });
  });

  describe('Logging', () => {
    test('should log errors with proper context', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const error = new Error('Test error');
      const context = { endpoint: '/api/test', userId: '123' };
      
      errorHandler.logWithContext(error, context);
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);
      
      expect(logData.error.message).toBe('Test error');
      expect(logData.context.endpoint).toBe('/api/test');
      expect(logData.context.userId).toBe('123');
      
      consoleSpy.mockRestore();
    });

    test('should use different log levels based on severity', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // High severity error
      errorHandler.logWithContext('SERVER_ERROR', {});
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Low severity error
      errorHandler.logWithContext('ZAPIER_ERROR', {});
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Async Error Wrapping', () => {
    test('should wrap async functions and handle errors', async () => {
      const failingFunction = async () => {
        throw new Error('Async error');
      };
      
      const wrappedFunction = errorHandler.wrapAsync(failingFunction, { test: true });
      
      await expect(wrappedFunction()).rejects.toThrow('Async error');
    });

    test('should preserve successful async function results', async () => {
      const successFunction = async (value) => {
        return value * 2;
      };
      
      const wrappedFunction = errorHandler.wrapAsync(successFunction, { test: true });
      const result = await wrappedFunction(5);
      
      expect(result).toBe(10);
    });
  });

  describe('Request ID Generation', () => {
    test('should generate unique request IDs', () => {
      const id1 = errorHandler.generateRequestId();
      const id2 = errorHandler.generateRequestId();
      
      expect(id1).toMatch(/^req_\d+_[a-z0-9]{9}$/);
      expect(id2).toMatch(/^req_\d+_[a-z0-9]{9}$/);
      expect(id1).not.toBe(id2);
    });
  });
});
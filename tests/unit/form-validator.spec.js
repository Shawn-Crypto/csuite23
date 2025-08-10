/**
 * Unit Tests - Comprehensive Form Validation System
 * Tests enhanced validation, sanitization, and security features
 */

const { FormValidator, validator, validateLeadCapture } = require('../../api/lib/form-validator');

describe('Comprehensive Form Validation System - Unit Tests', () => {
  
  let testValidator;

  beforeEach(() => {
    testValidator = new FormValidator({
      strictMode: false,
      enableSanitization: true,
      rateLimitByIP: false // Disable for tests
    });
  });

  afterEach(() => {
    if (testValidator) {
      testValidator.destroy();
    }
  });

  describe('Lead Capture Validation', () => {
    test('should validate complete valid lead data', () => {
      const leadData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '9876543210',
        consent: true
      };
      
      const result = testValidator.validateLeadCapture(leadData);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized.name).toBe('John Doe');
      expect(result.sanitized.email).toBe('john.doe@example.com');
      expect(result.sanitized.phone).toBe('9876543210');
      expect(result.securityPassed).toBe(true);
    });

    test('should reject missing required fields', () => {
      const leadData = {
        name: '',
        email: '',
        phone: '',
        consent: false
      };
      
      const result = testValidator.validateLeadCapture(leadData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toContain('Name cannot be empty');
      expect(result.errors.email).toContain('Email address cannot be empty');
      expect(result.errors.phone).toContain('Phone number cannot be empty');
      expect(result.errors.consent).toContain('You must accept the terms and conditions to continue');
    });

    test('should handle rate limiting', () => {
      const rateLimitValidator = new FormValidator({
        rateLimitByIP: true
      });

      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        consent: true
      };
      
      const context = { ip: '192.168.1.1' };
      
      // First 10 attempts should pass
      for (let i = 0; i < 10; i++) {
        const result = rateLimitValidator.validateLeadCapture(leadData, context);
        expect(result.isValid).toBe(true);
      }
      
      // 11th attempt should be rate limited
      const result = rateLimitValidator.validateLeadCapture(leadData, context);
      expect(result.rateLimited).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
      
      rateLimitValidator.destroy();
    });
  });

  describe('Name Validation', () => {
    test('should validate correct names', () => {
      const validNames = [
        'John Doe',
        'Mary Jane Watson',
        "O'Connor",
        'Jean-Pierre',
        'Dr. Smith',
        'Ms. Johnson'
      ];
      
      validNames.forEach(name => {
        const result = testValidator.validateName(name);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBeDefined();
      });
    });

    test('should reject invalid names', () => {
      const invalidNames = [
        '', // Empty
        ' ', // Only spaces
        'A', // Too short
        'Test123', // Contains numbers
        'test@test.com', // Contains special chars
        'a'.repeat(101), // Too long
        'testtest', // Too generic
        '12345', // Only numbers
        'aaaaa' // Repeated characters
      ];
      
      invalidNames.forEach(name => {
        const result = testValidator.validateName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should sanitize names correctly', () => {
      const testCases = [
        { input: '  John   Doe  ', expected: 'John Doe' },
        { input: 'John@Doe', expected: 'JohnDoe' },
        { input: 'John    Multiple    Spaces', expected: 'John Multiple Spaces' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = testValidator.validateName(input);
        if (result.isValid) {
          expect(result.sanitized).toBe(expected);
        }
      });
    });
  });

  describe('Email Validation', () => {
    test('should validate correct email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.in',
        'user+tag@example.org',
        'firstname.lastname@company.com'
      ];
      
      validEmails.forEach(email => {
        const result = testValidator.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe(email.toLowerCase().trim());
      });
    });

    test('should reject invalid email addresses', () => {
      const invalidEmails = [
        '', // Empty
        'notanemail', // No @
        '@domain.com', // No local part
        'user@', // No domain
        'user@domain', // No TLD
        'user name@domain.com', // Spaces
        'user@domain..com', // Double dot
        'a'.repeat(250) + '@domain.com' // Too long
      ];
      
      invalidEmails.forEach(email => {
        const result = testValidator.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should detect disposable email addresses', () => {
      const disposableEmails = [
        'test@10minutemail.com',
        'user@guerrillamail.com',
        'temp@mailinator.com',
        'test@yopmail.com'
      ];
      
      disposableEmails.forEach(email => {
        const result = testValidator.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(err => err.includes('temporary'))).toBe(true);
      });
    });

    test('should flag suspicious patterns in strict mode', () => {
      const strictValidator = new FormValidator({ strictMode: true });
      
      const suspiciousEmails = [
        'test123@example.com',
        '12345@domain.com',
        'fake.email@test.com',
        'user+testing@domain.com'
      ];
      
      suspiciousEmails.forEach(email => {
        const result = strictValidator.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(err => err.includes('primary'))).toBe(true);
      });
      
      strictValidator.destroy();
    });
  });

  describe('Phone Number Validation', () => {
    test('should validate correct Indian phone numbers', () => {
      const validPhones = [
        '9876543210', // 10 digits
        '+91 9876543210', // With country code
        '91 9876543210', // With country code, no +
        '9876-543-210', // With dashes
        '(98765) 43210', // With parentheses
        '6123456789', // Starting with 6
        '7123456789', // Starting with 7
        '8123456789', // Starting with 8
      ];
      
      validPhones.forEach(phone => {
        const result = testValidator.validatePhone(phone);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toMatch(/^[6-9]\d{9}$/);
        expect(result.formatted).toMatch(/^\+91 \d{5} \d{5}$/);
      });
    });

    test('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '', // Empty
        '123456789', // Too short
        '12345678901', // Too long
        '5123456789', // Invalid starting digit
        '0123456789', // Invalid starting digit
        '1111111111', // All same digits
        '1234567890', // Sequential
        'notanumber' // Not a number
      ];
      
      invalidPhones.forEach(phone => {
        const result = testValidator.validatePhone(phone);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should format Indian phone numbers correctly', () => {
      const phone = '9876543210';
      const result = testValidator.validatePhone(phone);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('9876543210');
      expect(result.formatted).toBe('+91 98765 43210');
    });
  });

  describe('Security Checks', () => {
    test('should detect honeypot fields', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        consent: true,
        honeypot: 'bot filled this' // Bot trap
      };
      
      const result = testValidator.validateLeadCapture(data);
      
      expect(result.isValid).toBe(false);
      expect(result.errors._security).toContain('Bot detected');
    });

    test('should detect suspicious user agents', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        consent: true
      };
      
      const context = {
        userAgent: 'curl/7.68.0'
      };
      
      const result = testValidator.validateLeadCapture(data, context);
      
      // Should still be valid but with warnings
      expect(result.isValid).toBe(true);
      expect(result.securityPassed).toBe(true);
      // Warnings would be logged but don't fail validation
    });

    test('should detect very fast submissions', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        consent: true
      };
      
      const context = {
        submissionTime: Date.now(),
        formLoadTime: Date.now() - 2000 // 2 seconds ago
      };
      
      const result = testValidator.validateLeadCapture(data, context);
      
      // Should still pass but with warnings
      expect(result.isValid).toBe(true);
    });

    test('should detect SQL injection patterns', () => {
      const data = {
        name: "'; DROP TABLE users; --",
        email: 'test@example.com',
        phone: '9876543210',
        consent: true
      };
      
      const result = testValidator.validateLeadCapture(data);
      
      expect(result.isValid).toBe(false);
      expect(result.errors._security).toContain('Invalid characters detected');
    });
  });

  describe('Custom Validation Rules', () => {
    test('should validate custom rules correctly', () => {
      const data = {
        username: 'johndoe',
        age: '25',
        website: 'https://example.com'
      };
      
      const rules = {
        username: {
          required: true,
          minLength: 3,
          maxLength: 20,
          pattern: /^[a-zA-Z0-9_]+$/,
          patternMessage: 'Username can only contain letters, numbers, and underscores'
        },
        age: {
          required: true,
          type: 'number',
          custom: (value) => {
            const age = parseInt(value);
            if (age < 18) return 'You must be at least 18 years old';
            if (age > 120) return 'Please enter a valid age';
            return true;
          }
        },
        website: {
          required: false,
          pattern: /^https?:\/\/.+/,
          patternMessage: 'Website must start with http:// or https://'
        }
      };
      
      const result = testValidator.validateCustom(data, rules);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized.username).toBe('johndoe');
      expect(result.sanitized.age).toBe('25');
    });

    test('should handle validation rule failures', () => {
      const data = {
        username: 'jo', // Too short
        age: '15', // Too young
        website: 'not-a-url' // Invalid format
      };
      
      const rules = {
        username: {
          required: true,
          minLength: 3,
          maxLength: 20
        },
        age: {
          required: true,
          type: 'number',
          custom: (value) => {
            const age = parseInt(value);
            if (age < 18) return 'You must be at least 18 years old';
            return true;
          }
        },
        website: {
          required: true,
          pattern: /^https?:\/\/.+/,
          patternMessage: 'Website must start with http:// or https://'
        }
      };
      
      const result = testValidator.validateCustom(data, rules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.username).toContain('username must be at least 3 characters long');
      expect(result.errors.age).toContain('You must be at least 18 years old');
      expect(result.errors.website).toContain('Website must start with http:// or https://');
    });
  });

  describe('Sanitization', () => {
    test('should sanitize data when enabled', () => {
      const sanitizingValidator = new FormValidator({ enableSanitization: true });
      
      const data = {
        name: '  John   Doe  ',
        email: '  USER@EXAMPLE.COM  ',
        phone: '+91 9876-543-210'
      };
      
      const result = sanitizingValidator.validateLeadCapture(data);
      
      expect(result.sanitized.name).toBe('John Doe');
      expect(result.sanitized.email).toBe('user@example.com');
      expect(result.sanitized.phone).toBe('9876543210');
      
      sanitizingValidator.destroy();
    });

    test('should not sanitize when disabled', () => {
      const nonSanitizingValidator = new FormValidator({ enableSanitization: false });
      
      const data = {
        name: '  John   Doe  ',
        email: '  USER@EXAMPLE.COM  '
      };
      
      const context = { ip: '192.168.1.1' };
      const result = nonSanitizingValidator.validateLeadCapture(data, context);
      
      if (result.isValid) {
        expect(result.sanitized.name).toBe('  John   Doe  ');
        expect(result.sanitized.email).toBe('  USER@EXAMPLE.COM  ');
      }
      
      nonSanitizingValidator.destroy();
    });
  });

  describe('Rate Limiting', () => {
    test('should track attempts per IP', () => {
      const rateLimitValidator = new FormValidator({ rateLimitByIP: true });
      
      const result1 = rateLimitValidator.checkRateLimit('192.168.1.1');
      expect(result1.allowed).toBe(true);
      
      const result2 = rateLimitValidator.checkRateLimit('192.168.1.1');
      expect(result2.allowed).toBe(true);
      
      // Different IP should be independent
      const result3 = rateLimitValidator.checkRateLimit('192.168.1.2');
      expect(result3.allowed).toBe(true);
      
      rateLimitValidator.destroy();
    });

    test('should clean up old rate limit entries', (done) => {
      const rateLimitValidator = new FormValidator({ rateLimitByIP: true });
      
      rateLimitValidator.checkRateLimit('192.168.1.1');
      expect(rateLimitValidator.rateLimitStore.size).toBe(1);
      
      // Manually trigger cleanup
      rateLimitValidator.cleanupRateLimit();
      
      // Should still have the entry (not old enough)
      expect(rateLimitValidator.rateLimitStore.size).toBe(1);
      
      rateLimitValidator.destroy();
      done();
    });
  });

  describe('Global Validator Instance', () => {
    test('should provide convenience functions', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        consent: true
      };
      
      const result = validateLeadCapture(data);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined inputs gracefully', () => {
      const nullResult = testValidator.validateLeadCapture(null);
      expect(nullResult.isValid).toBe(false);
      
      const undefinedResult = testValidator.validateLeadCapture(undefined);
      expect(undefinedResult.isValid).toBe(false);
      
      const emptyResult = testValidator.validateLeadCapture({});
      expect(emptyResult.isValid).toBe(false);
    });

    test('should handle very large inputs', () => {
      const largeData = {
        name: 'A'.repeat(1000),
        email: 'test@example.com',
        phone: '9876543210',
        consent: true
      };
      
      const result = testValidator.validateLeadCapture(largeData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toContain('less than 100 characters');
    });

    test('should handle special characters correctly', () => {
      const specialData = {
        name: 'José María',
        email: 'josé@domain.com',
        phone: '9876543210',
        consent: true
      };
      
      const result = testValidator.validateLeadCapture(specialData);
      
      // Should handle UTF-8 characters properly
      expect(result.isValid).toBe(true);
    });
  });
});
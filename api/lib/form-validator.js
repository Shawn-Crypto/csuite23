/**
 * Comprehensive Form Validation System - Guide 2 & 4 Implementation
 * Enhanced validation with better error messages and security features
 */

class FormValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode || false,
      enableSanitization: options.enableSanitization !== false,
      maxFieldLength: options.maxFieldLength || 1000,
      rateLimitByIP: options.rateLimitByIP || true,
      ...options
    };
    
    // Rate limiting storage
    this.rateLimitStore = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupRateLimit(), 60000); // Clean every minute
  }

  /**
   * Validates lead capture form data
   * @param {Object} data - Form data to validate
   * @param {Object} context - Request context (IP, user agent, etc.)
   * @returns {Object} Validation result
   */
  validateLeadCapture(data, context = {}) {
    const errors = {};
    const sanitized = {};
    
    // Check rate limiting first
    if (this.options.rateLimitByIP && context.ip) {
      const rateLimitResult = this.checkRateLimit(context.ip);
      if (!rateLimitResult.allowed) {
        return {
          isValid: false,
          errors: { _general: 'Too many attempts. Please try again later.' },
          rateLimited: true,
          retryAfter: rateLimitResult.retryAfter
        };
      }
    }

    // Validate and sanitize name
    const nameResult = this.validateName(data.name);
    if (!nameResult.isValid) {
      errors.name = nameResult.errors;
    } else {
      sanitized.name = nameResult.sanitized;
    }

    // Validate and sanitize email
    const emailResult = this.validateEmail(data.email);
    if (!emailResult.isValid) {
      errors.email = emailResult.errors;
    } else {
      sanitized.email = emailResult.sanitized;
    }

    // Validate and sanitize phone
    const phoneResult = this.validatePhone(data.phone);
    if (!phoneResult.isValid) {
      errors.phone = phoneResult.errors;
    } else {
      sanitized.phone = phoneResult.sanitized;
    }

    // Validate consent checkbox - handle various boolean representations
    const consent = data.consent;
    if (consent === undefined || consent === null || 
        consent === false || consent === 'false' || 
        consent === 0 || consent === '0' || 
        consent === '' || consent === 'off') {
      errors.consent = ['You must accept the terms and conditions to continue'];
    }

    // Additional security checks
    const securityResult = this.performSecurityChecks(data, context);
    if (!securityResult.passed) {
      errors._security = securityResult.errors;
    }

    const isValid = Object.keys(errors).length === 0;

    return {
      isValid,
      errors,
      sanitized: isValid ? sanitized : {},
      securityPassed: securityResult.passed,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validates name field with comprehensive checks
   * @param {string} name - Name to validate
   * @returns {Object} Validation result
   */
  validateName(name) {
    const errors = [];
    
    if (!name || typeof name !== 'string') {
      errors.push('Name is required');
      return { isValid: false, errors };
    }

    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      errors.push('Name cannot be empty');
    } else if (trimmed.length < 2) {
      errors.push('Name must be at least 2 characters long');
    } else if (trimmed.length > 100) {
      errors.push('Name must be less than 100 characters');
    }

    // Check for valid name characters (letters, spaces, common punctuation)
    const namePattern = /^[a-zA-Z\s\.\'\-]+$/;
    if (!namePattern.test(trimmed)) {
      errors.push('Name can only contain letters, spaces, periods, apostrophes, and hyphens');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /(.)\1{4,}/, // Repeated characters (aaaaa)
      /^[^a-zA-Z]*$/, // No letters at all
      /(test|dummy|fake|spam|bot)/i, // Common test/spam words
      /\d{4,}/, // Long sequences of numbers
      /[@#$%^&*()+={}[\]|\\:";'<>?]/  // Special characters not allowed in names
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(trimmed)) {
        errors.push('Please enter your real name');
        break;
      }
    }

    const sanitized = this.options.enableSanitization ? this.sanitizeName(trimmed) : trimmed;
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validates email with comprehensive checks including disposable email detection
   * @param {string} email - Email to validate
   * @returns {Object} Validation result
   */
  validateEmail(email) {
    const errors = [];
    
    if (!email || typeof email !== 'string') {
      errors.push('Email address is required');
      return { isValid: false, errors };
    }

    const trimmed = email.trim().toLowerCase();
    
    if (trimmed.length === 0) {
      errors.push('Email address cannot be empty');
      return { isValid: false, errors };
    }

    // Basic email format validation
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailPattern.test(trimmed)) {
      errors.push('Please enter a valid email address');
      return { isValid: false, errors };
    }

    // Check email length
    if (trimmed.length > 254) {
      errors.push('Email address is too long');
    }

    // Check for disposable/temporary email domains
    if (this.isDisposableEmail(trimmed)) {
      errors.push('Please use a permanent email address (temporary email services are not allowed)');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /^[^@]+\+.+@/, // Plus addressing (can be legitimate but often used for testing)
      /^\d+@/, // Email starting with numbers only
      /(test|fake|dummy|spam|temp).*@/i, // Common test email patterns
      /(.)\1{3,}@/ // Repeated characters before @
    ];

    if (this.options.strictMode) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(trimmed)) {
          errors.push('Please use your primary email address');
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: trimmed
    };
  }

  /**
   * Validates Indian phone numbers with comprehensive checks
   * @param {string} phone - Phone number to validate
   * @returns {Object} Validation result
   */
  validatePhone(phone) {
    const errors = [];
    
    if (!phone || typeof phone !== 'string') {
      errors.push('Phone number is required');
      return { isValid: false, errors };
    }

    // Clean phone number (remove spaces, dashes, parentheses)
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    
    if (cleaned.length === 0) {
      errors.push('Phone number cannot be empty');
      return { isValid: false, errors };
    }

    // Remove country code if present
    let normalizedPhone = cleaned;
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      normalizedPhone = cleaned.substring(2);
    } else if (cleaned.startsWith('+91') && cleaned.length === 13) {
      normalizedPhone = cleaned.substring(3);
    }

    // Indian mobile number validation (10 digits starting with 6-9)
    const indianMobilePattern = /^[6-9]\d{9}$/;
    if (!indianMobilePattern.test(normalizedPhone)) {
      if (normalizedPhone.length !== 10) {
        errors.push('Phone number must be exactly 10 digits');
      } else if (!normalizedPhone.startsWith('6') && !normalizedPhone.startsWith('7') && 
                 !normalizedPhone.startsWith('8') && !normalizedPhone.startsWith('9')) {
        errors.push('Indian mobile numbers must start with 6, 7, 8, or 9');
      } else {
        errors.push('Please enter a valid Indian mobile number');
      }
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /^(\d)\1{9}$/, // All same digits (1111111111)
      /^(0123456789|1234567890|9876543210)$/, // Sequential numbers
      /^[0-5]\d{9}$/, // Starting with invalid digits for Indian mobiles
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(normalizedPhone)) {
        errors.push('Please enter a valid phone number');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: normalizedPhone,
      formatted: this.formatIndianPhone(normalizedPhone)
    };
  }

  /**
   * Performs additional security checks on form data
   * @param {Object} data - Form data
   * @param {Object} context - Request context
   * @returns {Object} Security check result
   */
  performSecurityChecks(data, context) {
    const errors = [];
    const warnings = [];

    // Check for honeypot fields (if present)
    if (data.honeypot && data.honeypot.trim() !== '') {
      errors.push('Bot detected');
    }

    // Check submission timing (too fast might be a bot)
    if (context.submissionTime && context.formLoadTime) {
      const timeTaken = context.submissionTime - context.formLoadTime;
      if (timeTaken < 5000) { // Less than 5 seconds
        warnings.push('Very fast submission detected');
      }
    }

    // Check for suspicious user agent patterns
    if (context.userAgent) {
      const botPatterns = [
        /bot|crawler|spider|scraper/i,
        /^(curl|wget|python-requests)/i,
        /headless/i
      ];

      for (const pattern of botPatterns) {
        if (pattern.test(context.userAgent)) {
          warnings.push('Automated access detected');
          break;
        }
      }
    }

    // Check for SQL injection patterns in all text fields
    const sqlPatterns = [
      /'.*(?:union|select|insert|update|delete|drop|create|alter).*'/i,
      /;\s*(?:drop|delete|update|insert)/i,
      /\b(?:exec|execute|sp_|xp_)\b/i
    ];

    const textFields = [data.name, data.email, data.phone];
    for (const field of textFields) {
      if (typeof field === 'string') {
        for (const pattern of sqlPatterns) {
          if (pattern.test(field)) {
            errors.push('Invalid characters detected');
            break;
          }
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Checks rate limiting for IP address
   * @param {string} ip - IP address
   * @returns {Object} Rate limit result
   */
  checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 10;

    if (!this.rateLimitStore.has(ip)) {
      this.rateLimitStore.set(ip, { attempts: 1, firstAttempt: now });
      return { allowed: true };
    }

    const record = this.rateLimitStore.get(ip);
    
    // Reset if window has passed
    if (now - record.firstAttempt > windowMs) {
      this.rateLimitStore.set(ip, { attempts: 1, firstAttempt: now });
      return { allowed: true };
    }

    // Check if over limit
    if (record.attempts >= maxAttempts) {
      const retryAfter = Math.ceil((windowMs - (now - record.firstAttempt)) / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment attempts
    record.attempts++;
    return { allowed: true };
  }

  /**
   * Cleans up old rate limit entries
   */
  cleanupRateLimit() {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;

    for (const [ip, record] of this.rateLimitStore.entries()) {
      if (now - record.firstAttempt > windowMs) {
        this.rateLimitStore.delete(ip);
      }
    }
  }

  /**
   * Checks if email domain is from a disposable email service
   * @param {string} email - Email address
   * @returns {boolean} True if disposable
   */
  isDisposableEmail(email) {
    const domain = email.split('@')[1];
    if (!domain) return false;

    // Common disposable email domains
    const disposableDomains = [
      '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'yopmail.com',
      'temp-mail.org', 'throwaway.email', 'tempmail.ninja', 'maildrop.cc',
      '20minutemail.com', 'getnada.com', 'mohmal.com', 'guerrillamailblock.com',
      'sharklasers.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
      'spam4.me', 'mailcatch.com', 'mailmetrash.com', '2prong.com'
    ];

    return disposableDomains.includes(domain.toLowerCase());
  }

  /**
   * Sanitizes name input
   * @param {string} name - Name to sanitize
   * @returns {string} Sanitized name
   */
  sanitizeName(name) {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s\.\'\-]/g, '') // Remove invalid characters
      .substring(0, 100); // Limit length
  }

  /**
   * Formats Indian phone number for display
   * @param {string} phone - 10-digit phone number
   * @returns {string} Formatted phone number
   */
  formatIndianPhone(phone) {
    if (phone && phone.length === 10) {
      return `+91 ${phone.substring(0, 5)} ${phone.substring(5)}`;
    }
    return phone;
  }

  /**
   * Validates form data with custom rules
   * @param {Object} data - Data to validate
   * @param {Object} rules - Validation rules
   * @returns {Object} Validation result
   */
  validateCustom(data, rules) {
    const errors = {};
    const sanitized = {};

    for (const [field, fieldRules] of Object.entries(rules)) {
      const value = data[field];
      const fieldErrors = [];

      // Required validation
      if (fieldRules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        fieldErrors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        // Type validation
        if (fieldRules.type) {
          if (fieldRules.type === 'email' && !this.validateEmail(value).isValid) {
            fieldErrors.push(`${field} must be a valid email address`);
          } else if (fieldRules.type === 'phone' && !this.validatePhone(value).isValid) {
            fieldErrors.push(`${field} must be a valid phone number`);
          } else if (fieldRules.type === 'number' && isNaN(Number(value))) {
            fieldErrors.push(`${field} must be a number`);
          }
        }

        // Length validation
        if (fieldRules.minLength && value.length < fieldRules.minLength) {
          fieldErrors.push(`${field} must be at least ${fieldRules.minLength} characters long`);
        }
        if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
          fieldErrors.push(`${field} must be less than ${fieldRules.maxLength} characters long`);
        }

        // Pattern validation
        if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
          fieldErrors.push(fieldRules.patternMessage || `${field} format is invalid`);
        }

        // Custom validation function
        if (fieldRules.custom && typeof fieldRules.custom === 'function') {
          const customResult = fieldRules.custom(value);
          if (customResult !== true) {
            fieldErrors.push(customResult || `${field} is invalid`);
          }
        }

        // Sanitization
        if (fieldErrors.length === 0 && this.options.enableSanitization) {
          if (fieldRules.type === 'email') {
            sanitized[field] = value.trim().toLowerCase();
          } else if (fieldRules.type === 'phone') {
            sanitized[field] = value.replace(/[\s\-\(\)\+]/g, '');
          } else if (typeof value === 'string') {
            sanitized[field] = value.trim().substring(0, fieldRules.maxLength || 1000);
          } else {
            sanitized[field] = value;
          }
        }
      }

      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Cleanup method to clear intervals
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rateLimitStore.clear();
  }
}

// Create global instance
const globalValidator = new FormValidator({
  strictMode: process.env.NODE_ENV === 'production',
  enableSanitization: true,
  rateLimitByIP: true
});

// Export both class and instance
module.exports = {
  FormValidator,
  validator: globalValidator,
  
  // Convenience functions
  validateLeadCapture: (data, context) => globalValidator.validateLeadCapture(data, context),
  validateCustom: (data, rules) => globalValidator.validateCustom(data, rules)
};
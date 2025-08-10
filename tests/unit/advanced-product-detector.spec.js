/**
 * Unit Tests - Advanced Product Detection System
 * Tests multi-strategy product detection with confidence scoring
 */

const productDetector = require('../../api/lib/product-detector');

describe('Advanced Product Detection System - Unit Tests', () => {
  
  describe('Main Detection Function', () => {
    test('should use metadata strategy with highest confidence', () => {
      const paymentData = {
        amount: 199900,
        order_id: 'order_123',
        payment_id: 'pay_456',
        metadata: {
          product_type: 'full_bundle'
        }
      };
      
      const result = productDetector.detectProducts(paymentData);
      
      expect(result.detection_method).toBe('metadata');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.products).toEqual(['course', 'database', 'strategy_call']);
      expect(result.flags.send_course_access).toBe(true);
      expect(result.flags.send_database).toBe(true);
      expect(result.flags.send_calendar_link).toBe(true);
    });

    test('should fallback to amount-based detection when metadata unavailable', () => {
      const paymentData = {
        amount: 199900,
        order_id: 'order_123',
        payment_id: 'pay_456'
      };
      
      const result = productDetector.detectProducts(paymentData);
      
      expect(result.detection_method).toBe('amount_based');
      expect(result.products).toEqual(['course']);
      expect(result.amount).toBe(1999);
    });

    test('should always return valid detection even with minimal data', () => {
      const paymentData = {
        amount: 50000 // Unusual amount
      };
      
      const result = productDetector.detectProducts(paymentData);
      
      expect(result).toBeDefined();
      expect(productDetector.validateDetection(result)).toBe(true);
      expect(result.products.length).toBeGreaterThan(0);
    });
  });

  describe('Metadata Detection Strategy', () => {
    test('should detect from explicit product_type', () => {
      const paymentData = {
        amount: 399800,
        metadata: { product_type: 'course_plus_database' }
      };
      
      const result = productDetector.detectFromMetadata(paymentData);
      
      expect(result.products).toEqual(['course', 'database']);
      expect(result.confidence).toBe(0.95);
      expect(result.detection_method).toBe('metadata');
    });

    test('should detect from products array', () => {
      const paymentData = {
        amount: 199900,
        metadata: { products: ['course', 'strategy_call'] }
      };
      
      const result = productDetector.detectFromMetadata(paymentData);
      
      expect(result.products).toEqual(['course', 'strategy_call']);
      expect(result.confidence).toBe(0.9);
    });

    test('should detect from individual flags', () => {
      const paymentData = {
        amount: 199900,
        metadata: {
          include_course: true,
          include_database: true,
          include_call: false
        }
      };
      
      const result = productDetector.detectFromMetadata(paymentData);
      
      expect(result.products).toEqual(['course', 'database']);
      expect(result.confidence).toBe(0.7);
    });

    test('should return null when no metadata available', () => {
      const paymentData = { amount: 199900 };
      
      const result = productDetector.detectFromMetadata(paymentData);
      
      expect(result).toBeNull();
    });
  });

  describe('Enhanced Amount Detection Strategy', () => {
    test('should have high confidence for exact amount matches', () => {
      const result = productDetector.detectFromAmount(199900); // ₹1999
      
      expect(result.confidence).toBe(0.85);
      expect(result.products).toEqual(['course']);
      expect(result.closest_known_amount).toBe(1999);
    });

    test('should detect full bundle for highest tier', () => {
      const result = productDetector.detectFromAmount(899700); // ₹8997
      
      expect(result.products).toEqual(['course', 'database', 'strategy_call']);
      expect(result.flags.send_course_access).toBe(true);
      expect(result.flags.send_database).toBe(true);
      expect(result.flags.send_calendar_link).toBe(true);
    });

    test('should have lower confidence for unknown amounts', () => {
      const result = productDetector.detectFromAmount(250000); // ₹2500 - between tiers
      
      expect(result.confidence).toBeLessThan(0.6);
      expect(result.closest_known_amount).toBe(1999);
    });

    test('should handle edge case amounts gracefully', () => {
      const result = productDetector.detectFromAmount(0);
      
      expect(result.products).toEqual(['unknown']);
      expect(result.flags.send_course_access).toBe(false);
    });
  });

  describe('Notes Analysis Strategy', () => {
    test('should detect products from course-related keywords', () => {
      const result = productDetector.detectFromNotes('Complete investor course with database access');
      
      expect(result.products).toContain('course');
      expect(result.products).toContain('database');
      expect(result.detection_method).toBe('notes_analysis');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect full bundle from specific phrases', () => {
      const result = productDetector.detectFromNotes('Complete bundle with everything included');
      
      expect(result.products).toEqual(['course', 'database', 'strategy_call']);
      expect(result.confidence).toBe(0.8);
    });

    test('should return null for irrelevant notes', () => {
      const result = productDetector.detectFromNotes('Random payment for something');
      
      expect(result).toBeNull();
    });

    test('should handle empty or invalid notes', () => {
      expect(productDetector.detectFromNotes(null)).toBeNull();
      expect(productDetector.detectFromNotes('')).toBeNull();
      expect(productDetector.detectFromNotes(123)).toBeNull();
    });
  });

  describe('Customer-based Detection Strategy', () => {
    test('should detect premium products for premium emails', () => {
      const customer = { email: 'user@premium.com' };
      
      const result = productDetector.detectFromCustomer(customer);
      
      expect(result.products).toContain('course');
      expect(result.products).toContain('database');
      expect(result.confidence).toBe(0.5);
    });

    test('should return basic course for regular customers', () => {
      const customer = { email: 'user@example.com' };
      
      const result = productDetector.detectFromCustomer(customer);
      
      expect(result.products).toEqual(['course']);
      expect(result.confidence).toBe(0.3);
    });

    test('should handle missing customer data', () => {
      expect(productDetector.detectFromCustomer(null)).toBeNull();
      expect(productDetector.detectFromCustomer({})).toBeDefined();
    });
  });

  describe('Fallback Detection Strategy', () => {
    test('should always return valid detection', () => {
      const result = productDetector.getFallbackDetection();
      
      expect(result.products).toEqual(['course']);
      expect(result.detection_method).toBe('fallback');
      expect(result.confidence).toBe(0.5);
      expect(result.fallback_reason).toBeDefined();
    });

    test('should work with any amount', () => {
      const result = productDetector.getFallbackDetection(999999);
      
      expect(result.amount).toBe(9999);
      expect(result.amount_paise).toBe(999999);
    });
  });

  describe('Delivery Configuration', () => {
    test('should generate comprehensive delivery config for full bundle', () => {
      const products = ['course', 'database', 'strategy_call'];
      
      const config = productDetector.getDeliveryConfiguration(products);
      
      expect(config.kajabi.course_level).toBe('vip');
      expect(config.additional.priority_support).toBe(true);
      expect(config.notifications.slack_notification).toBe(true);
      expect(config.analytics.revenue_tier).toBe('tier_3');
    });

    test('should generate config for course-only purchase', () => {
      const products = ['course'];
      
      const config = productDetector.getDeliveryConfiguration(products);
      
      expect(config.kajabi.course_level).toBe('basic');
      expect(config.additional.priority_support).toBe(false);
      expect(config.notifications.slack_notification).toBe(false);
      expect(config.analytics.revenue_tier).toBe('tier_1');
    });

    test('should calculate customer value correctly', () => {
      const singleProduct = productDetector.getDeliveryConfiguration(['course']);
      const multipleProducts = productDetector.getDeliveryConfiguration(['course', 'database', 'strategy_call']);
      
      expect(singleProduct.analytics.customer_value).toBe(1000);
      expect(multipleProducts.analytics.customer_value).toBe(3000);
    });
  });

  describe('Validation System', () => {
    test('should validate correct detection results', () => {
      const validDetection = {
        products: ['course'],
        flags: { send_course_access: true },
        detection_method: 'amount_based',
        confidence: 0.8
      };
      
      expect(productDetector.validateDetection(validDetection)).toBe(true);
    });

    test('should reject invalid detection results', () => {
      const invalidDetections = [
        null,
        {},
        { products: [] },
        { products: ['invalid_product'], flags: {}, detection_method: 'test' },
        { products: ['course'], flags: {}, detection_method: 'test', confidence: 1.5 }
      ];
      
      invalidDetections.forEach(detection => {
        expect(productDetector.validateDetection(detection)).toBe(false);
      });
    });
  });

  describe('Detection Summary', () => {
    test('should generate readable summaries', () => {
      const detection = {
        products: ['course', 'database'],
        flags: {},
        detection_method: 'metadata',
        confidence: 0.85
      };
      
      const summary = productDetector.getDetectionSummary(detection);
      
      expect(summary).toContain('Complete Indian Investor Course + Stock Database');
      expect(summary).toContain('85% confidence');
      expect(summary).toContain('via metadata');
    });

    test('should handle invalid detections gracefully', () => {
      const summary = productDetector.getDetectionSummary(null);
      
      expect(summary).toBe('Invalid detection result');
    });
  });

  describe('Integration with Real Payment Data', () => {
    test('should handle complete Razorpay webhook payload', () => {
      const razorpayPayload = {
        amount: 399800,
        order_id: 'order_MN4XhkwJJrxCgB',
        payment_id: 'pay_MN4XhkwJJrxCgB',
        currency: 'INR',
        customer: {
          email: 'customer@example.com',
          contact: '+919999999999'
        },
        notes: {
          course_type: 'premium',
          includes: 'course,database'
        },
        metadata: {
          product_type: 'course_plus_database'
        }
      };
      
      const result = productDetector.detectProducts(razorpayPayload);
      
      expect(result.detection_method).toBe('metadata');
      expect(result.products).toEqual(['course', 'database']);
      expect(result.payment_id).toBe('pay_MN4XhkwJJrxCgB');
      expect(result.order_id).toBe('order_MN4XhkwJJrxCgB');
      expect(result.detected_at).toBeDefined();
    });
  });
});
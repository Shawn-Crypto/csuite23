/**
 * Advanced Product Detection System - Guide 3 Implementation
 * Multi-strategy product identification for robust course delivery
 * Supports amount-based, metadata, and fallback detection methods
 */

/**
 * Main product detection entry point with multiple strategies
 * @param {Object} paymentData - Complete payment information
 * @returns {Object} Product detection result with confidence score
 */
function detectProducts(paymentData) {
  const strategies = [
    () => detectFromMetadata(paymentData),
    () => detectFromAmount(paymentData.amount),
    () => detectFromNotes(paymentData.notes),
    () => detectFromCustomer(paymentData.customer),
    () => getFallbackDetection(paymentData.amount)
  ];

  let bestDetection = null;
  let highestConfidence = 0;

  for (const strategy of strategies) {
    try {
      const detection = strategy();
      if (detection && detection.confidence > highestConfidence) {
        bestDetection = detection;
        highestConfidence = detection.confidence;
      }
      
      // If we have high confidence, use it immediately
      if (detection && detection.confidence >= 0.9) {
        break;
      }
    } catch (error) {
      console.warn('Product detection strategy failed:', error.message);
    }
  }

  // Ensure we always return a valid result
  if (!bestDetection || !validateDetection(bestDetection)) {
    bestDetection = getFallbackDetection(paymentData.amount || 199900);
  }

  // Add metadata and timestamps
  bestDetection.detected_at = new Date().toISOString();
  bestDetection.payment_id = paymentData.payment_id;
  bestDetection.order_id = paymentData.order_id;
  
  return bestDetection;
}

/**
 * Strategy 1: Detect from Razorpay order metadata
 * @param {Object} paymentData - Payment information with metadata
 * @returns {Object} Detection result
 */
function detectFromMetadata(paymentData) {
  if (!paymentData.order_metadata && !paymentData.metadata) {
    return null;
  }

  const metadata = paymentData.order_metadata || paymentData.metadata || {};
  
  // Look for explicit product identifiers in metadata
  const productMap = {
    'complete_course': ['course'],
    'course_plus_database': ['course', 'database'],
    'course_plus_call': ['course', 'strategy_call'],
    'full_bundle': ['course', 'database', 'strategy_call'],
    'course_basic': ['course'],
    'course_premium': ['course', 'database'],
    'course_vip': ['course', 'database', 'strategy_call']
  };

  let detectedProducts = [];
  let confidence = 0;

  // Check for direct product specification
  if (metadata.product_type && productMap[metadata.product_type]) {
    detectedProducts = productMap[metadata.product_type];
    confidence = 0.95;
  }
  // Check for product array
  else if (metadata.products && Array.isArray(metadata.products)) {
    detectedProducts = metadata.products;
    confidence = 0.9;
  }
  // Check for individual product flags
  else {
    if (metadata.include_course !== false) detectedProducts.push('course');
    if (metadata.include_database === true) detectedProducts.push('database');
    if (metadata.include_call === true) detectedProducts.push('strategy_call');
    confidence = detectedProducts.length > 0 ? 0.7 : 0;
  }

  if (detectedProducts.length === 0) {
    return null;
  }

  return {
    products: detectedProducts,
    flags: generateDeliveryFlags(detectedProducts),
    amount: Math.round((paymentData.amount || 0) / 100),
    amount_paise: paymentData.amount || 0,
    detection_method: 'metadata',
    confidence,
    metadata_used: metadata
  };
}

/**
 * Strategy 2: Enhanced amount-based detection with confidence scoring
 * @param {number} amount - Payment amount in paise (Razorpay format)
 * @returns {Object} Product detection result
 */
function detectFromAmount(amount) {
  // Convert from paise to rupees
  const amountInRupees = Math.round(amount / 100);
  
  const products = [];
  const flags = {
    send_course_access: false,
    send_database: false,
    send_calendar_link: false
  };

  // Product detection based on amount tiers
  if (amountInRupees >= 8997) {
    // Full bundle: Course + Database + Strategy Call
    products.push('course', 'database', 'strategy_call');
    flags.send_course_access = true;
    flags.send_database = true;
    flags.send_calendar_link = true;
  } else if (amountInRupees >= 6498) {
    // Course + Strategy Call
    products.push('course', 'strategy_call');
    flags.send_course_access = true;
    flags.send_database = false;
    flags.send_calendar_link = true;
  } else if (amountInRupees >= 3998) {
    // Course + Database  
    products.push('course', 'database');
    flags.send_course_access = true;
    flags.send_database = true;
    flags.send_calendar_link = false;
  } else if (amountInRupees >= 1499) {
    // Course only (current main offering at ₹1999)
    products.push('course');
    flags.send_course_access = true;
    flags.send_database = false;
    flags.send_calendar_link = false;
  } else {
    // Unknown amount - log and provide minimal access
    console.warn(`Unknown payment amount: ₹${amountInRupees}`);
    products.push('unknown');
    flags.send_course_access = false;
    flags.send_database = false;
    flags.send_calendar_link = false;
  }

  // Calculate confidence based on how well amount matches known tiers
  let confidence = 0.6; // Base confidence for amount detection
  
  const knownAmounts = [1999, 3998, 6498, 8997]; // Known price points
  const closestAmount = knownAmounts.reduce((prev, curr) => 
    Math.abs(curr - amountInRupees) < Math.abs(prev - amountInRupees) ? curr : prev
  );
  
  // Higher confidence for exact matches
  if (knownAmounts.includes(amountInRupees)) {
    confidence = 0.85;
  }
  // Lower confidence if amount is far from known tiers
  else if (Math.abs(amountInRupees - closestAmount) > 500) {
    confidence = 0.4;
  }

  return {
    products,
    flags,
    amount: amountInRupees,
    amount_paise: amount,
    detection_method: 'amount_based',
    confidence,
    closest_known_amount: closestAmount
  };
}

/**
 * Strategy 3: Detect from payment notes or descriptions
 * @param {string} notes - Payment notes or description
 * @returns {Object} Detection result
 */
function detectFromNotes(notes) {
  if (!notes || typeof notes !== 'string') {
    return null;
  }

  const normalizedNotes = notes.toLowerCase().trim();
  let detectedProducts = [];
  let confidence = 0;

  // Look for specific keywords in notes
  const keywords = {
    course: ['course', 'training', 'education', 'learn', 'investor'],
    database: ['database', 'data', 'spreadsheet', 'excel', 'stocks'],
    strategy_call: ['call', 'consultation', 'strategy', 'session', '1-on-1']
  };

  Object.entries(keywords).forEach(([product, terms]) => {
    if (terms.some(term => normalizedNotes.includes(term))) {
      detectedProducts.push(product);
    }
  });

  // Special combinations
  if (normalizedNotes.includes('complete') && normalizedNotes.includes('bundle')) {
    detectedProducts = ['course', 'database', 'strategy_call'];
    confidence = 0.8;
  }
  else if (detectedProducts.length > 0) {
    confidence = Math.min(0.75, 0.4 + (detectedProducts.length * 0.15));
  }

  if (detectedProducts.length === 0) {
    return null;
  }

  return {
    products: detectedProducts,
    flags: generateDeliveryFlags(detectedProducts),
    detection_method: 'notes_analysis',
    confidence,
    notes_analyzed: normalizedNotes
  };
}

/**
 * Strategy 4: Detect based on customer information
 * @param {Object} customer - Customer information
 * @returns {Object} Detection result
 */
function detectFromCustomer(customer) {
  if (!customer || typeof customer !== 'object') {
    return null;
  }

  // Check if customer has specific preferences or history
  let detectedProducts = ['course']; // Default to course
  let confidence = 0.3; // Low confidence without more data

  // This could be enhanced with customer history from database
  // For now, provide basic detection
  if (customer.email && customer.email.includes('premium')) {
    detectedProducts.push('database');
    confidence = 0.5;
  }

  return {
    products: detectedProducts,
    flags: generateDeliveryFlags(detectedProducts),
    detection_method: 'customer_based',
    confidence,
    customer_email: customer.email
  };
}

/**
 * Strategy 5: Fallback detection when all else fails
 * @param {number} amount - Payment amount in paise
 * @returns {Object} Guaranteed detection result
 */
function getFallbackDetection(amount = 199900) {
  // Always provide course access as minimum
  const detectedProducts = ['course'];
  
  return {
    products: detectedProducts,
    flags: generateDeliveryFlags(detectedProducts),
    amount: Math.round(amount / 100),
    amount_paise: amount,
    detection_method: 'fallback',
    confidence: 0.5,
    fallback_reason: 'No other detection method succeeded'
  };
}

/**
 * Generate delivery flags based on detected products
 * @param {Array} products - Array of detected products
 * @returns {Object} Delivery flags
 */
function generateDeliveryFlags(products) {
  return {
    send_course_access: products.includes('course'),
    send_database: products.includes('database'),
    send_calendar_link: products.includes('strategy_call'),
    send_welcome_email: products.includes('course'),
    send_bonus_materials: products.includes('database') || products.includes('strategy_call')
  };
}

/**
 * Get comprehensive delivery configuration based on detected products
 * @param {Array} products - Array of detected products
 * @returns {Object} Complete delivery configuration
 */
function getDeliveryConfiguration(products) {
  const hasDatabase = products.includes('database');
  const hasStrategyCall = products.includes('strategy_call');
  const hasCourse = products.includes('course');

  const deliveryConfig = {
    kajabi: {
      grant_course_access: hasCourse,
      send_welcome_email: hasCourse,
      add_to_course: 'complete-indian-investor',
      course_level: hasDatabase && hasStrategyCall ? 'vip' : hasDatabase ? 'premium' : 'basic'
    },
    additional: {
      send_database: hasDatabase,
      send_calendar_link: hasStrategyCall,
      send_bonus_materials: hasDatabase || hasStrategyCall,
      priority_support: hasStrategyCall
    },
    notifications: {
      admin_notification: true,
      customer_confirmation: true,
      slack_notification: hasStrategyCall, // VIP customers get Slack notification
      email_sequence: hasCourse ? 'investor_course' : 'basic'
    },
    analytics: {
      revenue_tier: hasDatabase && hasStrategyCall ? 'tier_3' : hasDatabase ? 'tier_2' : 'tier_1',
      customer_value: products.length * 1000, // Rough LTV calculation
      track_conversion: true
    }
  };

  return deliveryConfig;
}

/**
 * Validate product detection result with comprehensive checks
 * @param {Object} detection - Product detection result
 * @returns {boolean} Whether detection is valid
 */
function validateDetection(detection) {
  if (!detection || typeof detection !== 'object') {
    return false;
  }

  // Required fields validation
  const requiredFields = ['products', 'flags', 'detection_method'];
  for (const field of requiredFields) {
    if (!(field in detection)) {
      console.warn(`Missing required field in detection: ${field}`);
      return false;
    }
  }

  // Products validation
  if (!Array.isArray(detection.products) || detection.products.length === 0) {
    console.warn('Detection products must be non-empty array');
    return false;
  }

  // Valid product types
  const validProducts = ['course', 'database', 'strategy_call', 'unknown'];
  const invalidProducts = detection.products.filter(p => !validProducts.includes(p));
  if (invalidProducts.length > 0) {
    console.warn(`Invalid products detected: ${invalidProducts.join(', ')}`);
    return false;
  }

  // Flags validation
  if (!detection.flags || typeof detection.flags !== 'object') {
    console.warn('Detection flags must be an object');
    return false;
  }

  // Confidence validation
  if ('confidence' in detection) {
    if (typeof detection.confidence !== 'number' || detection.confidence < 0 || detection.confidence > 1) {
      console.warn(`Invalid confidence score: ${detection.confidence}`);
      return false;
    }
  }

  return true;
}

/**
 * Get human-readable detection summary
 * @param {Object} detection - Product detection result
 * @returns {string} Summary description
 */
function getDetectionSummary(detection) {
  if (!detection || !validateDetection(detection)) {
    return 'Invalid detection result';
  }

  const productNames = {
    course: 'Complete Indian Investor Course',
    database: 'Stock Database',
    strategy_call: 'Strategy Call',
    unknown: 'Unknown Product'
  };

  const products = detection.products.map(p => productNames[p] || p).join(' + ');
  const confidence = detection.confidence ? ` (${Math.round(detection.confidence * 100)}% confidence)` : '';
  const method = detection.detection_method ? ` via ${detection.detection_method}` : '';

  return `${products}${confidence}${method}`;
}

module.exports = {
  // Main detection function
  detectProducts,
  
  // Individual strategies (for testing and debugging)
  detectFromAmount,
  detectFromMetadata,
  detectFromNotes,
  detectFromCustomer,
  getFallbackDetection,
  
  // Utility functions
  generateDeliveryFlags,
  getDeliveryConfiguration,
  validateDetection,
  getDetectionSummary,
  
  // Legacy support
  getDeliveryFlags: getDeliveryConfiguration
};
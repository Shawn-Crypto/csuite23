/**
 * Enhanced GTM Integration - LFG Ventures Best Practices Implementation
 * 
 * Based on the comprehensive playbook from LFG Ventures success:
 * - Single Source of Truth for each event
 * - Robust event deduplication with event_id
 * - Full-funnel tracking with standardized events
 * - Advanced custom variables with race condition prevention
 */

class GTMEnhanced {
  constructor() {
    this.eventQueue = [];
    this.sentEvents = new Set();
    this.initialized = false;
    this.debugMode = window.location.hostname === 'localhost' || 
                    window.location.search.includes('gtm_debug=1');
    
    // Standard event names - Meta's preferred format
    this.standardEvents = {
      VIEW_CONTENT: 'ViewContent',
      ADD_TO_CART: 'AddToCart', 
      INITIATE_CHECKOUT: 'InitiateCheckout',
      PURCHASE: 'Purchase',
      LEAD: 'Lead'
    };
    
    // Initialize immediately
    this.init();
  }

  /**
   * Initialize GTM Enhanced with master data layer reference
   */
  init() {
    if (this.initialized) return;
    
    // Create master data layer variable reference (prevents GTM race conditions)
    this.masterDataLayerRef = window.dataLayer || [];
    window.dataLayer = this.masterDataLayerRef;
    
    // Set up enhanced data layer push with deduplication
    this.enhanceDataLayerPush();
    
    // Process any queued events
    this.processEventQueue();
    
    this.initialized = true;
    this.log('GTM Enhanced initialized with deduplication and best practices');
  }

  /**
   * Enhanced dataLayer.push with automatic deduplication and validation
   */
  enhanceDataLayerPush() {
    const originalPush = this.masterDataLayerRef.push.bind(this.masterDataLayerRef);
    const self = this;
    
    this.masterDataLayerRef.push = function(eventData) {
      // Validate and enhance event data
      if (eventData && typeof eventData === 'object' && eventData.event) {
        const enhancedEvent = self.enhanceEvent(eventData);
        
        // Check for deduplication
        if (enhancedEvent.event_id && self.sentEvents.has(enhancedEvent.event_id)) {
          self.log('Prevented duplicate event:', enhancedEvent.event_id);
          return;
        }
        
        // Mark as sent if has event_id
        if (enhancedEvent.event_id) {
          self.sentEvents.add(enhancedEvent.event_id);
        }
        
        // Log enhanced event
        self.log('Sending enhanced event:', enhancedEvent);
        
        return originalPush(enhancedEvent);
      }
      
      return originalPush(eventData);
    };
  }

  /**
   * Enhance event data with best practices
   */
  enhanceEvent(eventData) {
    const enhanced = { ...eventData };
    
    // Add event_id if missing (critical for deduplication)
    if (!enhanced.event_id) {
      enhanced.event_id = this.generateEventId(enhanced.event);
    }
    
    // Standardize event names
    if (this.standardEvents[enhanced.event.toUpperCase()]) {
      enhanced.event = this.standardEvents[enhanced.event.toUpperCase()];
    }
    
    // Add consistent timestamp
    enhanced.event_timestamp = new Date().toISOString();
    
    // Add session information
    enhanced.session_id = this.getSessionId();
    
    // Enhance ecommerce data structure
    if (enhanced.ecommerce) {
      enhanced.ecommerce = this.enhanceEcommerceData(enhanced.ecommerce);
    }
    
    // Add user context
    enhanced.user_context = this.getUserContext();
    
    return enhanced;
  }

  /**
   * Enhanced ecommerce data with consistent formatting
   */
  enhanceEcommerceData(ecommerce) {
    const enhanced = { ...ecommerce };
    
    // Ensure transaction_id is present and consistent
    if (!enhanced.transaction_id && enhanced.order_id) {
      enhanced.transaction_id = enhanced.order_id;
    }
    
    // Standardize currency
    enhanced.currency = enhanced.currency || 'INR';
    
    // Enhance items array
    if (enhanced.items && Array.isArray(enhanced.items)) {
      enhanced.items = enhanced.items.map(item => ({
        item_id: item.item_id || 'complete_indian_investor',
        item_name: item.item_name || 'The Complete Indian Investor Course',
        price: item.price || item.value || 1999,
        quantity: item.quantity || 1,
        item_category: item.item_category || 'Education',
        ...item
      }));
    } else if (!enhanced.items) {
      // Add default item if missing
      enhanced.items = [{
        item_id: 'complete_indian_investor',
        item_name: 'The Complete Indian Investor Course',
        price: enhanced.value || 1999,
        quantity: 1,
        item_category: 'Education'
      }];
    }
    
    return enhanced;
  }

  /**
   * Get user context for enhanced tracking
   */
  getUserContext() {
    return {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Track ViewContent event with enhanced data
   */
  trackViewContent(contentData = {}) {
    const eventId = this.generateEventId('view_content');
    
    this.masterDataLayerRef.push({
      event: 'ViewContent',
      event_id: eventId,
      content_name: contentData.content_name || 'The Complete Indian Investor Course',
      content_category: contentData.content_category || 'Education',
      content_ids: contentData.content_ids || ['complete_indian_investor'],
      value: contentData.value || 1999,
      currency: 'INR'
    });
  }

  /**
   * Track Lead event with comprehensive data
   */
  trackLead(leadData) {
    const eventId = leadData.event_id || this.generateEventId('lead');
    
    this.masterDataLayerRef.push({
      event: 'Lead',
      event_id: eventId,
      lead_source: leadData.source || 'website',
      content_name: 'The Complete Indian Investor Course',
      content_category: 'Education',
      value: 1999,
      currency: 'INR',
      user_data: {
        email: leadData.email,
        phone: leadData.phone,
        first_name: leadData.name?.split(' ')[0],
        last_name: leadData.name?.split(' ').slice(1).join(' ')
      }
    });
  }

  /**
   * Track InitiateCheckout with proper deduplication
   */
  trackInitiateCheckout(checkoutData = {}) {
    const eventId = checkoutData.event_id || this.generateEventId('initiate_checkout');
    
    this.masterDataLayerRef.push({
      event: 'InitiateCheckout',
      event_id: eventId,
      checkout_trigger: checkoutData.trigger || 'button_click',
      ecommerce: {
        currency: 'INR',
        value: checkoutData.value || 1999,
        items: [{
          item_id: 'complete_indian_investor',
          item_name: 'The Complete Indian Investor Course',
          price: checkoutData.value || 1999,
          quantity: 1,
          item_category: 'Education'
        }]
      }
    });
  }

  /**
   * Track Purchase with comprehensive ecommerce data
   */
  trackPurchase(purchaseData) {
    const eventId = purchaseData.event_id || 
                   purchaseData.transaction_id || 
                   this.generateEventId('purchase');
    
    this.masterDataLayerRef.push({
      event: 'Purchase',
      event_id: eventId,
      ecommerce: {
        transaction_id: purchaseData.transaction_id || eventId,
        value: purchaseData.value || 1999,
        currency: 'INR',
        payment_type: purchaseData.payment_type || 'razorpay',
        items: [{
          item_id: 'complete_indian_investor',
          item_name: 'The Complete Indian Investor Course',
          price: purchaseData.value || 1999,
          quantity: 1,
          item_category: 'Education'
        }]
      },
      purchase_details: {
        payment_id: purchaseData.payment_id,
        order_id: purchaseData.order_id,
        payment_method: purchaseData.payment_method
      }
    });
  }

  /**
   * Generate consistent event IDs
   */
  generateEventId(eventType) {
    return `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get or create session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('gtm_enhanced_session');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('gtm_enhanced_session', sessionId);
    }
    return sessionId;
  }

  /**
   * Process queued events
   */
  processEventQueue() {
    while (this.eventQueue.length > 0) {
      const eventData = this.eventQueue.shift();
      this.masterDataLayerRef.push(eventData);
    }
  }

  /**
   * Manual event triggering for testing
   */
  triggerEvent(eventType, eventData = {}) {
    switch(eventType.toLowerCase()) {
      case 'viewcontent':
        this.trackViewContent(eventData);
        break;
      case 'lead':
        this.trackLead(eventData);
        break;
      case 'initiatecheckout':
        this.trackInitiateCheckout(eventData);
        break;
      case 'purchase':
        this.trackPurchase(eventData);
        break;
      default:
        this.log('Unknown event type:', eventType);
    }
  }

  /**
   * Debug logging
   */
  log(...args) {
    if (this.debugMode) {
      console.log('[GTM_ENHANCED]', ...args);
    }
  }

  /**
   * Get deduplication status
   */
  getDeduplicationStatus() {
    return {
      total_events_sent: this.sentEvents.size,
      unique_events: Array.from(this.sentEvents),
      session_id: this.getSessionId()
    };
  }
}

// Initialize GTM Enhanced
let gtmEnhanced;

// Initialize when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    gtmEnhanced = new GTMEnhanced();
  });
} else {
  gtmEnhanced = new GTMEnhanced();
}

// Expose for global access and testing
window.gtmEnhanced = gtmEnhanced;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GTMEnhanced;
}
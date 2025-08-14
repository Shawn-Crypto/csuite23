/**
 * Enhanced Analytics Implementation - LFG Ventures Gold Standard
 * 
 * Based on the production implementation that achieved:
 * - Complete Enhanced Ecommerce tracking
 * - Perfect event attribution  
 * - Full funnel visibility
 * - Zero data loss
 * 
 * Integrates with GTM container: GTM-M3JWN37C
 */

window.AnalyticsEnhanced = {
    // Configuration
    initialized: false,
    debugMode: window.location.hostname === 'localhost' || window.location.search.includes('analytics_debug=1'),
    eventQueue: [],
    sentEvents: new Set(),
    
    // GA4 Configuration - Update these for your property
    ga4Config: {
        measurement_id: 'G-XXXXXXXXXX', // Replace with your GA4 Measurement ID
        property_id: '491307873', // Your GA4 Property ID (from gold standard)
        account_id: '356907138', // Your GA4 Account ID (from gold standard)
        currency: 'INR',
        country: 'IN'
    },
    
    /**
     * Initialize Enhanced Analytics
     */
    init: function() {
        if (this.initialized) {
            this.log('Analytics Enhanced already initialized');
            return;
        }
        
        // Ensure dataLayer exists
        window.dataLayer = window.dataLayer || [];
        
        // Initialize enhanced data layer with proper structure
        this.initializeDataLayer();
        
        // Process any queued events
        this.processEventQueue();
        
        // Set up automatic event detection
        this.setupEventDetection();
        
        this.initialized = true;
        this.log('✅ Analytics Enhanced initialized with gold standard configuration');
    },
    
    /**
     * Initialize data layer with enhanced ecommerce structure
     */
    initializeDataLayer: function() {
        // Clear any existing ecommerce data
        dataLayer.push({ ecommerce: null });
        
        // Set up enhanced configuration
        dataLayer.push({
            'event': 'analytics_enhanced_init',
            'analytics_config': {
                'currency': this.ga4Config.currency,
                'country': this.ga4Config.country,
                'site_name': 'LotusLion - Complete Indian Investor',
                'content_group1': 'Education',
                'content_group2': 'Investment Course'
            }
        });
        
        this.log('Data layer initialized with enhanced configuration');
    },
    
    /**
     * Track Purchase Event - Gold Standard Enhanced Ecommerce
     */
    trackPurchase: function(data) {
        if (!data.order_id) {
            console.error('AnalyticsEnhanced: order_id is required for purchase tracking');
            return;
        }
        
        // Gold standard event ID format - MUST match Meta Pixel
        const eventId = `purchase_${data.order_id}`;
        
        // Check for duplicates
        if (this.sentEvents.has(eventId)) {
            this.log('Purchase event already sent:', eventId);
            return;
        }
        
        const amount = parseFloat(data.value || data.amount || 1999);
        
        // Enhanced Ecommerce Purchase Event - LFG Ventures Format
        const purchaseEvent = {
            'event': 'purchase',
            'event_id': eventId, // CRITICAL for deduplication
            'transaction_id': data.order_id,
            'value': amount,
            'currency': data.currency || 'INR',
            'ecommerce': {
                'transaction_id': data.order_id,
                'value': amount,
                'currency': data.currency || 'INR',
                'items': [
                    {
                        'item_id': data.item_id || 'complete-indian-investor',
                        'item_name': data.item_name || 'The Complete Indian Investor',
                        'item_category': data.item_category || 'Course',
                        'item_category2': data.item_category2 || 'Investment Education',
                        'price': amount,
                        'quantity': data.quantity || 1
                    }
                ]
            },
            // Additional tracking data
            'user_data': this.getUserData(),
            'page_data': this.getPageData()
        };
        
        // Push to data layer
        dataLayer.push({ ecommerce: null }); // Clear previous ecommerce data
        dataLayer.push(purchaseEvent);
        
        this.sentEvents.add(eventId);
        this.log('✅ Purchase tracked with enhanced ecommerce:', eventId, purchaseEvent);
    },
    
    /**
     * Track InitiateCheckout Event
     */
    trackInitiateCheckout: function(data) {
        const sessionId = this.getSessionId();
        const eventId = `checkout_${sessionId}_${Date.now()}`;
        
        if (this.sentEvents.has(eventId)) {
            this.log('InitiateCheckout event already sent:', eventId);
            return;
        }
        
        const amount = parseFloat(data.value || data.amount || 1999);
        
        const checkoutEvent = {
            'event': 'begin_checkout',
            'event_id': eventId,
            'currency': data.currency || 'INR',
            'value': amount,
            'ecommerce': {
                'currency': data.currency || 'INR',
                'value': amount,
                'items': [
                    {
                        'item_id': data.item_id || 'complete-indian-investor',
                        'item_name': data.item_name || 'The Complete Indian Investor',
                        'item_category': 'Course',
                        'price': amount,
                        'quantity': 1
                    }
                ]
            }
        };
        
        dataLayer.push({ ecommerce: null });
        dataLayer.push(checkoutEvent);
        
        this.sentEvents.add(eventId);
        this.log('✅ InitiateCheckout tracked:', eventId);
    },
    
    /**
     * Track Lead Event - Enhanced lead capture
     */
    trackLead: function(data) {
        const leadId = data.lead_id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const eventId = `lead_${leadId}`;
        
        if (this.sentEvents.has(eventId)) {
            this.log('Lead event already sent:', eventId);
            return;
        }
        
        const leadEvent = {
            'event': 'generate_lead',
            'event_id': eventId,
            'currency': 'INR',
            'value': parseFloat(data.value || 0),
            'lead_data': {
                'lead_id': leadId,
                'form_name': data.form_name || 'Lead Capture Modal',
                'content_group': 'Lead Generation',
                'method': data.method || 'form_submission'
            },
            'user_data': this.getUserData()
        };
        
        dataLayer.push(leadEvent);
        
        this.sentEvents.add(eventId);
        this.log('✅ Lead tracked:', eventId);
    },
    
    /**
     * Track ViewContent Event
     */
    trackViewContent: function(data) {
        const contentId = data.content_id || 'course_landing_page';
        const eventId = `view_content_${contentId}_${Date.now()}`;
        
        if (this.sentEvents.has(eventId)) {
            this.log('ViewContent event already sent:', eventId);
            return;
        }
        
        const viewEvent = {
            'event': 'view_item',
            'event_id': eventId,
            'currency': 'INR',
            'value': parseFloat(data.value || 1999),
            'ecommerce': {
                'currency': 'INR',
                'value': parseFloat(data.value || 1999),
                'items': [
                    {
                        'item_id': data.item_id || 'complete-indian-investor',
                        'item_name': data.item_name || 'The Complete Indian Investor',
                        'item_category': 'Course',
                        'price': parseFloat(data.value || 1999),
                        'quantity': 1
                    }
                ]
            }
        };
        
        dataLayer.push({ ecommerce: null });
        dataLayer.push(viewEvent);
        
        this.sentEvents.add(eventId);
        this.log('✅ ViewContent tracked:', eventId);
    },
    
    /**
     * Track Custom Event with enhanced data
     */
    trackCustomEvent: function(eventName, data) {
        const eventId = data.event_id || `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (this.sentEvents.has(eventId)) {
            this.log('Custom event already sent:', eventId);
            return;
        }
        
        const customEvent = {
            'event': eventName,
            'event_id': eventId,
            'event_category': data.category || 'engagement',
            'event_label': data.label || '',
            'value': parseFloat(data.value || 0),
            'custom_parameters': data.custom_parameters || {},
            'user_data': this.getUserData(),
            'page_data': this.getPageData()
        };
        
        dataLayer.push(customEvent);
        
        this.sentEvents.add(eventId);
        this.log('✅ Custom event tracked:', eventName, eventId);
    },
    
    /**
     * Get user data for enhanced tracking
     */
    getUserData: function() {
        return {
            'user_id': localStorage.getItem('user_id') || null,
            'email': localStorage.getItem('user_email') || null,
            'phone': localStorage.getItem('user_phone') || null,
            'name': localStorage.getItem('user_name') || null,
            'session_id': this.getSessionId(),
            'timestamp': new Date().toISOString()
        };
    },
    
    /**
     * Get page data for context
     */
    getPageData: function() {
        return {
            'page_title': document.title,
            'page_location': window.location.href,
            'page_path': window.location.pathname,
            'referrer': document.referrer || null,
            'user_agent': navigator.userAgent,
            'language': navigator.language,
            'screen_resolution': `${screen.width}x${screen.height}`,
            'viewport_size': `${window.innerWidth}x${window.innerHeight}`
        };
    },
    
    /**
     * Get or create session ID
     */
    getSessionId: function() {
        let sessionId = sessionStorage.getItem('analytics_session');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('analytics_session', sessionId);
        }
        return sessionId;
    },
    
    /**
     * Process queued events
     */
    processEventQueue: function() {
        while (this.eventQueue.length > 0) {
            const { method, args } = this.eventQueue.shift();
            this[method].apply(this, args);
        }
    },
    
    /**
     * Set up automatic event detection
     */
    setupEventDetection: function() {
        // Track scroll depth
        this.setupScrollTracking();
        
        // Track time on page
        this.setupTimeTracking();
        
        // Track engagement events
        this.setupEngagementTracking();
        
        // Detect payment success
        if (window.location.pathname.includes('success') ||
            window.location.search.includes('success')) {
            this.handlePaymentSuccess();
        }
    },
    
    /**
     * Set up scroll depth tracking
     */
    setupScrollTracking: function() {
        let maxScroll = 0;
        const milestones = [25, 50, 75, 90, 100];
        const triggered = new Set();
        
        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
            
            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
                
                milestones.forEach(milestone => {
                    if (scrollPercent >= milestone && !triggered.has(milestone)) {
                        triggered.add(milestone);
                        
                        this.trackCustomEvent('scroll_depth', {
                            category: 'engagement',
                            label: `${milestone}%`,
                            value: milestone
                        });
                    }
                });
            }
        });
    },
    
    /**
     * Set up time on page tracking
     */
    setupTimeTracking: function() {
        const startTime = Date.now();
        const milestones = [30, 60, 120, 300, 600]; // seconds
        const triggered = new Set();
        
        setInterval(() => {
            const timeOnPage = Math.round((Date.now() - startTime) / 1000);
            
            milestones.forEach(milestone => {
                if (timeOnPage >= milestone && !triggered.has(milestone)) {
                    triggered.add(milestone);
                    
                    this.trackCustomEvent('time_on_page', {
                        category: 'engagement',
                        label: `${milestone}s`,
                        value: milestone
                    });
                }
            });
        }, 5000);
    },
    
    /**
     * Set up engagement tracking
     */
    setupEngagementTracking: function() {
        // Track CTA clicks
        document.addEventListener('click', (event) => {
            const target = event.target;
            
            if (target.matches('button, .cta-button, .btn, a[href*="payment"], a[href*="checkout"]')) {
                this.trackCustomEvent('cta_click', {
                    category: 'engagement',
                    label: target.textContent?.trim() || 'CTA Button',
                    custom_parameters: {
                        button_text: target.textContent?.trim(),
                        button_href: target.href || null,
                        button_position: this.getElementPosition(target)
                    }
                });
            }
        });
        
        // Track form interactions
        document.addEventListener('focus', (event) => {
            if (event.target.matches('input, textarea, select')) {
                this.trackCustomEvent('form_interaction', {
                    category: 'engagement',
                    label: event.target.name || event.target.placeholder || 'form_field',
                    custom_parameters: {
                        field_type: event.target.type,
                        form_name: event.target.closest('form')?.id || 'unnamed_form'
                    }
                });
            }
        }, true);
    },
    
    /**
     * Handle payment success detection
     */
    handlePaymentSuccess: function() {
        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const paymentId = urlParams.get('razorpay_payment_id') || urlParams.get('payment_id');
            const orderId = urlParams.get('razorpay_order_id') || urlParams.get('order_id');
            
            if (orderId || paymentId) {
                this.trackPurchase({
                    order_id: orderId || paymentId,
                    value: 1999,
                    currency: 'INR',
                    item_name: 'The Complete Indian Investor'
                });
            }
        }, 1000);
    },
    
    /**
     * Get element position for tracking
     */
    getElementPosition: function(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    },
    
    /**
     * Debug logging
     */
    log: function(...args) {
        if (this.debugMode) {
            console.log('[ANALYTICS_ENHANCED]', ...args);
        }
    },
    
    /**
     * Manual event triggering for testing
     */
    triggerEvent: function(eventType, eventData = {}) {
        switch(eventType) {
            case 'purchase':
                this.trackPurchase({
                    order_id: eventData.order_id || 'manual_test_' + Date.now(),
                    value: eventData.value || 1999,
                    currency: 'INR'
                });
                break;
            case 'lead':
                this.trackLead({
                    lead_id: eventData.lead_id || 'manual_test_' + Date.now()
                });
                break;
            case 'checkout':
                this.trackInitiateCheckout(eventData);
                break;
            case 'view_content':
                this.trackViewContent(eventData);
                break;
            default:
                this.trackCustomEvent(eventType, eventData);
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.AnalyticsEnhanced.init();
    });
} else {
    window.AnalyticsEnhanced.init();
}

// Expose for manual triggering and debugging
window.triggerAnalyticsEvent = function(eventType, eventData) {
    window.AnalyticsEnhanced.triggerEvent(eventType, eventData);
};

console.log('✅ Analytics Enhanced loaded - LFG Ventures Gold Standard Implementation');
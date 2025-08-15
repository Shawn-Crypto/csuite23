/**
 * Meta Pixel Direct Implementation - Guide Compliant
 * 
 * Based on META-PIXEL-IMPLEMENTATION-GUIDE.md requirements:
 * - Standard fbq('track', ...) calls only
 * - Proper error handling
 * - Consistent event ID formats for deduplication
 * - No GTM dependencies
 */

class MetaPixelDirect {
    constructor() {
        this.pixelId = '726737740336667';
        this.initialized = false;
        this.eventQueue = [];
        this.sentEvents = new Set();
        this.debugMode = window.location.hostname === 'localhost' || window.location.search.includes('meta_debug=1');
        
        // Initialize immediately - no dependencies
        this.init();
    }

    /**
     * Initialize Meta Pixel with standard fbq implementation
     */
    init() {
        if (this.initialized) {
            this.log('Meta Pixel already initialized');
            return;
        }

        // Standard Meta Pixel base code - exactly as from guide
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        
        // Initialize with enhanced matching if available
        const userData = this.getEnhancedMatchingData();
        if (Object.keys(userData).length > 0) {
            if (typeof fbq !== 'undefined') {
                try {
                    fbq('init', this.pixelId, userData);
                    this.log('Meta Pixel initialized with enhanced matching:', userData);
                } catch (error) {
                    console.error('❌ Meta Pixel init failed:', error);
                }
            }
        } else {
            if (typeof fbq !== 'undefined') {
                try {
                    fbq('init', this.pixelId);
                    this.log('Meta Pixel initialized (basic)');
                } catch (error) {
                    console.error('❌ Meta Pixel init failed:', error);
                }
            }
        }
        
        // Track PageView with event ID for deduplication
        const pageViewId = this.generateEventId('pageview');
        this.trackEvent('PageView', {}, pageViewId);
        
        this.initialized = true;
        
        // Process any queued events
        this.processEventQueue();
        
        // Set up automatic event detection
        this.setupEventDetection();
    }

    /**
     * Track Purchase Event - CRITICAL for conversion tracking
     * Uses guide standard event ID format: purchase_{orderId}
     */
    trackPurchase(data) {
        if (!data.order_id) {
            console.error('MetaPixelDirect: order_id is required for purchase tracking');
            return;
        }
        
        // Guide standard event ID format - MUST match server-side
        const eventId = `purchase_${data.order_id}`;
        
        // Check for duplicates
        if (this.sentEvents.has(eventId)) {
            this.log('Purchase event already sent:', eventId);
            return;
        }
        
        const purchaseData = {
            value: parseFloat(data.value || data.amount || 1999),
            currency: data.currency || 'INR',
            content_ids: data.content_ids || ['complete-indian-investor'],
            content_type: data.content_type || 'product',
            content_name: data.content_name || 'The Complete Indian Investor',
            num_items: data.num_items || 1
        };
        
        this.trackEvent('Purchase', purchaseData, eventId);
        this.sentEvents.add(eventId);
        
        this.log('✅ Purchase tracked with standard event ID:', eventId);
    }

    /**
     * Track Lead Event - For lead capture
     */
    trackLead(data, eventId) {
        if (!eventId) {
            eventId = data.event_id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Check for duplicates
        if (this.sentEvents.has(eventId)) {
            this.log('Lead event already sent:', eventId);
            return;
        }
        
        const leadData = {
            content_name: data.content_name || 'Lead Capture - Complete Indian Investor',
            content_category: data.content_category || 'lead_generation',
            value: parseFloat(data.value || 0),
            currency: data.currency || 'INR'
        };
        
        this.trackEvent('Lead', leadData, eventId);
        this.sentEvents.add(eventId);
        
        this.log('✅ Lead tracked:', eventId);
    }

    /**
     * Track InitiateCheckout Event - When user starts payment process
     */
    trackInitiateCheckout(data) {
        const sessionId = this.getSessionId();
        const eventId = `checkout_${sessionId}_${Date.now()}`;
        
        // Check for duplicates
        if (this.sentEvents.has(eventId)) {
            this.log('InitiateCheckout event already sent:', eventId);
            return;
        }
        
        const checkoutData = {
            content_ids: data.content_ids || ['complete-indian-investor'],
            content_type: data.content_type || 'product',
            content_name: data.content_name || 'The Complete Indian Investor',
            value: parseFloat(data.value || data.amount || 1999),
            currency: data.currency || 'INR',
            num_items: data.num_items || 1
        };
        
        this.trackEvent('InitiateCheckout', checkoutData, eventId);
        this.sentEvents.add(eventId);
        
        this.log('✅ InitiateCheckout tracked:', eventId);
    }

    /**
     * Core event tracking function with guide-compliant error handling
     */
    trackEvent(eventName, eventData, eventId) {
        if (!this.initialized) {
            this.eventQueue.push({ eventName, eventData, eventId });
            this.log('Event queued (not initialized):', eventName);
            return;
        }
        
        // Guide-compliant error handling pattern
        if (typeof fbq !== 'undefined') {
            try {
                fbq('track', eventName, eventData, { eventID: eventId });
                this.log(`✅ ${eventName} event fired:`, eventId);
            } catch (error) {
                console.error(`❌ ${eventName} event failed:`, error);
            }
        } else {
            console.error('❌ fbq not available - Meta Pixel not loaded');
        }
    }

    /**
     * Get enhanced matching data for better attribution
     * Includes Click ID (fbc) for 100% potential boost per Meta recommendations
     */
    getEnhancedMatchingData() {
        const userData = {};
        
        // Try to get email from various sources
        const email = this.getEmailFromSources();
        if (email) {
            userData.em = email.toLowerCase().trim();
        }
        
        // Try to get phone from various sources  
        const phone = this.getPhoneFromSources();
        if (phone) {
            userData.ph = this.formatPhoneForIndia(phone);
        }
        
        // Get name if available
        const name = this.getNameFromSources();
        if (name) {
            const nameParts = name.split(' ');
            userData.fn = nameParts[0]?.toLowerCase().trim();
            if (nameParts.length > 1) {
                userData.ln = nameParts[nameParts.length - 1]?.toLowerCase().trim();
            }
        }
        
        // Get Facebook Click ID (fbc) - CRITICAL for 100% conversion boost
        const fbc = this.getFacebookClickId();
        if (fbc) {
            userData.fbc = fbc;
        }
        
        // Get Facebook Browser ID (fbp) from cookie
        const fbp = this.getFacebookBrowserId();
        if (fbp) {
            userData.fbp = fbp;
        }
        
        // Add External ID for better matching (user session or visitor ID)
        const externalId = this.getOrCreateExternalId();
        if (externalId) {
            userData.external_id = externalId;
        }
        
        return userData;
    }

    /**
     * Extract email from page sources
     */
    getEmailFromSources() {
        // Check localStorage
        const storedEmail = localStorage.getItem('user_email');
        if (storedEmail && this.isValidEmail(storedEmail)) return storedEmail;
        
        // Check form inputs
        const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"], input[placeholder*="email" i]');
        for (const input of emailInputs) {
            if (input.value && this.isValidEmail(input.value)) {
                return input.value.toLowerCase().trim();
            }
        }
        
        return null;
    }

    /**
     * Extract phone from page sources
     */
    getPhoneFromSources() {
        // Check localStorage
        const storedPhone = localStorage.getItem('user_phone');
        if (storedPhone) return storedPhone;
        
        // Check form inputs
        const phoneInputs = document.querySelectorAll('input[type="tel"], input[name*="phone"], input[name*="mobile"]');
        for (const input of phoneInputs) {
            if (input.value) {
                return this.formatPhoneForIndia(input.value);
            }
        }
        
        return null;
    }

    /**
     * Extract name from page sources
     */
    getNameFromSources() {
        // Check localStorage
        const storedName = localStorage.getItem('user_name');
        if (storedName) return storedName;
        
        // Check form inputs
        const nameInputs = document.querySelectorAll('input[name*="name"], input[placeholder*="name" i]');
        for (const input of nameInputs) {
            if (input.value) {
                return input.value.trim();
            }
        }
        
        return null;
    }

    /**
     * Format phone number for India
     */
    formatPhoneForIndia(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return '+91' + cleaned;
        }
        return cleaned;
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Get Facebook Click ID (fbc) from URL or stored cookie
     * Critical for 100% conversion boost per Meta recommendations
     */
    getFacebookClickId() {
        // Check if fbclid is in current URL
        const urlParams = new URLSearchParams(window.location.search);
        const fbclid = urlParams.get('fbclid');
        
        if (fbclid) {
            // Create proper fbc format: fb.{subdomain_index}.{timestamp}.{click_id}
            const timestamp = Math.floor(Date.now() / 1000);
            const fbc = `fb.1.${timestamp}.${fbclid}`;
            
            // Store for future use (7 days)
            const expires = new Date();
            expires.setDate(expires.getDate() + 7);
            document.cookie = `_fbc=${fbc}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
            
            this.log('Facebook Click ID captured:', fbc);
            return fbc;
        }
        
        // Try to get from existing cookie
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === '_fbc') {
                this.log('Facebook Click ID from cookie:', value);
                return value;
            }
        }
        
        return null;
    }

    /**
     * Get Facebook Browser ID (fbp) from cookie
     */
    getFacebookBrowserId() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === '_fbp') {
                this.log('Facebook Browser ID found:', value);
                return value;
            }
        }
        return null;
    }

    /**
     * Get or create External ID for better user matching
     * Uses consistent visitor ID across sessions
     */
    getOrCreateExternalId() {
        // Try to get existing external ID
        let externalId = localStorage.getItem('meta_external_id');
        
        if (!externalId) {
            // Create new external ID using visitor pattern
            externalId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
            localStorage.setItem('meta_external_id', externalId);
            this.log('Created new External ID:', externalId);
        } else {
            this.log('Using existing External ID:', externalId);
        }
        
        return externalId;
    }

    /**
     * Generate unique event ID - Guide standard format
     */
    generateEventId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get or create session ID
     */
    getSessionId() {
        let sessionId = sessionStorage.getItem('meta_pixel_session');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('meta_pixel_session', sessionId);
        }
        return sessionId;
    }

    /**
     * Process queued events
     */
    processEventQueue() {
        while (this.eventQueue.length > 0) {
            const { eventName, eventData, eventId } = this.eventQueue.shift();
            this.trackEvent(eventName, eventData, eventId);
        }
    }

    /**
     * Set up automatic event detection
     */
    setupEventDetection() {
        // Detect checkout button clicks
        document.addEventListener('click', (event) => {
            const target = event.target;
            
            if (target.matches('button, a, input[type="submit"]')) {
                const text = target.textContent?.toLowerCase() || '';
                const href = target.href?.toLowerCase() || '';
                
                if (text.includes('buy') || 
                    text.includes('purchase') || 
                    text.includes('checkout') ||
                    text.includes('enroll') ||
                    href.includes('razorpay') ||
                    href.includes('payment')) {
                    
                    this.trackInitiateCheckout({
                        content_name: 'The Complete Indian Investor',
                        value: 1999
                    });
                }
            }
        });
        
        // Detect form submissions for lead capture
        document.addEventListener('submit', (event) => {
            const form = event.target;
            
            if (form.tagName === 'FORM') {
                const email = form.querySelector('input[type="email"]')?.value;
                const phone = form.querySelector('input[type="tel"]')?.value;
                const name = form.querySelector('input[name*="name"]')?.value;
                
                if (email || phone) {
                    // Store user data for enhanced matching
                    if (email) localStorage.setItem('user_email', email);
                    if (phone) localStorage.setItem('user_phone', phone);
                    if (name) localStorage.setItem('user_name', name);
                    
                    this.trackLead({
                        content_name: 'Lead Capture - Complete Indian Investor'
                    });
                }
            }
        });
        
        // Detect payment success page
        if (window.location.pathname.includes('success') ||
            window.location.search.includes('success')) {
            
            this.handlePaymentSuccess();
        }
    }

    /**
     * Handle payment success detection
     */
    handlePaymentSuccess() {
        // Wait for page to stabilize
        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const paymentId = urlParams.get('razorpay_payment_id') || urlParams.get('payment_id');
            const orderId = urlParams.get('razorpay_order_id') || urlParams.get('order_id');
            
            if (orderId || paymentId) {
                this.trackPurchase({
                    order_id: orderId || paymentId,
                    value: 1999,
                    currency: 'INR',
                    content_ids: ['complete-indian-investor'],
                    content_name: 'The Complete Indian Investor'
                });
            }
        }, 1000);
    }

    /**
     * Debug logging
     */
    log(...args) {
        if (this.debugMode) {
            console.log('[META_PIXEL_DIRECT]', ...args);
        }
    }

    /**
     * Manual event triggering for testing
     */
    triggerEvent(eventType, eventData = {}) {
        switch(eventType) {
            case 'purchase':
                this.trackPurchase({
                    order_id: eventData.order_id || 'manual_test_' + Date.now(),
                    value: eventData.value || 1999,
                    currency: 'INR'
                });
                break;
            case 'lead':
                this.trackLead(eventData);
                break;
            case 'checkout':
                this.trackInitiateCheckout(eventData);
                break;
            default:
                this.log('Unknown event type:', eventType);
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.MetaPixelDirect = new MetaPixelDirect();
    });
} else {
    window.MetaPixelDirect = new MetaPixelDirect();
}

// Expose for manual triggering and debugging
window.triggerMetaEvent = function(eventType, eventData) {
    if (window.MetaPixelDirect) {
        window.MetaPixelDirect.triggerEvent(eventType, eventData);
    }
};

console.log('✅ Meta Pixel Direct loaded - Guide Compliant Implementation');
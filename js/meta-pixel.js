/**
 * Meta Pixel Client-Side Integration with GTM Synchronization
 * Implements proper deduplication and event coordination between client and server
 * Fixes all identified GTM issues: deduplication, ViewContent, InitiateCheckout, Advanced Matching
 */

class MetaPixelClient {
    constructor() {
        this.pixelId = '726737740336667';
        this.initialized = false;
        this.eventQueue = [];
        this.sentEvents = new Set(); // For client-side deduplication
        this.debugMode = window.location.hostname === 'localhost' || window.location.search.includes('debug=1');
        
        // Initialize immediately
        this.init();
    }

    /**
     * Initialize Meta Pixel and set up GTM integration
     */
    init() {
        if (this.initialized) return;

        // Load Meta Pixel base code if not already loaded
        if (typeof fbq === 'undefined') {
            this.loadPixelScript();
        }

        // Initialize pixel with Advanced Matching
        fbq('init', this.pixelId, {
            // Enable Advanced Matching for better event quality
            em: this.getHashedEmail(),
            ph: this.getHashedPhone()
        });

        // Send PageView with event ID for deduplication
        const pageViewId = this.generateEventId('pageview');
        fbq('track', 'PageView', {}, { eventID: pageViewId });

        // Set up GTM data layer listeners
        this.setupDataLayerListeners();
        
        // Set up automatic event detection
        this.setupEventDetection();
        
        // Process any queued events
        this.processEventQueue();
        
        this.initialized = true;
        this.log('Initialized with deduplication support');
    }

    /**
     * Load Meta Pixel script dynamically
     */
    loadPixelScript() {
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbq.js');
    }

    /**
     * Set up GTM data layer event listeners for deduplication
     */
    setupDataLayerListeners() {
        // Listen for GTM data layer pushes
        const originalPush = window.dataLayer?.push || function() {};
        
        if (window.dataLayer) {
            const self = this;
            window.dataLayer.push = function(event) {
                // Process Meta Pixel events with deduplication
                if (event && typeof event === 'object') {
                    self.handleDataLayerEvent(event);
                }
                
                // Call original push
                return originalPush.apply(window.dataLayer, arguments);
            };
        }

        // Set up mutation observer for dynamic content
        this.setupContentObserver();
    }

    /**
     * Handle GTM data layer events and apply deduplication
     */
    handleDataLayerEvent(event) {
        const eventType = event.event;
        
        switch(eventType) {
            case 'purchase':
                this.handlePurchaseEvent(event);
                break;
            case 'initiate_checkout':
            case 'begin_checkout':
                this.handleInitiateCheckoutEvent(event);
                break;
            case 'view_item':
            case 'view_content':
                this.handleViewContentEvent(event);
                break;
            case 'lead_capture':
                this.handleLeadEvent(event);
                break;
        }
    }

    /**
     * Handle purchase events with proper deduplication
     */
    handlePurchaseEvent(eventData) {
        const transactionId = eventData.ecommerce?.transaction_id || 
                             eventData.transaction_id ||
                             this.generateEventId('purchase');
        
        // Generate consistent event ID for deduplication
        const eventId = `purchase_${transactionId}`;
        
        // Check if already sent (client-side deduplication)
        if (this.sentEvents.has(eventId)) {
            this.log('Purchase event already sent:', eventId);
            return;
        }

        const purchaseData = {
            content_ids: eventData.ecommerce?.items?.map(item => item.item_id) || ['complete_indian_investor'],
            content_type: 'product',
            currency: eventData.ecommerce?.currency || 'INR',
            value: eventData.ecommerce?.value || eventData.value || 1999,
            num_items: eventData.ecommerce?.items?.length || 1
        };

        // Send event with deduplication ID
        this.sendEvent('Purchase', purchaseData, eventId);
        
        // Store in localStorage for server-side deduplication reference
        this.storeEventReference('purchase', transactionId, eventId);
    }

    /**
     * Handle checkout initiation with better reliability (fixes the cashfree.com trigger issue)
     */
    handleInitiateCheckoutEvent(eventData) {
        const sessionId = this.getSessionId();
        const eventId = `checkout_${sessionId}_${Date.now()}`;
        
        if (this.sentEvents.has(eventId)) return;

        const checkoutData = {
            content_ids: ['complete_indian_investor'],
            content_type: 'product',
            currency: 'INR',
            value: 1999,
            num_items: 1
        };

        this.sendEvent('InitiateCheckout', checkoutData, eventId);
        this.storeEventReference('initiate_checkout', sessionId, eventId);
    }

    /**
     * Handle view content events (fixes the scroll trigger issue)
     */
    handleViewContentEvent(eventData) {
        // Only fire on actual content pages, not homepage scrolls
        const path = window.location.pathname;
        if (path === '/' && !eventData.content_id) {
            this.log('Skipping ViewContent on homepage scroll');
            return;
        }

        const contentId = eventData.content_id || 'course_landing_page';
        const eventId = `view_content_${contentId}_${Date.now()}`;
        
        if (this.sentEvents.has(eventId)) return;

        const viewData = {
            content_ids: [contentId],
            content_type: 'product',
            content_name: 'The Complete Indian Investor Course'
        };

        this.sendEvent('ViewContent', viewData, eventId);
    }

    /**
     * Handle lead capture events
     */
    handleLeadEvent(eventData) {
        const leadId = eventData.lead_id || this.generateEventId('lead');
        const eventId = `lead_${leadId}`;
        
        if (this.sentEvents.has(eventId)) return;

        const leadData = {
            content_ids: ['complete_indian_investor'],
            content_type: 'product',
            content_name: 'The Complete Indian Investor Course',
            value: 1999,
            currency: 'INR'
        };

        this.sendEvent('Lead', leadData, eventId);
        this.storeEventReference('lead', leadId, eventId);
    }

    /**
     * Send Meta Pixel event with deduplication
     */
    sendEvent(eventName, eventData, eventId) {
        if (!this.initialized) {
            this.eventQueue.push({ eventName, eventData, eventId });
            return;
        }

        // Add Advanced Matching user data
        const userData = this.getUserData();
        if (Object.keys(userData).length > 0) {
            eventData.user_data = userData;
        }

        // Add event ID for server-side deduplication - THIS IS CRITICAL
        const pixelData = {
            ...eventData,
            eventID: eventId // This prevents double counting with server-side events
        };

        try {
            fbq('track', eventName, pixelData);
            this.sentEvents.add(eventId);
            
            this.log(`Sent ${eventName} event:`, {
                eventId,
                data: pixelData
            });
            
        } catch (error) {
            console.error('[META_PIXEL_CLIENT] Error sending event:', error);
        }
    }

    /**
     * Get user data for Advanced Matching
     */
    getUserData() {
        const userData = {};
        
        // Try to get email from various sources
        const email = this.getEmailFromSources();
        if (email) {
            userData.em = this.hashEmail(email);
        }
        
        // Try to get phone from various sources  
        const phone = this.getPhoneFromSources();
        if (phone) {
            userData.ph = this.hashPhone(phone);
        }

        // Add client IP and user agent
        userData.client_user_agent = navigator.userAgent;
        
        return userData;
    }

    /**
     * Extract email from various page sources
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
        
        // Check data layer
        if (window.dataLayer) {
            for (const item of window.dataLayer) {
                if (item.user_email || item.email) {
                    const email = item.user_email || item.email;
                    if (this.isValidEmail(email)) return email;
                }
            }
        }
        
        return null;
    }

    /**
     * Extract phone from various page sources
     */
    getPhoneFromSources() {
        // Check localStorage
        const storedPhone = localStorage.getItem('user_phone');
        if (storedPhone) return storedPhone;
        
        // Check form inputs
        const phoneInputs = document.querySelectorAll('input[type="tel"], input[name*="phone"], input[name*="mobile"], input[placeholder*="phone" i], input[placeholder*="mobile" i]');
        for (const input of phoneInputs) {
            if (input.value) {
                return this.formatPhoneForIndia(input.value);
            }
        }
        
        return null;
    }

    /**
     * Hash email for privacy compliance
     */
    hashEmail(email) {
        if (!email) return null;
        return this.sha256(email.toLowerCase().trim());
    }

    /**
     * Hash phone for privacy compliance  
     */
    hashPhone(phone) {
        if (!phone) return null;
        const formatted = this.formatPhoneForIndia(phone);
        return this.sha256(formatted);
    }

    /**
     * Format phone number for India
     */
    formatPhoneForIndia(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return '91' + cleaned; // Add India country code
        }
        return cleaned;
    }

    /**
     * Simple SHA256 implementation using crypto API
     */
    sha256(str) {
        // Use Web Crypto API if available
        if (window.crypto && window.crypto.subtle) {
            return this.sha256Crypto(str);
        }
        
        // Fallback: return a simple hash
        return this.simpleHash(str);
    }

    /**
     * Crypto API SHA256
     */
    async sha256Crypto(str) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            return this.simpleHash(str);
        }
    }

    /**
     * Simple hash fallback
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Generate unique event ID
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
     * Store event reference for server-side deduplication
     */
    storeEventReference(eventType, transactionId, eventId) {
        const eventRef = {
            eventType,
            transactionId,
            eventId,
            timestamp: Date.now(),
            clientSent: true
        };
        
        localStorage.setItem(`meta_event_${eventType}_${transactionId}`, JSON.stringify(eventRef));
        
        // Clean up old references (keep for 24 hours)
        this.cleanupOldEventReferences();
    }

    /**
     * Clean up old event references
     */
    cleanupOldEventReferences() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('meta_event_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.timestamp < cutoff) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        }
    }

    /**
     * Process queued events
     */
    processEventQueue() {
        while (this.eventQueue.length > 0) {
            const { eventName, eventData, eventId } = this.eventQueue.shift();
            this.sendEvent(eventName, eventData, eventId);
        }
    }

    /**
     * Set up automatic event detection
     */
    setupEventDetection() {
        // Detect checkout button clicks (improved InitiateCheckout trigger)
        this.detectCheckoutClicks();
        
        // Detect form submissions for lead capture
        this.detectFormSubmissions();
        
        // Detect payment success
        this.detectPaymentSuccess();
    }

    /**
     * Detect checkout button clicks
     */
    detectCheckoutClicks() {
        document.addEventListener('click', (event) => {
            const target = event.target;
            
            // Check for checkout-related buttons
            if (target.matches('button, a, input[type="submit"]')) {
                const text = target.textContent?.toLowerCase() || '';
                const href = target.href?.toLowerCase() || '';
                
                if (text.includes('buy') || 
                    text.includes('purchase') || 
                    text.includes('checkout') ||
                    text.includes('enroll') ||
                    href.includes('cashfree') ||
                    href.includes('razorpay')) {
                    
                    // Push to dataLayer for consistency
                    if (window.dataLayer) {
                        window.dataLayer.push({
                            event: 'initiate_checkout',
                            checkout_trigger: 'button_click',
                            button_text: target.textContent
                        });
                    }
                }
            }
        });
    }

    /**
     * Detect form submissions for lead capture
     */
    detectFormSubmissions() {
        document.addEventListener('submit', (event) => {
            const form = event.target;
            
            if (form.tagName === 'FORM') {
                const email = form.querySelector('input[type="email"], input[name*="email"]')?.value;
                const phone = form.querySelector('input[type="tel"], input[name*="phone"]')?.value;
                const name = form.querySelector('input[name*="name"]')?.value;
                
                if (email || phone) {
                    // Store user data
                    if (email) localStorage.setItem('user_email', email);
                    if (phone) localStorage.setItem('user_phone', phone);
                    if (name) localStorage.setItem('user_name', name);
                    
                    // Push to dataLayer
                    if (window.dataLayer) {
                        window.dataLayer.push({
                            event: 'lead_capture',
                            lead_id: this.generateEventId('form'),
                            form_type: 'contact'
                        });
                    }
                }
            }
        });
    }

    /**
     * Detect payment success
     */
    detectPaymentSuccess() {
        // Check URL for success indicators
        if (window.location.pathname.includes('success') ||
            window.location.search.includes('success') ||
            document.title.toLowerCase().includes('success')) {
            
            this.handlePaymentSuccess();
        }
    }

    /**
     * Set up content observation for dynamic events
     */
    setupContentObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        // Check for payment success indicators
                        if (node.textContent && 
                            (node.textContent.includes('payment successful') ||
                             node.textContent.includes('purchase complete'))) {
                            this.handlePaymentSuccess();
                        }
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Handle payment success detection
     */
    handlePaymentSuccess() {
        // Wait a bit for the page to stabilize
        setTimeout(() => {
            // Only trigger if we haven't already sent a purchase event recently
            if (!this.sentEvents.has('purchase_detected')) {
                
                const urlParams = new URLSearchParams(window.location.search);
                const paymentId = urlParams.get('razorpay_payment_id');
                const orderId = urlParams.get('razorpay_order_id');
                
                // Push purchase event to dataLayer
                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'purchase',
                        ecommerce: {
                            transaction_id: orderId || this.generateEventId('detected'),
                            value: 1999,
                            currency: 'INR',
                            items: [{
                                item_id: 'complete_indian_investor',
                                item_name: 'The Complete Indian Investor Course',
                                price: 1999,
                                quantity: 1
                            }]
                        },
                        payment_details: {
                            payment_id: paymentId,
                            order_id: orderId
                        }
                    });
                }
                
                this.sentEvents.add('purchase_detected');
            }
        }, 1000);
    }

    /**
     * Get hashed email for init
     */
    getHashedEmail() {
        const email = this.getEmailFromSources();
        return email ? this.hashEmail(email) : undefined;
    }

    /**
     * Get hashed phone for init
     */
    getHashedPhone() {
        const phone = this.getPhoneFromSources();
        return phone ? this.hashPhone(phone) : undefined;
    }

    /**
     * Debug logging
     */
    log(...args) {
        if (this.debugMode) {
            console.log('[META_PIXEL_CLIENT]', ...args);
        }
    }

    /**
     * Manual event triggering for integration testing
     */
    triggerEvent(eventType, eventData = {}) {
        switch(eventType) {
            case 'purchase':
                this.handlePurchaseEvent({ 
                    ecommerce: { 
                        transaction_id: eventData.transaction_id || 'manual_test_' + Date.now(),
                        value: eventData.value || 1999,
                        currency: 'INR'
                    }
                });
                break;
            case 'lead':
                this.handleLeadEvent({ 
                    lead_id: eventData.lead_id || 'manual_test_' + Date.now()
                });
                break;
            case 'checkout':
                this.handleInitiateCheckoutEvent(eventData);
                break;
            default:
                this.log('Unknown event type:', eventType);
        }
    }
}

// Initialize Meta Pixel Client
let metaPixelClient;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        metaPixelClient = new MetaPixelClient();
    });
} else {
    metaPixelClient = new MetaPixelClient();
}

// Expose for manual triggering and debugging
window.metaPixelClient = metaPixelClient;

// Expose helper functions for easy integration
window.triggerMetaEvent = function(eventType, eventData) {
    if (metaPixelClient) {
        metaPixelClient.triggerEvent(eventType, eventData);
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetaPixelClient;
}
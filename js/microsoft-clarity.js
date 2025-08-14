/**
 * Microsoft Clarity Integration
 * Direct implementation without GTM dependency
 * 
 * To activate:
 * 1. Get your Clarity project ID from clarity.microsoft.com
 * 2. Replace 'YOUR_PROJECT_ID' below with your actual project ID
 * 3. Include this script in your HTML: <script src="js/microsoft-clarity.js"></script>
 */

(function() {
    'use strict';
    
    // Configuration - Activated with project ID
    const CLARITY_PROJECT_ID = 'so66xp7vg7';
    
    // Don't load if project ID not configured
    if (CLARITY_PROJECT_ID === 'YOUR_PROJECT_ID') {
        console.log('[Clarity] Not configured. Add your project ID to activate.');
        return;
    }
    
    // Microsoft Clarity initialization code
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
    
    // Log initialization
    console.log('[Clarity] Initialized with project ID:', CLARITY_PROJECT_ID);
    
    // Optional: Set up custom events for Clarity
    window.clarityCustomEvents = {
        // Track custom events
        track: function(eventName, eventData) {
            if (window.clarity) {
                window.clarity('set', eventName, eventData);
            }
        },
        
        // Identify user (if needed)
        identify: function(userId, sessionId, customData) {
            if (window.clarity) {
                window.clarity('identify', userId, sessionId, customData);
            }
        }
    };
    
    // Automatically track purchase events to Clarity
    if (window.dataLayer) {
        const originalPush = window.dataLayer.push;
        window.dataLayer.push = function(event) {
            if (event && event.event === 'purchase' && window.clarity) {
                // Send purchase data to Clarity for session replay context
                window.clarity('set', 'purchase', {
                    transaction_id: event.ecommerce?.transaction_id,
                    value: event.ecommerce?.value,
                    currency: event.ecommerce?.currency
                });
            }
            return originalPush.apply(window.dataLayer, arguments);
        };
    }
    
})();
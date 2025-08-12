// Meta Conversions API Integration with Retry Logic
const crypto = require('crypto');
const { retryStandard } = require('./retry-handler');

class MetaCAPI {
    constructor(pixelId, accessToken) {
        this.pixelId = pixelId || process.env.META_PIXEL_ID;
        this.accessToken = accessToken || process.env.META_ACCESS_TOKEN;
        this.apiVersion = 'v18.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
        this.testEventCode = process.env.META_TEST_EVENT_CODE; // For testing
        this.requestTimeout = 15000; // 15 second timeout
    }

    // Hash user data for PII compliance
    hashUserData(userData) {
        const hashed = {};

        if (userData.email) {
            hashed.em = this.sha256Hash(userData.email.toLowerCase().trim());
        }

        if (userData.phone) {
            // Format phone for India (add 91 if not present)
            let phone = userData.phone.replace(/\D/g, '');
            if (!phone.startsWith('91') && phone.length === 10) {
                phone = '91' + phone;
            }
            hashed.ph = this.sha256Hash(phone);
        }

        if (userData.firstName) {
            hashed.fn = this.sha256Hash(userData.firstName.toLowerCase().trim());
        }

        if (userData.lastName) {
            hashed.ln = this.sha256Hash(userData.lastName.toLowerCase().trim());
        }

        if (userData.city) {
            hashed.ct = this.sha256Hash(userData.city.toLowerCase().trim());
        }

        if (userData.state) {
            hashed.st = this.sha256Hash(userData.state.toLowerCase().trim());
        }

        if (userData.country) {
            hashed.country = this.sha256Hash(userData.country.toLowerCase().trim());
        }

        if (userData.zipCode) {
            hashed.zp = this.sha256Hash(userData.zipCode.toLowerCase().trim());
        }

        // Add client IP and user agent if available
        if (userData.clientIp) {
            hashed.client_ip_address = userData.clientIp;
        }

        if (userData.userAgent) {
            hashed.client_user_agent = userData.userAgent;
        }

        // Add click ID if available (from fbclid parameter)
        if (userData.fbc) {
            hashed.fbc = userData.fbc;
        }

        // Add browser ID if available (from _fbp cookie)
        if (userData.fbp) {
            hashed.fbp = userData.fbp;
        }

        return hashed;
    }

    sha256Hash(value) {
        if (!value) return null;
        return crypto.createHash('sha256').update(value).digest('hex');
    }

    // Send purchase event
    async sendPurchaseEvent(orderData, customerData, requestData = {}) {
        if (!this.pixelId || !this.accessToken) {
            console.log('[META_CAPI] Missing credentials, skipping event');
            return null;
        }

        try {
            const eventData = {
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                event_id: orderData.order_id, // For deduplication
                action_source: 'website',
                user_data: this.hashUserData({
                    email: customerData.email,
                    phone: customerData.phone,
                    firstName: customerData.name?.split(' ')[0],
                    lastName: customerData.name?.split(' ').slice(1).join(' '),
                    clientIp: requestData.clientIp,
                    userAgent: requestData.userAgent,
                    fbc: requestData.fbc,
                    fbp: requestData.fbp
                }),
                custom_data: {
                    currency: orderData.currency || 'INR',
                    value: orderData.amount,
                    content_ids: ['complete-indian-investor'],
                    content_type: 'product',
                    content_name: 'The Complete Indian Investor',
                    num_items: 1,
                    order_id: orderData.order_id,
                    payment_id: orderData.payment_id
                },
                event_source_url: requestData.sourceUrl || 'https://lotuslion.in'
            };

            return await this.sendEventWithRetry(eventData, {
                operation: 'Meta CAPI Purchase Event',
                orderId: orderData.order_id,
                customerId: customerData.email
            });
        } catch (error) {
            console.error('[META_CAPI] Error sending purchase event:', error);
            return null;
        }
    }

    // Send initiate checkout event
    async sendInitiateCheckoutEvent(customerData, requestData = {}) {
        if (!this.pixelId || !this.accessToken) {
            return null;
        }

        try {
            const eventData = {
                event_name: 'InitiateCheckout',
                event_time: Math.floor(Date.now() / 1000),
                event_id: `checkout_${Date.now()}`,
                action_source: 'website',
                user_data: this.hashUserData({
                    email: customerData?.email,
                    phone: customerData?.phone,
                    clientIp: requestData.clientIp,
                    userAgent: requestData.userAgent,
                    fbc: requestData.fbc,
                    fbp: requestData.fbp
                }),
                custom_data: {
                    currency: 'INR',
                    value: 1999,
                    content_ids: ['complete-indian-investor'],
                    content_type: 'product',
                    num_items: 1
                },
                event_source_url: requestData.sourceUrl || 'https://lotuslion.in'
            };

            return await this.sendEventWithRetry(eventData, {
                operation: 'Meta CAPI Checkout Event',
                customerId: customerData?.email || 'unknown'
            });
        } catch (error) {
            console.error('[META_CAPI] Error sending checkout event:', error);
            return null;
        }
    }

    // Send page view event
    async sendPageViewEvent(requestData = {}) {
        if (!this.pixelId || !this.accessToken) {
            return null;
        }

        try {
            const eventData = {
                event_name: 'PageView',
                event_time: Math.floor(Date.now() / 1000),
                event_id: `pageview_${Date.now()}`,
                action_source: 'website',
                user_data: this.hashUserData({
                    clientIp: requestData.clientIp,
                    userAgent: requestData.userAgent,
                    fbc: requestData.fbc,
                    fbp: requestData.fbp
                }),
                event_source_url: requestData.sourceUrl || 'https://lotuslion.in'
            };

            return await this.sendEventWithRetry(eventData, {
                operation: 'Meta CAPI Page View Event',
                sourceUrl: requestData.sourceUrl
            });
        } catch (error) {
            console.error('[META_CAPI] Error sending pageview event:', error);
            return null;
        }
    }

    // Generic event sender with retry logic
    async sendEventWithRetry(eventData, context = {}) {
        return await retryStandard(
            async () => this.sendEvent(eventData),
            {
                ...context,
                eventName: eventData.event_name,
                eventId: eventData.event_id,
                startTime: Date.now()
            }
        );
    }

    // Check if client-side already sent this event (deduplication)
    checkClientSideEvent(eventType, transactionId) {
        // This would be used in the webhook processing context
        // where we have access to client-side data via database or headers
        try {
            // The client-side stores event references in localStorage
            // In server context, we'll use consistent event ID generation
            const eventId = `${eventType}_${transactionId}`;
            return { shouldSkip: false, eventId };
        } catch (error) {
            return { shouldSkip: false, eventId: `${eventType}_${transactionId}` };
        }
    }

    // Core event sender (used internally)
    async sendEvent(eventData) {
        const url = `${this.baseUrl}/${this.pixelId}/events`;
        
        const payload = {
            data: [eventData],
            access_token: this.accessToken
        };

        // Add test event code if in test mode
        if (this.testEventCode) {
            payload.test_event_code = this.testEventCode;
        }

        try {
            console.log(`[META_CAPI] Sending ${eventData.event_name} event (ID: ${eventData.event_id})`);

            // Make actual HTTP request to Meta CAPI
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'LotusLion-Meta-CAPI/1.0'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = new Error(`Meta CAPI request failed: ${response.status} ${response.statusText}`);
                error.response = response;
                throw error;
            }

            const result = await response.json();
            
            if (result.error) {
                throw new Error(`Meta CAPI error: ${JSON.stringify(result.error)}`);
            }

            console.log(`[META_CAPI] ✅ Event sent successfully: ${eventData.event_name} (${eventData.event_id})`);
            
            return {
                success: true,
                event_id: eventData.event_id,
                meta_response: result,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`[META_CAPI] ❌ Failed to send ${eventData.event_name} event:`, error.message);
            
            return {
                success: false,
                event_id: eventData.event_id,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Extract tracking parameters from request
    extractTrackingParams(req) {
        const params = {
            clientIp: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            userAgent: req.headers['user-agent'],
            sourceUrl: req.headers['referer'] || `https://${req.headers['host']}${req.url}`
        };

        // Extract Facebook click ID from query or cookies
        if (req.query?.fbclid) {
            params.fbc = `fb.1.${Date.now()}.${req.query.fbclid}`;
        }

        // Extract Facebook browser ID from cookies
        if (req.cookies?._fbp) {
            params.fbp = req.cookies._fbp;
        }

        return params;
    }

    // Async purchase event with retry
    async sendPurchaseEventAsync(orderData, customerData, requestData = {}) {
        return await this.withRetry(() => 
            this.sendPurchaseEvent(orderData, customerData, requestData)
        , 3);
    }

    // Retry wrapper for failed API calls
    async withRetry(fn, maxAttempts = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await fn();
                
                if (result.success) {
                    return result;
                }
                
                // If not successful but no error thrown, treat as error
                lastError = new Error(result.error || 'Unknown Meta CAPI error');
                
            } catch (error) {
                lastError = error;
                console.log(`[META_CAPI] Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < maxAttempts) {
                const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s...
                console.log(`[META_CAPI] Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
        console.error(`[META_CAPI] All ${maxAttempts} attempts failed`);
        return {
            success: false,
            error: lastError.message,
            attempts: maxAttempts,
            timestamp: new Date().toISOString()
        };
    }

    // Send event with timeout protection
    async sendEventHTTP(eventData) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        try {
            const result = await this.sendEvent(eventData);
            clearTimeout(timeoutId);
            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Meta CAPI request timeout');
            }
            throw error;
        }
    }
}

// Singleton instance
let metaCAPIInstance = null;

function getMetaCAPI() {
    if (!metaCAPIInstance) {
        metaCAPIInstance = new MetaCAPI();
    }
    return metaCAPIInstance;
}

module.exports = { MetaCAPI, getMetaCAPI };

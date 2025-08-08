// Enhanced logging for Vercel with event deduplication
class Logger {
    constructor() {
        this.processedEvents = new Map();
        this.eventBuffer = [];
        this.flushInterval = null;
    }

    // Generate consistent transaction ID
    generateTransactionId(prefix = 'TXN') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `${prefix}_${timestamp}_${random}`;
    }

    // Event deduplication
    isDuplicateEvent(eventId, timeWindow = 300000) { // 5 minutes default
        const now = Date.now();
        
        // Clean old events
        for (const [id, timestamp] of this.processedEvents.entries()) {
            if (now - timestamp > timeWindow) {
                this.processedEvents.delete(id);
            }
        }

        // Check if event exists
        if (this.processedEvents.has(eventId)) {
            return true;
        }

        // Mark as processed
        this.processedEvents.set(eventId, now);
        return false;
    }

    // Log payment event with deduplication
    logPaymentEvent(type, data) {
        const eventId = `${type}_${data.payment_id || data.order_id}`;
        
        if (this.isDuplicateEvent(eventId)) {
            console.log(`[DUPLICATE_SKIPPED] ${type}:`, eventId);
            return null;
        }

        const event = {
            event_type: type,
            event_id: eventId,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            ...data
        };

        // Log to Vercel console (will appear in Vercel dashboard)
        console.log(`[PAYMENT_EVENT] ${type}:`, JSON.stringify(event));

        // Add to buffer for batch processing
        this.eventBuffer.push(event);

        // Return event for further processing
        return event;
    }

    // Log conversion with consistent transaction ID
    logConversion(orderData, paymentData, customerData) {
        const conversion = {
            transaction_id: orderData.order_id,
            payment_id: paymentData.payment_id,
            amount: orderData.amount,
            currency: orderData.currency,
            customer: {
                email: customerData.email,
                phone: customerData.phone,
                name: customerData.name
            },
            timestamp: new Date().toISOString(),
            source: 'razorpay',
            event_name: 'Purchase'
        };

        // Log for Vercel analytics
        console.log('[CONVERSION]:', JSON.stringify(conversion));

        // Prepare for Meta CAPI if configured
        if (process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN) {
            this.sendToMetaCAPI(conversion);
        }

        return conversion;
    }

    // Send events to Meta CAPI
    async sendToMetaCAPI(eventData) {
        try {
            const metaEvent = {
                data: [{
                    event_name: eventData.event_name || 'Purchase',
                    event_time: Math.floor(new Date(eventData.timestamp).getTime() / 1000),
                    event_id: eventData.transaction_id,
                    user_data: {
                        em: this.hashEmail(eventData.customer.email),
                        ph: this.hashPhone(eventData.customer.phone),
                        fn: this.hashData(eventData.customer.name.split(' ')[0]),
                        ln: this.hashData(eventData.customer.name.split(' ').slice(1).join(' '))
                    },
                    custom_data: {
                        currency: eventData.currency,
                        value: eventData.amount,
                        order_id: eventData.transaction_id,
                        content_type: 'product',
                        content_ids: ['complete-indian-investor']
                    },
                    action_source: 'website'
                }]
            };

            // TODO: Implement actual Meta CAPI call
            console.log('[META_CAPI_READY]:', JSON.stringify(metaEvent));
            
        } catch (error) {
            console.error('[META_CAPI_ERROR]:', error);
        }
    }

    // Hash functions for PII compliance
    hashEmail(email) {
        if (!email) return null;
        const crypto = require('crypto');
        return crypto.createHash('sha256')
            .update(email.toLowerCase().trim())
            .digest('hex');
    }

    hashPhone(phone) {
        if (!phone) return null;
        const crypto = require('crypto');
        // Remove non-numeric characters and add country code if missing
        const cleaned = phone.replace(/\D/g, '');
        const formatted = cleaned.startsWith('91') ? cleaned : '91' + cleaned;
        return crypto.createHash('sha256')
            .update(formatted)
            .digest('hex');
    }

    hashData(data) {
        if (!data) return null;
        const crypto = require('crypto');
        return crypto.createHash('sha256')
            .update(data.toLowerCase().trim())
            .digest('hex');
    }

    // Analytics aggregation for Vercel dashboard
    getAnalytics() {
        const analytics = {
            total_events: this.eventBuffer.length,
            unique_transactions: new Set(this.eventBuffer.map(e => e.transaction_id)).size,
            events_by_type: {},
            last_event: this.eventBuffer[this.eventBuffer.length - 1]
        };

        // Count events by type
        this.eventBuffer.forEach(event => {
            analytics.events_by_type[event.event_type] = 
                (analytics.events_by_type[event.event_type] || 0) + 1;
        });

        return analytics;
    }

    // Flush events (for batch processing)
    flushEvents() {
        if (this.eventBuffer.length === 0) return;

        console.log('[BATCH_FLUSH]:', {
            count: this.eventBuffer.length,
            events: this.eventBuffer
        });

        // Clear buffer after flush
        this.eventBuffer = [];
    }

    // Start auto-flush
    startAutoFlush(interval = 60000) { // 1 minute default
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }

        this.flushInterval = setInterval(() => {
            this.flushEvents();
        }, interval);
    }

    // Stop auto-flush
    stopAutoFlush() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flushEvents(); // Final flush
    }
}

// Singleton instance
let loggerInstance = null;

function getLogger() {
    if (!loggerInstance) {
        loggerInstance = new Logger();
        loggerInstance.startAutoFlush();
    }
    return loggerInstance;
}

module.exports = { getLogger, Logger };
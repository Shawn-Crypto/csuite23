/**
 * Zapier Webhook Integration - Guide 2 & 3 Implementation
 * Sends lead data to Zapier for course enrollment and CRM
 */

const { retryExponential } = require('./retry-handler');

const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_LEAD_WEBHOOK_URL;

/**
 * Sends lead data to the Zapier webhook.
 * @param {object} leadData - The lead data to send.
 * @returns {Promise<object>} The result of the webhook call.
 */
async function sendLeadToZapier(leadData) {
    if (!ZAPIER_WEBHOOK_URL) {
        console.warn('[ZAPIER] Webhook URL not configured. Skipping.');
        return { success: false, error: 'Zapier webhook URL not configured.' };
    }

    const payload = {
        ...leadData,
        event_source: 'lotuslion-api',
        submission_time: new Date().toISOString(),
    };

    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    };

    try {
        const response = await fetch(ZAPIER_WEBHOOK_URL, requestOptions);

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Zapier webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
            error.response = response;
            throw error;
        }

        const result = await response.json();
        console.log('[ZAPIER] ✅ Lead sent successfully:', result);
        return { success: true, data: result };

    } catch (error) {
        console.error('[ZAPIER] ❌ Error sending lead to Zapier:', error.message);
        throw error; // Re-throw for retry handler
    }
}

/**
 * Sends lead data to Zapier with exponential backoff retry logic.
 * @param {object} leadData - The lead data.
 * @returns {Promise<object>} The final result after retries.
 */
async function sendLeadToZapierWithRetry(leadData) {
    return await retryExponential(
        () => sendLeadToZapier(leadData),
        {
            operation: 'Zapier Lead Webhook',
            maxAttempts: 4,
            initialDelay: 5000, // Start with a 5-second delay
            context: { email: leadData.email }
        }
    );
}

module.exports = {
    sendLeadToZapier: sendLeadToZapierWithRetry, // Export the retry-wrapped version
    _sendLeadToZapier: sendLeadToZapier, // Export original for testing
};

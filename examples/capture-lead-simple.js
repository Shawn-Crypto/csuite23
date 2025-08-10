// Simplified Lead Capture API - Immediate Response
// This endpoint captures leads and returns immediately, processing external calls async

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://www.lfgventures.in');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { email, firstName, lastName, phone, source } = req.body;

        // Basic validation
        if (!email || !firstName || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email, firstName, phone'
            });
        }

        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Return success immediately
        const leadData = {
            email: email.trim(),
            firstName: firstName.trim(),
            lastName: lastName?.trim() || '',
            phone: phone.trim(),
            source: source || 'lead_capture_modal',
            timestamp: new Date().toISOString(),
            lead_id: `lead_${Date.now()}_${Math.random().toString(36).substring(7)}`
        };

        console.log('Lead captured:', { 
            email: leadData.email, 
            source: leadData.source,
            lead_id: leadData.lead_id 
        });

        // Process external integrations with timeout (wait briefly to ensure execution)
        try {
            await Promise.race([
                processExternalIntegrations(leadData),
                new Promise(resolve => setTimeout(resolve, 2000)) // 2 second timeout
            ]);
        } catch (err) {
            console.error('Background processing error:', err.message);
        }

        // Return immediately
        return res.status(200).json({
            success: true,
            message: 'Lead captured successfully',
            lead_id: leadData.lead_id,
            next_step: 'payment_page'
        });

    } catch (error) {
        console.error('Lead capture error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            lead_id: `error_${Date.now()}`
        });
    }
}

// Async function to process external integrations (runs in background)
async function processExternalIntegrations(leadData) {
    try {
        console.log('🔄 Starting external integrations for:', leadData.lead_id);
        console.log('🔍 Environment check - ZAPIER_LEAD_WEBHOOK_URL exists:', !!process.env.ZAPIER_LEAD_WEBHOOK_URL);

        // Process Zapier webhook (with timeout)
        if (process.env.ZAPIER_LEAD_WEBHOOK_URL) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const zapierPayload = {
                    email: leadData.email,
                    first_name: leadData.firstName,
                    last_name: leadData.lastName,
                    phone: leadData.phone,
                    lead_source: leadData.source,
                    timestamp: leadData.timestamp,
                    lead_id: leadData.lead_id
                };

                await fetch(process.env.ZAPIER_LEAD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(zapierPayload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log('✅ Zapier integration completed for:', leadData.lead_id, 'Status:', response.status);
            } catch (zapierError) {
                console.error('Zapier integration failed:', leadData.lead_id, zapierError.message);
            }
        }

        // Process Meta Pixel (simplified)
        if (process.env.FACEBOOK_ACCESS_TOKEN && process.env.FACEBOOK_PIXEL_ID) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const eventData = {
                    data: [{
                        event_name: 'Lead',
                        event_time: Math.floor(Date.now() / 1000),
                        event_id: leadData.lead_id,
                        action_source: 'website',
                        user_data: {
                            em: await hashSHA256(leadData.email),
                            fn: await hashSHA256(leadData.firstName),
                            ph: await hashSHA256(leadData.phone)
                        },
                        custom_data: {
                            content_name: 'Beyond the Deck Lead',
                            content_category: 'Course Interest'
                        }
                    }]
                };

                await fetch(`https://graph.facebook.com/v18.0/${process.env.FACEBOOK_PIXEL_ID}/events`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...eventData,
                        access_token: process.env.FACEBOOK_ACCESS_TOKEN
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log('Meta Pixel integration completed for:', leadData.lead_id);
            } catch (metaError) {
                console.error('Meta Pixel integration failed:', leadData.lead_id, metaError.message);
            }
        }

    } catch (error) {
        console.error('❌ External integrations processing failed:', leadData.lead_id, error.message, error.stack);
    }
}

// Simple SHA-256 hash function
async function hashSHA256(data) {
    if (!data) return '';
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
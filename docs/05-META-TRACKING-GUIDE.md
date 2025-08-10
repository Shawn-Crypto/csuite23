# Meta CAPI & Tracking Integration Guide

**Target**: Claude Code sessions implementing Meta Pixel tracking with deduplication  
**Guide 5 of 8**: Server-Side Meta CAPI & Client-Side Tracking

## Meta Pixel Setup Overview

### Key Components
1. **Client-Side Pixel**: Browser-based tracking via Meta Pixel script
2. **Server-Side CAPI**: Server-to-server event transmission
3. **Event Deduplication**: Preventing duplicate events using event IDs
4. **Enhanced Matching**: User data hashing for better attribution

## Server-Side Meta CAPI Implementation

### /api/meta-capi-server.js
```javascript
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      order_id, 
      customer_email, 
      customer_name, 
      customer_phone, 
      amount, 
      products, 
      payment_data 
    } = req.body;

    // Build event data with enhanced matching
    const eventData = buildMetaEventData({
      order_id,
      customer_email,
      customer_name,
      customer_phone,
      amount,
      products,
      payment_data
    });

    // Send to Meta Conversions API
    const response = await sendToMetaAPI(eventData);

    if (response.success) {
      console.log('✅ Meta CAPI event sent:', response.event_id);
      res.status(200).json({ success: true, event_id: response.event_id });
    } else {
      throw new Error(response.error || 'Meta CAPI failed');
    }

  } catch (error) {
    console.error('❌ Meta CAPI error:', error);
    res.status(500).json({ error: 'Meta CAPI processing failed' });
  }
}

function buildMetaEventData(data) {
  const timestamp = Math.floor(Date.now() / 1000);
  const eventId = `purchase_${data.order_id}`; // CRITICAL for deduplication
  
  return {
    data: [{
      event_name: 'Purchase',
      event_time: timestamp,
      event_id: eventId, // Must match client-side event ID
      event_source_url: 'https://www.yoursite.com',
      action_source: 'website',
      user_data: buildUserData(data),
      custom_data: buildCustomData(data),
      data_processing_options: [] // Required for compliance
    }],
    test_event_code: process.env.META_TEST_EVENT_CODE // Remove in production
  };
}

function buildUserData(data) {
  // Enhanced matching with hashed user data
  const userData = {};
  
  // Email (required for good match rate)
  if (data.customer_email) {
    userData.em = [hashData(data.customer_email.toLowerCase().trim())];
  }
  
  // Phone number
  if (data.customer_phone) {
    const cleanPhone = data.customer_phone.replace(/\D/g, '');
    userData.ph = [hashData(cleanPhone)];
  }
  
  // Name components
  if (data.customer_name) {
    const nameParts = data.customer_name.trim().split(' ');
    if (nameParts[0]) {
      userData.fn = [hashData(nameParts[0].toLowerCase())]; // First name
    }
    if (nameParts.length > 1) {
      userData.ln = [hashData(nameParts[nameParts.length - 1].toLowerCase())]; // Last name
    }
  }
  
  // Location data (customize based on your audience)
  userData.country = [hashData('in')]; // India
  userData.ct = [hashData('mumbai')]; // City
  userData.st = [hashData('mh')]; // State
  
  // External ID for better matching
  userData.external_id = [hashData(data.order_id)];
  
  // Browser data from payment
  if (data.payment_data?.user_agent) {
    userData.client_user_agent = data.payment_data.user_agent;
  }
  
  if (data.payment_data?.ip_address) {
    userData.client_ip_address = data.payment_data.ip_address;
  }
  
  // Facebook click ID if available
  if (data.payment_data?.fbc) {
    userData.fbc = data.payment_data.fbc;
  }
  
  // Facebook browser ID if available
  if (data.payment_data?.fbp) {
    userData.fbp = data.payment_data.fbp;
  }
  
  return userData;
}

function buildCustomData(data) {
  return {
    currency: 'INR',
    value: data.amount,
    content_ids: data.products || ['course'],
    content_type: 'product',
    content_name: getContentName(data.products),
    content_category: 'education',
    contents: buildContents(data.products, data.amount),
    num_items: data.products?.length || 1
  };
}

function buildContents(products, totalAmount) {
  if (!products || products.length === 0) {
    return [{ id: 'course', quantity: 1, item_price: totalAmount }];
  }
  
  return products.map(product => ({
    id: product,
    quantity: 1,
    item_price: getProductPrice(product)
  }));
}

function getContentName(products) {
  if (!products || products.length === 0) return 'Course Purchase';
  
  if (products.includes('course') && products.includes('database') && products.includes('strategy_call')) {
    return 'Complete Bundle';
  } else if (products.length > 1) {
    return `${products.join(' + ')} Bundle`;
  } else {
    return getProductName(products[0]);
  }
}

function getProductName(productId) {
  const names = {
    'course': 'Beyond the Deck Course',
    'database': 'Investor Database',
    'strategy_call': 'Strategy Call'
  };
  return names[productId] || productId;
}

function getProductPrice(productId) {
  const prices = {
    'course': 1499,
    'database': 2499,
    'strategy_call': 4999
  };
  return prices[productId] || 0;
}

function hashData(data) {
  if (!data) return '';
  return crypto.createHash('sha256').update(data.toString()).digest('hex');
}

async function sendToMetaAPI(eventData) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.META_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`
        },
        body: JSON.stringify(eventData)
      }
    );

    const result = await response.json();
    
    if (response.ok && result.events_received) {
      return { 
        success: true, 
        event_id: eventData.data[0].event_id,
        events_received: result.events_received 
      };
    } else {
      console.error('Meta API error:', result);
      return { 
        success: false, 
        error: result.error?.message || 'Unknown error' 
      };
    }
    
  } catch (error) {
    console.error('Meta API request failed:', error);
    return { success: false, error: error.message };
  }
}
```

## Client-Side Pixel Implementation

### Base Pixel Installation
```html
<!-- Add to <head> of all pages -->
<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  
  fbq('init', 'YOUR_PIXEL_ID'); // Replace with your Pixel ID
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
       src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"/>
</noscript>
<!-- End Meta Pixel Code -->
```

### Enhanced Event Tracking
```javascript
// js/meta-pixel-tracking.js
class MetaPixelTracker {
  constructor(pixelId) {
    this.pixelId = pixelId;
    this.initialized = false;
    this.init();
  }

  init() {
    if (typeof fbq !== 'undefined') {
      this.initialized = true;
      console.log('✅ Meta Pixel initialized');
      
      // Set up enhanced matching on init
      this.setupEnhancedMatching();
    } else {
      console.warn('⚠️ Meta Pixel not loaded');
    }
  }

  setupEnhancedMatching() {
    // Get user data if available from session
    const leadData = this.getLeadData();
    
    if (leadData && leadData.email) {
      fbq('init', this.pixelId, {
        em: leadData.email.toLowerCase(),
        fn: this.extractFirstName(leadData.name),
        ln: this.extractLastName(leadData.name),
        ph: this.cleanPhoneNumber(leadData.phone)
      });
    }
  }

  // Track lead generation
  trackLead(leadData) {
    if (!this.initialized) return;
    
    const eventId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    fbq('track', 'Lead', {
      content_name: 'Lead Capture Modal',
      content_category: 'lead_generation',
      value: 0,
      currency: 'INR'
    }, { eventID: eventId });
    
    console.log('✅ Lead event tracked:', eventId);
  }

  // Track initiate checkout
  trackInitiateCheckout(products, amount) {
    if (!this.initialized) return;
    
    const eventId = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    fbq('track', 'InitiateCheckout', {
      content_ids: products,
      content_type: 'product',
      num_items: products.length,
      value: amount,
      currency: 'INR'
    }, { eventID: eventId });
    
    console.log('✅ InitiateCheckout tracked:', eventId);
  }

  // Track purchase (CRITICAL: Must match server event ID)
  trackPurchase(orderId, amount, products) {
    if (!this.initialized) return;
    
    // CRITICAL: Event ID must match server-side
    const eventId = `purchase_${orderId}`;
    
    fbq('track', 'Purchase', {
      value: amount,
      currency: 'INR',
      content_ids: products,
      content_type: 'product',
      content_name: this.getProductName(products),
      num_items: products.length
    }, { eventID: eventId });
    
    console.log('✅ Purchase tracked with event ID:', eventId);
  }

  // Track add to cart (if applicable)
  trackAddToCart(product, price) {
    if (!this.initialized) return;
    
    fbq('track', 'AddToCart', {
      content_ids: [product],
      content_type: 'product',
      content_name: this.getProductName([product]),
      value: price,
      currency: 'INR'
    });
  }

  // Track page views with custom parameters
  trackPageView(pageName, category) {
    if (!this.initialized) return;
    
    fbq('track', 'PageView', {
      page_name: pageName,
      page_category: category
    });
  }

  // Helper methods
  getLeadData() {
    try {
      const data = sessionStorage.getItem('leadData');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  extractFirstName(fullName) {
    if (!fullName) return '';
    return fullName.split(' ')[0].toLowerCase();
  }

  extractLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  getProductName(products) {
    if (products.length === 3) return 'Complete Bundle';
    if (products.length === 2) return 'Bundle Package';
    if (products.includes('course')) return 'Course';
    return 'Product';
  }
}

// Initialize tracker
const metaTracker = new MetaPixelTracker('YOUR_PIXEL_ID');
```

## GTM Integration for Meta Pixel

### Data Layer Configuration
```javascript
// Push events to data layer for GTM processing
window.dataLayer = window.dataLayer || [];

// Purchase event with deduplication ID
function pushPurchaseToDataLayer(orderId, amount, products) {
  window.dataLayer.push({
    event: 'purchase',
    ecommerce: {
      transaction_id: orderId,
      value: amount,
      currency: 'INR',
      items: products.map(p => ({
        item_id: p,
        item_name: getProductName(p),
        price: getProductPrice(p),
        quantity: 1
      }))
    },
    // Meta Pixel specific data
    meta_pixel: {
      event_id: `purchase_${orderId}`, // CRITICAL: Must match server
      content_ids: products,
      content_type: 'product'
    }
  });
}
```

### GTM Meta Pixel Tag Configuration
```javascript
// Custom HTML Tag in GTM
<script>
  (function() {
    // Get data from data layer
    var eventId = {{DLV - Meta Event ID}};
    var transactionId = {{DLV - Transaction ID}};
    var value = {{DLV - Transaction Value}};
    var contentIds = {{DLV - Meta Content IDs}};
    
    // Only fire if we have required data
    if (transactionId && value) {
      // Use consistent event ID format
      var finalEventId = eventId || 'purchase_' + transactionId;
      
      fbq('track', 'Purchase', {
        value: value,
        currency: 'INR',
        content_ids: contentIds || ['course'],
        content_type: 'product'
      }, {
        eventID: finalEventId
      });
      
      console.log('GTM Meta Pixel fired with event ID:', finalEventId);
    }
  })();
</script>
```

## Event Deduplication Strategy

### Critical Rules for Deduplication

1. **Consistent Event IDs**: Always use format `eventType_orderId`
2. **Client & Server Match**: Both must send identical event IDs
3. **Timing**: Server events should fire within 5 minutes of client
4. **Data Consistency**: Currency and value must match exactly

### Implementation Pattern
```javascript
// Client-side (success page)
const orderId = urlParams.get('order_id');
const eventId = `purchase_${orderId}`; // Consistent format
fbq('track', 'Purchase', data, { eventID: eventId });

// Server-side (webhook)
const eventId = `purchase_${order_id}`; // Same format
const metaEventData = {
  event_id: eventId, // Must match client
  // ... other data
};
```

## Testing Meta Pixel Integration

### Test Event Code Setup
```javascript
// For testing in Events Manager
const TEST_EVENT_CODE = 'TEST12345'; // Your test code

// Add to server events
if (process.env.NODE_ENV !== 'production') {
  eventData.test_event_code = TEST_EVENT_CODE;
}

// Test endpoint for validation
app.post('/api/test-meta-pixel', async (req, res) => {
  const testData = {
    data: [{
      event_name: 'Test',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `test_${Date.now()}`,
      user_data: { em: [hashData('test@example.com')] },
      custom_data: { value: 100, currency: 'INR' }
    }],
    test_event_code: TEST_EVENT_CODE
  };
  
  const result = await sendToMetaAPI(testData);
  res.json(result);
});
```

### Validation Checklist

1. **Events Manager Check**:
   - Go to Events Manager → Test Events
   - Enter your test event code
   - Verify events appear in real-time

2. **Deduplication Verification**:
   - Check "Event Deduplication" column
   - Should show "Deduplicated" for duplicate events
   - Both client and server events should appear

3. **Match Quality Check**:
   - Review "Match Quality" score
   - Should be >7.0 for good performance
   - Add more user data parameters to improve

4. **Event Parameters**:
   - Verify all custom data parameters
   - Check value and currency accuracy
   - Ensure product IDs are correct

## Common Issues & Solutions

### Issue 1: Events Not Deduplicating
```javascript
// Problem: Different event IDs
// Client: purchase_1234567890
// Server: purchase_order_xyz_123

// Solution: Standardize format
const eventId = `purchase_${orderId.replace(/[^a-zA-Z0-9]/g, '_')}`;
```

### Issue 2: Low Match Quality
```javascript
// Solution: Add more user data
userData.em = [hashData(email)];
userData.ph = [hashData(phone)];
userData.fn = [hashData(firstName)];
userData.ln = [hashData(lastName)];
userData.ct = [hashData(city)];
userData.st = [hashData(state)];
userData.zp = [hashData(zipCode)];
```

### Issue 3: Server Events Not Firing
```javascript
// Check webhook processing
console.log('Sending to Meta CAPI:', eventData);

// Add timeout handling
const response = await fetch(metaApiUrl, {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(eventData),
  timeout: 8000 // 8 second timeout
});
```

## Compliance & Privacy

### Data Processing Options
```javascript
// For CCPA compliance
eventData.data_processing_options = [];
eventData.data_processing_options_country = 0;
eventData.data_processing_options_state = 0;

// For limited data use
if (userOptedOutOfTargeting) {
  eventData.data_processing_options = ['LDU'];
  eventData.data_processing_options_country = 0;
  eventData.data_processing_options_state = 0;
}
```

### User Consent Handling
```javascript
// Check for consent before tracking
if (hasUserConsent()) {
  fbq('track', 'Purchase', data);
  sendToMetaCAPI(eventData);
} else {
  console.log('Tracking skipped - no user consent');
}
```

## Next Steps

1. **Set up Meta Pixel** base code on all pages
2. **Implement server-side CAPI** endpoint
3. **Configure GTM tags** with proper event IDs
4. **Test deduplication** in Events Manager
5. **Monitor match quality** and optimize
6. **Set up custom conversions** in Ads Manager

## Critical Success Factors

1. **Event ID consistency** is paramount for deduplication
2. **Hash all PII** before sending to Meta
3. **Include test event codes** during development
4. **Monitor Events Manager** regularly for issues
5. **Maintain <5 minute gap** between client and server events
6. **Use enhanced matching** for better attribution
7. **Test thoroughly** before launching campaigns

This guide ensures proper Meta Pixel implementation with working deduplication based on lessons learned from production deployments.
# Production Deployment Checklist

**Target**: Claude Code sessions deploying to production  
**Guide 8 of 8**: Complete Production Deployment & Monitoring Setup

## Pre-Deployment Checklist

### ✅ Code Review
```markdown
- [ ] All console.logs removed or wrapped in debug flag
- [ ] No hardcoded credentials or secrets
- [ ] Error handling implemented for all API calls
- [ ] Timeouts configured for external services
- [ ] Environment-specific code properly separated
- [ ] Test mode flags removed from production code
```

### ✅ Security Audit
```markdown
- [ ] All environment variables in Vercel dashboard
- [ ] Webhook secrets configured and validated
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (if using raw queries)
- [ ] XSS protection headers set
```

## Environment Variables Setup

### Vercel Dashboard Configuration
```bash
# Production Variables (Add in Vercel Dashboard)
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_live_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

META_PIXEL_ID=your_pixel_id
META_ACCESS_TOKEN=your_long_lived_token
# Remove META_TEST_EVENT_CODE in production

ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxxx
ZAPIER_LEAD_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxxx

KAJABI_API_KEY=your_kajabi_key
KAJABI_OFFER_ID=your_offer_id

CALCOM_API_KEY=your_calcom_key
CALCOM_EVENT_TYPE_ID=your_event_id

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_anon_key

SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
NODE_ENV=production
```

### Environment Validation Script
```javascript
// scripts/validate-env.js
const requiredEnvVars = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'META_PIXEL_ID',
  'META_ACCESS_TOKEN',
  'ZAPIER_WEBHOOK_URL'
];

const missingVars = requiredEnvVars.filter(
  varName => !process.env[varName]
);

if (missingVars.length > 0) {
  console.error('❌ Missing environment variables:', missingVars);
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

## Vercel Configuration

### vercel.json
```json
{
  "functions": {
    "api/razorpay-webhook.js": {
      "maxDuration": 10
    },
    "api/create-razorpay-order.js": {
      "maxDuration": 30
    },
    "api/verify-razorpay-payment.js": {
      "maxDuration": 10
    },
    "api/capture-lead-async.js": {
      "maxDuration": 10
    },
    "api/meta-capi-server.js": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/success",
      "destination": "/success.html"
    }
  ]
}
```

## Database Setup

### Supabase Schema Deployment
```sql
-- Run in Supabase SQL Editor

-- Webhook events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'INR',
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  products JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Lead captures table
CREATE TABLE IF NOT EXISTS lead_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  source VARCHAR(100) DEFAULT 'website',
  zapier_sent BOOLEAN DEFAULT FALSE,
  meta_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_webhook_events_order_id ON webhook_events(order_id);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX idx_lead_captures_email ON lead_captures(email);
CREATE INDEX idx_lead_captures_created_at ON lead_captures(created_at);

-- Row Level Security
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_captures ENABLE ROW LEVEL SECURITY;
```

## Deployment Steps

### 1. Pre-Deployment Testing
```bash
# Run all tests locally
npm test

# Build production bundle
npm run build

# Test production build locally
NODE_ENV=production npm start

# Verify all endpoints
curl http://localhost:3000/api/health-check
```

### 2. Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Or use GitHub integration for auto-deploy
```

### 3. Post-Deployment Verification
```bash
# Check deployment status
vercel list

# Check function logs
vercel logs https://your-deployment.vercel.app

# Test production endpoints
curl https://yoursite.com/api/health-check

# Test order creation (with test flag)
curl -X POST https://yoursite.com/api/create-razorpay-order \
  -H "Content-Type: application/json" \
  -d '{"amount":1,"test_mode":true}'
```

## Razorpay Webhook Configuration

### Setting Up Production Webhook
```markdown
1. Login to Razorpay Dashboard
2. Navigate to Settings → Webhooks
3. Add new webhook:
   - URL: https://yoursite.com/api/razorpay-webhook
   - Secret: Generate and save to RAZORPAY_WEBHOOK_SECRET
   - Events to subscribe:
     - payment.captured
     - payment.failed
     - order.paid
4. Test webhook with test payment
5. Verify signature validation works
```

## Monitoring Setup

### Health Check Endpoint
```javascript
// api/health-check.js
export default async function handler(req, res) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    checks: {}
  };

  try {
    // Check Razorpay connectivity
    health.checks.razorpay = await checkRazorpay();
    
    // Check database connectivity
    health.checks.database = await checkDatabase();
    
    // Check Meta API
    health.checks.metaApi = await checkMetaAPI();
    
    const allHealthy = Object.values(health.checks)
      .every(check => check.status === 'healthy');
    
    res.status(allHealthy ? 200 : 503).json(health);
    
  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;
    res.status(500).json(health);
  }
}

async function checkRazorpay() {
  try {
    // Simple API call to verify credentials
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    
    await razorpay.orders.all({ count: 1 });
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

### Uptime Monitoring
```markdown
## Recommended Services

### UptimeRobot (Free tier available)
1. Create account at uptimerobot.com
2. Add monitors:
   - https://yoursite.com (Main site)
   - https://yoursite.com/api/health-check (API health)
3. Set check interval: 5 minutes
4. Configure alerts: Email, Slack, SMS

### Better Stack (Recommended for production)
1. Create account at betterstack.com
2. Add heartbeat monitors for critical endpoints
3. Set up status page for customers
4. Configure incident management
```

### Error Tracking with Sentry
```javascript
// utils/sentry.js
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  }
});

export function captureError(error, context = {}) {
  Sentry.withScope(scope => {
    Object.keys(context).forEach(key => {
      scope.setExtra(key, context[key]);
    });
    Sentry.captureException(error);
  });
}

// Usage in API endpoints
try {
  // API logic
} catch (error) {
  captureError(error, {
    endpoint: '/api/razorpay-webhook',
    orderId: req.body.order_id
  });
  throw error;
}
```

## Performance Optimization

### CDN Configuration
```markdown
## Cloudflare Setup (Optional but Recommended)

1. Add domain to Cloudflare
2. Configure DNS to point to Vercel
3. Set up page rules:
   - Cache Level: Standard for /api/*
   - Cache Level: Aggressive for /assets/*
4. Enable optimizations:
   - Auto Minify: JavaScript, CSS, HTML
   - Brotli compression
   - HTTP/3 QUIC
5. Configure firewall rules for webhook endpoints
```

### Asset Optimization
```html
<!-- Preload critical resources -->
<link rel="preload" href="/css/critical.css" as="style">
<link rel="preload" href="/js/main.js" as="script">
<link rel="preconnect" href="https://api.razorpay.com">
<link rel="preconnect" href="https://graph.facebook.com">

<!-- Lazy load non-critical scripts -->
<script defer src="/js/analytics.js"></script>
<script defer src="/js/tracking.js"></script>
```

## Go-Live Checklist

### Final Verification
```markdown
## Pre-Launch (1 hour before)
- [ ] All environment variables set in Vercel
- [ ] Database migrations applied
- [ ] Webhook endpoints configured in Razorpay
- [ ] Meta Pixel test events working
- [ ] Zapier webhooks tested
- [ ] Health check endpoint responding
- [ ] Error tracking configured
- [ ] Uptime monitoring active

## Launch
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Test complete payment flow with ₹1 transaction
- [ ] Check webhook processing
- [ ] Verify Meta Events Manager
- [ ] Check email delivery

## Post-Launch (First 24 hours)
- [ ] Monitor error rates in Sentry
- [ ] Check webhook success rate
- [ ] Review performance metrics
- [ ] Monitor conversion tracking
- [ ] Check for any 404s or 500s
- [ ] Review customer support tickets
- [ ] Verify all automations working
```

## Rollback Plan

### Quick Rollback Process
```bash
# If issues detected, rollback immediately

# Via Vercel CLI
vercel rollback

# Or via Vercel Dashboard
# 1. Go to Deployments
# 2. Find last working deployment
# 3. Click "..." → "Promote to Production"

# Verify rollback
curl https://yoursite.com/api/health-check
```

### Emergency Contacts
```markdown
## Support Contacts
- Razorpay Support: support@razorpay.com
- Meta Business Support: business.facebook.com/help
- Vercel Support: vercel.com/support
- Your Team:
  - Backend Lead: [Contact]
  - Frontend Lead: [Contact]
  - DevOps: [Contact]
```

## Post-Deployment Monitoring

### Daily Checks (First Week)
```markdown
- [ ] Review Vercel function logs
- [ ] Check webhook success rate
- [ ] Monitor payment conversion rate
- [ ] Review Meta Pixel match rate
- [ ] Check Zapier task history
- [ ] Review error logs in Sentry
- [ ] Verify database growth rate
```

### Weekly Metrics Review
```javascript
// scripts/weekly-metrics.js
async function generateWeeklyReport() {
  const metrics = {
    orders: await getOrderCount(),
    revenue: await getTotalRevenue(),
    conversionRate: await getConversionRate(),
    webhookSuccessRate: await getWebhookSuccessRate(),
    avgResponseTime: await getAvgResponseTime(),
    errors: await getErrorCount()
  };
  
  console.log('📊 Weekly Metrics:', metrics);
  
  // Send to team via Slack/Email
  await sendMetricsReport(metrics);
}
```

## Scaling Considerations

### When to Upgrade
```markdown
## Vercel Plan Upgrade Triggers
- Function invocations > 100k/month
- Bandwidth > 100GB/month
- Build minutes > 6000/month

## Database Scaling
- Supabase: Upgrade when:
  - Database size > 500MB
  - Concurrent connections > 50
  - Request rate > 1000/minute

## Monitoring Scaling
- Add APM when:
  - Daily transactions > 10k
  - Need detailed performance tracing
  - Multiple team members debugging
```

## Documentation

### Create Runbook
```markdown
# Production Runbook

## Common Issues & Solutions

### Issue: Webhook failing with 401
**Solution**: Check RAZORPAY_WEBHOOK_SECRET in Vercel

### Issue: Meta events not appearing
**Solution**: Check META_ACCESS_TOKEN validity

### Issue: Emails not sending
**Solution**: Check Zapier task history and webhook URL

## Emergency Procedures

### Complete payment system failure
1. Enable maintenance mode
2. Rollback to last working deployment
3. Contact Razorpay support
4. Notify customers via email/social

### Database connection issues
1. Check Supabase status page
2. Verify connection string
3. Restart Vercel functions
4. Scale database if needed
```

## Success Metrics

### KPIs to Track
- **Payment Success Rate**: > 95%
- **Webhook Success Rate**: > 99%
- **API Response Time**: < 500ms average
- **Error Rate**: < 1%
- **Uptime**: > 99.9%
- **Meta Pixel Match Rate**: > 80%

## Final Notes

1. **Always test in production** with small amounts first
2. **Monitor closely** for the first 48 hours
3. **Keep rollback ready** for quick recovery
4. **Document everything** for future reference
5. **Celebrate launch** but stay vigilant! 🎉

This deployment guide ensures a smooth, reliable production launch based on battle-tested practices.
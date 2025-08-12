# Production Deployment Checklist

## Pre-Deployment Requirements ✅

### 1. Razorpay Production Setup
- [ ] **Get Live Credentials**: Login to Razorpay Dashboard → Settings → API Keys
  - [ ] Generate Live Key ID (starts with `rzp_live_`)
  - [ ] Generate Live Key Secret
  - [ ] Enable live mode on your Razorpay account
- [ ] **Configure Webhooks**: Dashboard → Settings → Webhooks
  - [ ] Add webhook URL: `https://your-domain.com/api/razorpay-webhook`
  - [ ] Select events: `payment.captured`, `payment.failed`, `order.paid`
  - [ ] Generate and save webhook secret
  - [ ] Set webhook to "Active"
- [ ] **Update Environment Variables**:
  ```bash
  RAZORPAY_MODE=live
  RAZORPAY_LIVE_KEY_ID=rzp_live_XXXXXXXXXX
  RAZORPAY_LIVE_KEY_SECRET=your_live_secret
  RAZORPAY_LIVE_WEBHOOK_SECRET=your_webhook_secret
  ```

### 2. Database Schema Deployment
- [ ] **Login to Supabase**: https://app.supabase.com
- [ ] **Go to SQL Editor**
- [ ] **Execute Schema**: Copy/paste contents of `database/schema.sql`
- [ ] **Verify Tables Created**:
  - [ ] webhook_events
  - [ ] webhook_errors
  - [ ] lead_captures
  - [ ] purchase_analytics
  - [ ] meta_pixel_events
  - [ ] system_health
- [ ] **Test Database Connection**: 
  ```bash
  node -e "
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  client.from('system_health').select('*').limit(1).then(console.log);
  "
  ```

### 3. Meta Pixel Production Configuration
- [ ] **Remove Test Event Code**: Ensure `META_TEST_EVENT_CODE` is not set in production
- [ ] **Verify Pixel Domain**: Add production domain in Meta Business Manager
- [ ] **Set up Custom Conversions**: Create "Course Purchase" conversion in Ads Manager
- [ ] **Configure iOS 14+ Settings**: If targeting iOS users
- [ ] **Verify Access Token**: Ensure token has required permissions

### 4. Vercel Environment Variables Setup
- [ ] **Go to Vercel Dashboard**: https://vercel.com/dashboard/your-project
- [ ] **Settings → Environment Variables**
- [ ] **Add Production Variables**: Copy from `.env.production`
- [ ] **Set Deployment Context**: Production only
- [ ] **Add Preview Variables**: Use test credentials for preview deployments

## Deployment Process 🚀

### Step 1: Environment Configuration
```bash
# Copy production environment
cp .env.production .env

# Verify all variables are set
node scripts/validate-env.js
```

### Step 2: Pre-deployment Testing
```bash
# Test API health
curl https://your-domain.com/api/health-check

# Test Razorpay configuration
node scripts/test-razorpay.js

# Verify database connectivity
node scripts/setup-database.js
```

### Step 3: Deploy to Production
```bash
# Deploy with production token
vercel --prod --token YOUR_VERCEL_TOKEN

# Or using Vercel CLI
vercel --prod
```

### Step 4: Post-Deployment Verification
```bash
# Health check
curl https://your-domain.com/api/health-check

# Test webhook endpoint
curl -X POST https://your-domain.com/api/razorpay-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Verify Meta CAPI endpoint
curl https://your-domain.com/api/meta-capi-server
```

## Production Testing Protocol 🧪

### 1. Complete Payment Flow Test
- [ ] **Navigate to Production Site**
- [ ] **Fill Lead Capture Form**
- [ ] **Verify Razorpay Checkout Opens**
- [ ] **Test Payment with Live Card** (small amount)
- [ ] **Confirm Success Page Redirect**
- [ ] **Check All Tracking Events**:
  - [ ] GTM Enhanced events
  - [ ] Meta Pixel events
  - [ ] Database entries
  - [ ] Zapier webhook triggers

### 2. Webhook Processing Test
- [ ] **Check Vercel Function Logs**
- [ ] **Verify Webhook Response Time < 200ms**
- [ ] **Confirm Database Entries Created**
- [ ] **Test Zapier Automations**:
  - [ ] Kajabi course access email sent
  - [ ] Database delivery email (if applicable)
  - [ ] Calendar booking link (if applicable)

### 3. Tracking Verification
- [ ] **Meta Events Manager**: Check real-time events
- [ ] **GTM Debug Console**: Verify all events firing
- [ ] **Database Analytics**: Run sample queries
- [ ] **Supabase Dashboard**: Check table data

### 4. Performance Monitoring
- [ ] **Vercel Analytics**: Check function execution times
- [ ] **Core Web Vitals**: Verify page performance
- [ ] **Error Tracking**: Monitor for any issues
- [ ] **Database Performance**: Check query execution times

## Monitoring Setup 📊

### 1. Error Tracking
- [ ] **Set up Sentry** (optional): Add DSN to environment
- [ ] **Configure Slack Alerts**: For critical errors
- [ ] **Monitor Vercel Logs**: Set up notifications
- [ ] **Database Error Tracking**: Monitor webhook_errors table

### 2. Performance Monitoring
- [ ] **Webhook Response Times**: Target < 200ms
- [ ] **Payment Success Rate**: Target > 99%
- [ ] **Conversion Tracking**: Monitor funnel performance
- [ ] **API Uptime**: Monitor all endpoints

### 3. Business Metrics
- [ ] **Revenue Tracking**: Monitor purchase_analytics table
- [ ] **Lead Conversion**: Track lead_captures → purchases
- [ ] **Product Performance**: Monitor product mix
- [ ] **Customer Journey**: Analyze time-to-conversion

## Rollback Procedure 🔄

### If Issues Arise:
```bash
# 1. Switch back to test mode immediately
export RAZORPAY_MODE=test
vercel --prod

# 2. Verify test mode is active
curl https://your-domain.com/api/health-check

# 3. Fix issues in staging environment
# 4. Re-test thoroughly
# 5. Deploy again when ready
```

## Security Checklist 🔒

- [ ] **Environment Variables**: Never commit to git
- [ ] **API Keys**: Use different keys for test/production
- [ ] **Webhook Signatures**: Always verify signatures
- [ ] **HTTPS Only**: Ensure all endpoints use HTTPS
- [ ] **CORS Configuration**: Restrict to your domains
- [ ] **Rate Limiting**: Implement if necessary
- [ ] **Error Messages**: Don't expose sensitive information

## Post-Launch Monitoring 👀

### Week 1: Close Monitoring
- [ ] **Daily Health Checks**: Monitor all systems
- [ ] **Payment Flow Testing**: Test purchases daily
- [ ] **Error Rate Tracking**: Watch for any spikes
- [ ] **Customer Feedback**: Monitor for issues

### Week 2-4: Regular Monitoring
- [ ] **Weekly Performance Reviews**: Check metrics
- [ ] **Monthly Analytics**: Revenue and conversion analysis
- [ ] **Quarterly Reviews**: System optimization opportunities

## Emergency Contacts 📞

- **Razorpay Support**: support@razorpay.com
- **Vercel Support**: Via dashboard
- **Supabase Support**: Via dashboard
- **Meta Business Support**: Via Business Manager

## Success Criteria ✅

Deployment is successful when:
- [ ] Health check returns 200 OK
- [ ] Complete payment flow works end-to-end
- [ ] All tracking events fire correctly
- [ ] Webhook processing < 200ms response time
- [ ] No critical errors in logs
- [ ] Customer receives course access after payment
- [ ] Analytics data flows correctly

---

**Remember**: Test everything thoroughly in a staging environment before production deployment!
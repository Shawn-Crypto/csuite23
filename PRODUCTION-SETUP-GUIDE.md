# Production Setup Guide

## Current Status
✅ **Test Environment Working**: All systems tested and functional
⚠️ **Production Credentials Needed**: Ready to configure production

## 1. Razorpay Production Credentials

### Current Test Credentials
```
RAZORPAY_KEY_ID=rzp_test_SWb5ypxKYwCUKK
RAZORPAY_KEY_SECRET=eUqfESP2Az0g76dorqwGmHpt
```

### Production Credentials Needed
```
# Get these from Razorpay Dashboard → Settings → API Keys
RAZORPAY_LIVE_KEY_ID=rzp_live_xxxxxxxxx
RAZORPAY_LIVE_KEY_SECRET=your_live_secret_key

# Get from Dashboard → Settings → Webhooks
RAZORPAY_LIVE_WEBHOOK_SECRET=your_live_webhook_secret
```

### Steps to Get Production Credentials:
1. **Login to Razorpay Dashboard**: https://dashboard.razorpay.com
2. **Go to Settings → API Keys**
3. **Generate Live Keys** (requires business verification)
4. **Set up Webhook**:
   - URL: `https://your-domain.com/api/razorpay-webhook`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
   - Secret: Generate and save securely

---

## 2. Meta Pixel Production Configuration

### Current Configuration
```
META_PIXEL_ID=726737740336667
META_ACCESS_TOKEN=EAALBKYywVzQBPIJjQM7gzUxn2QbvxIIqGtCOBS8LmumDFznTnwmbNZAbW05v6OykhqyT35HqqKGed0hgK25ZAlpaW8p8VpsLWIpgKDfKvw5OZCHlwuDObs4ZCpq5wN1hBZCLdCugpAiHLOaoJjhc0U2bvAkZCpq6ZAghnwgJIE3b5oZAlpL1jd7WIq1g1f0dIgZDZD
```

### Production Checklist:
- ✅ **Pixel ID Confirmed**: 726737740336667
- ✅ **Access Token Active**: Never expires
- ⚠️ **Remove Test Event Code**: Update for production

### Steps for Production:
1. **Remove Test Event Code** from `js/meta-pixel.js`
2. **Verify Pixel Domain**: Add your production domain to pixel settings
3. **Set up Custom Conversions** in Ads Manager
4. **Configure iOS 14+ Settings** if targeting iOS users

---

## 3. Supabase Database Configuration

### Current Configuration
```
SUPABASE_URL=https://qrcqviyzwvgsfyvflcog.supabase.co
SUPABASE_KEY=sb_secret_qG1B_Vm7D8QYm14sYZYYFg_R8k9p9J-
```

### Database Schema Needed
```sql
-- Create webhook_events table
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'INR',
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  payment_method VARCHAR(50),
  products JSONB,
  product_flags JSONB,
  razorpay_payment_status VARCHAR(50),
  processed_at TIMESTAMP DEFAULT NOW(),
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_webhook_events_order_id ON webhook_events(order_id);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);

-- Create webhook_errors table for error tracking
CREATE TABLE webhook_errors (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255),
  event_type VARCHAR(100),
  error_message TEXT,
  error_stack TEXT,
  webhook_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Steps to Set Up Database:
1. **Login to Supabase Dashboard**: https://app.supabase.com
2. **Go to SQL Editor**
3. **Run the schema SQL above**
4. **Verify Tables Created**
5. **Test Connection** with current credentials

---

## 4. Zapier Webhook Configuration

### Current Configuration
```
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/23606322/u34shwt/
ZAPIER_LEAD_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/23606322/u6t1nd5/
```

### Production Checklist:
- ✅ **Purchase Webhook Active**: u34shwt
- ✅ **Lead Webhook Active**: u6t1nd5
- ⚠️ **Test Webhook Flow**: Verify automation works

### Steps to Verify:
1. **Test Purchase Flow**: Send test webhook to purchase URL
2. **Test Lead Flow**: Send test lead to lead URL
3. **Verify Kajabi Integration**: Check course access emails
4. **Verify Calendar Integration**: Check strategy call booking

---

## 5. Environment Variables Summary

### Production .env Configuration
```bash
# Environment
NODE_ENV=production
RAZORPAY_MODE=live

# Razorpay Live Credentials
RAZORPAY_LIVE_KEY_ID=rzp_live_xxxxxxxxx
RAZORPAY_LIVE_KEY_SECRET=your_live_secret_key
RAZORPAY_LIVE_WEBHOOK_SECRET=your_live_webhook_secret

# Razorpay Test Credentials (keep for testing)
RAZORPAY_TEST_KEY_ID=rzp_test_SWb5ypxKYwCUKK
RAZORPAY_TEST_KEY_SECRET=eUqfESP2Az0g76dorqwGmHpt
RAZORPAY_TEST_WEBHOOK_SECRET=secret_lotus-lfg

# Database
SUPABASE_URL=https://qrcqviyzwvgsfyvflcog.supabase.co
SUPABASE_KEY=sb_secret_qG1B_Vm7D8QYm14sYZYYFg_R8k9p9J-

# Meta Pixel (Production)
META_PIXEL_ID=726737740336667
META_ACCESS_TOKEN=EAALBKYywVzQBPIJjQM7gzUxn2QbvxIIqGtCOBS8LmumDFznTnwmbNZAbW05v6OykhqyT35HqqKGed0hgK25ZAlpaW8p8VpsLWIpgKDfKvw5OZCHlwuDObs4ZCpq5wN1hBZCLdCugpAiHLOaoJjhc0U2bvAkZCpq6ZAghnwgJIE3b5oZAlpL1jd7WIq1g1f0dIgZDZD
# Remove META_TEST_EVENT_CODE for production

# Zapier Webhooks
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/23606322/u34shwt/
ZAPIER_LEAD_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/23606322/u6t1nd5/

# Additional Monitoring (Optional)
WEBHOOK_ERROR_ALERT_URL=your_slack_webhook_or_email_service
PERFORMANCE_MONITORING_URL=your_monitoring_service
APP_VERSION=1.0.0
DEPLOY_TIME=2025-01-11T12:00:00Z
```

---

## 6. Vercel Environment Variables

### Steps to Set Up:
1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select Your Project**: csuite23
3. **Go to Settings → Environment Variables**
4. **Add All Production Variables** from the list above
5. **Set Deployment Contexts**:
   - Production: Use live credentials
   - Preview: Use test credentials

### Important Notes:
- **Never commit .env to git**
- **Use different credentials for preview/staging**
- **Set up monitoring for production**

---

## 7. Pre-Launch Checklist

### Technical Verification
- [ ] Database schema deployed
- [ ] Razorpay live credentials configured
- [ ] Webhook endpoint responding <200ms
- [ ] Meta Pixel test events removed
- [ ] Zapier automations tested
- [ ] SSL certificate active
- [ ] Domain properly configured

### Testing Protocol
- [ ] Test full payment flow with real card
- [ ] Verify webhook processing
- [ ] Check Meta Events Manager
- [ ] Confirm email automations
- [ ] Test mobile responsiveness
- [ ] Cross-browser compatibility

### Monitoring Setup
- [ ] Error tracking configured
- [ ] Performance monitoring active
- [ ] Webhook success rate monitoring
- [ ] Meta pixel event monitoring
- [ ] Database query performance

---

## 8. Go-Live Procedure

### Step 1: Update Environment
```bash
# Update RAZORPAY_MODE to live
RAZORPAY_MODE=live

# Add live credentials
RAZORPAY_LIVE_KEY_ID=your_live_key
RAZORPAY_LIVE_KEY_SECRET=your_live_secret
```

### Step 2: Deploy to Production
```bash
vercel --prod
```

### Step 3: Verify All Systems
1. Check webhook endpoint: `/api/health-check`
2. Test order creation: `/api/create-order` 
3. Verify Meta pixel firing
4. Test complete payment flow

### Step 4: Monitor Closely
- Watch Razorpay dashboard for payments
- Monitor Meta Events Manager
- Check Vercel function logs
- Verify Zapier automations

---

## Support & Troubleshooting

### Quick Debug Commands
```bash
# Check environment
curl https://your-domain.com/api/health-check

# Test webhook
curl -X POST https://your-domain.com/api/razorpay-webhook

# Check version
curl https://your-domain.com/api/version
```

### Common Issues
1. **Webhook timeout**: Check processing time in logs
2. **Payment failure**: Verify Razorpay credentials
3. **Tracking issues**: Check Meta Events Manager
4. **Email not sending**: Verify Zapier webhook URLs

### Emergency Rollback
```bash
# Revert to test mode
RAZORPAY_MODE=test
vercel --prod
```

This guide covers all steps needed to move from test to production environment safely.
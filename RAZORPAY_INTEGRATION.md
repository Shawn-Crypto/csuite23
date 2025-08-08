# Razorpay Payment Integration Guide

## Overview
This document describes the Razorpay payment integration for the Lotuslion course website, replacing the previous Cashfree external redirect flow with an embedded, seamless checkout experience.

## Quick Start

### 1. Environment Setup
```bash
# Copy environment variables
cp .env.example .env

# Install dependencies
npm install

# Install Playwright browsers for testing
npx playwright install
```

### 2. Configure Razorpay Credentials
Edit `.env` file with your Razorpay credentials:
```env
RAZORPAY_KEY_ID=rzp_test_SWb5ypxKYwCUKK
RAZORPAY_KEY_SECRET=eUqfESP2Az0g76dorqwGmHpt
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Test Payment Flow
```bash
# Run tests
npm test

# Run tests with UI
npm run test:headed

# Debug tests
npm run test:debug
```

## Architecture

### Frontend Components
- **`js/razorpay-checkout.js`** - Main checkout integration
  - Customer form modal
  - Razorpay widget initialization
  - Payment verification
  - Conversion tracking

### Backend API Endpoints
- **`/api/create-order`** - Creates Razorpay order
- **`/api/verify-payment`** - Verifies payment signature
- **`/api/webhook`** - Handles Razorpay webhooks

### Supporting Libraries
- **`api/lib/logger.js`** - Event logging and deduplication
- **`api/lib/meta-capi.js`** - Meta Conversions API integration

## Payment Flow

1. **Customer clicks "ENROLL NOW"**
   - Customer form modal appears
   - User enters name, email, phone

2. **Order Creation**
   - Frontend calls `/api/create-order`
   - Backend creates Razorpay order
   - Returns order ID and key

3. **Payment Processing**
   - Razorpay checkout widget opens
   - Customer completes payment
   - Payment data sent to Razorpay

4. **Payment Verification**
   - Frontend receives payment response
   - Calls `/api/verify-payment`
   - Backend verifies signature

5. **Success Handling**
   - Conversion tracked in GTM
   - Customer redirected to success page
   - Webhook processes async events

## Test Credentials

### Test Cards
```
Success: 4111 1111 1111 1111
Failure: 5105 1051 0510 5100
International: 4012 8888 8881 881
```

### Test UPI
```
Success: success@razorpay
Failure: failure@razorpay
```

### Test Net Banking
- Bank: HDFC
- Success flow enabled by default

## Webhook Configuration

1. **Configure in Razorpay Dashboard**
   - URL: `https://lotuslion.in/api/webhook`
   - Events to subscribe:
     - payment.captured
     - payment.failed
     - order.paid
     - refund.created

2. **Get Webhook Secret**
   - Copy from Razorpay dashboard
   - Add to `.env` file

## Event Tracking

### Google Tag Manager
Events are automatically tracked:
- `begin_checkout` - When checkout initiated
- `purchase` - On successful payment
- `payment_failed` - On payment failure

### Meta Conversions API
Configure in `.env`:
```env
META_PIXEL_ID=your_pixel_id
META_ACCESS_TOKEN=your_access_token
META_TEST_EVENT_CODE=TEST12345  # For testing
```

### Vercel Logs
All events logged with prefixes:
- `[PAYMENT_EVENT]` - Payment events
- `[CONVERSION]` - Successful conversions
- `[META_CAPI]` - Meta API events
- `[DUPLICATE_SKIPPED]` - Deduplicated events

## Deployment

### Local Development
```bash
# Serve static files
npx serve -s . -p 3000

# In another terminal, run Vercel dev for APIs
vercel dev
```

### Production Deployment
```bash
# Deploy to Vercel
vercel --prod

# Or with CI/CD
git push origin main
```

## Security Considerations

1. **API Keys**: Never expose in frontend code
2. **Signature Verification**: Always verify webhook signatures
3. **PII Handling**: Hash customer data for Meta CAPI
4. **CORS**: Configured for production domain only
5. **Rate Limiting**: Implement on API endpoints

## Monitoring

### Key Metrics
- Conversion rate: Target 25% improvement
- Payment success rate: Monitor via webhooks
- API response time: <500ms target
- Failed payments: Track reasons

### Debug Mode
Enable detailed logging:
```javascript
// In browser console
localStorage.setItem('debug', 'razorpay:*');
```

## Troubleshooting

### Common Issues

**Payment widget doesn't open**
- Check browser console for errors
- Verify API keys are correct
- Ensure CORS is configured

**Webhook not received**
- Verify webhook URL is accessible
- Check webhook secret matches
- Review Vercel function logs

**Payment verification fails**
- Ensure signature calculation is correct
- Check order ID matches
- Verify key secret is correct

## Support

For issues or questions:
- Razorpay Support: https://razorpay.com/support
- Technical Documentation: https://razorpay.com/docs
- Test Environment: https://dashboard.razorpay.com/test

## Migration Checklist

- [x] Remove Cashfree payment links
- [x] Implement Razorpay checkout
- [x] Set up API endpoints
- [x] Configure webhooks
- [x] Add event tracking
- [x] Create test suite
- [ ] Test with real credentials
- [ ] Deploy to production
- [ ] Monitor first transactions
- [ ] Remove Cashfree references
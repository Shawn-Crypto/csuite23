# LotusLion Course - Razorpay Integration

This project integrates Razorpay payment gateway with a comprehensive business workflow including Zapier automation and Meta CAPI conversion tracking.

## Architecture Overview

- **Frontend**: Static HTML/CSS/JS with Razorpay Standard Checkout
- **Backend**: Vercel serverless functions (Node.js)
- **Payment Gateway**: Razorpay
- **Course Delivery**: Kajabi (via Zapier)
- **Analytics**: Google Tag Manager + Meta CAPI

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/create-order` | POST | Create Razorpay order for checkout |
| `/api/webhook` | POST | Handle Razorpay payment webhooks |
| `/api/zapier` | POST | Forward payment data to Zapier |
| `/api/meta-capi` | POST | Send conversion events to Meta CAPI |

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxx
WEBHOOK_SECRET=webhook_secret_string

# Zapier Integration
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxxxxx/xxxxxxx

# Meta Conversion API
META_PIXEL_ID=your_pixel_id
META_ACCESS_TOKEN=your_conversion_api_access_token
META_TEST_EVENT_CODE=TEST12345
```

## Payment Flow

1. User clicks "START LEARNING TODAY" button
2. Frontend creates order via `/api/create-order`
3. Razorpay Checkout opens with order details
4. User completes payment
5. Razorpay sends webhook to `/api/webhook`
6. Webhook triggers Zapier integration for course access
7. Conversion data sent to Meta CAPI
8. User redirected to success page with analytics tracking

## Course Details

- **Price**: ₹9,999 (60% off from ₹24,999)
- **EMI Option**: ₹1,667/month for 6 months
- **Course**: The Complete Indian Investor
- **Platform**: Kajabi

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test webhooks locally (use ngrok for testing)
ngrok http 3000
```

## Security Features

- HTTPS enforcement
- Webhook signature verification
- CORS protection
- Event deduplication
- PII data compliance
- Environment variable storage

## Scalability

Designed to handle 800+ transactions per second with:
- Serverless architecture auto-scaling
- Event deduplication for reliability
- Structured logging for monitoring
- Retry logic for external integrations

## Testing

Uses Playwright for end-to-end testing:
- Payment flow validation
- Webhook endpoint testing
- Error handling scenarios
- Integration testing with test cards

## Support

For technical support, contact: investoreducation@lotuslion.in

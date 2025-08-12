# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

## Project Overview

This is a single-page landing website for "The Complete Indian Investor" course, an educational platform at lotuslion.in. The project is a static HTML site using vanilla JavaScript and custom CSS, with serverless functions for backend logic, deployed on Vercel. The primary goal is to capture leads and process payments for the course via Razorpay.

## Core Technologies

- **Frontend**: Static HTML, vanilla JavaScript, CSS. No frontend frameworks like React or Vue.
- **Backend**: Node.js-based serverless functions hosted on Vercel.
- **Payment Gateway**: Razorpay for processing payments.
- **Deployment**: Vercel, configured via `vercel.json`.
- **Testing**:
    - **E2E & Integration**: Playwright (`playwright.config.js`)
    - **Unit**: Jest (`jest.config.js`)
- **Dependencies**: `razorpay`, `dotenv`, `cors` (see `package.json`).

## Architecture

- **`index.html`**: The main single-page application.
- **`/api`**: Vercel serverless functions.
    - `api/create-order.js`: Creates a Razorpay order.
    - `api/capture-lead.js`: Captures user information.
    - `api/webhook-rzp-secure-7k9m.js`: Handles secure Razorpay webhooks. **(CRITICAL)**
- **`/js`**: Frontend JavaScript.
    - `js/main-scripts.js`: Core UI logic, navigation, and analytics.
    - `js/razorpay-checkout.js`: Handles the client-side Razorpay checkout flow.
    - `js/lead-capture-modal.js`: Manages the lead capture form.
- **`/css`**: Stylesheets.
- **`/docs`**: In-depth documentation. **These are essential reading.**
- **`/tests`**: Contains all Playwright and Jest tests.

## Critical Guides & Pitfalls

The `/docs` directory contains essential guides. **Before any significant work, especially on payments or webhooks, these must be reviewed.** The most critical guide is:

- **`docs/06-CRITICAL-PITFALLS-GUIDE.md`**: This document outlines major production issues and their solutions. Reading this can save hours of debugging.

### Key Pitfalls Summary:

1.  **Webhook Response Time**: Webhooks **MUST** respond in <200ms. All heavy processing (like API calls to other services or database updates) must happen *after* the response is sent, using `setImmediate` or a queue.
2.  **Webhook Signature Verification**: Vercel's body parser must be disabled (`export const config = { api: { bodyParser: false } }`) to get the raw request body for accurate signature verification.
3.  **API Timeouts**: Frontend `fetch` calls to the backend API must have timeouts (e.g., using `AbortController`) to prevent the UI from hanging.
4.  **Event Deduplication**: Use a consistent, unique event ID (e.g., based on `order_id`) across client-side (Meta Pixel), server-side (Meta CAPI), and GTM to avoid duplicate conversion tracking.
5.  **Environment Variables**: Use distinct variables for `test` and `live` environments (e.g., `RAZORPAY_LIVE_KEY_ID`, `RAZORPAY_TEST_KEY_ID`) and validate them on startup.
6.  **Serverless Cold Starts**: Initialize SDKs and clients (like the Razorpay client) *outside* the serverless function handler to reuse connections and reduce latency.

## Development & Testing

### Running Locally

To run the development server, which serves the static files and makes the Vercel API functions available:

```bash
# Start the Vercel development server
vercel dev --listen 3000 --yes
```

### Running Tests

The project has a comprehensive test suite.

- **Run all tests:**
  ```bash
  npm test
  ```

- **Run only unit tests (Jest):**
  ```bash
  npm run test:unit
  ```

- **Run only E2E tests (Playwright):**
  ```bash
  npm run test:e2e
  ```

- **View test reports:**
  ```bash
  npm run test:report
  ```

## Key Workflows

### 1. Lead Capture & Payment Flow

1.  User clicks a CTA button on `index.html`.
2.  `js/lead-capture-modal.js` displays a form to collect name, email, and phone.
3.  User submits the form.
4.  The frontend calls `/api/capture-lead` to save the lead information (this is done asynchronously).
5.  Simultaneously, the frontend calls `/api/create-order` with the amount.
6.  `/api/create-order` uses the Razorpay SDK to create an order and returns the `order_id` to the client.
7.  `js/razorpay-checkout.js` uses the `order_id` to open the Razorpay payment modal.
8.  User completes payment.

### 2. Payment Verification (Webhook)

1.  Razorpay sends a `payment.captured` or `order.paid` event to the secure webhook endpoint: `/api/webhook-rzp-secure-7k9m`.
2.  The webhook handler first verifies the Razorpay signature using the raw request body.
3.  It immediately sends a `200 OK` response back to Razorpay.
4.  **After responding**, it processes the event asynchronously using `setImmediate`. This includes:
    - Sending conversion events to Meta CAPI.
    - Updating a database.
    - Logging the event.

## Deployment

Deployment is handled by Vercel. Pushing to the main branch will trigger a production deployment.

- **Manual Deployment**:
  ```bash
  # Deploy to Vercel production
  vercel --prod
  ```

Configuration is in `vercel.json`, which includes security headers, caching rules, and redirects.

## Common Tasks

### Updating Pricing

1.  Search for the price in `index.html` and update it in the pricing card and CTA buttons.
2.  Update the `amount` parameter in the `/api/create-order.js` function or ensure it's passed dynamically from the frontend.
3.  Verify the test cases in `tests/e2e/payment-flow.spec.js` reflect the new price.

### Modifying API Logic

1.  Locate the relevant function in the `/api` directory.
2.  Make changes to the logic.
3.  Find the corresponding test file in `/tests` (e.g., `tests/integration/api-integration.spec.js` or a unit test).
4.  Update the tests to cover the new logic.
5.  Run `npm test` to ensure nothing is broken.

### Updating Frontend UI

1.  Modify `index.html` for structural changes.
2.  Modify `css/sprint3-styles.css` for styling changes.
3.  Modify `js/main-scripts.js` for dynamic behavior changes.
4.  Run E2E tests (`npm run test:e2e`) to check for regressions.

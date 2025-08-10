# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a single-page landing website for "The Complete Indian Investor" course - an educational investment course platform hosted at lotuslion.in. The project is built as a static HTML site with vanilla JavaScript, custom CSS, and deployment on Vercel.

## Razorpay Integration Documentation

**IMPORTANT**: Comprehensive documentation for the Razorpay payment integration is available in the `/docs/` directory. These guides contain battle-tested patterns from 50+ hours of production debugging that transformed a failing system into 100% reliability.

### Available Guides in /docs/:
1. **01-SYSTEM-ARCHITECTURE-GUIDE.md** - Core system flow and components
2. **02-RAZORPAY-INTEGRATION-GUIDE.md** - API patterns and SDK usage  
3. **03-WEBHOOK-SYSTEM-GUIDE.md** - Critical <200ms performance patterns
4. **04-FRONTEND-INTEGRATION-GUIDE.md** - Lead capture and payment UI
5. **05-META-TRACKING-GUIDE.md** - CAPI and deduplication strategies
6. **06-CRITICAL-PITFALLS-GUIDE.md** - **MUST READ FIRST** - Avoid 50+ hours of debugging
7. **07-TESTING-GUIDE.md** - E2E and performance testing patterns
8. **08-DEPLOYMENT-GUIDE.md** - Production deployment checklist

### When to Refer to These Guides:
- **Before ANY webhook work**: Read Guide 6 (Pitfalls) and Guide 3 (Webhook System)
- **For payment integration**: Start with Guide 6, then Guides 1-2
- **For tracking issues**: Guides 5 and 6 (event deduplication)
- **For debugging**: Guide 6 has a debug checklist that solves 90% of issues

### Key Lessons from Production:
- Webhook MUST respond in <200ms (was taking 1.7M ms!)
- Raw body required for signature verification
- Consistent event IDs prevent duplicate conversions
- Never block webhook responses with external API calls

These guides transformed the system from 33% to 100% success rate.

## Commands

### Development & Build
```bash
# No build required - static site
npm run build    # Outputs: "Static site - no build required"
npm run start    # Outputs: "Static site ready for deployment"

# Development server with API functions
vercel dev --listen 3000 --yes
```

### Deployment
```bash
# Deploy to Vercel production
vercel --prod

# Or with token
vercel --prod --token YOUR_TOKEN
```

### Vercel CLI Integration
Claude has access to Vercel CLI with token: `bRiL99YysrlNQUpBQdPUmP8W`

### Python Utilities (RTF Processing)
```bash
# Extract content from RTF files
python3 extract_rtf_content.py <input.rtf>

# Advanced RTF processing
python3 advanced_rtf_processor.py

# Manual RTF cleaning
python3 manual_rtf_cleaner.py
```

## Architecture

### Core Structure
- **Single-page application** - All content in `index.html` with smooth scroll navigation
- **Static site deployment** - No server-side rendering or build process required
- **Vercel hosting** - Configured via `vercel.json` with security headers and caching rules
- **Cashfree payment integration** - External payment form embedded for course purchases

### Key Files
- `index.html` - Main landing page with all course content
- `css/sprint3-styles.css` - Primary stylesheet with mobile-responsive design
- `js/main-scripts.js` - Core functionality including navigation, animations, and tracking
- `js/faq-accordion.js` - FAQ accordion interaction
- `js/lazy-loading.js` - Image lazy loading for performance

### Supporting Pages
- `success.html` - Post-purchase confirmation page
- `terms.html`, `privacy.html`, `refund.html` - Legal compliance pages
- `verify-deployment.html`, `test-purchase-tracking.html` - Testing utilities

### Performance Optimizations
- WebP images with multiple resolutions in `assets/optimized/`
- Lazy loading for images below the fold
- Deferred GTM loading for better initial page load
- Optimized font loading with subset CSS files

## Key Implementation Details

### Google Tag Manager Integration
- GTM ID: `GTM-M3JWN37C`
- Deferred loading strategy for performance
- Enhanced engagement tracking with scroll depth and time-based events
- Purchase tracking with localStorage persistence

### Payment Flow
1. User clicks CTA button anywhere on page
2. Redirects to Cashfree payment form
3. On success, redirects to `success.html`
4. Purchase tracked via GTM with transaction details

### Responsive Design Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px  
- Desktop: > 1024px

### Grid Layouts
- Audience cards: 2x2 grid on desktop, single column mobile
- Problem cards: 2x2 grid on desktop, single column mobile
- Method cards: 3-column row on desktop, single column mobile
- Included features: 2x3 grid on desktop, single column mobile

## Development Guidelines

### Content Updates
- Hero section uses simplified language for Indian audience
- Course title: "The Complete Indian Investor" (not "Stock Investor")
- Current pricing: ₹1,999 (anchor price ₹9,999 strikethrough)
- Instructor bio kept concise with key credibility markers

### Legal Compliance
- SEBI disclaimers required for investment education content
- Terms, Privacy, and Refund policies must remain accessible
- Educational purpose disclaimers throughout content

### Testing Approach
- Manual testing via browser for static site functionality
- Use `verify-deployment.html` to check deployment status
- Test purchase tracking with `test-purchase-tracking.html`
- Cross-browser testing important for payment flow

## Common Tasks

### Update Pricing
1. Search for hardcoded prices in `index.html`
2. Update pricing card (around line 1612)
3. Update CTA buttons throughout
4. Verify Cashfree form reflects new price

### Modify Hero Section
- Hero content starts around line 1315
- Clickable hero implemented with JavaScript event handler
- Keep text concise and value-focused

### Add/Remove Course Features
- "What's Included" section uses grid layout
- Update grid CSS if changing card count
- Maintain responsive behavior for mobile

### Deploy Changes
1. Commit changes to git
2. Run `vercel --prod` for production deployment
3. Verify with `verify-deployment.html` page
4. Test payment flow on production

## Changelog Management

**CRITICAL**: Always update `CHANGELOG.md` when making changes to the codebase.

### Changelog Format
The changelog follows a simple CSV format inside the markdown file for LLM compatibility:
```
Date,Version,Type,Component,Description,Files Changed,Impact
```

### Update Requirements
- **Every coding session**: Add entries for all changes made
- **Date format**: YYYY-MM-DD
- **Version**: Semantic versioning (MAJOR.MINOR.PATCH)
- **Type**: FEAT, FIX, CONFIG, DOC, REFACTOR, TEST
- **Component**: Specific area changed (e.g., Frontend Integration, Webhook System)
- **Description**: Brief, clear description of what changed
- **Files Changed**: Key files modified (comma-separated if multiple)
- **Impact**: CRITICAL, HIGH, MEDIUM, LOW

### Types Explained
- **FEAT**: New features or functionality
- **FIX**: Bug fixes or corrections
- **CONFIG**: Configuration changes (package.json, .env, etc.)
- **DOC**: Documentation updates
- **REFACTOR**: Code improvements without functionality changes
- **TEST**: Test additions or modifications

### Example Entry
```
2025-08-09,1.4.0,FEAT,Frontend Integration,Implemented Guide 4 frontend integration patterns with lead capture and timeout protection,js/razorpay-checkout.js,HIGH
```

**Today's Date**: August 9, 2025
**Current Version**: 1.4.0 (after comprehensive testing suite implementation)
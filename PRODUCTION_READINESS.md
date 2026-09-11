# PRODUCTION_READINESS.md - Victoriosa 1.0

## Summary
Victoriosa has been refactored to remove all fake, simulated, or demo data from production code paths. The application now properly reports configuration status and requires real API credentials for all integrations.

---

## Changes Completed

### 1. Firestore Security Rules (`firestore.rules`)
- **REMOVED**: Open `match /test/{docId} { allow read, write: if true; }` rule
- **REMOVED**: Hardcoded email-based admin detection (`isAdmin()` now uses `/admins/{uid}` document only)
- **REMOVED**: Anonymous user admin bootstrap capability
- **ADDED**: Order creation requires authenticated, non-anonymous users
- **ADDED**: Users can only create customer profiles (`role='customer'`)
- **ADDED**: Admin management via `/admins` collection only

### 2. Authentication (`src/lib/firebase.ts`, `src/components/auth/AuthModal.tsx`, `src/context/AppContext.tsx`)
- **REMOVED**: Hardcoded admin email list (`STAFF_ADMIN_EMAILS`)
- **REMOVED**: Email-based admin role detection in `syncUserProfile()`
- **REMOVED**: Demo role switcher UI component
- **REMOVED**: Demo quick-fill login buttons
- **REMOVED**: Admin role selection during signup (always creates customer)
- **ADDED**: Admin status determined only via `/admins/{uid}` Firestore document

### 3. Server API (`server.ts`)
- **REMOVED**: Fake fallback product data in `/api/autopilot/discover`
- **REMOVED**: Fake fallback analysis in `/api/autopilot/analyze`
- **REMOVED**: Fake extracted data in `/api/connectors/direct-import`
- **REMOVED**: Fake tracking number generation (`TRK-DHL-*`)
- **REMOVED**: Fake inventory counts, ratings, and SKU generation
- **ADDED**: NOT_CONFIGURED error responses when Gemini API is not available
- **ADDED**: MANUAL_REVIEW status for URL import without AI

### 4. Orders (`src/context/AppContext.tsx`)
- **REMOVED**: `paymentStatus: 'paid'` hardcoded in order creation
- **REMOVED**: Fake tracking number generation (`TRK-ES-*`)
- **ADDED**: `paymentStatus: 'pending'` - payment confirmed only via webhook
- **ADDED**: `status: 'pending_payment'` - proper order flow state
- **ADDED**: Empty tracking number until supplier provides after shipment

### 5. Checkout (`src/components/store/CheckoutModal.tsx`)
- **REMOVED**: Fake pre-filled customer data (name, email, address)
- **REMOVED**: Fake card input fields (number, expiry, CVV)
- **ADDED**: Payment configuration notice when gateway not configured
- **ADDED**: Empty form fields requiring user input

### 6. Fulfillment (`src/services/connectors/SupplierHubConnector.ts`)
- **REMOVED**: Fake tracking number generation in `getTracking()`
- **REMOVED**: Hardcoded supplier catalog data
- **ADDED**: `REQUIRES_HUMAN_ACTION` status (no API integration yet)
- **ADDED**: `isConfigured()` returns `false`
- **ADDED**: Empty catalog array

### 7. Connectors
#### Amazon (`src/services/connectors/AmazonConnector.ts`)
- **REMOVED**: Fabricated product data in `getProductByUrl()`
- **ADDED**: Minimal data requiring manual review

#### AliExpress (`src/services/connectors/AliExpressConnector.ts`)
- **REMOVED**: Fabricated product data in `getProductByUrl()`
- **ADDED**: Minimal data requiring manual review

#### Alibaba (`src/services/connectors/AlibabaConnector.ts`)
- **REMOVED**: Fabricated product data in `getProductByUrl()`
- **ADDED**: RFQ (Request for Quote) pending status

#### Direct URL (`src/services/connectors/DirectUrlConnector.ts`)
- **REMOVED**: Fabricated product metadata in `getProductByUrl()`
- **REMOVED**: Fake stock verification claiming `passed: true`
- **ADDED**: `NOT_CONFIGURED` status (requires web scraper)
- **ADDED**: `isConfigured()` returns `false`
- **ADDED**: `UNVERIFIED_STOCK` flag in verification results

### 8. Demo Data Isolation (`src/context/AppContext.tsx`)
- **ADDED**: `DEMO_MODE` environment variable check
- **ADDED**: Demo products only load when `VITE_DEMO_MODE='true'`
- **ADDED**: Database seeding only occurs in demo mode
- **ADDED**: Reset function is no-op in production mode

### 9. Environment Configuration (`.env.example`)
- **ADDED**: `DEMO_MODE=false` (default for production)
- **ADDED**: All optional integration credentials documented
- **ADDED**: Rate limiting configuration variables

### 10. Type Definitions (`src/types.ts`)
- **ADDED**: `'pending_payment'` to Order status type
- **ADDED**: `'UNVERIFIED_STOCK'` to verification flags

---

## Remaining Manual Steps for Production

### Critical (Must Complete)
1. **Payment Gateway Integration**
   - Configure Stripe, PayPal, or other payment provider
   - Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in environment
   - Implement webhook handler for payment confirmation
   - Update order flow: `paymentStatus` should change from `pending` → `paid` via webhook

2. **Firebase Admin SDK (Optional)**
   - If server-side operations needed, configure `FIREBASE_SERVICE_ACCOUNT_KEY`
   - Required for: server-side Firestore access, token verification

### Recommended
3. **Amazon SP-API Integration** (Optional)
   - Obtain Amazon SP-API credentials
   - Set `AMAZON_SP_API_REFRESH_TOKEN`, `AMAZON_SP_API_CLIENT_ID`, `AMAZON_SP_API_CLIENT_SECRET`
   - Enables automated product search and price checking

4. **AliExpress Open Platform** (Optional)
   - Register for AliExpress affiliate program
   - Set `ALIEXPRESS_APP_KEY` and `ALIEXPRESS_APP_SECRET`

5. **Web Scraping Service** (For Direct URL Import)
   - Integrate a web scraping service (e.g., ScraperAPI, Bright Data)
   - Required for `DirectUrlConnector` to extract real product metadata

6. **Rate Limiting**
   - Configure `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`
   - Recommended: 60 second window, 30 requests per window

---

## Configuration Checklist

| Setting | Status | Required |
|---------|--------|----------|
| `GEMINI_API_KEY` | Environment | Yes (for AI features) |
| `FIREBASE_*` | Hardcoded in firebase.ts | Yes (for auth/DB) |
| `DEMO_MODE` | `false` default | No |
| `STRIPE_*` | Not configured | Yes (for payments) |
| `AMAZON_*` | Not configured | Optional |
| `ALIEXPRESS_*` | Not configured | Optional |

---

## Security Notes

1. **Admin Access**: Admin users must be manually added to `/admins/{uid}` collection in Firestore
2. **No Hardcoded Secrets**: All API keys are loaded from environment variables
3. **Price Authority**: Backend (`server.ts`) is the source of truth for all pricing
4. **Webhook Payments**: Payment status is only confirmed via payment provider webhooks
5. **Demo Mode**: Never deploy to production with `DEMO_MODE=true`

---

## Build & Deploy

```bash
# Install dependencies
npm install

# Run lint/typecheck
npm run lint

# Build for production
npm run build

# Output: dist/ directory (static files + server.cjs)
```

---

## Known Limitations

1. **No Real Payment Processing**: Orders are created with `paymentStatus: 'pending'` until payment gateway is integrated
2. **No Real Tracking Numbers**: Tracking must be manually entered or provided by supplier API
3. **No Automated Purchasing**: All supplier orders require manual operator confirmation
4. **No Product Discovery**: Without `GEMINI_API_KEY`, AI-powered product discovery is disabled
5. **No Web Scraping**: Direct URL import requires manual data entry

---

*Last Updated: September 2, 2026*

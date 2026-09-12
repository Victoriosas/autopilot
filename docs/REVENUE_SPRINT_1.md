# Revenue Sprint 1

Objective: convert storefront traffic into measurable purchase intent while keeping Autopilot private to the site administrator.

## Public storefront

Customers can:
- buy through WhatsApp when `VITE_SALES_WHATSAPP` is configured;
- create a bank-transfer order that remains `pending_verification` until an administrator verifies the payment;
- pay through PayPal when the gateway and any required storefront-to-USD conversion rate are configured.

Victoriosa must never collect raw card numbers or CVV values.

## Admin-only Autopilot

Autopilot remains an administrative system. Customers do not interact with `/api/autopilot/v4` or supplier automation. Supplier purchasing remains disabled by default and `AUTOPILOT_PURCHASE_LIMIT_USD=0` stays the safe default.

## Revenue funnel

The revenue service records these event names through the existing audit stream:

- `REVENUE_PRODUCT_VIEW`
- `REVENUE_ADD_TO_CART`
- `REVENUE_CHECKOUT_STARTED`
- `REVENUE_WHATSAPP_ORDER_STARTED`
- `REVENUE_TRANSFER_ORDER_CREATED`
- `REVENUE_PAYMENT_COMPLETED`

Event payloads must not contain secrets, card data, CVV values, bank passwords, or provider credentials.

## Transfer semantics

A manual transfer order is created with:

- `payment_method = bank_transfer`
- `payment_status = pending_verification`
- `status = pending_payment`

A customer statement or screenshot must never change that status to `paid` automatically.

## PayPal semantics

PayPal remains an international option. When storefront currency is not USD, `VITE_PAYPAL_USD_RATE` must be explicitly configured. No browser-side hardcoded FX rate is used by the new checkout.

The current legacy PayPal backend still needs a dedicated hardening pass so order totals are recalculated server-side and webhook signatures are verified before production payment automation is considered complete.

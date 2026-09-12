# Victoriosa — verified release status, 2026-09-12

## Product and release boundary
Public storefront with an owner-only admin area. Product browsing is available; checkout must remain disabled (`CHECKOUT_ENABLED=false`) until the operational gates below pass. This is not a completed commercial launch.

## Verified in this cycle
- Correct connected repository: Victoriosas/autopilot.
- Vercel project: autopilot, team autopilot12. Public alias: https://autopilot-ten-chi.vercel.app.
- Supabase project: jfjzpwlrhzqbcrvqxhzf. One admin profile.
- Before release, production pointed to 8b677ed and `/api/health` returned HTML; the 255cb6f preview returned API JSON.
- Added draft/review/publication/repricing/observation tables and additive release-integrity migration to the live database.
- RLS enabled on new tables. Publication and repricing RPCs use invoker security; execute is denied to anon/authenticated and granted to service_role.
- Rollback-only SQL tests passed: publication replay uses the same product ID; stock is zero; repricing replay is idempotent; public roles cannot call mutations.
- Counts after rollback tests: 156 existing products, zero orders, zero new drafts. No test products or orders retained.
- Seven automated regression tests plus TypeScript, Node build and Vercel-specific build passed locally.
- Vercel preview build quota failure on the older PR head is historical: the newer 255cb6f preview reached READY.

## Repairs
- Pricing rounds up rather than undercutting the target; unknown strategies are rejected.
- Orders use UUID primary keys and separate readable order numbers. Bank transfers persist `pending`, matching the database constraint.
- Provider order IDs and expected charge amount/currency are persisted. PayPal confirmation uses the stored amount, including webhook confirmation; it does not recalculate currency conversion at capture time.
- Payment creation is disabled by default and unavailable providers are hidden in checkout. Unknown currency, insufficient inventory, duplicate products and unsupported variants are rejected.
- Publication/product creation and repricing/state changes now run in database transactions.
- Catalog monitoring uses existing source/source_id fields instead of the nonexistent cj_product_id column; cross-currency supplier costs are not used as local prices.
- Removed the legacy browser order path that could label a payment paid from a caller-supplied value.
- Removed fabricated 1.08 currency conversion across product, hero, cart and account displays.
- Removed unsupported three-year warranties, 24/48-hour shipping, Madrid support, fake newsletter confirmation and public Autopilot shortcuts.

## External blockers
- Vercel runtime preview has no configured Autopilot admin token or payment providers. No Vercel CLI token is available here; dashboard browser requires sign-in. Connected Vercel tools can inspect deployments but do not expose environment-variable writes.
- Required server env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTOPILOT_ADMIN_TOKEN; optional dedicated AUTOPILOT_CODEX_TOKEN. Never expose secrets using a VITE_ prefix.
- Payment activation requires the merchant's real Mercado Pago/PayPal credentials, account activation and provider sandbox verification. None were obtained or fabricated.
- Transfer checkout needs the actual beneficiary/account instructions. WhatsApp needs the real business contact.
- Catalog sample records lack supplier URLs/evidence. Currency is deliberately nullable on old rows. Do not relabel the existing numbers as verified UYU/USD prices.
- No supplier API credential or verified fulfillment contract was available. Do not enable automatic purchases.
- Supabase advisor warning: leaked-password protection disabled. The six RLS/no-policy INFO notices are intentional server-only tables, not a reason to add public policies.

## Launch gates still required
1. Supply server credentials through platform settings; verify admin login and unauthorized rejection in production.
2. Verify each sellable product's source URL, currency, costs, rights to imagery, stock, shipping, returns and actual margin. Keep unverifiable products out of live checkout.
3. Complete durable stock reservation/release and customer retry idempotency before concurrent checkout activation; current stock checks alone do not reserve inventory.
4. Implement and test provider sandbox order → approval → capture/webhook → database confirmation, retry and mismatch scenarios. Test order ownership/account association and payment-return UX.
5. Review merchant identity, customer support and applicable sales/privacy/returns terms before collecting real orders. Current preparation copy is not a substitute for launch policies.
6. Confirm production API JSON, browser flow, deployment SHA and rollback target; only then set CHECKOUT_ENABLED=true.

## Rollback
Revert the release application commit or restore the last known deployment. Keep the additive database columns/tables/functions: dropping them risks data loss and is unnecessary for application rollback. Never roll back to a checkout that trusts browser payment truth. Disable checkout immediately if payment integrity is uncertain. No migration in this cycle deletes customer or catalog data.

## Cycle record and continuation prompts
1. Inspection → prioritize production routing, schema incompatibility, payment integrity and unsupported claims. Execute code fixes and additive migrations. Validate local tests and rollback-only DB assertions. Result: safe release candidate, commercial launch blocked.
2. Internal continuation: "Publish the tested branch, verify its preview, merge with expected SHA checks and inspect the resulting public production alias. Keep all monetary operations disabled."
3. On external credential block: "Resume after platform credentials are configured. Start with read-only readiness and owner authorization; then provider sandbox and supplier verification. Never infer credential availability or claim real revenue from a build passing."

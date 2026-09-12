# Victoriosa Production Status

Current production goal: public storefront + admin-only Autopilot control plane.

## Confirmed
- Storefront builds on Vercel.
- Supabase production schema is connected and populated.
- Admin profile exists in Supabase.
- Autopilot v4 persistence and model telemetry migrations are applied.
- Legacy sourcing routes are protected by the admin guard.
- Preview Vercel runtime exposes `/api/health` as JSON.
- Mercado Pago and PayPal server routes are mounted behind the Vercel API function.

## Production gate
The public production alias must return JSON from `/api/health`. If it returns the SPA HTML, production is still serving the older static-only deployment.

## Secrets required for privileged runtime
Keep these only in Vercel server-side environment variables. Never expose them through Vite/browser variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTOPILOT_ADMIN_TOKEN`
- `AUTOPILOT_CODEX_TOKEN`
- payment provider secrets
- AI provider secrets
- supplier API secrets

## Safety defaults
- Autonomous purchasing remains disabled.
- Product sourcing creates drafts until human approval.
- Manual transfers require verification before `paid`.
- Supplier facts without observed evidence must remain unverified/inferred.

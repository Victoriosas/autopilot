# Victoriosa — cart inventory TDD evidence

Date: 2026-10-10 (America/Montevideo). Scope: local cart stock validation.

Source: user requested ECC `tdd-workflow`; journeys derived during repository inspection. The broader attached audit prompt is not claimed complete by this report.

## Acceptance criteria

As a shopper, I want restored cart contents to reflect verified numeric inventory, so corrupt stock values never create apparent availability. Valid stock remains limited to 20 units per product, shared across variants.

## Evidence

Runner detection: ECC `scripts/setup-package-manager.js --detect` selected npm from the lockfile. Project tests use Node's native test runner with tsx, not Jest/Vitest.

RED command: `node --import tsx --test src/storefront/cartState.test.ts`.
Result before implementation: 6 tests executed, 4 passed, 2 failed. String inventory `"3"` returned availability 3 instead of 0 and a persisted cart retained that product.
RED checkpoint: `e51f6c8`.

Minimal implementation: remove numeric coercion in `cartLimit`; validate the original inventory with `Number.isSafeInteger`. `Product.inventory` and the Supabase row type declare numeric inventory. AppContext uses this function for adding and restoring cart contents.

GREEN command: `node --import tsx --test --experimental-test-coverage --test-coverage-include=src/storefront/cartState.ts src/storefront/cartState.test.ts`.
Result: 6 passed, 0 failed. Coverage for `cartState.ts`: lines 100%, branches 100%, functions 100%. This is module coverage, not whole-project coverage.
GREEN checkpoint: `4f4633a`. Both checkpoints verified reachable from HEAD on `codex/autopilot-v4-durable-orchestrator`.

| Guarantee | Test type | Result |
|---|---|---|
| Draft/zero stock rejected; valid inventory capped at 20 | Unit | PASS |
| Missing/draft products excluded; quantity clamped to stock | Unit | PASS |
| String, boolean, null, undefined, nonfinite, negative, fractional and unsafe stock rejected | Unit | PASS |
| Persisted cart excludes malformed live stock | Unit | PASS |
| Identical variants merge; different variants share product stock | Unit | PASS |
| Invalid persisted entries ignored; blank variants normalized | Unit | PASS |

Full regression: `npm test` — 76 passed, 0 failed, 0 skipped. `npm run lint`, `npm run build` and `npm run build:vercel` — exit 0. Both builds warn about a main frontend chunk above 500 kB (590.25 kB). `git diff HEAD~2 HEAD --check` — exit 0. Production, credentials and customer data were not modified.

## Limits and next actions

No browser E2E or isolated PostgreSQL tests were run. This change does not verify live catalog availability, supplier stock, payment processing or fulfillment. No independent reviewer was used. Local diff inspection confirmed the production change is one line and preserves valid numeric stock behavior.

Existing untracked `.audit/`, `.playwright-cli/` and root test scripts were preserved. No push or deployment performed.

The attached broader audit remains outstanding: live service access, current deployment SHA, commerce readiness, integration verification, complete ECC capability matrix and independent review. Local README documents checkout disabled by default, Shadow sourcing, blocked supplier purchases and manual publication gates; those are documented policies, not verified live settings.

Recommended next priority: isolated coverage of Mercado Libre OAuth added by `77e3604`, including callback authorization, token persistence and sanitization; then sandbox payment/fulfillment validation before commerce activation. Keep existing Shadow and publication barriers.

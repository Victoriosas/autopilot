# Uruguay shadow economic policy — 2026-09-14

Scope: Autopilot V4 CJ sourcing in **shadow mode only**. This is a conservative simulation policy, not a production tax determination and not authorization to publish, purchase, charge customers or enable checkout.

## External facts used

- Uruguay international postal simplified regime (Decree 50/026 / Customs guidance): commercial or non-commercial shipments up to USD 800 and 20 kg may use the simplified regime with a single 60% levy on invoice/declaration value, minimum USD 20. Source: Dirección Nacional de Aduanas / Ministerio de Economía y Finanzas.
- Mercado Pago Uruguay Checkout/Link pricing observed 2026-09-14: 5.99% + VAT for immediate availability. Uruguay basic VAT rate is 22%, so the shadow model uses 7.31% (= 5.99% × 1.22) as an effective payment-cost reserve.
- Uruguay basic VAT rate for goods/services is generally 22%. For a VAT-inclusive retail price, 22/122 = 18.03% of gross is reserved in this shadow model. Actual tax treatment depends on the legal/tax regime and input credits and must be reviewed before production.
- USD/UYU market snapshot on 2026-09-14: 40.2091 UYU per USD. Shadow policy adds an approximately 2% FX cushion and uses 41.02 UYU/USD.
- CJ cooperation terms state CJ-provided product digital assets are for sales purposes. Shadow may therefore treat CJ-provided imagery as sales-use allowed for evaluation only. Production still requires policy/legal review and product-specific IP screening.

## Shadow policy v1

- destination: UY
- store currency: UYU
- provider currency: USD
- providerToStoreRate: 41.02
- customsRatePct: 60
- paymentFeePct: 7.31
- paymentFeeFixed: 0
- returnReservePct: 5
- acquisitionCost: 150 UYU/order
- taxRatePct: 18.03
- targetNetMarginPct: 30
- imageSaleUseAllowed: true (CJ sales-purpose terms; shadow only)
- commercialProxiesAllowed: true (CJ operational/listing proxies; shadow only)

## Rationale for internal assumptions

`returnReservePct=5` and `acquisitionCost=150 UYU` are internal conservative business assumptions, not external facts. They intentionally make products harder, not easier, to qualify.

`taxRatePct=18.03` is a reserve model for a VAT-inclusive price under the general 22% rate. It must not be treated as a legal tax calculation for Victoriosa until the actual taxpayer regime is confirmed.

## Guardrails

This policy may be injected only into the one-time production-infrastructure shadow route. It cannot change mode, enable sourcing cron, enable checkout, enable purchases, lower purchase limit, or make shadow drafts publishable.

Before any production activation, replace the static FX snapshot with a fresh-source mechanism, confirm the company tax regime, confirm import treatment for each product class, and add regulatory blockers for controlled cosmetics/health products.
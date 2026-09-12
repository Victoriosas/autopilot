import type { NextFunction, Request, Response } from 'express';

const BLOCKED_ROUTES = new Map<string, {
  status: number;
  code: string;
  message: string;
}>([
  [
    'POST /api/fulfillment/create-supplier-order',
    {
      status: 423,
      code: 'SUPPLIER_PURCHASE_REQUIRES_OWNER_APPROVAL',
      message: 'Legacy supplier-order creation is disabled. Supplier purchases require explicit owner approval and a governed purchase flow.',
    },
  ],
  [
    'POST /api/autopilot/discover',
    {
      status: 410,
      code: 'LEGACY_GENERATIVE_DISCOVERY_DISABLED',
      message: 'Legacy AI discovery could fabricate supplier facts and source data. Use the governed sourcing/opportunity pipeline instead.',
    },
  ],
  [
    'POST /api/autopilot/analyze',
    {
      status: 410,
      code: 'LEGACY_ANALYSIS_DISABLED',
      message: 'Legacy analysis is disabled because it can infer unsupported supplier, pricing, shipping and publication facts. Use Autopilot v4.',
    },
  ],
  [
    'GET /api/sourcing/price-monitor',
    {
      status: 423,
      code: 'LEGACY_AUTOREPRICE_DISABLED',
      message: 'Legacy automatic repricing is disabled. Pricing changes must go through governed pricing and approval.',
    },
  ],
  [
    'POST /api/sourcing/verify-published',
    {
      status: 423,
      code: 'LEGACY_CATALOG_MUTATION_DISABLED',
      message: 'Legacy published-product mutation is disabled until it is migrated to governed pricing and provenance checks.',
    },
  ],
  [
    'POST /api/payments/paypal/order',
    {
      status: 410,
      code: 'LEGACY_PAYMENT_ROUTE_DISABLED',
      message: 'Legacy PayPal order creation is disabled because it trusted caller-supplied totals. Use /api/payments/v2.',
    },
  ],
  [
    'POST /api/payments/paypal/capture',
    {
      status: 410,
      code: 'LEGACY_PAYMENT_ROUTE_DISABLED',
      message: 'Legacy PayPal capture is disabled. Use the server-authoritative payment v2 flow.',
    },
  ],
  [
    'POST /api/webhooks/paypal',
    {
      status: 410,
      code: 'LEGACY_WEBHOOK_ROUTE_DISABLED',
      message: 'Legacy PayPal webhook handling is disabled because signature verification was incomplete. Use the payment v2 webhook flow.',
    },
  ],
]);

export function createLegacySafetyGate() {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.method.toUpperCase()} ${req.path}`;
    const block = BLOCKED_ROUTES.get(key);

    if (block) {
      return res.status(block.status).json({
        error: 'LEGACY_ACTION_BLOCKED',
        code: block.code,
        message: block.message,
        governedAlternativeRequired: true,
        purchaseAutomationEnabled: false,
      });
    }

    next();
  };
}

import type { NextFunction, Request, Response } from 'express';

const BLOCKED_MUTATIONS = new Set([
  'POST /api/fulfillment/create-supplier-order',
]);

export function createLegacySafetyGate() {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.method.toUpperCase()} ${req.path}`;

    if (BLOCKED_MUTATIONS.has(key)) {
      return res.status(423).json({
        error: 'LEGACY_ACTION_BLOCKED',
        code: 'SUPPLIER_PURCHASE_REQUIRES_OWNER_APPROVAL',
        message: 'Legacy supplier-order creation is disabled. Supplier purchases require explicit owner approval and a governed purchase flow.',
        purchaseAutomationEnabled: false,
      });
    }

    next();
  };
}

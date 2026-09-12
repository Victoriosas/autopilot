import { Router } from 'express';
import { requireControlPlaneAuth } from './auth';
import { calculatePricingQuote, type PricingInput } from './pricingEngine';

export function createPricingRouter(): Router {
  const router = Router();
  router.use(requireControlPlaneAuth);

  router.post('/quote', (req, res) => {
    try {
      const quote = calculatePricingQuote((req.body || {}) as PricingInput);
      res.json({
        quote,
        policy: {
          autonomousPurchaseAllowed: false,
          draftEligible: quote.confidence >= 80 && quote.revenueScore >= 70,
          publishRequiresCouncilApproval: true,
          councilQuorum: '2_of_3',
          requiresReview: quote.confidence < 80 || quote.warnings.length > 0,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

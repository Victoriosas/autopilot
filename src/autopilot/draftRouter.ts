import { Router } from 'express';
import { requireControlPlaneAuth } from './auth';
import { buildCommercialDraft, type CommercialFacts } from './draftBuilder';
import type { OpportunityCandidate } from './opportunityEngine';

export function createDraftRouter(): Router {
  const router = Router();
  router.use(requireControlPlaneAuth);

  router.post('/build', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        candidate?: OpportunityCandidate;
        facts?: CommercialFacts;
        useAi?: boolean;
      };

      if (!body.candidate) {
        return res.status(400).json({ error: 'candidate is required' });
      }

      const draft = await buildCommercialDraft(
        body.candidate,
        body.facts || {},
        body.useAi !== false
      );

      return res.json({
        draft,
        policy: {
          autonomousPurchaseAllowed: false,
          publishRequiresHumanApproval: true,
          persistencePerformed: false,
        },
      });
    } catch (error: any) {
      const message = error?.message || 'Draft Builder failed';
      const status = message.includes('only draft_ready') ? 409 : 400;
      return res.status(status).json({ error: message });
    }
  });

  return router;
}

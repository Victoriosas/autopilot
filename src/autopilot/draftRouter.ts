import { Router } from 'express';
import { getAutopilotPrincipal, requireControlPlaneAuth } from './auth';
import { buildCommercialDraft, type CommercialFacts } from './draftBuilder';
import {
  draftPersistenceStatus,
  listPersistedProductDrafts,
  persistProductDraft,
  reviewProductDraft,
} from './draftStore';
import type { OpportunityCandidate } from './opportunityEngine';

export function createDraftRouter(): Router {
  const router = Router();
  router.use(requireControlPlaneAuth);

  router.get('/', async (req, res) => {
    try {
      const limit = Number(req.query.limit || 50);
      const drafts = await listPersistedProductDrafts(limit);
      return res.json({
        persistence: draftPersistenceStatus(),
        drafts,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Unable to list drafts' });
    }
  });

  router.post('/build', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        candidate?: OpportunityCandidate;
        facts?: CommercialFacts;
        useAi?: boolean;
        persist?: boolean;
      };

      if (!body.candidate) {
        return res.status(400).json({ error: 'candidate is required' });
      }

      const draft = await buildCommercialDraft(
        body.candidate,
        body.facts || {},
        body.useAi !== false
      );

      const persisted = body.persist === true
        ? await persistProductDraft(draft)
        : null;

      return res.json({
        draft,
        persisted,
        policy: {
          autonomousPurchaseAllowed: false,
          publishRequiresGovernorApproval: true,
          governorCanApproveLowRiskCommercialDrafts: true,
          highRiskOrFinancialActionsRequireOwnerApproval: true,
          persistencePerformed: Boolean(persisted),
        },
        persistence: draftPersistenceStatus(),
      });
    } catch (error: any) {
      const message = error?.message || 'Draft Builder failed';
      const status = message.includes('only draft_ready') ? 409 : 400;
      return res.status(status).json({ error: message });
    }
  });

  router.post('/:id/review', async (req, res) => {
    try {
      const principal = getAutopilotPrincipal(res);
      const body = (req.body || {}) as {
        decision?: 'approve' | 'reject';
        reason?: string;
      };

      if (body.decision !== 'approve' && body.decision !== 'reject') {
        return res.status(400).json({ error: 'decision must be approve or reject' });
      }

      const reviewed = await reviewProductDraft({
        id: req.params.id,
        decision: body.decision,
        reviewer: `autopilot-governor:${principal.role}`,
        reason: String(body.reason || '').trim(),
      });

      return res.json({
        draft: reviewed,
        policy: {
          autonomousPurchaseAllowed: false,
          publicationAllowedAfterAiApproval: reviewed.status === 'ai_approved',
          ownerApprovalStillRequiredFor: ['supplier_purchase', 'refund', 'production_secrets', 'medical_claims', 'regulated_products'],
        },
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Draft review failed' });
    }
  });

  return router;
}

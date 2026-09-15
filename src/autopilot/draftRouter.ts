import { Router } from 'express';
import { runApprovalCouncil } from './approvalCouncil';
import { getAutopilotPrincipal, requireControlPlaneAuth } from './auth';
import { buildCommercialDraft, type CommercialFacts } from './draftBuilder';
import {
  assertDraftPublishable,
  publishProductDraftAtomically,
  draftPersistenceStatus,
  getPersistedProductDraft,
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
      return res.json({ persistence: draftPersistenceStatus(), drafts });
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

      if (!body.candidate) return res.status(400).json({ error: 'candidate is required' });

      const draft = await buildCommercialDraft(body.candidate, body.facts || {}, body.useAi !== false);
      const persisted = body.persist === true ? await persistProductDraft(draft) : null;

      return res.json({
        draft,
        persisted,
        policy: {
          autonomousPurchaseAllowed: false,
          publishRequiresCouncilApproval: true,
          councilQuorum: '2_of_3',
          highRiskOrFinancialActionsRequireOwnerApproval: true,
          persistencePerformed: Boolean(persisted),
          persistedDraftsAreShadowOnly: true,
        },
        persistence: draftPersistenceStatus(),
      });
    } catch (error: any) {
      const message = error?.message || 'Draft Builder failed';
      const status = message.includes('only draft_ready') ? 409 : 400;
      return res.status(status).json({ error: message });
    }
  });

  router.post('/:id/council-review', async (req, res) => {
    try {
      const persisted = await getPersistedProductDraft(req.params.id);
      if (persisted.status !== 'draft') {
        return res.status(409).json({ error: 'draft has already been reviewed', status: persisted.status });
      }

      const council = await runApprovalCouncil(persisted.draft);
      if (council.ownerEscalationRequired) {
        return res.status(409).json({
          draft: persisted,
          council,
          policy: { publicationAllowed: false, ownerApprovalRequired: true },
        });
      }

      const reason = [
        council.summary,
        ...council.votes.map((vote) => `${vote.agent}: ${vote.decision} (${vote.confidence}%) - ${vote.reason}`),
      ].join(' | ').slice(0, 4000);

      const reviewed = await reviewProductDraft({
        id: req.params.id,
        decision: council.decision,
        reviewer: `autopilot-council:${council.quorum}`,
        reason,
      });

      return res.json({
        draft: reviewed,
        council,
        policy: {
          standardCatalogApproval: 'majority_2_of_3',
          publicationAllowedAfterCouncilApproval: reviewed.status === 'ai_approved' && reviewed.publicationEligible && !reviewed.createdInShadowMode,
          ownerApprovalStillRequiredFor: ['supplier_purchase', 'refund', 'production_secrets', 'medical_claims', 'regulated_products'],
        },
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Council review failed' });
    }
  });

  // Kept for backwards-compatible clients, but intentionally fail-closed.
  // Automatic publication is not part of the owner-approved release policy.
  router.post('/:id/auto-publish', async (_req, res) => {
    if (process.env.AUTOPILOT_AUTO_PUBLISH_ENABLED !== 'true' || process.env.AUTOPILOT_V4_AUTO_PUBLISH_ENABLED !== 'true') {
      return res.status(403).json({
        error: 'AUTO_PUBLICATION_DISABLED',
        policy: { manualAdminReleaseRequired: true, supplierPurchaseAllowed: false },
      });
    }
    return res.status(403).json({
      error: 'AUTO_PUBLICATION_NOT_APPROVED_FOR_CURRENT_RELEASE',
      policy: { manualAdminReleaseRequired: true },
    });
  });

  router.post('/:id/publish', async (req, res) => {
    try {
      const principal = getAutopilotPrincipal(res);
      if (principal.role !== 'admin') return res.status(403).json({ error: 'ADMIN_REQUIRED_FOR_MANUAL_RELEASE' });

      const persisted = await getPersistedProductDraft(req.params.id);
      assertDraftPublishable(persisted);

      if (persisted.status === 'published' && persisted.publishedProductId) {
        return res.json({
          draft: persisted,
          product: { id: persisted.publishedProductId, status: 'published' },
          policy: { idempotentReplay: true, autonomousPurchaseAllowed: false, manualRelease: true },
        });
      }

      if (persisted.status === 'publishing') {
        return res.status(409).json({ error: 'publication already in progress', status: persisted.status });
      }

      if (persisted.status !== 'ai_approved') {
        return res.status(409).json({
          error: 'draft must be council-approved before publication',
          status: persisted.status,
        });
      }

      const publishedDraft = await publishProductDraftAtomically(persisted.id);
      const product = { productId: publishedDraft.publishedProductId, status: 'published' };

      return res.json({
        draft: publishedDraft,
        product,
        policy: {
          approvedByCouncil: true,
          manualAdminRelease: true,
          freshProductionEvidenceRequired: true,
          supplierPurchaseTriggered: false,
          autonomousPurchaseAllowed: false,
          inventoryDefaultsToZeroUntilVerified: true,
        },
      });
    } catch (error: any) {
      const code=error?.message || 'Governed publication failed';
      const status=/STALE|PRODUCTION_READY|SHADOW|COUNCIL|ADMIN/.test(code)?409:400;
      return res.status(status).json({ error: code });
    }
  });

  router.post('/:id/review', async (req, res) => {
    try {
      const principal = getAutopilotPrincipal(res);
      const body = (req.body || {}) as { decision?: 'reject'; reason?: string };

      if (body.decision !== 'reject') {
        return res.status(400).json({
          error: 'Single-agent approval is disabled. Use /council-review for approval; this endpoint only supports rejection.',
        });
      }

      const reviewed = await reviewProductDraft({
        id: req.params.id,
        decision: 'reject',
        reviewer: `autopilot-governor:${principal.role}`,
        reason: String(body.reason || '').trim(),
      });

      return res.json({
        draft: reviewed,
        policy: {
          autonomousPurchaseAllowed: false,
          singleAgentApprovalAllowed: false,
          approvalRequiresCouncilQuorum: '2_of_3',
        },
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Draft review failed' });
    }
  });

  return router;
}

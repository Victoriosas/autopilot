import { Router } from 'express';
import { requireControlPlaneAuth } from './auth';
import { observePublishedCatalog } from './catalogMonitor';
import { persistCatalogObservations, listCatalogObservationHistory } from './catalogObservationStore';
import { buildRepricingProposal } from './repricingProposal';
import { runRepricingCouncil } from './repricingCouncil';
import { evaluatePromotion } from './promotionEngine';
import { assessDormancy } from './dormancyEngine';
import { calculateRealizedProfit } from './profitEngine';
import {
  applyApprovedRepricing,
  getRepricingProposal,
  listRepricingProposals,
  persistRepricingProposal,
  recordRepricingCouncil,
} from './repricingStore';

export function createCatalogGovernanceRouter(): Router {
  const router = Router();
  router.use(requireControlPlaneAuth);

  router.get('/observations', async (req, res) => {
    try {
      const limit = Number(req.query.limit || 50);
      const observations = await observePublishedCatalog(limit);
      const persistedCount = req.query.persist === 'true'
        ? await persistCatalogObservations(observations)
        : 0;
      return res.json({
        observations,
        persistedCount,
        policy: {
          readOnlyObservation: true,
          automaticStockMutationAllowed: false,
          automaticPriceMutationAllowed: false,
          supplierPurchaseAllowed: false,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Catalog observation failed' });
    }
  });

  router.get('/observations/:productId/history', async (req, res) => {
    try {
      const history = await listCatalogObservationHistory(req.params.productId, Number(req.query.limit || 50));
      return res.json({ history });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Unable to load observation history' });
    }
  });

  router.post('/repricing/propose', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.observation) return res.status(400).json({ error: 'observation is required' });
      const proposal = buildRepricingProposal(body.observation);
      const persisted = body.persist === true && proposal.status === 'review_required'
        ? await persistRepricingProposal(proposal)
        : null;
      return res.json({ proposal, persisted });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Unable to build repricing proposal' });
    }
  });

  router.get('/repricing', async (req, res) => {
    try {
      const items = await listRepricingProposals(Number(req.query.limit || 50));
      return res.json({ proposals: items });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Unable to list repricing proposals' });
    }
  });

  router.post('/repricing/:id/council-review', async (req, res) => {
    try {
      const persisted = await getRepricingProposal(req.params.id);
      if (persisted.status !== 'pending') {
        return res.status(409).json({ error: 'repricing proposal already reviewed', status: persisted.status });
      }
      const council = await runRepricingCouncil(persisted.proposal);
      if (council.ownerEscalationRequired) {
        return res.status(409).json({
          proposal: persisted,
          council,
          policy: {
            ownerApprovalRequired: true,
            councilMayOverride: false,
            automaticPriceMutationAllowed: false,
          },
        });
      }
      const reviewed = await recordRepricingCouncil(req.params.id, council);
      return res.json({ reviewed, council });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Repricing council failed' });
    }
  });

  router.post('/repricing/:id/apply', async (req, res) => {
    try {
      const applied = await applyApprovedRepricing(req.params.id);
      return res.json({
        applied,
        policy: {
          requiredPriorState: 'ai_approved',
          supplierPurchaseAllowed: false,
          compareAtPriceMutationPerformed: false,
        },
      });
    } catch (error: any) {
      return res.status(409).json({ error: error?.message || 'Unable to apply approved repricing' });
    }
  });

  router.post('/promotions/evaluate', (req, res) => {
    try {
      return res.json({ decision: evaluatePromotion(req.body || {}) });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Unable to evaluate promotion' });
    }
  });

  router.post('/dormancy/evaluate', (req, res) => {
    try {
      return res.json({ assessment: assessDormancy(req.body || {}) });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Unable to assess product dormancy' });
    }
  });

  router.post('/profit/calculate', (req, res) => {
    try {
      return res.json({ summary: calculateRealizedProfit(req.body || {}) });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Unable to calculate realized profit' });
    }
  });

  return router;
}

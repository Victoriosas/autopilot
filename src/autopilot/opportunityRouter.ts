import { Router } from 'express';
import { requireControlPlaneAuth } from './auth';
import { rankOpportunities, type OpportunityCandidate } from './opportunityEngine';
import { rerankDocuments } from './reranker';

export function createOpportunityRouter(): Router {
  const router = Router();
  router.use(requireControlPlaneAuth);

  router.post('/rank', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        candidates?: OpportunityCandidate[];
        limit?: number;
        query?: string;
        semanticTopN?: number;
      };

      if (!Array.isArray(body.candidates)) {
        return res.status(400).json({ error: 'candidates must be an array' });
      }

      const limit = Math.max(1, Math.min(Number(body.limit || 20), 100));
      const deterministic = rankOpportunities(body.candidates, Math.max(limit, 50));
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      const pipelineWarnings: string[] = [];

      if (!query || deterministic.length === 0) {
        return res.json({
          mode: 'deterministic',
          results: deterministic.slice(0, limit),
          policy: {
            autonomousPurchaseAllowed: false,
            publishRequiresHumanApproval: true,
          },
          warnings: pipelineWarnings,
        });
      }

      try {
        const semanticTopN = Math.max(1, Math.min(Number(body.semanticTopN || limit), deterministic.length));
        const reranked = await rerankDocuments(
          query,
          deterministic.map((result) => ({
            text: [
              result.candidate.title,
              result.candidate.source || '',
              ...(result.candidate.tags || []),
              ...result.reasons,
            ].filter(Boolean).join(' | '),
            metadata: { candidateId: result.candidate.id },
          })),
          semanticTopN
        );

        const byId = new Map(deterministic.map((item) => [item.candidate.id, item]));
        const blended = reranked
          .map((entry) => {
            const candidateId = String(entry.document.metadata && (entry.document.metadata as any).candidateId || '');
            const result = byId.get(candidateId);
            if (!result) return null;
            const semanticScore = Math.max(0, Math.min(100, Math.round(entry.relevanceScore * 100)));
            const blendedScore = Math.round((result.opportunityScore * 0.75) + (semanticScore * 0.25));
            return { ...result, semanticScore, blendedScore };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.blendedScore - a.blendedScore)
          .slice(0, limit);

        return res.json({
          mode: 'deterministic+semantic_rerank',
          results: blended,
          policy: {
            autonomousPurchaseAllowed: false,
            publishRequiresHumanApproval: true,
          },
          warnings: pipelineWarnings,
        });
      } catch (error: any) {
        pipelineWarnings.push(`Semantic rerank unavailable: ${error.message}`);
        return res.json({
          mode: 'deterministic_fallback',
          results: deterministic.slice(0, limit),
          policy: {
            autonomousPurchaseAllowed: false,
            publishRequiresHumanApproval: true,
          },
          warnings: pipelineWarnings,
        });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

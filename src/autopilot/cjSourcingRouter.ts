import { Router } from 'express';
import { getCJClient } from '../services/cjDropshipping';
import { requireControlPlaneAuth } from './auth';

/**
 * Read-only CJ sourcing surface for the Vercel control plane.
 * Product publication and supplier purchasing remain separate governed flows.
 */
export function createCJSourcingRouter(): Router {
  const router = Router();
  router.use(requireControlPlaneAuth);

  router.get('/status', (_req, res) => {
    return res.json({
      provider: 'cj_dropshipping',
      configured: Boolean(process.env.CJ_API_KEY?.trim()),
      capabilities: {
        categories: true,
        search: true,
        importToDraft: false,
        publishAutomatically: false,
        purchaseAutomatically: false,
      },
    });
  });

  router.get('/categories', async (_req, res) => {
    const cj = getCJClient();
    if (!cj) return res.status(503).json({ error: 'CJ_API_NOT_CONFIGURED' });
    try {
      return res.json({ categories: await cj.getCategoryList() });
    } catch (error: any) {
      return res.status(502).json({ error: 'CJ_API_REQUEST_FAILED', message: error?.message || 'CJ request failed' });
    }
  });

  router.post('/search', async (req, res) => {
    const cj = getCJClient();
    if (!cj) return res.status(503).json({ error: 'CJ_API_NOT_CONFIGURED' });

    const body = (req.body || {}) as {
      keyword?: string;
      categoryId?: string;
      pageNum?: number;
      pageSize?: number;
      minPrice?: number;
      maxPrice?: number;
    };
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim().slice(0, 120) : undefined;
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim().slice(0, 80) : undefined;
    const pageNum = Math.max(1, Math.min(Number(body.pageNum || 1), 1000));
    const pageSize = Math.max(1, Math.min(Number(body.pageSize || 20), 50));
    const minPrice = body.minPrice === undefined ? undefined : Number(body.minPrice);
    const maxPrice = body.maxPrice === undefined ? undefined : Number(body.maxPrice);
    if (!keyword && !categoryId) return res.status(400).json({ error: 'keyword_or_category_required' });
    if ((minPrice !== undefined && !Number.isFinite(minPrice)) || (maxPrice !== undefined && !Number.isFinite(maxPrice))) {
      return res.status(400).json({ error: 'price_filters_must_be_finite' });
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return res.status(400).json({ error: 'min_price_must_not_exceed_max_price' });
    }

    try {
      const result = await cj.searchProducts({ keyword, categoryId, pageNum, pageSize, minPrice, maxPrice });
      return res.json({ ...result, policy: { draftOnly: true, publishAutomatically: false, purchaseAutomatically: false } });
    } catch (error: any) {
      return res.status(502).json({ error: 'CJ_API_REQUEST_FAILED', message: error?.message || 'CJ request failed' });
    }
  });

  return router;
}

import { Router, json, type ErrorRequestHandler, type RequestHandler } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { createHash, createHmac } from 'node:crypto';
import { normalizeConsultationRequest } from './consultationRequest';
import { consultationSupabaseStore, type ConsultationStore } from './consultationSupabase';
import { createConsultationDelivery, type ConsultationDelivery } from './consultationDelivery';

export function createConsultationRouter(deps: { store?: ConsultationStore; delivery?: ConsultationDelivery; enabled?: () => boolean; origin?: () => string | undefined; abuseKey?: () => string | undefined; auth?: RequestHandler } = {}) {
  const router = Router(), store = deps.store || consultationSupabaseStore, delivery = deps.delivery || createConsultationDelivery();
  const enabled = deps.enabled || (() => process.env.CONSULTATION_REQUESTS_ENABLED === 'true' && process.env.CONSULTATION_PRIVACY_APPROVED === 'true' && process.env.CONSULTATION_RETENTION_READY === 'true');
  const origin = deps.origin || (() => process.env.PUBLIC_APP_URL), abuseKey = deps.abuseKey || (() => process.env.CONSULTATION_ABUSE_SECRET);
  const allowedOrigin = () => { try { const url = new URL(origin() || ''); return url.protocol === 'https:' && !url.username && !url.password ? url.origin : ''; } catch { return ''; } };
  const available = async () => { try { return enabled() && Boolean(allowedOrigin()) && Boolean(abuseKey() && (deps.abuseKey || abuseKey()!.length >= 32)) && delivery.ready() && await store.ready(); } catch { return false; } };
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/config', async (_req, res) => res.json({ enabled: await available(), privacyVersion: 'consultation-v1', retentionDays: 30 }));
  router.get('/admin', deps.auth || requireSupabaseAdminAuth, async (req, res) => {
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    try {
      const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token || !store.list) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      return res.json({ requests: await store.list(token, offset) });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  router.post('/', async (req, res, next) => {
    if (!await available()) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
    if (req.get('origin') !== allowedOrigin() || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'CONSULTATION_ORIGIN_INVALID' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'CONSULTATION_INPUT_INVALID' });
    return next();
  }, json({ limit: '4kb', strict: true }), async (req, res) => {
    if (Buffer.byteLength(JSON.stringify(req.body || {})) > 4096) return res.status(413).json({ error: 'CONSULTATION_INPUT_TOO_LARGE' });
    let input;
    try { input = normalizeConsultationRequest(req.body); } catch { return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' }); }
    try {
      const fingerprint = createHash('sha256').update(JSON.stringify({ input, delivery: delivery.signature?.() || '' })).digest('hex');
      // Uses Express's audited proxy configuration, never an arbitrary client X-Forwarded-For.
      const abuseHash = createHmac('sha256', abuseKey()!).update(req.ip || 'unknown').digest('hex');
      const claim = await store.claim(input, fingerprint, abuseHash);
      if (claim.state === 'conflict') return res.status(409).json({ error: 'CONSULTATION_IDEMPOTENCY_CONFLICT' });
      if (claim.state === 'throttled') return res.status(429).json({ error: 'CONSULTATION_RATE_LIMITED' });
      if (claim.state !== 'accepted') {
        if (claim.state !== 'send' || !claim.lease) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
        const providerId = await delivery.send(input.id);
        if (!await store.finish(input.id, claim.lease, providerId)) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      }
      return res.status(202).json({ id: input.id, status: 'accepted' });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  const invalidJson: ErrorRequestHandler = (error, _req, res, _next) => res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: error?.type === 'entity.too.large' ? 'CONSULTATION_INPUT_TOO_LARGE' : 'CONSULTATION_INPUT_INVALID' });
  router.use(invalidJson);
  return router;
}

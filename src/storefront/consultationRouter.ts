import { Router, json, type ErrorRequestHandler, type RequestHandler } from 'express';
import { isIP } from 'node:net';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { createHash, createHmac } from 'node:crypto';
import { normalizeConsultationRequest } from './consultationRequest';
import { consultationSupabaseStore, type ConsultationStore } from './consultationSupabase';
import { createConsultationDelivery, type ConsultationDelivery } from './consultationDelivery';
import { draftConsultationResponse } from './consultationResponseAgents';
import { maybeSendAutomaticConsultationReply } from './consultationAutoReply';
import { approveAndSendConsultationReply } from './consultationReplyDelivery';
import { beautyServerDatabase } from './beautyDatabase';
import { consultationReadStore, type ConsultationReadStore } from './consultationReading';
import { registerConsultationIntelligence,type IntelligenceRouterDependencies } from './consultationIntelligenceRouter';

export function consultationAddress(req: { ip?: string; get(name: string): string | undefined }, vercel = process.env.VERCEL === '1'): string {
  // Vercel overwrites this header. Outside its runtime, use only Express's peer IP.
  const address = vercel ? req.get('x-vercel-forwarded-for') : undefined;
  return address && isIP(address) ? address : req.ip || 'unknown';
}

export function createConsultationRouter(deps: { store?: ConsultationStore; reads?: ConsultationReadStore; intelligence?:IntelligenceRouterDependencies; delivery?: ConsultationDelivery; enabled?: () => boolean; origin?: () => string | undefined; abuseKey?: () => string | undefined; auth?: RequestHandler } = {}) {
  const router = Router(), store = deps.store || consultationSupabaseStore, delivery = deps.delivery || createConsultationDelivery();
  const reads = deps.reads || consultationReadStore;
  const enabled = deps.enabled || (() => process.env.CONSULTATION_REQUESTS_ENABLED === 'true' && process.env.CONSULTATION_PRIVACY_APPROVED === 'true' && process.env.CONSULTATION_RETENTION_READY === 'true');
  const origin = deps.origin || (() => process.env.PUBLIC_APP_URL), abuseKey = deps.abuseKey || (() => process.env.CONSULTATION_ABUSE_SECRET);
  const allowedOrigin = () => { try { const url = new URL(origin() || ''); return url.protocol === 'https:' && !url.username && !url.password ? url.origin : ''; } catch { return ''; } };
  const available = async () => { try { return enabled() && Boolean(allowedOrigin()) && Boolean(abuseKey() && (deps.abuseKey || abuseKey()!.length >= 32)) && delivery.ready() && await store.ready(); } catch { return false; } };
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/config', async (_req, res) => res.json({ enabled: await available(), privacyVersion: 'consultation-v1', retentionDays: 30 }));
  // Aggregate-only private dashboard; no names, email addresses or clinical details.
  router.get('/admin/metrics', deps.auth || requireSupabaseAdminAuth, async (_req, res) => {
    try {
      const db = beautyServerDatabase();
      const cutoff = new Date().toISOString();
      const [requests, sent, uncertain, unreadRequests] = await Promise.all([
        db.from('consultation_requests').select('id', { count: 'exact', head: true }).gt('expires_at', cutoff),
        db.from('consultation_reply_outbox').select('request_id', { count: 'exact', head: true }).eq('state', 'sent').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        db.from('consultation_reply_outbox').select('request_id', { count: 'exact', head: true }).eq('state', 'failed_unknown').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        reads.unreadCount().catch(() => null),
      ]);
      if (requests.error || sent.error || uncertain.error) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      return res.json({ activeRequests: requests.count || 0, sentLast30Days: sent.count || 0, uncertainLast30Days: uncertain.count || 0, unreadRequests });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  router.get('/admin', deps.auth || requireSupabaseAdminAuth, async (req, res) => {
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    try {
      const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token || !store.list) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      const requests = await store.list(token, offset);
      // Missing schema/permissions must mean unknown reading, never "all unread".
      const readStates = await reads.list(requests.map(row => row.id)).catch(() => null);
      return res.json({ requests, readStates });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  router.post('/admin/:id/read-state', deps.auth || requireSupabaseAdminAuth, json({ limit: '1kb', strict: true }), async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    if (req.get('origin') !== allowedOrigin() || req.get('x-consultation-approval') !== req.params.id) return res.status(403).json({ error: 'CONSULTATION_ORIGIN_INVALID' });
    const value = req.body;
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || typeof value.read !== 'boolean') return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    try {
      const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      const adminId = res.locals.adminUserId;
      if (!token || typeof adminId !== 'string' || !store.get) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      if (!await store.get(token, req.params.id)) return res.status(404).json({ error: 'CONSULTATION_NOT_FOUND' });
      return res.json({ readAt: await reads.set(req.params.id, adminId, value.read) });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  // Read-only delivery audit, scoped to verified administrators and valid consultation records.
  router.get('/admin/:id/reply-status', deps.auth || requireSupabaseAdminAuth, async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    try {
      const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token || !store.get) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      if (!await store.get(token, req.params.id)) return res.status(404).json({ error: 'CONSULTATION_NOT_FOUND' });
      const db = beautyServerDatabase();
      const [result, caseResult] = await Promise.all([
        db.from('consultation_reply_outbox').select('state,created_at,sent_at').eq('request_id', req.params.id).maybeSingle(),
        db.from('consultation_case_states').select('status,updated_at').eq('request_id', req.params.id).maybeSingle(),
      ]);
      if (result.error || caseResult.error) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      return res.json({ reply: result.data || null, case: caseResult.data || { status: 'new' } });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  // Administrative workflow is independent of delivery and can never send mail.
  router.post('/admin/:id/case-status', deps.auth || requireSupabaseAdminAuth, json({ limit: '1kb', strict: true }), async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    if (req.get('origin') !== allowedOrigin() || req.get('x-consultation-approval') !== req.params.id) return res.status(403).json({ error: 'CONSULTATION_ORIGIN_INVALID' });
    const valid = ['new', 'in_review', 'awaiting_contact', 'answered', 'closed'] as const;
    const value = req.body;
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !valid.includes(value.status)) return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    try {
      const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      const adminId = res.locals.adminUserId;
      if (!token || typeof adminId !== 'string' || !store.get) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      if (!await store.get(token, req.params.id)) return res.status(404).json({ error: 'CONSULTATION_NOT_FOUND' });
      const result = await beautyServerDatabase().from('consultation_case_states').upsert({
        request_id: req.params.id, status: value.status, updated_by: adminId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'request_id' });
      if (result.error) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      return res.json({ status: value.status });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  // Authenticated, read-only draft generation. No email is sent from this endpoint.
  router.get('/admin/:id/draft', deps.auth || requireSupabaseAdminAuth, async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    try {
      const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token || !store.get) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      const record = await store.get(token, req.params.id);
      if (!record) return res.status(404).json({ error: 'CONSULTATION_NOT_FOUND' });
      return res.json({ draft: draftConsultationResponse(record.input) });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  // Explicit human approval only. No customer details appear in URL or logs.
  router.post('/admin/:id/approve-send', deps.auth || requireSupabaseAdminAuth, async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(400).json({ error: 'CONSULTATION_INPUT_INVALID' });
    if (req.get('origin') !== allowedOrigin()) return res.status(403).json({ error: 'CONSULTATION_ORIGIN_INVALID' });
    if (req.get('x-consultation-approval') !== req.params.id) return res.status(400).json({ error: 'CONSULTATION_APPROVAL_REQUIRED' });
    try {
      const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      const adminId = res.locals.adminUserId;
      if (!token || typeof adminId !== 'string' || !store.get) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
      const record = await store.get(token, req.params.id);
      if (!record) return res.status(404).json({ error: 'CONSULTATION_NOT_FOUND' });
      const result = await approveAndSendConsultationReply(record, adminId);
      if (result === 'invalid_channel') return res.status(409).json({ error: 'CONSULTATION_REPLY_CHANNEL_UNAVAILABLE' });
      if (result === 'already_processing') return res.status(409).json({ error: 'CONSULTATION_REPLY_ALREADY_PROCESSED' });
      if (result === 'provider_unavailable') return res.status(503).json({ error: 'CONSULTATION_REPLY_UNAVAILABLE' });
      return res.json({ status: 'sent' });
    } catch { return res.status(503).json({ error: 'CONSULTATION_REPLY_UNAVAILABLE' }); }
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
      const abuseHash = createHmac('sha256', abuseKey()!).update(consultationAddress(req)).digest('hex');
      const claim = await store.claim(input, fingerprint, abuseHash);
      if (claim.state === 'conflict') return res.status(409).json({ error: 'CONSULTATION_IDEMPOTENCY_CONFLICT' });
      if (claim.state === 'throttled') return res.status(429).json({ error: 'CONSULTATION_RATE_LIMITED' });
      if (claim.state !== 'accepted') {
        if (claim.state !== 'send' || !claim.lease) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
        const providerId = await delivery.send(input.id);
        if (!await store.finish(input.id, claim.lease, providerId)) return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' });
        // Only a newly accepted form with confirmed owner notification may trigger auto-acknowledgement.
        // Failure never causes form resubmission or a second automatic send attempt.
        try { await maybeSendAutomaticConsultationReply(input); } catch { /* Fail closed; never retry an uncertain email. */ }
      }
      return res.status(202).json({ id: input.id, status: 'accepted' });
    } catch { return res.status(503).json({ error: 'CONSULTATION_UNAVAILABLE' }); }
  });
  registerConsultationIntelligence(router,deps.auth||requireSupabaseAdminAuth,store,allowedOrigin,deps.intelligence);
  const invalidJson: ErrorRequestHandler = (error, _req, res, _next) => res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: error?.type === 'entity.too.large' ? 'CONSULTATION_INPUT_TOO_LARGE' : 'CONSULTATION_INPUT_INVALID' });
  router.use(invalidJson);
  return router;
}

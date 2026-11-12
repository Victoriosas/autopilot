import { json, type Router, type RequestHandler } from 'express';
import { beautyCallerDatabase } from './beautyDatabase';
import { CONSULTATION_UUID } from './consultationRequest';
import { createMaterialAdminStore, type MaterialAdminStore } from './consultationMaterialAdmin';

// Public key + verified caller JWT only, including the admin profile lookup.
export const requireMaterialAdmin: RequestHandler = async (req, res, next) => {
  const token = req.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
  try {
    const db = beautyCallerDatabase(token);
    const user = await db.auth.getUser(token);
    if (user.error || !user.data.user) return res.status(401).json({ error: 'ADMIN_AUTH_INVALID' });
    const profile = await db.from('profiles').select('role').eq('id', user.data.user.id).single();
    if (profile.error || profile.data?.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ROLE_REQUIRED' });
    next();
  } catch { return res.status(503).json({ error: 'MATERIAL_UNAVAILABLE' }); }
};

export function registerConsultationMaterialAdmin(router: Router, origin: () => string, store: MaterialAdminStore = createMaterialAdminStore(), auth: RequestHandler = requireMaterialAdmin) {
  const base = '/admin/:request/material';
  const guard: RequestHandler = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!CONSULTATION_UUID.test(req.params.request)) return res.status(400).json({ error: 'MATERIAL_INPUT_INVALID' });
    if (!req.get('authorization')?.match(/^Bearer (\S+)$/i)) return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
    if (req.method !== 'GET' && (!origin() || req.get('origin') !== origin() || req.get('x-consultation-approval') !== req.params.request)) return res.status(403).json({ error: 'MATERIAL_APPROVAL_REQUIRED' });
    next();
  };
  const token = (req: Parameters<RequestHandler>[0]) => req.get('authorization')!.slice(7);
  router.get(base, auth, guard, async (req, res) => {
    try { return res.json({ rows: await store.snapshot(token(req), req.params.request), delivery_decision: 'no_send' }); }
    catch { return res.status(503).json({ error: 'MATERIAL_UNAVAILABLE' }); }
  });
  router.post(base + '/review', auth, guard, json({ limit: '1kb', strict: true }), async (req, res) => {
    const value = req.body;
    if (!value || Object.keys(value).sort().join(',') !== 'id,state,updated_at' || !CONSULTATION_UUID.test(value.id) || typeof value.updated_at !== 'string' || !Number.isFinite(Date.parse(value.updated_at)) || !['reviewed','rejected','revoked'].includes(value.state)) return res.status(400).json({ error: 'MATERIAL_INPUT_INVALID' });
    try {
      const saved = await store.review(token(req), req.params.request, value.id, value.updated_at, value.state);
      return res.status(saved ? 200 : 409).json({ saved, delivery_decision: 'no_send' });
    } catch { return res.status(503).json({ error: 'MATERIAL_UNAVAILABLE' }); }
  });
  router.post(base + '/purge', auth, guard, json({ limit: '1kb', strict: true }), async (req, res) => {
    if (!req.body || Object.keys(req.body).length) return res.status(400).json({ error: 'MATERIAL_INPUT_INVALID' });
    try { return res.json({ erased: await store.purge(token(req), req.params.request), delivery_decision: 'no_send' }); }
    catch { return res.status(503).json({ error: 'MATERIAL_UNAVAILABLE' }); }
  });
}

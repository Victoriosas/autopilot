import { json, type Router, type RequestHandler } from 'express';
import { strictObject } from './consultationIntelligenceContracts';
import { runConsultationLab } from './consultationLab';
import { consultationLabCases } from './consultationLabCases';
import { consultationKnowledge } from './consultationKnowledge';
import { serviceKnowledgeStore, validateServiceKnowledge, type ServiceKnowledgeStore } from './consultationServiceKnowledge';

export function registerConsultationLab(router: Router, auth: RequestHandler, allowedOrigin: () => string, knowledge: ServiceKnowledgeStore = serviceKnowledgeStore) {
  const guard: RequestHandler = (req, res, next) => {
    if (req.get('origin') !== allowedOrigin() || req.get('x-consultation-lab') !== 'synthetic-v1' || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'LAB_ORIGIN_INVALID' });
    next();
  };
  router.get('/admin/lab', auth, (_req, res) => res.json({ cases: consultationLabCases, remoteAvailable: false, reviewRequired: true, sendsEnabled: false }));
  router.post('/admin/lab', auth, guard, json({ limit: '1kb', strict: true }), async (req, res) => {
    if (!strictObject(req.body, ['caseId']) || typeof req.body.caseId !== 'string' || !consultationLabCases.some(c => c.id === req.body.caseId)) return res.status(400).json({ error: 'LAB_CASE_INVALID' });
    try {
      // A failed knowledge read must not block isolated, synthetic-only testing.
      // Fall back to ZERO facts, never to stale or unapproved service content.
      // The private editor still returns 503 when its schema is unavailable.
      let facts: Awaited<ReturnType<ServiceKnowledgeStore['facts']>> = [];
      let knowledgeUnavailable = false;
      try { facts = await knowledge.facts(); }
      catch { knowledgeUnavailable = true; }
      const simulation = await runConsultationLab(req.body.caseId, { facts });
      return res.json({ ...simulation, knowledgeUnavailable });
    } catch {
      return res.status(503).json({ error: 'LAB_SIMULATION_UNAVAILABLE', reviewRequired: true, delivery: 'NOT_SENT' });
    }
  });
  router.get('/admin/lab/knowledge', auth, async (req, res) => {
    try { const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]; if (!token) return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
      return res.json({ services: consultationKnowledge.services, entries: await knowledge.list(token) });
    } catch { return res.status(503).json({ error: 'KNOWLEDGE_UNAVAILABLE' }); }
  });
  router.post('/admin/lab/knowledge', auth, guard, json({ limit: '16kb', strict: true }), async (req, res) => {
    let value; try { value = validateServiceKnowledge(req.body); } catch { return res.status(400).json({ error: 'KNOWLEDGE_INPUT_INVALID' }); }
    try { const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]; if (!token) return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
      const saved = await knowledge.save(token, value); return res.status(saved ? 200 : 409).json({ saved });
    } catch { return res.status(409).json({ error: 'KNOWLEDGE_SAVE_REJECTED' }); }
  });
}

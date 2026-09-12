import { Router } from 'express';
import { listAgents } from './agentRegistry';
import { controlPlaneAuthStatus, getAutopilotPrincipal, requireControlPlaneAuth } from './auth';
import { getModelRouterStatus } from './modelRouter';
import { modelTelemetryStatus } from './modelTelemetry';
import { getTaskOrchestrator } from './orchestrator';
import { rerankDocuments } from './reranker';
import {
  listPersistedTasks,
  persistAuditEvent,
  persistTask,
  taskPersistenceStatus,
} from './taskStore';
import type { Actor, AutopilotAction } from './policyEngine';

export function createAutopilotV4Router(): Router {
  const router = Router();
  const orchestrator = getTaskOrchestrator();

  router.use(requireControlPlaneAuth);

  router.get('/status', (_req, res) => {
    res.json({
      version: '4.0.0-alpha.3',
      controlPlane: 'governed',
      auth: controlPlaneAuthStatus(),
      persistence: taskPersistenceStatus(),
      telemetry: modelTelemetryStatus(),
      modelRouter: getModelRouterStatus(),
      principal: getAutopilotPrincipal(res).role,
    });
  });

  router.get('/agents', (_req, res) => {
    res.json({ agents: listAgents() });
  });

  router.get('/tasks', async (req, res) => {
    try {
      const persistence = taskPersistenceStatus();
      const limit = Number(req.query.limit || 100);
      const persisted = persistence.durable ? await listPersistedTasks(limit) : [];
      res.json({ tasks: persistence.durable ? persisted : orchestrator.listTasks() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/tasks', async (req, res) => {
    try {
      const { goal, actor, action, input } = req.body as {
        goal?: string;
        actor?: Actor;
        action?: AutopilotAction;
        input?: unknown;
      };

      if (!goal || !actor || !action) {
        return res.status(400).json({ error: 'goal, actor and action are required' });
      }

      const principal = getAutopilotPrincipal(res);
      if (principal.role === 'codex' && actor !== 'codex') {
        return res.status(403).json({ error: 'Codex credentials may only create codex tasks' });
      }

      const task = orchestrator.createTask(goal, actor, action, input);
      await persistTask(task);
      await Promise.all(
        task.audit.map((event) =>
          persistAuditEvent({
            taskId: task.id,
            at: event.at,
            event: event.event,
            details: { ...(typeof event.details === 'object' && event.details ? event.details : {}), principal: principal.role },
          })
        )
      );

      res.status(201).json({ task });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/tasks/:id/approve', async (_req, res) => {
    try {
      const principal = getAutopilotPrincipal(res);
      const approvedBy = principal.role === 'codex' ? 'codex' : 'human';
      const task = orchestrator.approve(_req.params.id, approvedBy);
      const event = task.audit[task.audit.length - 1];
      await persistTask(task);
      await persistAuditEvent({
        taskId: task.id,
        at: event.at,
        event: event.event,
        details: { ...(typeof event.details === 'object' && event.details ? event.details : {}), principal: principal.role },
      });
      res.json({ task });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/rerank', async (req, res) => {
    try {
      const { query, documents, topN = 10 } = req.body as {
        query?: string;
        documents?: Array<{ text: string; metadata?: unknown }>;
        topN?: number;
      };

      if (!query || !Array.isArray(documents)) {
        return res.status(400).json({ error: 'query and documents are required' });
      }
      if (documents.length > 200) {
        return res.status(400).json({ error: 'Maximum 200 documents per rerank request' });
      }
      if (documents.some((document) => !document?.text || typeof document.text !== 'string')) {
        return res.status(400).json({ error: 'Every document must contain text' });
      }

      const results = await rerankDocuments(query, documents, Number(topN));
      res.json({ results });
    } catch (error: any) {
      res.status(503).json({ error: error.message });
    }
  });

  return router;
}

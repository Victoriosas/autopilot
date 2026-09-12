import { Router } from 'express';
import { getModelRouterStatus } from './modelRouter';
import { getTaskOrchestrator } from './orchestrator';
import { rerankDocuments } from './reranker';
import { persistAuditEvent, persistTask, taskPersistenceStatus } from './taskStore';
import type { Actor, AutopilotAction } from './policyEngine';

export function createAutopilotV4Router(): Router {
  const router = Router();
  const orchestrator = getTaskOrchestrator();

  router.get('/status', (_req, res) => {
    res.json({
      version: '4.0.0-alpha',
      controlPlane: 'governed',
      persistence: taskPersistenceStatus(),
      modelRouter: getModelRouterStatus(),
    });
  });

  router.get('/tasks', (_req, res) => {
    res.json({ tasks: orchestrator.listTasks() });
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

      const task = orchestrator.createTask(goal, actor, action, input);
      await persistTask(task);
      await Promise.all(
        task.audit.map((event) =>
          persistAuditEvent({
            taskId: task.id,
            at: event.at,
            event: event.event,
            details: event.details,
          })
        )
      );

      res.status(201).json({ task });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/tasks/:id/approve', async (req, res) => {
    try {
      const approvedBy = req.body?.approvedBy === 'codex' ? 'codex' : 'human';
      const task = orchestrator.approve(req.params.id, approvedBy);
      const event = task.audit[task.audit.length - 1];
      await persistTask(task);
      await persistAuditEvent({
        taskId: task.id,
        at: event.at,
        event: event.event,
        details: event.details,
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

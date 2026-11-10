import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createAutopilotV4Router } from './api';

test('Codex cannot approve its own human-gated task; admin approval remains available', async () => {
  const previousAdmin = process.env.AUTOPILOT_ADMIN_TOKEN;
  const previousCodex = process.env.AUTOPILOT_CODEX_TOKEN;
  process.env.AUTOPILOT_ADMIN_TOKEN = 'synthetic-admin-token';
  process.env.AUTOPILOT_CODEX_TOKEN = 'synthetic-codex-token';

  const app = express();
  app.use(express.json());
  app.use(createAutopilotV4Router());
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;

  const request = (path: string, token: string, body?: unknown) => fetch(`${url}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(3000),
  });

  try {
    const created = await request('/tasks', 'synthetic-admin-token', {
      goal: 'synthetic protected action',
      actor: 'codex',
      action: 'deploy_production',
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { task: { id: string; status: string } };
    const task = createdBody.task;
    assert.equal(task.status, 'awaiting_approval');

    const codexApproval = await request(
      `/tasks/${encodeURIComponent(task.id)}/approve`,
      'synthetic-codex-token',
      {},
    );
    assert.equal(codexApproval.status, 403);

    const tasks = await request('/tasks', 'synthetic-admin-token');
    const listed = await tasks.json() as { tasks: Array<{ id: string; status: string }> };
    assert.equal(listed.tasks.find((candidate) => candidate.id === task.id)?.status, 'awaiting_approval');

    const humanApproval = await request(
      `/tasks/${encodeURIComponent(task.id)}/approve`,
      'synthetic-admin-token',
      {},
    );
    assert.equal(humanApproval.status, 200);
    const approved = await humanApproval.json() as {
      task: { status: string; audit: Array<{ details?: { approvedBy?: string } }> };
    };
    assert.equal(approved.task.status, 'queued');
    assert.equal(approved.task.audit.at(-1)?.details?.approvedBy, 'human');
  } finally {
    if (previousAdmin === undefined) delete process.env.AUTOPILOT_ADMIN_TOKEN;
    else process.env.AUTOPILOT_ADMIN_TOKEN = previousAdmin;
    if (previousCodex === undefined) delete process.env.AUTOPILOT_CODEX_TOKEN;
    else process.env.AUTOPILOT_CODEX_TOKEN = previousCodex;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

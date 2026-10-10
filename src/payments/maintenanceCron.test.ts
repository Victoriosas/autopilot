import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createCommerceMaintenanceRouter } from './commerceMaintenance';

test('maintenance cron requires its own secret, defaults disabled and never initiates payments', async () => {
  const env: NodeJS.ProcessEnv = { COMMERCE_MAINTENANCE_CRON_SECRET: 'fixture-maint-cron' };
  const actions: string[] = [], owners: string[] = [];
  const app = express();
  app.use('/maintenance', createCommerceMaintenanceRouter({
    env: () => env,
    command: async (action: string, args: any) => {
      actions.push(action);
      if (action === 'expired') return { reservations: [] };
      if (action === 'claim_fulfillment') { owners.push(args.owner); return { job: null }; }
      throw new Error('unexpected command');
    },
    gateway: { async create() { throw new Error('must never charge'); }, async lookup() { throw new Error('unused'); } },
  }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${(server.address() as any).port}/maintenance/cron`;
    for (const token of [undefined, 'Bearer fixture-sourcing-only', 'Bearer fixture-maint-cron-extra']) {
      assert.equal((await fetch(url, { headers: token ? { authorization: token } : {} })).status, 401);
    }
    const request = () => fetch(url, { headers: { authorization: 'Bearer fixture-maint-cron' } });
    const disabled = await request();
    assert.equal(disabled.status, 200);
    assert.deepEqual(await disabled.json(), { status: 'skipped_disabled' });
    env.COMMERCE_MAINTENANCE_CRON_ENABLED = 'TRUE';
    assert.deepEqual(await (await request()).json(), { status: 'skipped_disabled' });
    assert.deepEqual(actions, []);
    env.COMMERCE_MAINTENANCE_CRON_ENABLED = 'true';
    const head = await fetch(url, { method: 'HEAD', headers: { authorization: 'Bearer fixture-maint-cron' } });
    assert.equal(head.status, 405);
    assert.deepEqual(actions, []);
    for (let retry = 0; retry < 2; retry++) {
      const response = await request(); assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { expiryChecks: 0, uncertainReservations: 0, manualTasks: 0 });
    }
    assert.deepEqual(actions, ['expired', 'claim_fulfillment', 'expired', 'claim_fulfillment']);
    assert.equal(new Set(owners).size, 2);
    delete env.COMMERCE_MAINTENANCE_CRON_SECRET;
    assert.equal((await request()).status, 401);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('maintenance cron returns sanitized failures without leaking provider or database details', async () => {
  const app = express();
  app.use(createCommerceMaintenanceRouter({
    env: () => ({ COMMERCE_MAINTENANCE_CRON_ENABLED: 'true', COMMERCE_MAINTENANCE_CRON_SECRET: 'fixture-maint-cron' }),
    command: async () => { throw new Error('sensitive upstream details'); },
  }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/cron`, { headers: { authorization: 'Bearer fixture-maint-cron' } });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'COMMERCE_MAINTENANCE_UNAVAILABLE' });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import handler from '../../vercel-api';
import { createApp } from '../http/createApp';

const vercelRequest: RequestListener = (req, res) => {
  const url = new URL(req.url!, 'http://127.0.0.1');
  const query: Record<string, string | string[]> = { path: url.pathname.replace(/^\/api\//, '').split('/') };
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  Object.assign(req, { query });
  handler(req, res);
};

test('Vercel rewrite preserves health, query arrays and anonymous access controls on Node 24', async () => {
  const warnings: string[] = [];
  const recordWarning = (warning: Error & { code?: string }) => {
    if (warning.code === 'DEP0169') warnings.push(warning.stack ?? warning.message);
  };
  process.on('warning', recordWarning);
  const server = createServer(vercelRequest);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const path of ['/api/health', '/api/health?probe=synthetic&probe=repeat&encoded=a%26b']) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const health = await response.json();
      assert.equal(health.status, 'ok');
      assert.equal(health.runtime, 'vercel');
      assert.equal(health.checkoutEnabled, false);
      assert.equal(health.checkoutRequested, false);
    }
    assert.equal((await fetch(origin + '/api/beauty/inquiries/admin')).status, 401);
    const missing = await fetch(origin + '/api/does-not-exist');
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'API_ROUTE_NOT_FOUND' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(warnings, [], 'DEP0169 requires investigation with --trace-deprecation');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    process.off('warning', recordWarning);
  }
});

test('direct Express and Vercel preserve the shared API protections and parser order', async (t) => {
  const prior = process.env.CONSULTATION_REQUESTS_ENABLED;
  process.env.CONSULTATION_REQUESTS_ENABLED = 'false';
  t.after(() => {
    if (prior === undefined) delete process.env.CONSULTATION_REQUESTS_ENABLED;
    else process.env.CONSULTATION_REQUESTS_ENABLED = prior;
  });

  for (const [name, listener] of [
    ['Node', createApp({ healthMetadata: () => ({ service: 'Node fixture' }) })],
    ['Vercel', vercelRequest],
  ] as const) {
    await t.test(name, async (subtest) => {
      const server = createServer(listener);
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      subtest.after(async () => {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      });
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const admin = await fetch(origin + '/api/beauty/inquiries/admin');
      assert.equal(admin.status, 401);
      await admin.body?.cancel();

      const unavailable = await fetch(origin + '/api/beauty/inquiries', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid',
      });
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), { error: 'CONSULTATION_UNAVAILABLE' });

      const legacy = await fetch(origin + '/api/webhooks/paypal', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      });
      assert.equal(legacy.status, 410);
      assert.equal((await legacy.json()).code, 'LEGACY_WEBHOOK_ROUTE_DISABLED');
    });
  }
});

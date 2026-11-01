import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import handler from '../../vercel-api';

test('Vercel rewrite preserves health, query arrays and anonymous access controls on Node 24', async () => {
  const warnings: string[] = [];
  const recordWarning = (warning: Error & { code?: string }) => {
    if (warning.code === 'DEP0169') warnings.push(warning.stack ?? warning.message);
  };
  process.on('warning', recordWarning);
  const server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://127.0.0.1');
    const query: Record<string, string | string[]> = { path: url.pathname.replace(/^\/api\//, '').split('/') };
    for (const key of new Set(url.searchParams.keys())) {
      const values = url.searchParams.getAll(key);
      query[key] = values.length > 1 ? values : values[0];
    }
    (req as any).query = query;
    handler(req, res);
  });
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

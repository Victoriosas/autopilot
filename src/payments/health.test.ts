import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import handler from '../../vercel-api';

test('public health distinguishes requested checkout from verified availability', async () => {
  const old = process.env.CHECKOUT_ENABLED, atomic = process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED;
  process.env.CHECKOUT_ENABLED = 'true'; process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED = 'false';
  const server = createServer((req, res) => { (req as any).query = { path: 'health' }; handler(req, res); }).listen(0, '127.0.0.1');
  await once(server, 'listening'); const { port } = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200); const health = await response.json();
    assert.equal(health.checkoutEnabled, false); assert.equal(health.checkoutRequested, true);
  } finally {
    if (old === undefined) delete process.env.CHECKOUT_ENABLED; else process.env.CHECKOUT_ENABLED = old;
    if (atomic === undefined) delete process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED; else process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED = atomic;
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

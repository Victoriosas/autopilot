import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createLegacySafetyGate } from './legacySafety';

test('legacy safety gate blocks case and trailing-slash aliases before downstream handlers', async () => {
  const app = express();
  app.use(createLegacySafetyGate());
  app.use((_req, res) => res.status(200).json({ unsafeHandlerReached: true }));
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  try {
    const routes = [
      ['POST', '/api/fulfillment/create-supplier-order', 423],
      ['POST', '/api/autopilot/discover', 410],
      ['POST', '/api/autopilot/analyze', 410],
      ['GET', '/api/sourcing/price-monitor', 423],
      ['POST', '/api/sourcing/verify-published', 423],
      ['POST', '/api/payments/paypal/order', 410],
      ['POST', '/api/payments/paypal/capture', 410],
      ['POST', '/api/webhooks/paypal', 410],
    ] as const;
    for (const [method, path, status] of routes) {
      for (const alias of [path, `${path}/`, path.toUpperCase(), `${path.toUpperCase()}/`]) {
        const response = await fetch(`http://127.0.0.1:${port}${alias}?ignored=1`, { method });
        assert.equal(response.status, status, `${method} ${alias}`);
        assert.equal((await response.json()).error, 'LEGACY_ACTION_BLOCKED');
      }
    }
    for (const path of ['/api/sourcing/price-monitor', '/API/SOURCING/PRICE-MONITOR/']) {
      assert.equal((await fetch(`http://127.0.0.1:${port}${path}`, { method: 'HEAD' })).status, 423, path);
    }
    for (const alias of ['/api/sourcing/price-monitor', '/api/sourcing/price-monitor/', '/API/SOURCING/PRICE-MONITOR/']) {
      assert.equal((await fetch(`http://127.0.0.1:${port}${alias}`, { method: 'HEAD' })).status, 423, `HEAD ${alias}`);
    }
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/payments/v2/config`, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/payments/v2/config`)).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

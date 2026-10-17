import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createLegacyAdminGuard } from './adminAuth';

test('legacy admin guard protects case aliases and only exempts the V4 path segment', async () => {
  const app = express();
  app.use(createLegacyAdminGuard());
  app.use((_req, res) => res.status(200).json({ reached: true }));
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  try {
    for (const path of ['/api/sourcing/products', '/api/autopilot/discover', '/api/fulfillment/status', '/api/connectors', '/api/autopilot/v4evil']) {
      for (const alias of [path, `${path}/`, path.toUpperCase()]) {
        const response = await fetch(`http://127.0.0.1:${port}${alias}?ignored=1`);
        assert.equal(response.status, 401, alias);
        assert.equal((await response.json()).error, 'ADMIN_AUTH_REQUIRED');
      }
    }
    for (const path of ['/api/autopilot/v4', '/API/AUTOPILOT/V4/', '/api/autopilot/v4/sourcing', '/api/health']) {
      assert.equal((await fetch(`http://127.0.0.1:${port}${path}`)).status, 200, path);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

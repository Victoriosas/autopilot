import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createMercadoLibreRouter } from './mercadoLibreRouter';

test('Mercado Libre rejects unauthorized admin routes and invalid OAuth callbacks', async () => {
  const app = express();
  app.use('/api/integrations/mercadolibre', createMercadoLibreRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}/api/integrations/mercadolibre`;
  try {
    for (const route of ['status', 'authorize']) {
      const response = await fetch(`${base}/${route}`);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'ADMIN_AUTH_REQUIRED' });
    }
    for (const [query, cookie] of [
      ['', ''],
      ['?code=test&state=expected', ''],
      ['?code=test&state=expected', 'victoriosa_ml_oauth_state=other'],
      ['?code=test&state=expected', 'victoriosa_ml_oauth_state=%E0%A4%A'],
    ]) {
      const response = await fetch(`${base}/callback${query}`, {
        headers: { cookie }, signal: AbortSignal.timeout(1500), redirect: 'manual',
      });
      assert.equal(response.status, 400);
      assert.equal(await response.text(), 'Mercado Libre OAuth: state o code inválido.');
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

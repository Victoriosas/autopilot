import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const nodeBundle = fileURLToPath(new URL('../dist-node/server.cjs', import.meta.url));
const vercelHandler = createRequire(import.meta.url)('../dist/vercel-api.cjs').default;
assert.equal(typeof vercelHandler, 'function');

const request = (origin, pathname, method = 'GET') => fetch(origin + pathname, {
  method, signal: AbortSignal.timeout(5000),
});

async function checkMissingApi(origin) {
  for (const method of ['GET', 'POST', 'HEAD']) {
    const response = await request(origin, '/api/__missing_build_probe__', method);
    assert.equal(response.status, 404, `${method} unknown API status`);
    assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);
    if (method === 'HEAD') assert.equal(await response.text(), '');
    else assert.deepEqual(await response.json(), { error: 'API_ROUTE_NOT_FOUND' });
  }
}

const vercel = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  req.query = { path: url.pathname.slice('/api/'.length).split('/') };
  vercelHandler(req, res);
}).listen(0, '127.0.0.1');
try {
  await once(vercel, 'listening');
  await checkMissingApi(`http://127.0.0.1:${vercel.address().port}`);
} finally {
  vercel.closeAllConnections();
  await new Promise(resolve => vercel.close(resolve));
}

// An empty working directory and a minimal environment keep local .env files out of the probe.
const cwd = await mkdtemp(join(tmpdir(), 'victoriosas-build-probe-'));
const child = spawn(process.execPath, [nodeBundle], {
  cwd,
  env: {
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0',
    CHECKOUT_ENABLED: 'false', AUTOPILOT_LEGACY_SOURCING_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
  windowsHide: true,
});
const closed = new Promise(resolve => child.once('close', resolve));
const lines = createInterface({ input: child.stdout });
async function listeningPort() {
  for await (const line of lines) {
    const match = /Server running on port (\d+)/.exec(line);
    if (match) return Number(match[1]);
  }
  throw new Error('Compiled Node server exited before listening');
}
try {
  const port = await Promise.race([
    listeningPort(),
    new Promise((_, reject) => child.once('error', reject)),
    delay(10000, 0, { ref: false }),
  ]);
  assert.ok(port, 'Compiled Node server did not listen in time');
  const origin = `http://127.0.0.1:${port}`;
  await checkMissingApi(origin);
  const health = await request(origin, '/api/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).checkoutEnabled, false);
  const home = await request(origin, '/');
  assert.equal(home.status, 200);
  const asset = /<script[^>]+src="(\/assets\/[^\"]+\.js)"/.exec(await home.text());
  assert.ok(asset, 'Node HTML has no compiled entry asset');
  assert.equal((await request(origin, asset[1])).status, 200);
  assert.equal((await request(origin, '/checkout')).status, 410);
} finally {
  lines.close();
  if (child.exitCode === null && child.signalCode === null) child.kill();
  await closed;
  await rmdir(cwd);
}

console.log('Both compiled APIs return JSON 404. Node serves its own HTML and assets.');

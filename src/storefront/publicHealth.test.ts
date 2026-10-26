import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicHealth } from '../../scripts/public-health.mjs';

function responses(change: Record<string, unknown> = {}) {
  const bodies: Record<string, unknown> = {
    '/api/health': { status: 'ok', commit: 'a'.repeat(40), checkoutEnabled: false, checkoutRequested: false },
    '/api/beauty/config': { requestsEnabled: false },
    '/api/beauty/inquiries/config': { enabled: true, privacyVersion: 'consultation-v1', retentionDays: 30 },
    '/api/beauty/catalog': { catalogEnabled: false, services: [] },
    '/api/payments/mercadopago/config': { configured: false, checkoutRequested: false, unavailableReason: 'CHECKOUT_DISABLED' },
    ...change,
  };
  return async (url: string, options?: RequestInit) => {
    assert.equal(options?.method, 'GET');
    assert.equal(options?.redirect, 'manual');
    assert.equal(options?.body, undefined);
    const path = new URL(url).pathname;
    const status = ['/tienda', '/checkout', '/tratamientos'].includes(path) ? 410
      : path.startsWith('/de-mi-para-ti/') ? 404
      : path === '/api/beauty/inquiries/admin' ? 401 : 200;
    return new Response(JSON.stringify(bodies[path] ?? {}), { status });
  };
}

test('public monitor accepts the closed release and uses GET only', async () => {
  const result = await checkPublicHealth('https://example.test', responses());
  assert.equal(result.commit, 'a'.repeat(40));
});
for (const [name, change] of Object.entries({
  payments: { '/api/health': { status: 'ok', commit: 'a'.repeat(40), checkoutEnabled: true, checkoutRequested: false } },
  requests: { '/api/beauty/config': { requestsEnabled: true } },
  catalog: { '/api/beauty/catalog': { catalogEnabled: true, services: [] } },
  provider: { '/api/payments/mercadopago/config': { configured: true, checkoutRequested: true } },
  malformed: { '/api/health': {} },
})) {
  test(`public monitor rejects ${name} drift`, async () => {
    await assert.rejects(checkPublicHealth('https://example.test', responses(change)));
  });
}
test('public monitor rejects redirects that hide missing drafts', async () => {
  await assert.rejects(checkPublicHealth('https://example.test', async () => new Response('', { status: 302 })));
});
test('public monitor propagates unavailable hosting', async () => {
  await assert.rejects(checkPublicHealth('https://example.test', async () => { throw new Error('offline'); }));
});

test('public monitor rejects missing service discovery', async () => {
  const normal = responses();
  await assert.rejects(checkPublicHealth('https://example.test', async (url: string, options?: RequestInit) =>
    new URL(url).pathname === '/nuestros-servicios'
      ? new Response('', { status: 404 }) : normal(url, options)));
});

test('public monitor checks the consultation page, config and private inbox boundary', async () => {
  const visited: string[] = [];
  const normal = responses();
  await checkPublicHealth('https://example.test', async (url: string, options?: RequestInit) => {
    visited.push(new URL(url).pathname);
    return normal(url, options);
  });
  for (const path of ['/consultanos', '/api/beauty/inquiries/config', '/api/beauty/inquiries/admin']) {
    assert.ok(visited.includes(path), `missing consultation health check: ${path}`);
  }
});

for (const [name, config] of Object.entries({
  disabled: { enabled: false, privacyVersion: 'consultation-v1', retentionDays: 30 },
  malformed: {},
  wrongPrivacy: { enabled: true, privacyVersion: 'unknown', retentionDays: 30 },
  wrongRetention: { enabled: true, privacyVersion: 'consultation-v1', retentionDays: 60 },
})) {
  test(`public monitor rejects consultation config ${name}`, async () => {
    await assert.rejects(checkPublicHealth('https://example.test', responses({ '/api/beauty/inquiries/config': config })));
  });
}

for (const [path, status] of [
  ['/consultanos', 404],
  ['/api/beauty/inquiries/config', 503],
  ['/api/beauty/inquiries/admin', 200],
] as const) {
  test(`public monitor rejects consultation route drift: ${path} HTTP ${status}`, async () => {
    const normal = responses();
    await assert.rejects(checkPublicHealth('https://example.test', async (url: string, options?: RequestInit) =>
      new URL(url).pathname === path ? new Response('{}', { status }) : normal(url, options)));
  });
}

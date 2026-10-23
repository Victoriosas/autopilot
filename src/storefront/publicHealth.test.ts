import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicHealth } from '../../scripts/public-health.mjs';

function responses(change: Record<string, unknown> = {}) {
  const bodies: Record<string, unknown> = {
    '/api/health': { status: 'ok', commit: 'a'.repeat(40), checkoutEnabled: false, checkoutRequested: false },
    '/api/beauty/config': { requestsEnabled: false },
    '/api/beauty/catalog': { catalogEnabled: false, services: [] },
    '/api/payments/mercadopago/config': { configured: false, checkoutRequested: false, unavailableReason: 'CHECKOUT_DISABLED' },
    ...change,
  };
  return async (url: string) => {
    const path = new URL(url).pathname;
    const status = ['/tienda', '/checkout', '/tratamientos'].includes(path) ? 410
      : path.startsWith('/de-mi-para-ti/') ? 404 : 200;
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
  await assert.rejects(checkPublicHealth('https://example.test', async (url: string) =>
    new URL(url).pathname === '/nuestros-servicios'
      ? new Response('', { status: 404 }) : normal(url)));
});

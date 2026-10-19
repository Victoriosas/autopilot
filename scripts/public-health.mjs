import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// GET requests only. No customer data, login, purchases or provider mutations.
export async function checkPublicHealth(origin, request = fetch) {
  async function get(path, status = 200) {
    const response = await request(new URL(path, origin).href, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, status, `${path}: unexpected HTTP status`);
    console.log(`${path}: HTTP ${response.status}`);
    return response;
  }
  for (const path of ['/', '/de-mi-para-ti', '/privacidad', '/robots.txt', '/sitemap.xml']) await get(path);
  for (const path of ['/tienda', '/checkout', '/tratamientos']) await get(path, 410);
  for (const slug of ['una-pausa-tranquila-para-vos', 'ordenar-tu-rutina-cosmetica']) await get(`/de-mi-para-ti/${slug}`, 404);
  const health = await (await get('/api/health')).json();
  assert.equal(health.status, 'ok');
  assert.match(health.commit, /^[a-f0-9]{40}$/);
  assert.equal(health.checkoutEnabled, false);
  assert.equal(health.checkoutRequested, false);
  const beauty = await (await get('/api/beauty/config')).json();
  assert.equal(beauty.requestsEnabled, false);
  const catalog = await (await get('/api/beauty/catalog')).json();
  assert.equal(catalog.catalogEnabled, false);
  assert.deepEqual(catalog.services, []);
  const payments = await (await get('/api/payments/mercadopago/config')).json();
  assert.equal(payments.configured, false);
  assert.equal(payments.checkoutRequested, false);
  assert.equal(payments.unavailableReason, 'CHECKOUT_DISABLED');
  console.log(`Public release healthy: ${health.commit}; commercial gates closed.`);
  return { commit: health.commit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkPublicHealth('https://victoriosas.online');
}

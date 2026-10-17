/** Isolated UI smoke: requires Playwright + Chromium and a fixture-only Vite server.
 * Start: VITE_DEMO_MODE=true VITE_CHECKOUT_ENABLED=true VITE_SUPABASE_URL=http://127.0.0.1:59999 VITE_SUPABASE_ANON_KEY=fixture-public-key npx vite --host 127.0.0.1 --port 5173
 * Run: PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs node scripts/storefront-smoke.mjs
 * All non-Vite network requests are intercepted. No real auth, payments or orders.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const baseURL = process.env.STOREFRONT_SMOKE_URL || 'http://127.0.0.1:5173';
assert.equal(new URL(baseURL).hostname, '127.0.0.1', 'Only isolated loopback servers allowed');
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const orderKeys = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL).origin && !url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname === '/api/payments/mercadopago/config') return route.fulfill({ json: { configured: true } });
      if (url.pathname === '/api/payments/v2/config') return route.fulfill({ json: { checkoutEnabled: true, paypalConfigured: false, transferConfigured: false } });
      if (url.pathname === '/api/payments/mercadopago/order') {
        orderKeys.push(route.request().headers()['idempotency-key']);
        return route.fulfill(orderKeys.length === 1
          ? { status: 409, json: { error: 'CHECKOUT_RESERVATION_RELEASED', retryAllowed: true } }
          : { status: 503, json: { error: 'Fixture uncertain outcome' } });
      }
      if (url.pathname === '/api/connectors') return route.fulfill({ json: { connectors: [] } });
      return route.fulfill({ status: 503, json: { error: 'Isolated smoke fixture: integration unavailable' } });
    });
    const page = await context.newPage();
    await page.goto(baseURL);
    const productTitle = page.getByRole('heading', { name: 'Auriculares Hi-Fi Espaciales con Cancelación Activa Híbrida 42dB', exact: true });
    await productTitle.waitFor();
    await productTitle.click();
    const detail = page.getByRole('dialog', { name: 'Auriculares Hi-Fi Espaciales con Cancelación Activa Híbrida 42dB', exact: true });
    await detail.waitFor();
    await mkdir('docs/evidence', { recursive: true });
    const detailClose = await detail.getByRole('button', { name: 'Cerrar detalle del producto' }).boundingBox();
    assert(detailClose && detailClose.y >= 0 && detailClose.y + detailClose.height <= viewport.height, 'Detail close must start within viewport');
    await page.screenshot({ path: `docs/evidence/storefront-detail-${viewport.width}.png` });
    assert(await detail.evaluate(node => node.contains(document.activeElement)), 'Detail must receive focus');
    await page.keyboard.press('Shift+Tab');
    assert(await detail.evaluate(node => node.contains(document.activeElement)), 'Focus must remain in detail');
    await page.keyboard.press('Escape');
    await detail.waitFor({ state: 'detached' });
    await productTitle.click();
    await page.getByRole('button', { name: /Añadir a la bolsa ·/ }).click();
    const cart = page.getByRole('dialog', { name: 'Tu Bolsa Victoriosa' });
    await cart.waitFor();
    assert(await cart.evaluate(node => node.contains(document.activeElement)), 'Bag must receive focus');
    await page.keyboard.press('Shift+Tab');
    assert(await cart.evaluate(node => node.contains(document.activeElement)), 'Focus must remain in bag');
    await cart.getByRole('button', { name: 'Tramitar Pedido Seguro' }).click();
    const checkout = page.getByRole('dialog', { name: 'Finalizar pedido' });
    await checkout.waitFor();
    const checkoutClose = await checkout.getByRole('button', { name: 'Cerrar checkout' }).boundingBox();
    assert(checkoutClose && checkoutClose.y >= 0 && checkoutClose.y + checkoutClose.height <= viewport.height, 'Checkout close must start within viewport');
    await page.screenshot({ path: `docs/evidence/storefront-checkout-${viewport.width}.png` });
    assert(await checkout.evaluate(node => node.contains(document.activeElement)), 'Checkout must receive focus');
    for (const [label, value] of Object.entries({ 'Nombre completo': 'Cliente Fixture', Email: 'fixture@example.test', Teléfono: '099000000', Dirección: 'Dirección de prueba', 'Código postal': '15000', Ciudad: 'Ciudad Fixture' })) {
      await checkout.getByLabel(label, { exact: true }).fill(value);
    }
    const payButton = checkout.getByRole('button', { name: 'Tarjeta, débito y medios locales · Mercado Pago' });
    await payButton.click();
    await page.getByText('La reserva anterior terminó y fue liberada. Revisá tu bolsa y volvé a intentar para crear un nuevo pedido.', { exact: true }).waitFor();
    assert.equal(orderKeys.length, 1, 'Released attempt must require a new user click');
    await payButton.click();
    await page.getByText('Fixture uncertain outcome', { exact: true }).waitFor();
    assert.notEqual(orderKeys[0], orderKeys[1], 'Explicit released attempt must receive a new key');
    await payButton.click();
    assert.equal(orderKeys.length, 3);
    assert.equal(orderKeys[1], orderKeys[2], 'Uncertain attempt must retain its key');
    await page.keyboard.press('Escape');
    await checkout.waitFor({ state: 'detached' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal viewport overflow');
    console.log(`PASS isolated dialog smoke ${viewport.width}x${viewport.height}`);
    await context.close();
  }
} finally {
  await browser.close();
}

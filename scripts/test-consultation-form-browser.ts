// Real browser, loopback only. Cookie gate and delivery are synthetic fixtures.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createConsultationRouter } from '../src/storefront/consultationRouter';
import type { ConsultationStore } from '../src/storefront/consultationSupabase';

let available = true, claims = 0, notices = 0, clearedPosts = 0;
const store: ConsultationStore = {
  ready: async () => true,
  claim: async () => { claims++; return { state: 'send', lease: 'synthetic-lease' }; },
  finish: async () => true,
};
const app = express();
// Mirrors an edge clearance requirement without contacting or bypassing Cloudflare.
app.use('/api/beauty/inquiries', (req, res, next) => {
  if (!req.headers.cookie?.includes('synthetic_clearance=verified')) {
    return res.status(403).type('html').send('<html>Security challenge fixture</html>');
  }
  if (req.method === 'POST') clearedPosts++;
  next();
});
app.use('/api/beauty/inquiries', createConsultationRouter({ store, enabled: () => available,
  origin: () => 'https://victoriosas.online', abuseKey: () => 'synthetic-fixture',
  delivery: { ready: () => true, send: async () => { notices++; return 'synthetic-notice'; } },
}));
const vite = await createViteServer({ configFile: false, root: process.cwd(), plugins: [react(), {
  name: 'isolated-form-entry',
  resolveId(id) { if (id === '/__form.js') return '\0form-entry'; },
  load(id) { if (id === '\0form-entry') return `import React from 'react';import {createRoot} from 'react-dom/client';import {ConsultationForm} from '/src/components/public/ConsultationForm.tsx';createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(ConsultationForm)));`; },
}], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
app.get('/__form', async (_req, res) => {
  res.setHeader('Set-Cookie', 'synthetic_clearance=verified; Path=/; HttpOnly; SameSite=Lax');
  res.type('html').send(await vite.transformIndexHtml('/__form', '<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__form.js"></script></body></html>'));
});
app.use(vite.middlewares);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const { chromium } = await import(process.env.CONSULTATION_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Block every external request; only the local fixture can receive synthetic input.
    await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const submit = page.getByRole('button', { name: 'Enviar consulta', exact: true });
    available = true;
    await page.goto(base + '/__form');
    await page.waitForFunction(() => !(document.querySelector('button[type=submit]') as HTMLButtonElement)?.disabled, undefined, { timeout: 5000 });
    assert.equal(await submit.isEnabled(), true, 'same-origin clearance must survive the configuration request');
    await page.locator('[name=fullName]').fill('Caso sintético');
    await page.locator('[name=phone]').fill('00000000');
    await page.locator('[name=message]').fill('Quisiera orientación general.');
    await submit.click();
    assert.equal(claims, notices, 'native consent validation prevents persistence');
    const before = claims;
    await page.locator('[name=consent]').check();
    // Public origin check remains active: loopback origin is rejected.
    const rejected = page.waitForResponse(r => r.request().method() === 'POST');
    await submit.click();
    assert.equal((await rejected).status(), 403);
    assert.equal(clearedPosts, viewport.width === 1280 ? 1 : 2, 'POST also retains clearance before origin validation');
    assert.equal(claims, before);
    available = false;
    await page.reload();
    await page.getByText('El formulario está temporalmente sin conexión.', { exact: false }).waitFor();
    assert.equal(await submit.isDisabled(), true);
    available = true;
    await page.getByRole('button', { name: 'Reintentar conexión' }).click();
    await page.waitForFunction(() => !(document.querySelector('button[type=submit]') as HTMLButtonElement)?.disabled);
    assert.deepEqual(errors, []);
    console.log(`Form browser ${viewport.width}px: clearance, consent, origin, fail-closed and retry OK`);
    await context.close();
  }
  assert.equal(notices, 0);
} finally {
  await browser.close(); await vite.close();
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
}

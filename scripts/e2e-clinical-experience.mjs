import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.E2E_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4184/';
const chrome = process.env.E2E_CHROME_PATH;
const out = process.env.E2E_SCREENSHOT_DIR || '.clinical-screenshots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
try {
  for (const width of [390, 1365]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const noOverflow = async (label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 5), label + ' horizontal overflow');
    const home = await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
    assert.equal(home.status(), 200);
    assert.ok(await page.getByRole('link', { name: /conocé nuestra tecnología/i }).count());
    await page.getByRole('link', { name: /conocé nuestra tecnología/i }).first().click();
    await page.waitForURL('**/tecnologia');
    const deepLink = await page.reload({ waitUntil: 'networkidle' });
    assert.equal(deepLink?.status(), 200, 'technology direct reload must not return 404');
    assert.equal(await page.locator('.beauty-equipment-card').count(), 4);
    assert.ok(await page.getByText('Dermapen', { exact: true }).isVisible());
    await noOverflow('technology');
    await page.screenshot({ path: out + '/technology-' + width + '.png', fullPage: true, animations: 'disabled' });

    if (width < 1290) {
      await page.getByRole('button', { name: /menú/i }).first().click();
      await page.getByRole('navigation', { name: /navegación móvil/i }).getByRole('link', { name: 'Tratamientos', exact: true }).click();
    } else {
      await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Tratamientos', exact: true }).click();
    }
    await page.waitForURL('**/nuestros-servicios');
    assert.equal(await page.locator('.beauty-treatment-card-grid > li').count(), 11);
    assert.ok(await page.locator('.beauty-treatment-category-heading img').isVisible());
    const search = page.getByRole('searchbox', { name: 'Encontrá tu tratamiento' });
    await search.fill('hidratación');
    assert.ok(await page.locator('.beauty-treatment-card-grid > li').count() >= 1);
    await search.fill('noexisteestaopcion');
    assert.equal(await page.locator('.beauty-treatment-card-grid > li').count(), 0);
    assert.ok(await page.getByText(/no encontramos coincidencias/i).isVisible());
    await search.fill('');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: out + '/treatments-' + width + '.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: /ayudame a elegir/i }).click();
    assert.ok(await page.getByRole('dialog').isVisible());
    await page.locator('.beauty-finder-options button').first().click();
    assert.ok(await page.locator('.beauty-finder-progress').isVisible());
    await page.getByRole('button', { name: /empezar de nuevo/i }).click();
    assert.ok(await page.getByText(/paso 1 de 3/i).isVisible());
    await page.getByRole('button', { name: /cerrar/i }).first().click();
    await page.getByRole('link', { name: /corporales/i }).first().click();
    assert.equal(await page.locator('.beauty-treatment-card-grid > li').count(), 6);
    await page.locator('.beauty-treatment-card-grid a').first().click();
    assert.ok(await page.getByText(/ver detalles del tratamiento/i).count());
    await noOverflow('treatments and detail');
    assert.deepEqual(errors, [], 'JS errors');
    console.log('PASS width=' + width + ' technology(4), facials(11), body(6), search, wizard, detail, responsive');
    await page.close();
  }
} finally { await browser.close(); }

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.E2E_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4182/';
const screenshotDir = process.env.E2E_SCREENSHOT_DIR || '.visual-screenshots';
const chrome = process.env.E2E_CHROME_PATH;
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
try {
  for (const width of [390, 1365]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let r = await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
    assert.equal(r?.status(), 200, 'home HTTP');
    assert.equal(await page.locator('.beauty-tech-kicker').isVisible(), true, 'clinical kicker');
    assert.equal(await page.locator('.beauty-tech-panel').isVisible(), width > 1050, 'responsive process panel');
    const btn = page.locator('.beauty-home-actions .beauty-button').first();
    assert.equal(await btn.isVisible(), true, 'home CTA');
    const shadow = await btn.evaluate(e => getComputedStyle(e).boxShadow);
    assert.notEqual(shadow, 'none', '3D button must have visible depth');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 5), true, 'no horizontal overflow');
    await page.screenshot({ path: screenshotDir + '/home-' + width + '.png', fullPage: true, animations: 'disabled' });
    if (width < 1050) {
      await page.getByRole('button', { name: /menú/i }).first().click();
      await page.getByRole('navigation', { name: /navegación móvil/i }).getByRole('link', { name: 'Tratamientos', exact: true }).click();
    } else {
      await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Tratamientos', exact: true }).click();
    }
    await page.waitForURL('**/nuestros-servicios');
    assert.equal(await page.getByRole('heading', { name: 'Tratamientos', exact: true }).isVisible(), true);
    assert.ok((await page.locator('.beauty-treatment-links a').count()) > 0, 'service tiles');
    const tileShadow = await page.locator('.beauty-treatment-links a').first().evaluate(e => getComputedStyle(e).boxShadow);
    assert.notEqual(tileShadow, 'none', 'service tile must have depth');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 5), true, 'treatments no overflow');
    await page.screenshot({ path: screenshotDir + '/treatments-' + width + '.png', fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, [], 'JS must not throw');
    console.log('PASS: ' + width + 'px, home + treatments, 3D depth, mobile/desktop, no overflow or JS errors');
    await page.close();
  }
} finally { await browser.close(); }

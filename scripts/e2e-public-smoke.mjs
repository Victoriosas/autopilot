import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.E2E_PLAYWRIGHT_PATH || 'playwright');
const url = process.env.E2E_BASE_URL || 'http://127.0.0.1:4178/';
const browser = await chromium.launch({ headless: true, ...(process.env.E2E_CHROME_PATH ? { executablePath: process.env.E2E_CHROME_PATH } : {}) });
try {
  for (const width of [390, 1365]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (response?.status() !== 200) throw new Error(`HTTP ${response?.status()} at ${width}px`);
    if (!/Victoriosas/i.test(await page.title())) throw new Error(`Unexpected title at ${width}px`);
    const body = await page.locator('body').innerText();
    if (!/victoriosas/i.test(body)) throw new Error(`Missing visible content at ${width}px`);
    const menu = page.getByRole('button', { name: /men\u00fa|menu/i }).first();
    let navigationCheck;
    if (width < 1200) {
      if (!(await menu.isVisible())) throw new Error(`Mobile menu button absent at ${width}px`);
      await menu.click();
      if (await menu.getAttribute('aria-expanded') !== 'true') throw new Error(`Menu did not expand at ${width}px`);
      const mobileNav = page.getByRole('navigation', { name: 'Navegación móvil' });
      if (!(await mobileNav.getByRole('link', { name: 'Tratamientos', exact: true }).isVisible())) {
        throw new Error(`Mobile navigation links absent at ${width}px`);
      }
      navigationCheck = 'menu-expanded';
    } else {
      const desktopNav = page.getByRole('navigation', { name: 'Principal' });
      if (!(await desktopNav.isVisible()) || !(await desktopNav.getByRole('link', { name: 'Tratamientos', exact: true }).isVisible())) {
        throw new Error(`Desktop navigation absent at ${width}px`);
      }
      if (await menu.isVisible()) throw new Error(`Unexpected mobile menu at ${width}px`);
      navigationCheck = 'desktop-nav-visible';
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    if (overflow) throw new Error(`Horizontal overflow at ${width}px`);
    if (errors.length) throw new Error(`JavaScript errors at ${width}px: ${errors.join('; ')}`);
    console.log(`PASS viewport=${width} http=200 ${navigationCheck} no-overflow js-errors=0`);
    await page.close();
  }
} finally {
  await browser.close();
}

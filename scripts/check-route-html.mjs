import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Checks the actual Vite output and the hosting destinations, without a browser DOM.
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const read = (name) => readFileSync(`dist/${name}`, 'utf8');
const home = read('index.html');
const editorial = read('seo/editorial.html');
const fallback = read('seo/fallback.html');
assert.match(home, /rel="canonical" href="https:\/\/victoriosas.online\/"/);
assert.match(editorial, /rel="canonical" href="https:\/\/victoriosas.online\/de-mi-para-ti"/);
assert.match(editorial, /property="og:url" content="https:\/\/victoriosas.online\/de-mi-para-ti"/);
assert.match(fallback, /name="robots" content="noindex,nofollow"/);
assert.doesNotMatch(fallback, /rel="canonical"|property="og:url"/);
for (const html of [home, editorial, fallback]) {
  const script = html.match(/<script[^>]+src="([^"]+)"/)[1];
  assert.ok(existsSync(`dist${script}`), `Missing entry asset: ${script}`);
}
for (const route of ['/de-mi-para-ti', '/de-mi-para-ti/']) {
  assert.equal(config.rewrites.find(rule => rule.source === route)?.destination, '/seo/editorial.html');
}
assert.equal(config.rewrites.at(-1).destination, '/seo/fallback.html');
assert.match(read('sitemap.xml'), /https:\/\/victoriosas.online\/de-mi-para-ti<\/loc>/);
assert.doesNotMatch(read('sitemap.xml'), /admin|beauty-professional|checkout|tratamientos/);
console.log('Built route HTML, assets, sitemap and Vercel destinations: PASS');

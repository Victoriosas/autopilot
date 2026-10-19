import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Checks the actual Vite output and the hosting destinations, without a browser DOM.
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const read = (name) => readFileSync(`dist/${name}`, 'utf8');
const home = read('index.html');
const editorial = read('seo/editorial.html');
const fallback = read('seo/fallback.html');
const privacy = read('seo/privacy.html');
assert.match(home, /rel="canonical" href="https:\/\/victoriosas.online\/"/);
assert.match(editorial, /rel="canonical" href="https:\/\/victoriosas.online\/de-mi-para-ti"/);
assert.match(editorial, /property="og:url" content="https:\/\/victoriosas.online\/de-mi-para-ti"/);
assert.match(fallback, /name="robots" content="noindex,nofollow"/);
assert.doesNotMatch(fallback, /rel="canonical"|property="og:url"/);
assert.match(privacy, /rel="canonical" href="https:\/\/victoriosas.online\/privacidad"/);
assert.match(home, /property="og:image" content="https:\/\/victoriosas.online\/brand\/social-victoriosas.png"/);
assert.ok(existsSync('dist/brand/social-victoriosas.png'));
const social = readFileSync('dist/brand/social-victoriosas.png');
assert.equal(social.readUInt32BE(16), 1200);
assert.equal(social.readUInt32BE(20), 630);
for (const [, cssPath] of home.matchAll(/<link[^>]+href="(\/assets\/[^\"]+\.css)"/g)) {
  const css = read(cssPath.slice(1));
  for (const [, raw] of css.matchAll(/url\(([^)]+)\)/g)) {
    const url = raw.replace(/^["']|["']$/g, '');
    if (url.startsWith('data:')) continue;
    assert.ok(!url.startsWith('http'), `External runtime asset: ${url}`);
    assert.ok(existsSync(`dist${url}`), `Missing stylesheet asset: ${url}`);
  }
}
for (const html of [home, editorial, fallback, privacy]) {
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

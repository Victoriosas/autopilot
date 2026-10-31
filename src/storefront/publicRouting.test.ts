import test from 'node:test';
import assert from 'node:assert/strict';
import middleware from '../../middleware';

test('retired commerce routes return HTTP410/noindex for GET and HEAD without reflection', async () => {
  for (const path of ['/tienda', '/checkout/', '/tratamientos?ref=%3Cscript%3E']) {
    const response = middleware(new Request('https://victoriosas.online' + path));
    assert.equal(response?.status, 410, path);
    assert.equal(response?.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    const html = await response!.text();
    assert.match(html, /Volver al inicio/);
    assert.doesNotMatch(html, /<script|rel="canonical"|%3Cscript%3E/);
  }
  const head = middleware(new Request('https://victoriosas.online/tienda', {method:'HEAD'}));
  assert.equal(head?.status, 410);
  assert.equal(await head!.text(), '');
});
test('unknown pages and editorial drafts are real HTTP404 in production', () => {
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  try {
    for (const path of ['/inexistente', '/de-mi-para-ti/inexistente', '/de-mi-para-ti/una-pausa-tranquila-para-vos']) {
      assert.equal(middleware(new Request('https://victoriosas.online' + path))?.status, 404, path);
    }
  } finally { if(previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous; }
});
test('known pages, private entry points, API, assets and preview drafts retain their existing handlers', () => {
  for (const path of ['/', '/servicios', '/contacto/', '/victoria', '/tecnologia', '/tecnologia/', '/privacidad', '/de-mi-para-ti', '/admin', '/beauty-professional', '/api/health', '/assets/app.js', '/brand/fonts/font-1.ttf', '/robots.txt', '/sitemap.xml', '/favicon.svg']) {
    assert.equal(middleware(new Request('https://victoriosas.online' + path)), undefined, path);
  }
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'preview';
  try {
    assert.equal(middleware(new Request('https://preview.example/de-mi-para-ti/una-pausa-tranquila-para-vos')), undefined);
    assert.equal(middleware(new Request('https://preview.example/de-mi-para-ti/not-a-draft'))?.status, 404);
  } finally { if(previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous; }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeHtml, type PublicDocument } from './routeMetadata';

test('service discovery has distinct indexable initial metadata in production', () => {
  const html = routeHtml(readFileSync('index.html', 'utf8'), 'services' as PublicDocument, false);
  assert.match(html, /<title>Nuestros servicios · Victoriosas<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/victoriosas.online\/nuestros-servicios"/);
  assert.match(html, /property="og:url" content="https:\/\/victoriosas.online\/nuestros-servicios"/);
  assert.match(html, /property="og:title" content="Nuestros servicios · Victoriosas"/);
  assert.match(html, /name="twitter:title" content="Nuestros servicios · Victoriosas"/);
  assert.match(html, /name="robots" content="index,follow"/);
});

test('hosting and sitemap include service discovery without changing API routing', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  for (const path of ['/nuestros-servicios', '/nuestros-servicios/']) {
    assert.equal(config.rewrites.find((rule: {source:string}) => rule.source === path)?.destination, '/seo/services.html');
  }
  assert.equal(config.rewrites[0].source, '/api/:path*');
  assert.match(readFileSync('public/sitemap.xml', 'utf8'), /<loc>https:\/\/victoriosas.online\/nuestros-servicios<\/loc>/);
  assert.match(routeHtml(readFileSync('index.html', 'utf8'), 'services' as PublicDocument, true), /name="robots" content="noindex,nofollow"/);
});

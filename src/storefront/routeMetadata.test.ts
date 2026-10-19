import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeHtml } from './routeMetadata';

const source = readFileSync('index.html', 'utf8');
test('editorial initial HTML has its own canonical and consistent social metadata', () => {
  const html = routeHtml(source, 'editorial', false);
  assert.match(html, /<title>De mí para ti · Victoriosas<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/victoriosas.online\/de-mi-para-ti"/);
  assert.match(html, /property="og:url" content="https:\/\/victoriosas.online\/de-mi-para-ti"/);
  assert.match(html, /property="og:title" content="De mí para ti · Victoriosas"/);
  assert.match(html, /property="og:description" content="Un espacio pensado como una pausa/);
  assert.match(html, /name="robots" content="index,follow"/);
  assert.match(html, /src="\/src\/main.tsx"/);
});
test('private, unknown and draft fallback HTML cannot advertise the home canonical or be indexed', () => {
  const html = routeHtml(source, 'fallback', false);
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(html, /rel="canonical"|property="og:url"/);
});
test('preview documents are noindex and home metadata stays intact in production', () => {
  assert.equal(routeHtml(source, 'home', false), source);
  for (const route of ['home', 'editorial', 'fallback'] as const) {
    assert.match(routeHtml(source, route, true), /name="robots" content="noindex,nofollow"/);
  }
});

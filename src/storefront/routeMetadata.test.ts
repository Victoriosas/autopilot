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
  assert.match(html, /name="twitter:title" content="De mí para ti · Victoriosas"/);
  assert.match(html, /property="og:image" content="https:\/\/victoriosas.online\/brand\/social-victoriosas.png"/);
  assert.match(html, /name="robots" content="index,follow"/);
  assert.match(html, /src="\/src\/main.tsx"/);
});

test('contact privacy information has its own initial metadata', () => {
  const html = routeHtml(source, 'privacy', false);
  assert.match(html, /<title>Contacto y privacidad · Victoriosas<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/victoriosas.online\/privacidad"/);
  assert.match(html, /name="twitter:title" content="Contacto y privacidad · Victoriosas"/);
});
test('technology has dedicated title, canonical, and preview noindex metadata', () => {
  const html = routeHtml(source, 'technology', false);
  assert.match(html, /<title>Tecnología estética · Victoriosas<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/victoriosas.online\/tecnologia"/);
  assert.match(html, /property="og:url" content="https:\/\/victoriosas.online\/tecnologia"/);
  assert.match(html, /Punta de diamante|punta de diamante/);
  assert.match(routeHtml(source, 'technology', true), /name="robots" content="noindex,nofollow"/);
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

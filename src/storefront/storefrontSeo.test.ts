import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('public SEO describes professional services without commercial offers or invented credentials', () => {
  const html = readFileSync('index.html', 'utf8');
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json));
  assert.equal(schemas.length, 1);
  assert.equal(schemas[0]['@type'], 'Organization');
  assert.equal(schemas[0].name, 'Victoriosas');
  assert.equal(schemas[0].url, 'https://victoriosas.online/');
  assert.ok(!schemas[0].address && !schemas[0].offers);
  assert.match(html, /Ciudad de la Costa y Carrasco/);
  assert.doesNotMatch(html, /OnlineStore|Product|AggregateRating|Ya se puede comprar/);
});

test('legacy service document cannot publish draft prices or capture personal data', () => {
  const html = readFileSync('public/servicios-sofia.html', 'utf8');
  assert.match(html, /url=\/servicios/);
  assert.doesNotMatch(html, /<form|3[.,]200|3[.,]600|5[.,]200|beauty-services.js/);
});

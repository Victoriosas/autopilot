import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicNavigation } from '../components/public/PublicNavigation';
import { ServicesDirectory } from '../components/public/ServicesDirectory';
import { serviceGroups, serviceSlug } from '../components/public/serviceDirectory';
import { publicRouteResponse } from './publicRouting';
import { routeHtml, type PublicDocument } from './routeMetadata';
import { readFileSync } from 'node:fs';

test('consultation is visible in navigation and every service has a contextual entry', () => {
  const nav = renderToStaticMarkup(React.createElement(PublicNavigation));
  assert.match(nav, /href="\/consultanos">Consultanos/);
  const directory = renderToStaticMarkup(React.createElement(ServicesDirectory));
  for (const group of serviceGroups) for (const name of group.services) {
    assert.ok(directory.includes(`href="/consultanos#${serviceSlug(name)}"`), name);
  }
  assert.equal((directory.match(/Hablemos de tu cuidado/g) ?? []).length, 19);
});

test('consultation has a public route and distinct initial metadata, with previews noindex', () => {
  for (const path of ['/consultanos','/consultanos/']) {
    assert.equal(publicRouteResponse(new Request('https://victoriosas.online' + path)), undefined);
  }
  const source = readFileSync('index.html', 'utf8');
  const html = routeHtml(source, 'consultation' as PublicDocument, false);
  assert.match(html, /<title>Consultanos · Victoriosas<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/victoriosas.online\/consultanos"/);
  assert.match(routeHtml(source, 'consultation' as PublicDocument, true), /noindex,nofollow/);
});

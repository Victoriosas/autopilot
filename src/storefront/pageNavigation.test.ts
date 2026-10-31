import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServicesDirectory } from '../components/public/ServicesDirectory';
import { routeHtml } from './routeMetadata';
import { readFileSync } from 'node:fs';

test('selected treatment renders one complete fiche rather than the whole directory', () => {
  const html = renderToStaticMarkup(React.createElement(ServicesDirectory, {selectedName:'Peeling'}));
  assert.equal((html.match(/<li id=/g)||[]).length,1);
  assert.match(html, /<h1>Peeling<\/h1>/);
  assert.doesNotMatch(html, /id="masaje-relax"/);
  assert.match(html, /class="beauty-service-expand" open=""/);
  assert.match(html, /evaluaci/);
});
test('separate Victoria and starting documents expose their own title and canonical', () => {
  const source=readFileSync('index.html','utf8');
  const victoria=routeHtml(source,'victoria',false);
  assert.match(victoria, /<title>Victoria/);
  assert.match(victoria, /rel="canonical" href="https:\/\/victoriosas.online\/victoria"/);
  assert.match(routeHtml(source,'starting',false), /rel="canonical" href="https:\/\/victoriosas.online\/contacto"/);
});

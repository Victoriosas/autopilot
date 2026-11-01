import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServicesDirectory } from '../components/public/ServicesDirectory';
import { serviceGroups, serviceSlug } from '../components/public/serviceDirectory';

const names = serviceGroups.flatMap(group => group.services);
function destinations() {
  const html = renderToStaticMarkup(React.createElement(ServicesDirectory));
  // Se permite exclusivamente la búsqueda local, sin formularios de captura ni campos personales.
  assert.doesNotMatch(html, /<form\b|<textarea\b|<input\b(?![^>]*\btype="search")/i);
  assert.match(html, /<input\b[^>]*\btype="search"/i);
  return [...html.matchAll(/href="([^"]+)"/g)].map(match =>
    new URL(match[1].replace(/&amp;/g, '&'), 'https://victoriosas.online'));
}

for (const channel of ['whatsapp', 'email'] as const) {
  test(`each service keeps its selected name in the ${channel} consultation`, () => {
    const links = destinations().filter(url => channel === 'email'
      ? url.pathname === '/consultanos' && url.searchParams.get('canal') === 'email' : url.hostname === 'wa.me');
    assert.equal(links.length, 17);
    names.forEach((name, index) => {
      const url = links[index];
      if (channel === 'email') {
        assert.equal(url.origin + url.pathname, 'https://victoriosas.online/consultanos');
        assert.equal(url.searchParams.get('canal'), 'email');
        assert.equal(url.searchParams.get('servicio'), serviceSlug(name));
        assert.deepEqual([...url.searchParams.keys()].sort(), ['canal', 'servicio']);
      } else {
        const body = url.searchParams.get('text')!;
        assert.ok(body.includes(name), `Missing service: ${name}`);
        assert.match(body, /evaluación inicial remota/);
        assert.match(body, /Desde la web de Victoriosas/);
        assert.doesNotMatch(body, /todavía no sé|reservado|confirmado|cédula|historia clínica/i);
        assert.equal(url.origin + url.pathname, 'https://wa.me/59897045305');
        assert.deepEqual([...url.searchParams.keys()], ['text']);
      }
    });
    assert.equal(new Set(links.map(url => url.href)).size, 17);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { careServices, filterCareServices, visibleCareServices } from './careCatalog';
import { ServiceCatalog } from '../components/public/ServiceCatalog';
import { ContactLink } from '../components/public/ContactLink';

test('public catalog contains only the three confirmed areas; online stays draft', () => {
  assert.deepEqual(visibleCareServices(false).map(s => s.id), ['facial', 'corporal', 'masajes']);
  assert.equal(visibleCareServices(true).length, 4);
  assert.equal(careServices.find(s => s.category === 'online')?.status, 'draft');
  assert.equal(new Set(careServices.map(s => s.id)).size, careServices.length);
  for (const service of careServices) {
    assert.equal(service.priceUYU, null);
    assert.equal(service.durationMinutes, null);
    assert.ok(service.includes.length && service.exclusions.length && service.steps.length);
  }
});

test('filters only return visible matching services without mutating the source', () => {
  const visible = visibleCareServices(false);
  assert.deepEqual(filterCareServices(visible, 'faciales').map(s => s.id), ['facial']);
  assert.equal(filterCareServices(visible, 'online').length, 0);
  assert.equal(filterCareServices(visible, 'todos').length, 3);
  assert.equal(visible.length, 3);
});

test('initial public markup retains service summaries and excludes draft offer and unknown prices', () => {
  const html = renderToStaticMarkup(React.createElement(ServiceCatalog, { review: false }));
  for (const name of ['Estética facial', 'Estética corporal', 'Masajes']) assert.ok(html.includes(name));
  assert.doesNotMatch(html, /Asesoría de cuidado facial online|>Online<|Gratis|550|30 minutos|por confirmar|<form/i);
  assert.equal((html.match(/aria-haspopup="dialog"/g) ?? []).length, 3);
  assert.match(html, /aria-pressed="true"/);
  const preview = renderToStaticMarkup(React.createElement(ServiceCatalog, { review: true }));
  assert.match(preview, /Asesoría de cuidado facial online/);
  assert.match(preview, /Borrador para revisión/);
});

test('online inquiries identify the proposal in both channels without claiming an initial evaluation', () => {
  for (const channel of ['whatsapp', 'email'] as const) {
    const html = renderToStaticMarkup(React.createElement(ContactLink, { channel, interest: 'online' }));
    const url = new URL(html.match(/href="([^"]+)"/)![1].replace(/&amp;/g, '&'));
    const message = url.searchParams.get(channel === 'email' ? 'body' : 'text')!;
    assert.equal(channel === 'email' ? url.pathname : url.host + url.pathname, channel === 'email' ? 'victoriosas.online@gmail.com' : 'wa.me/59897045305');
    assert.match(message, /asesoría de cuidado facial online/);
    assert.match(message, /Desde la web de Victoriosas/);
    assert.doesNotMatch(message, /evaluación inicial|diagnóstico|foto|historia clínica|reservado/i);
  }
});

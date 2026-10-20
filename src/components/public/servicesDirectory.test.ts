import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { serviceGroups, serviceSlug } from './serviceDirectory';
import { ServicesDirectory } from './ServicesDirectory';
import { PublicNavigation } from './PublicNavigation';

test('el menú contiene 11 faciales y 6 corporales en el orden solicitado', () => {
  assert.deepEqual(serviceGroups.map(group => group.services.length), [11, 6]);
  assert.equal(serviceGroups[0].services[0], 'Higiene y limpieza facial');
  assert.equal(serviceGroups[1].services[5], 'Reducción de estrías');
  assert.equal(serviceGroups.flatMap(group => group.services).some(name => /mesoterapia/i.test(name)), false);
});

test('cada enlace del menú tiene un destino real en el directorio', () => {
  const nav = renderToStaticMarkup(React.createElement(PublicNavigation));
  const page = renderToStaticMarkup(React.createElement(ServicesDirectory));
  assert.match(nav, /De mí para ti/);
  assert.match(nav, /Nuestros servicios/);
  assert.match(page, /Faciales/);
  assert.match(page, /Corporales/);
  for (const group of serviceGroups) for (const name of group.services) {
    assert.ok(page.includes('id="' + serviceSlug(name) + '"'), name);
    assert.ok(nav.includes('/nuestros-servicios#' + serviceSlug(name)), name);
  }
});

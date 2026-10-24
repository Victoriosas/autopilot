import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { serviceGroups, serviceSlug } from './serviceDirectory';
import { ServicesDirectory } from './ServicesDirectory';
import { PublicNavigation } from './PublicNavigation';
import { serviceDetails } from './serviceDetails';

test('el menú contiene 11 faciales, 6 corporales y 2 experiencias en el orden solicitado', () => {
  assert.deepEqual(serviceGroups.map(group => group.services.length), [11, 6, 2]);
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
  assert.match(page, /Orientación y experiencias/);
  for (const group of serviceGroups) for (const name of group.services) {
    assert.ok(page.includes('id="' + serviceSlug(name) + '"'), name);
    assert.ok(nav.includes('/nuestros-servicios#' + serviceSlug(name)), name);
  }
});

test('las 19 fichas muestran contenidos individuales y mantienen el protocolo confirmado', () => {
  const names = serviceGroups.flatMap(group => group.services);
  assert.equal(Object.keys(serviceDetails).length, 19);
  for (const name of names) {
    const info = serviceDetails[name];
    assert.ok(info, name);
    assert.ok(info.description.length > 100, name);
    assert.ok(info.objectives.length >= 3, name);
    assert.ok(info.caution.length > 25, name);
  }
  const page = renderToStaticMarkup(React.createElement(ServicesDirectory));
  assert.equal((page.match(/Ver detalles del tratamiento/g) ?? []).length, 19);
  assert.match(page, /60 minutos por sesión/);
  assert.match(page, /al menos 4 sesiones/);
  assert.doesNotMatch(page, /mesoterapia|reservar ahora|comprar ahora/i);
});

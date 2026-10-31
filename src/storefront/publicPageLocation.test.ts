import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPageLocation } from './publicPageLocation';
test('legacy home anchors resolve to separate pages and skip link remains local', () => {
  assert.equal(publicPageLocation('/', '', '#servicios'), '/nuestros-servicios');
  assert.equal(publicPageLocation('/', '', '#nosotras'), '/victoria');
  assert.equal(publicPageLocation('/', '', '#contacto'), '/consultanos');
  assert.equal(publicPageLocation('/', '', '#contenido'), '/#contenido');
});
test('treatment and editorial locations preserve selected detail and filters', () => {
  assert.equal(publicPageLocation('/servicios/', '?categoria=corporales', '#masaje-relax'), '/nuestros-servicios?categoria=corporales#masaje-relax');
  assert.equal(publicPageLocation('/de-mi-para-ti/', '?categoria=Bienestar', ''), '/de-mi-para-ti?categoria=Bienestar');
});

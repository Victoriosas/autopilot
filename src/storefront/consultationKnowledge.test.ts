import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationKnowledge, approvedServiceName } from './consultationKnowledge';
import { serviceGroups } from '../components/public/serviceDirectory';

test('approved knowledge mirrors the published service directory', () => {
  assert.equal(consultationKnowledge.services.length, serviceGroups.reduce((n, g) => n + g.services.length, 0));
  assert.equal(approvedServiceName('rejuvenecimiento'), 'Rejuvenecimiento');
  assert.equal(approvedServiceName('servicio-inventado'), null);
});
test('no fees, bookings or diagnosis are approved knowledge', () => {
  assert.match(consultationKnowledge.pricingPolicy, /No se publican tarifas/);
  assert.match(consultationKnowledge.escalation.clinical, /No recomendar tratamientos/);
  assert.match(consultationKnowledge.escalation.scheduling, /No prometer/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { draftConsultationResponse } from './consultationResponseAgents';
import type { ConsultationInput } from './consultationRequest';

const sample: ConsultationInput = {
  id: '8abb9c64-fb63-4c4f-821a-4ac1d9edca91',
  fullName: 'Persona Ejemplo', phone: '+59897000000', email: 'persona@example.com',
  age: 32, service: 'orientacion', message: '¿Qué pasos siguen?',
  responseChannel: 'email', consent: true, consentVersion: 'consultation-v1', website: '',
};
test('email draft never confirms reservations or publishes fees', () => {
  const r = draftConsultationResponse(sample);
  assert.equal(r.channel, 'email');
  assert.equal(r.requiresHumanApproval, true);
  assert.doesNotMatch(r.text, /reserva confirmada|\$[0-9]+/);
});
test('health information is never echoed to outgoing email', () => {
  const r = draftConsultationResponse({ ...sample, message: 'Tengo dermatitis MI_DIAGNOSTICO_PRIVADO' });
  assert.equal(r.priority, 'review');
  assert.doesNotMatch(r.text, /MI_DIAGNOSTICO_PRIVADO/);
});
test('channel preference is preserved so no WhatsApp contact is silently emailed', () => {
  const r = draftConsultationResponse({ ...sample, responseChannel: 'whatsapp' });
  assert.equal(r.channel, 'whatsapp');
});

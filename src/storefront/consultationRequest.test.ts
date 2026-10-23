import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConsultationRequest } from './consultationRequest';

export const consultationFixture = { id: '88888888-8888-4888-8888-888888888888', fullName: 'Consulta sintética', phone: '+598 099123456', email: '', age: null, service: 'orientacion', message: 'Deseo información general.', responseChannel: 'whatsapp', consent: true, consentVersion: 'consultation-v1', website: '' };
test('consultation validates explicit consent, optional age/email and bounded plain text', () => {
  assert.deepEqual(normalizeConsultationRequest(consultationFixture), consultationFixture);
  for (const change of [{ consent: false }, { consentVersion: 'old' }, { age: -1 }, { age: 121 }, { age: '20' }, { email: 'invalid' }, { responseChannel: 'email' }, { fullName: '<script>' }, { message: 'a'.repeat(601) }, { medical: 'extra' }, { service: 'inventado' }, { phone: '123' }, { website: 'spam' }]) {
    assert.throws(() => normalizeConsultationRequest({ ...consultationFixture, ...change }), /CONSULTATION_INPUT_INVALID/);
  }
});

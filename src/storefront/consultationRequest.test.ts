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

test('consultation accepts ordinary multiline questions without accepting control characters', () => {
  assert.equal(normalizeConsultationRequest({ ...consultationFixture, message: 'Hola,\nquisiera orientación.' }).message, 'Hola,\nquisiera orientación.');
  for (const message of ['Hola\u0000', 'Hola<script>', 'Hola\u202e']) {
    assert.throws(() => normalizeConsultationRequest({ ...consultationFixture, message }), /CONSULTATION_INPUT_INVALID/);
  }
});

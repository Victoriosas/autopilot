import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAnswerOptions, validateApprovedAnswer } from './consultationAnswerOptions';
import type { ConsultationInput } from './consultationRequest';
const input: ConsultationInput = {
 id: '8abb9c64-fb63-4c4f-821a-4ac1d9edca91',
 fullName: 'Ejemplo', phone: '+59897000000', email: 'ejemplo@example.com',
 age: 32, service: 'limpieza-profunda',
 message: 'Cuanto sale la limpieza profunda',
 responseChannel: 'email', consent: true,
 consentVersion: 'consultation-v1', website: ''
};
test('offers three distinct drafts for service price inquiries', () => {
 const plan = prepareAnswerOptions(input);
 assert.equal(plan.options.length, 3);
 assert.equal(plan.needsVictoria, false);
 assert.match(plan.options[0].text, /limpieza profunda/i);
});
test('consults Victoria for medical or unknown requests', () => {
 assert.equal(prepareAnswerOptions({ ...input, message: 'Estoy embarazada' }).needsVictoria, true);
 assert.equal(prepareAnswerOptions({ ...input, service: 'orientacion', message: 'Una pregunta ajena al catálogo' }).needsVictoria, true);
});
test('prevents unsupported outbound claims', () => {
 assert.notEqual(validateApprovedAnswer('Hola, son 1500 UYU. Victoria | Victoriosas'), null);
 assert.notEqual(validateApprovedAnswer('Hola, turno confirmado. Victoria | Victoriosas'), null);
 assert.equal(validateApprovedAnswer('Hola, podemos conversar en una evaluación inicial remota. Victoria | Victoriosas'), null);
});

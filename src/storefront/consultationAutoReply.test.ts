import test from 'node:test';
import assert from 'node:assert/strict';
import { maybeSendAutomaticConsultationReply } from './consultationAutoReply';
import type { ConsultationInput } from './consultationRequest';

const example = {
  id: '12a4a4a4-1111-4111-8111-111111111111',
  fullName: 'Cliente Ejemplo',
  phone: '099123456',
  email: 'example@example.com',
  age: 33,
  service: 'orientacion',
  message: 'Precios',
  responseChannel: 'email',
  consent: true,
  consentVersion: 'consultation-v1',
  website: '',
} as ConsultationInput;

const enabled = {
  CONSULTATION_AUTO_REPLY_ENABLED: 'true',
  CONSULTATION_REPLY_SENDING_ENABLED: 'true',
  CONSULTATION_MAIL_PROVIDER: 'resend',
  CONSULTATION_MAIL_FROM: 'consultas@victoriosas.online',
  RESEND_API_KEY: 'test_dummy_not_real',
} as NodeJS.ProcessEnv;

test('auto reply defaults to disabled and cannot touch provider', async () => {
  assert.equal(await maybeSendAutomaticConsultationReply(example, { env: {} }), 'disabled');
});
test('agent refuses clinical, urgent, underage, non-email and test inquiries', async () => {
  const examples = [
    { message: 'Tengo dermatitis y quiero saber precios' },
    { message: 'No puedo respirar' },
    { message: 'Por favor dame un diagnostico' },
    { age: 17 },
    { age: null },
    { responseChannel: 'whatsapp' },
    { email: '' },
    { message: '¿Cuál tratamiento es mejor para una infección?' },
    { message: 'PRUEBA TECNICA: precios' },
    { fullName: 'Prueba Test' },
  ];
  for (const change of examples) {
    assert.equal(await maybeSendAutomaticConsultationReply({ ...example, ...change } as ConsultationInput, {
      env: enabled, fetch: async () => { throw Error('SHOULD_NOT_SEND'); },
    }), 'ineligible');
  }
});

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

test('providing email permits a separate human-approved reply even when WhatsApp or calling is preferred', async () => {
  const { consultationEmailAvailable } = await import('./consultationRequest');
  const { approveAndSendConsultationReply } = await import('./consultationReplyDelivery');
  const expiration = { id: sample.id, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() };
  for (const responseChannel of ['email', 'whatsapp', 'phone'] as const) {
    const input = { ...sample, responseChannel };
    assert.equal(consultationEmailAvailable(input), true);
    const record = { ...expiration, input } as import('./consultationSupabase').ConsultationRecord;
    assert.equal(await approveAndSendConsultationReply(record, 'synthetic-admin', { env: {} }), 'provider_unavailable',
      'disabled provider must not send, but channel preference must not prohibit email');
  }
  const noEmail = { ...sample, responseChannel: 'whatsapp' as const, email: '' };
  const record = { ...expiration, input: noEmail } as import('./consultationSupabase').ConsultationRecord;
  assert.equal(consultationEmailAvailable(noEmail), false);
  assert.equal(consultationEmailAvailable({ email: 'invalid' }), false);
  assert.equal(await approveAndSendConsultationReply(record, 'synthetic-admin', { env: {} }), 'invalid_channel');
  assert.equal(draftConsultationResponse({ ...sample, responseChannel: 'whatsapp' }).channel, 'whatsapp');
});

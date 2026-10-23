import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsultationDelivery } from './consultationDelivery';
test('transactional notice uses stable idempotency and no visitor content', async () => {
  const env = { CONSULTATION_MAIL_ENABLED: 'true', CONSULTATION_MAIL_PROVIDER: 'resend', RESEND_API_KEY: 'synthetic-only', CONSULTATION_MAIL_FROM: 'consultas@victoriosas.online', CONSULTATION_MAIL_TO: 'victoriosas.online@gmail.com' };
  let calls = 0;
  const delivery = createConsultationDelivery({ env, fetch: async (url, options) => { calls++; assert.equal(url, 'https://api.resend.com/emails'); assert.equal(new Headers(options?.headers).get('Idempotency-Key'), 'consultation-v1/88888888-8888-4888-8888-888888888888'); const payload = JSON.parse(options!.body as string); assert.deepEqual(Object.keys(payload).sort(), ['from', 'subject', 'text', 'to']); assert.doesNotMatch(payload.text, /phone|email|mensaje|nombre/i); return new Response(JSON.stringify({ id: 'provider-accepted' }), { status: 200 }); } });
  assert.equal(delivery.ready(), true); assert.equal(await delivery.send('88888888-8888-4888-8888-888888888888'), 'provider-accepted'); assert.equal(calls, 1);
  assert.equal(createConsultationDelivery({ env: {} }).ready(), false);
  assert.equal(createConsultationDelivery({ env: { ...env, CONSULTATION_MAIL_FROM: 'visitor@gmail.com' } }).ready(), false);
  await assert.rejects(createConsultationDelivery({ env, fetch: async () => new Response('{}', { status: 429 }) }).send('88888888-8888-4888-8888-888888888888'), /CONSULTATION_UNAVAILABLE/);
});

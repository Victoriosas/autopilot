import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { consultationAddress, createConsultationRouter } from './consultationRouter';
import type { ConsultationStore } from './consultationSupabase';

const input = { id: '88888888-8888-4888-8888-888888888888', fullName: 'Consulta sintética', phone: '+598 099123456', email: '', age: null, service: 'orientacion', message: 'Información general.', responseChannel: 'whatsapp', consent: true, consentVersion: 'consultation-v1', website: '' };
test('abuse address trusts platform-overwritten IP only inside the Vercel runtime', () => {
  const request = { ip: '127.0.0.1', get: (name: string) => name === 'x-vercel-forwarded-for' ? '192.0.2.1' : '198.51.100.1' };
  assert.equal(consultationAddress(request, false), '127.0.0.1');
  assert.equal(consultationAddress(request, true), '192.0.2.1');
  assert.equal(consultationAddress({ ...request, get: () => '192.0.2.1, 198.51.100.1' }, true), '127.0.0.1');
});
test('consultation HTTP fails closed and accepts only durable recorded/provider-accepted requests', async t => {
  let enabled = false, ready = true, sent = false, fail = false, finish = true, state = 'send', calls = 0;
  const store: ConsultationStore = { ready: async () => ready, claim: async () => { calls++; return { state: state as any, lease: '99999999-9999-4999-8999-999999999999' }; }, finish: async () => finish };
  const app = express();
  app.use('/api/beauty/inquiries', createConsultationRouter({ enabled: () => enabled, origin: () => 'https://victoriosas.online', store, delivery: { ready: () => true, send: async () => { if (fail) throw Error('private detail'); sent = true; return 'synthetic-provider-id'; } }, abuseKey: () => 'synthetic-key-only' }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/beauty/inquiries`;
  const post = (body: unknown = input, headers: Record<string, string> = {}) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://victoriosas.online', ...headers }, body: JSON.stringify(body) });
  try {
    await t.test('disabled never touches private persistence', async () => { assert.equal((await post()).status, 503); assert.equal(calls, 0); assert.deepEqual(await (await fetch(base + '/config')).json(), { enabled: false, privacyVersion: 'consultation-v1', retentionDays: 30 }); });
    enabled = true;
    await t.test('configuration closes when schema is unavailable', async () => { ready = false; assert.equal((await (await fetch(base + '/config')).json()).enabled, false); assert.equal((await post()).status, 503); ready = true; });
    await t.test('rejects cross-site/missing origin, honeypot, PII extensions and oversized body', async () => { for (const origin of ['', 'https://attacker.test']) assert.equal((await post(input, { origin })).status, 403); assert.equal((await post({ ...input, website: 'bot' })).status, 400); assert.equal((await post({ ...input, diagnosis: 'extra' })).status, 400); assert.equal((await post({ ...input, message: 'a'.repeat(9000) })).status, 413); assert.equal(calls, 0); });
    await t.test('provider accepted and durable mark required before acceptance', async () => { assert.equal((await post()).status, 202); assert.equal(sent, true); finish = false; assert.equal((await post()).status, 503); finish = true; });
    await t.test('provider failure remains honest and generic', async () => { fail = true; const response = await post(); assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'CONSULTATION_UNAVAILABLE' }); fail = false; });
    await t.test('replay sends nothing; conflicts and durable abuse denial are distinct', async () => { sent = false; state = 'accepted'; assert.equal((await post()).status, 202); assert.equal(sent, false); state = 'conflict'; assert.equal((await post()).status, 409); state = 'throttled'; assert.equal((await post()).status, 429); state = 'pending'; assert.equal((await post()).status, 503); });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('consultation inbox requires authorization and lists through the caller identity', async () => {
  let called = false;
  const app = express();
  app.use('/inquiries', createConsultationRouter({
    store: { ready: async () => true, claim: async () => ({ state: 'pending' }), finish: async () => false,
      list: async (token: string, offset: number) => { called = true; assert.equal(token, 'synthetic-admin'); assert.equal(offset, 50); return []; } },
    auth: (req, res, next) => req.get('authorization') === 'Bearer synthetic-admin' ? next() : res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' }),
  }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as any).port}/inquiries/admin?offset=50`;
  try {
    assert.equal((await fetch(url)).status, 401); assert.equal(called, false);
    const response = await fetch(url, { headers: { authorization: 'Bearer synthetic-admin' } });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { requests: [] }); assert.equal(called, true);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('reply status endpoint is private and never queries outbox for an unknown consultation', async () => {
  const app = express();
  app.use('/inquiries', createConsultationRouter({
    store: { ready: async () => true, claim: async () => ({ state: 'pending' }), finish: async () => false,
      get: async () => null },
    auth: (req, res, next) => req.get('authorization') === 'Bearer synthetic-admin' ? next() : res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' }),
  }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as any).port}/inquiries/admin/88888888-8888-4888-8888-888888888888/reply-status`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { authorization: 'Bearer synthetic-admin' } })).status, 404);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

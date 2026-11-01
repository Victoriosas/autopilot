import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLocalConsultationModel } from './consultationLocalModelCheck';

function transport(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    assert.equal(new URL(String(url)).origin, 'http://127.0.0.1:11434');
    assert.equal(init?.redirect, 'error');
    assert.equal((init?.headers as any)?.authorization, undefined);
    if (Object.hasOwn(overrides, path)) return new Response(JSON.stringify(overrides[path]));
    if (path === '/api/version') return new Response('{"version":"0.40.11"}');
    if (path === '/api/tags') return new Response(JSON.stringify({ models: [{ name: 'test:local', size: 100 }] }));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'test:local');
    assert.equal(body.stream, false);
    assert.ok(!String(init?.body).includes('synthetic@example.com'));
    assert.ok(!String(init?.body).includes('+59899123456'));
    const payload = JSON.parse(body.messages[1].content);
    const system = body.messages[0].content;
    const content = system.endsWith('understand')
      ? { topics: ['price'], serviceCandidates: payload.serviceCandidates, risks: [], confidence: 0.9, notes: [] }
      : system.endsWith('draft') ? { texts: payload.allowedDrafts }
      : system.endsWith('review') ? { status: 'approved', codes: [] } : { ok: true };
    return new Response(JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(content) } }));
  };
  return { request: request as typeof fetch, calls };
}

test('local check proves transport and real adapter stages with synthetic data only', async () => {
  const flags = ['CONSULTATION_MODEL_GATEWAY_ENABLED', 'CONSULTATION_AI_PROVIDER', 'CONSULTATION_AI_MODEL', 'CONSULTATION_AI_REMOTE_AUTHORIZED']
    .map(key => [key, process.env[key]] as const);
  const { request, calls } = transport();
  const result = await checkLocalConsultationModel('test:local', request);
  assert.equal(result.ok, true);
  assert.equal(result.analysis?.calls, 3);
  assert.equal(result.analysis?.action, 'no_send');
  assert.equal(result.scope, 'synthetic_smoke_only');
  assert.equal(calls.length, 6);
  assert.equal(JSON.stringify(result).includes('synthetic@example.com'), false);
  assert.ok(flags.every(([key, value]) => process.env[key] === value), 'diagnostic must preserve runtime flags');
});

test('three completed calls with a negative review are not a semantic pass', async () => {
  const good = transport();
  const request = (async (url: any, init: any) => {
    if (String(init?.body).includes('Etapa: review')) {
      return new Response(JSON.stringify({ done: true, message: { content: '{"status":"blocked","codes":["missing_evidence"]}' } }));
    }
    return good.request(url, init);
  }) as typeof fetch;
  const result = await checkLocalConsultationModel('test:local', request);
  assert.equal(result.ok, false);
  assert.equal(result.analysis?.calls, 3);
  assert.ok(result.analysis?.codes.includes('MODEL_REVIEW_NOT_APPROVED'));
});

test('uninstalled and cloud models never reach generation or download endpoints', async () => {
  for (const entry of [[], [{ name: 'test:local', size: 0 }], [{ name: 'test:local', size: 100, remote_host: 'https://cloud.example' }]]) {
    const { request, calls } = transport({ '/api/tags': { models: entry } });
    assert.equal((await checkLocalConsultationModel('test:local', request)).ok, false);
    assert.ok(!calls.includes('/api/chat'));
  }
  let calls = 0;
  for (const model of ['test:cloud', '../model', '']) {
    assert.equal((await checkLocalConsultationModel(model, (async () => { calls++; }) as any)).ok, false);
  }
  assert.equal(calls, 0);
});

test('transport success cannot hide a semantic failure or leak provider errors', async () => {
  const good = transport();
  let chat = 0;
  const request = (async (url: any, init: any) => {
    if (String(url).endsWith('/api/chat') && ++chat > 1) throw Error('private provider body');
    return good.request(url, init);
  }) as typeof fetch;
  const result = await checkLocalConsultationModel('test:local', request);
  assert.equal(result.chat, true);
  assert.equal(result.ok, false);
  assert.equal(result.analysis?.guardian, 'blocked');
  assert.equal(result.analysis?.action, 'no_send');
  assert.ok(!JSON.stringify(result).includes('private provider body'));
});

test('bad version, failed HTTP and network errors stop without automatic retries', async () => {
  const malformed = transport({ '/api/version': {} });
  assert.equal((await checkLocalConsultationModel('test:local', malformed.request)).ok, false);
  assert.equal(malformed.calls.length, 1);
  for (const request of [async () => new Response('{}', { status: 503 }), async () => { throw Error('sensitive'); }]) {
    const result = await checkLocalConsultationModel('test:local', request as typeof fetch);
    assert.equal(result.ok, false);
    assert.equal(result.analysis, undefined);
    assert.ok(!JSON.stringify(result).includes('sensitive'));
  }
});

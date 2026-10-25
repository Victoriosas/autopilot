import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredConsultationModel } from './consultationIntelligenceProviders';
test('provider selection stays closed without gateway, independent authorization and bounded costs', () => {
  assert.equal(configuredConsultationModel({ GEMINI_API_KEY: 'unrelated' }), undefined);
  assert.throws(() => configuredConsultationModel({ CONSULTATION_AI_PROVIDER: 'camelrun' }), /NOT_AUTHORIZED/);
  assert.throws(() => configuredConsultationModel({ CONSULTATION_AI_PROVIDER: 'ollama', CONSULTATION_AI_MODEL: 'test' }), /GATEWAY_DISABLED/);
  assert.throws(() => configuredConsultationModel({ CONSULTATION_AI_PROVIDER: 'openai-compatible', CONSULTATION_AI_MODEL: 'test', CONSULTATION_AI_REMOTE_AUTHORIZED: 'true', CONSULTATION_MODEL_GATEWAY_ENABLED: 'true', CONSULTATION_AI_ALTERNATIVE_PROCESSING_APPROVED: 'true', CONSULTATION_AI_ENDPOINT: 'https://api.example.com', CONSULTATION_AI_API_KEY: 'fixture' }), /COST_BOUND_UNVERIFIED/);
});
test('Ollama and stateless camelRun share the gateway without credentials or data in metrics', async () => {
  for (const id of ['ollama', 'camelrun']) {
    const seen: any[] = [];
    const env = { CONSULTATION_MODEL_GATEWAY_ENABLED: 'true', CONSULTATION_AI_PROVIDER: id, CONSULTATION_AI_MODEL: 'test', CONSULTATION_AI_REMOTE_AUTHORIZED: 'true', CAMELAI_API_KEY: 'fixture-key' };
    const provider = configuredConsultationModel(env, (async (url, init) => {
      if(String(url).endsWith('/models'))return new Response(JSON.stringify([{id:'test',cost:{input:0.1,output:0.5,cacheWrite:0.125}}]));
      seen.push({ url, init }); return new Response(JSON.stringify(id === 'ollama' ? { done: true, message: { content: '{"status":"approved","codes":[]}' } } : { status: 'completed', output:{status:'approved',codes:[]} }));
    }) as typeof fetch)!;
    assert.deepEqual(await provider.complete('review', { evidence: [] }, { type: 'object' }, new AbortController().signal), { status: 'approved', codes: [] });
    const body = JSON.parse(seen[0].init.body);
    assert.equal(seen[0].init.redirect, 'error');
    assert.equal(body.tools, undefined); assert.equal(body.agent, undefined);
    if (id === 'camelrun') assert.equal(body.spendLimit.usd, 0.02);
    else { assert.equal(seen[0].init.headers.authorization, undefined); assert.deepEqual(body.format, { type: 'object' }); }
  }
});

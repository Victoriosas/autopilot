import assert from 'node:assert/strict';
import test from 'node:test';
import { runModelGateway, validateModelGatewayConfig } from './consultationModelGateway';
const ollama = { provider: 'ollama' as const, endpoint: 'http://127.0.0.1:11434', model: 'qwen3:1.7b' };
test('gateway rejects non-local Ollama endpoints, credentials and unsafe schemes', () => {
  assert.throws(() => validateModelGatewayConfig({ ...ollama, endpoint: 'http://example.com' }), /LOCAL_ONLY/);
  assert.throws(() => validateModelGatewayConfig({ ...ollama, endpoint: 'https://127.0.0.1:11434' }), /LOCAL_ONLY/);
  assert.throws(() => validateModelGatewayConfig({ ...ollama, endpoint: 'http://user:pass@127.0.0.1:11434' }), /ENDPOINT_INVALID/);
  assert.throws(() => validateModelGatewayConfig({ provider: 'openai-compatible', endpoint: 'http://api.example.com', model: 'test', apiKey: 'secret' }), /REMOTE_INVALID/);
});

test('gateway bounds JSON output, input size, redirects and provider error disclosure', async () => {
 const env={CONSULTATION_MODEL_GATEWAY_ENABLED:'true'};
 const req={systemPrompt:'system',input:{q:'hola'},requestId:'request_001'};
 for(const response of [new Response(JSON.stringify({message:{content:'not JSON'}})),new Response('x'.repeat(65000))]) {
  await assert.rejects(runModelGateway(ollama,req,(async()=>response) as any,env),/MODEL_RESPONSE_INVALID/);
 }
 await assert.rejects(runModelGateway(ollama,{...req,input:'x'.repeat(13000)},fetch,env),/INPUT_LIMIT/);
 await assert.rejects(runModelGateway(ollama,req,(async()=>{throw Error('sensitive upstream body');}) as any,env),/^Error: MODEL_PROVIDER_UNAVAILABLE$/);
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(runModelGateway(ollama,{...req,signal:controller.signal},(async()=>{calls++;}) as any,env),/TIMEOUT/);assert.equal(calls,0);
});
test('gateway is disabled by default', async () => {
  const previous = process.env.CONSULTATION_MODEL_GATEWAY_ENABLED;
  delete process.env.CONSULTATION_MODEL_GATEWAY_ENABLED;
  try { await assert.rejects(runModelGateway(ollama, { systemPrompt: 'test', input: {}, requestId: 'request_001' }), /DISABLED/); }
  finally { if (previous === undefined) delete process.env.CONSULTATION_MODEL_GATEWAY_ENABLED; else process.env.CONSULTATION_MODEL_GATEWAY_ENABLED = previous; }
});
test('gateway calls local chat without auth and validates reply', async () => {
  const prev = process.env.CONSULTATION_MODEL_GATEWAY_ENABLED;
  process.env.CONSULTATION_MODEL_GATEWAY_ENABLED = 'true';
  try {
    let received: any;
    const result = await runModelGateway(ollama, { systemPrompt: 'system', input: { q: 'hola' }, requestId: 'request_001' },
      (async (url: any, options: any) => { received = { url, options }; return { ok: true, json: async () => ({ message: { content: '{"ok":true}' } }) }; }) as any);
    assert.equal(result.text, '{"ok":true}');
    assert.equal(received.url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(received.options.headers.authorization, undefined);
    assert.equal(JSON.parse(received.options.body).stream, false);
  } finally { if (prev === undefined) delete process.env.CONSULTATION_MODEL_GATEWAY_ENABLED; else process.env.CONSULTATION_MODEL_GATEWAY_ENABLED = prev; }
});

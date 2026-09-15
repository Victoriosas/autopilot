import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CJMcpReadOnlyClient,
  cjMcpShadowSafetyReady,
  resolveCJMcpUrl,
} from '../services/cjMcp';

test('rejects non-official MCP hosts', () => {
  assert.throws(
    () => resolveCJMcpUrl({ CJ_MCP_SERVER_URL: 'https://evil.example/mcp/token' } as NodeJS.ProcessEnv),
    /CJ_MCP_URL_NOT_OFFICIAL/,
  );
});

test('preserves CJ direct-token delimiters while encoding token payload', () => {
  const url = resolveCJMcpUrl({
    CJ_MCP_TOKEN: 'MCP@CJ4623764@CJ:abc+/= token',
  } as NodeJS.ProcessEnv);
  assert.equal(
    url,
    'https://developers.cjdropshipping.com/mcp/MCP@CJ4623764@CJ:abc%2B%2F%3D%20token',
  );
});

test('keeps opaque MCP tokens safely URL encoded for compatibility', () => {
  const url = resolveCJMcpUrl({ CJ_MCP_TOKEN: 'opaque token/value' } as NodeJS.ProcessEnv);
  assert.equal(url, 'https://developers.cjdropshipping.com/mcp/opaque%20token%2Fvalue');
});

test('shadow safety requires explicit enablement and zero purchase capability', () => {
  assert.equal(cjMcpShadowSafetyReady({
    CJ_MCP_SHADOW_ENABLED: 'true',
    AUTOPILOT_SHADOW_MODE: 'true',
    CHECKOUT_ENABLED: 'false',
    AUTOPILOT_PURCHASE_LIMIT_USD: '0',
    AUTOPILOT_LEGACY_SOURCING_ENABLED: 'false',
  } as NodeJS.ProcessEnv), true);

  assert.equal(cjMcpShadowSafetyReady({
    CJ_MCP_SHADOW_ENABLED: 'true',
    AUTOPILOT_SHADOW_MODE: 'true',
    CHECKOUT_ENABLED: 'false',
    AUTOPILOT_PURCHASE_LIMIT_USD: '10',
  } as NodeJS.ProcessEnv), false);
});

test('blocks write tools before any network request', async () => {
  let calls = 0;
  const client = new CJMcpReadOnlyClient(
    'https://developers.cjdropshipping.com/mcp/fake-token',
    (async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    }) as typeof fetch,
  );

  await assert.rejects(() => client.callReadOnlyTool('create_order', {}), /CJ_MCP_TOOL_BLOCKED/);
  assert.equal(calls, 0);
});

test('reports upstream HTTP status without exposing response body', async () => {
  const client = new CJMcpReadOnlyClient(
    'https://developers.cjdropshipping.com/mcp/fake-token',
    (async () => new Response('secret upstream body', { status: 400 })) as typeof fetch,
  );

  await assert.rejects(
    () => client.listTools(),
    (error: any) => error?.code === 'CJ_MCP_HTTP_400' && !String(error?.message || '').includes('secret'),
  );
});

test('calls an allowed read-only tool through StreamableHTTP JSON-RPC', async () => {
  let requestBody: any = null;
  const client = new CJMcpReadOnlyClient(
    'https://developers.cjdropshipping.com/mcp/fake-token',
    (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: { content: [{ type: 'text', text: '{"ok":true}' }] },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  );

  const result = await client.callReadOnlyTool('search_products', { keyword: 'facial headband', pageSize: 3 });
  assert.equal(requestBody.method, 'tools/call');
  assert.equal(requestBody.params.name, 'search_products');
  assert.equal(requestBody.params.arguments.keyword, 'facial headband');
  assert.equal(result.content[0].type, 'text');
});

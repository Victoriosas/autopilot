import test from 'node:test';
import assert from 'node:assert/strict';
import CJDropshippingClient from '../services/cjDropshipping';

test('concurrent token requests share one CJ authentication call', async () => {
  const originalFetch = globalThis.fetch;
  let authCalls = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.endsWith('/authentication/getAccessToken')) {
      throw new Error(`unexpected URL: ${url}`);
    }
    authCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response(JSON.stringify({
      code: 200,
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiryDate: '2099-01-01T00:00:00Z',
        refreshTokenExpiryDate: '2099-01-01T00:00:00Z',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const client = new CJDropshippingClient('api-key');
    const ensure = (client as any).ensureAccessToken.bind(client) as () => Promise<string>;
    const [a, b, c] = await Promise.all([ensure(), ensure(), ensure()]);

    assert.equal(a, 'access-token');
    assert.equal(b, 'access-token');
    assert.equal(c, 'access-token');
    assert.equal(authCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('valid cached access token avoids a second authentication call', async () => {
  const originalFetch = globalThis.fetch;
  let authCalls = 0;

  globalThis.fetch = (async () => {
    authCalls += 1;
    return new Response(JSON.stringify({
      code: 200,
      data: {
        accessToken: 'cached-access-token',
        refreshToken: 'cached-refresh-token',
        accessTokenExpiryDate: '2099-01-01T00:00:00Z',
        refreshTokenExpiryDate: '2099-01-01T00:00:00Z',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const client = new CJDropshippingClient('api-key');
    const ensure = (client as any).ensureAccessToken.bind(client) as () => Promise<string>;
    assert.equal(await ensure(), 'cached-access-token');
    assert.equal(await ensure(), 'cached-access-token');
    assert.equal(authCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

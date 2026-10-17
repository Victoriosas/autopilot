import test from 'node:test';
import assert from 'node:assert/strict';
import CJDropshippingClient from '../services/cjDropshipping';
import { CJMcpFirstSourcingProvider } from '../services/cjSourcingProvider';
import { errorClass } from './sourcingOrchestrator';

test('CJ rejected API key remains actionable through the sourcing chain without leaking provider text', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return Response.json({ code: 1600005, message: 'secret-provider-text', data: null });
  }) as typeof fetch;
  try {
    const provider = new CJMcpFirstSourcingProvider(null, new CJDropshippingClient('secret-key'));
    await assert.rejects(provider.searchProducts({ keyword: 'spa headband' }), (error: any) => {
      assert.equal(error.code, 'CJ_REST_ONLY_CJ_API_1600005');
      assert.equal(error.status, 401);
      assert.equal(errorClass(error).retryable, false);
      assert.ok(!error.message.includes('secret'));
      return true;
    });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

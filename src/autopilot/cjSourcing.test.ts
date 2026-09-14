import assert from 'node:assert/strict';
import test from 'node:test';
import CJDropshippingClient from '../services/cjDropshipping';

test('CJ search sends the documented keyword and never fabricates inventory', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/getAccessToken')) return Response.json({ code: 200, data: {
      accessToken: 'test-token', accessTokenExpiryDate: '2099-01-01',
    } });
    assert.equal(url.searchParams.get('productNameEn'), 'facial headband');
    assert.equal(url.searchParams.has('keyWord'), false);
    return Response.json({ code: 200, data: { list: [
      { pid: 'unknown' }, { pid: 'zero', stockQuantity: 0 },
      { pid: 'observed', stockQuantity: '12' }, { pid: 'invalid', stockQuantity: -1 },
    ], total: 4 } });
  });
  const result = await new CJDropshippingClient('test-key').searchProducts({ keyword: 'facial headband' });
  assert.deepEqual(result.products.map(p => p.stockQuantity), [undefined, 0, 12, undefined]);
});

test('CJ detail preserves zero and leaves absent inventory unknown', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/getAccessToken')) return Response.json({ code: 200, data: {
      accessToken: 'test-token', accessTokenExpiryDate: '2099-01-01',
    } });
    return Response.json({ code: 200, data: url.searchParams.get('pid') === 'zero'
      ? { pid: 'zero', stockQuantity: 0 } : { pid: 'unknown' } });
  });
  const client = new CJDropshippingClient('test-key');
  assert.equal((await client.getProductDetail('zero'))?.stockQuantity, 0);
  assert.equal((await client.getProductDetail('unknown'))?.stockQuantity, undefined);
});

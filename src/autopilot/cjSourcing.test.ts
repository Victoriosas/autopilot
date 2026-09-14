import assert from 'node:assert/strict';
import test from 'node:test';
import CJDropshippingClient from '../services/cjDropshipping';

function tokenResponse() {
  return Response.json({ code: 200, data: {
    accessToken: 'test-token', accessTokenExpiryDate: '2099-01-01',
  } });
}

test('CJ search sends the documented keyword and never fabricates inventory', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/getAccessToken')) return tokenResponse();
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
    if (url.pathname.endsWith('/getAccessToken')) return tokenResponse();
    return Response.json({ code: 200, data: url.searchParams.get('pid') === 'zero'
      ? { pid: 'zero', stockQuantity: 0 } : { pid: 'unknown' } });
  });
  const client = new CJDropshippingClient('test-key');
  assert.equal((await client.getProductDetail('zero'))?.stockQuantity, 0);
  assert.equal((await client.getProductDetail('unknown'))?.stockQuantity, undefined);
});

test('CJ variants preserve provider variant id, observed price and weight', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/getAccessToken')) return tokenResponse();
    assert.equal(url.pathname.endsWith('/product/variant/query'), true);
    assert.equal(url.searchParams.get('pid'), 'product-1');
    return Response.json({ code: 200, data: [
      { pid: 'product-1', vid: 'variant-1', variantSku: 'SKU-1', variantNameEn: 'Pink', variantWeight: '145', variantSellPrice: '2.75' },
      { pid: 'product-1', vid: 'variant-no-price', variantSellPrice: '' },
    ] });
  });
  const variants = await new CJDropshippingClient('test-key').getVariants('product-1');
  assert.equal(variants[0].vid, 'variant-1');
  assert.equal(variants[0].variantSellPrice, 2.75);
  assert.equal(variants[0].variantWeight, 145);
  assert.equal(variants[1].variantSellPrice, null);
});

test('CJ stock aggregates only observed warehouse totals and keeps missing totals unknown', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/getAccessToken')) return tokenResponse();
    assert.equal(url.pathname.endsWith('/product/stock/queryByVid'), true);
    assert.equal(url.searchParams.get('vid'), 'variant-1');
    return Response.json({ code: 200, data: [
      { countryCode: 'CN', totalInventoryNum: 4, cjInventoryNum: 3, factoryInventoryNum: 1 },
      { countryCode: 'US', totalInventoryNum: '6' },
      { countryCode: 'DE' },
    ] });
  });
  const stock = await new CJDropshippingClient('test-key').getVariantStock('variant-1');
  assert.equal(stock?.totalInventory, 10);
  assert.equal(stock?.warehouses[2].totalInventory, null);
});

test('CJ freight calculation uses vid and never invents product weight', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/getAccessToken')) return tokenResponse();
    assert.equal(url.pathname.endsWith('/logistic/freightCalculate'), true);
    const body = JSON.parse(String(init?.body || '{}'));
    assert.equal(body.startCountryCode, 'CN');
    assert.equal(body.endCountryCode, 'UY');
    assert.deepEqual(body.products, [{ quantity: 1, vid: 'variant-1' }]);
    assert.equal('productWeight' in body, false);
    return Response.json({ code: 200, data: [
      { logisticName: 'CJPacket', logisticAging: '12-20', logisticPrice: '4.20', taxesFee: '0.30', clearanceOperationFee: '0.50' },
      { logisticName: 'Fast', logisticAging: '7-12', logisticPrice: '8.00', totalPostageFee: '8.40' },
    ] });
  });
  const freight = await new CJDropshippingClient('test-key').calculateShipping({ variantId: 'variant-1', countryCode: 'UY' });
  assert.equal(freight[0].totalCostUsd, 5);
  assert.equal(freight[1].totalCostUsd, 8.4);
});

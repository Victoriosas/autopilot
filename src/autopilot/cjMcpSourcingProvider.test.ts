import assert from 'node:assert/strict';
import test from 'node:test';
import { CJMcpReadOnlyClient, extractCJMcpToolJson } from '../services/cjMcp';
import { CJMcpFirstSourcingProvider } from '../services/cjSourcingProvider';
import type CJDropshippingClient from '../services/cjDropshipping';
import { errorClass } from './sourcingOrchestrator';

function mcpClient(handler: (name: string, args: any) => unknown) {
  return new CJMcpReadOnlyClient(
    'https://developers.cjdropshipping.com/mcp/fake-token',
    (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.method === 'tools/call') {
        const value = handler(body.params.name, body.params.arguments || {});
        const text = body.params.name === 'search_products'
          ? `📋 Found products.\n\n${JSON.stringify(value)}`
          : JSON.stringify(value);
        return Response.json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text }] } });
      }
      return Response.json({ jsonrpc: '2.0', id: body.id, result: { tools: [] } });
    }) as typeof fetch,
  );
}

test('extracts grounded JSON from CJ tool text with a human-readable prefix', () => {
  const data = extractCJMcpToolJson({ content: [{ type: 'text', text: 'Found 1 product\n\n{"totalRecords":1}' }] }) as any;
  assert.equal(data.totalRecords, 1);
});

test('MCP-first search maps CJ listV2 product shape without fabricating fields', async () => {
  const mcp = mcpClient((name, args) => {
    assert.equal(name, 'search_products');
    assert.equal(args.keyword, 'spa headband');
    assert.equal(args.startWarehouseInventory, 1);
    return {
      totalRecords: 1,
      content: [{ productList: [{
        id: 'P-1',
        nameEn: 'Spa Headband',
        sku: 'SPU-1',
        sellPrice: '2.50',
        bigImage: 'https://example.test/p.jpg',
        totalVerifiedInventory: '12',
      }] }],
    };
  });
  const provider = new CJMcpFirstSourcingProvider(mcp, null);
  const result = await provider.searchProducts({ keyword: 'spa headband', pageSize: 3 });
  assert.equal(result.total, 1);
  assert.equal(result.products[0].pid, 'P-1');
  assert.equal(result.products[0].sellPrice, 2.5);
  assert.equal(result.products[0].stockQuantity, 12);
  assert.equal(result.products[0].supplierId, '');
  assert.ok(provider.drainTrace().includes('CJ_MCP_SEARCH_PRODUCTS_OBSERVED'));
});

test('MCP-first provider maps variants, public inventory and freight for V4 evidence', async () => {
  const mcp = mcpClient((name) => {
    if (name === 'get_product_variants') return [
      { pid: 'P-1', vid: 'V-1', variantSku: 'SKU-1', variantNameEn: 'Pink', variantSellPrice: '3.25', variantWeight: '80' },
    ];
    if (name === 'query_cj_inventory') return [
      { countryCode: 'CN', totalInventoryNum: 4, cjInventoryNum: 4 },
      { countryCode: 'US', totalInventoryNum: '6' },
    ];
    if (name === 'calculate_freight') return [
      { logisticName: 'CJPacket', logisticAging: '12-22', logisticPrice: '4.20', taxesFee: '0.30', clearanceOperationFee: '0.50' },
    ];
    throw new Error(`unexpected tool ${name}`);
  });
  const provider = new CJMcpFirstSourcingProvider(mcp, null);
  const variants = await provider.getVariants('P-1');
  const stock = await provider.getVariantStock('V-1');
  const freight = await provider.calculateShipping({ variantId: 'V-1', countryCode: 'UY' });
  assert.equal(variants[0].variantSellPrice, 3.25);
  assert.equal(variants[0].variantWeight, 80);
  assert.equal(stock?.totalInventory, 10);
  assert.equal(freight[0].totalCostUsd, 5);
  assert.equal(freight[0].logisticAging, '12-22');
  const trace = provider.drainTrace();
  assert.ok(trace.includes('CJ_MCP_GET_PRODUCT_VARIANTS_OBSERVED'));
  assert.ok(trace.includes('CJ_MCP_QUERY_CJ_INVENTORY_OBSERVED'));
  assert.ok(trace.includes('CJ_MCP_CALCULATE_FREIGHT_OBSERVED'));
});

test('falls back to REST when an MCP read fails and records only a sanitized code', async () => {
  const mcp = new CJMcpReadOnlyClient(
    'https://developers.cjdropshipping.com/mcp/fake-token',
    (async () => new Response('upstream secret', { status: 503 })) as typeof fetch,
  );
  const rest = {
    searchProducts: async () => ({ products: [{
      pid: 'REST-1', productNameEn: 'Fallback', productName: 'Fallback', productImage: '', productSku: '', productWeight: '',
      productType: 'ORDINARY_PRODUCT', salePrice: 1, sellPrice: 1, categoryName: '', categoryId: '', supplierId: '', supplierName: '',
      isFreeShipping: false, shippingCountryCodes: '', createTime: 0,
    }], total: 1 }),
  } as unknown as CJDropshippingClient;
  const provider = new CJMcpFirstSourcingProvider(mcp, rest);
  const result = await provider.searchProducts({ keyword: 'fallback' });
  assert.equal(result.products[0].pid, 'REST-1');
  const trace = provider.drainTrace().join('|');
  assert.match(trace, /CJ_MCP_SEARCH_PRODUCTS_FALLBACK_CJ_MCP_HTTP_503/);
  assert.match(trace, /CJ_REST_SEARCH_PRODUCTS_OBSERVED/);
  assert.equal(trace.includes('secret'), false);
});

test('persists whether a 401 came from REST-only or an MCP-to-REST fallback chain', async () => {
  const rest401 = {
    searchProducts: async () => {
      const error: any = new Error('provider body must not leak');
      error.status = 401;
      throw error;
    },
  } as unknown as CJDropshippingClient;

  const restOnly = new CJMcpFirstSourcingProvider(null, rest401);
  await assert.rejects(
    () => restOnly.searchProducts({ keyword: 'test' }),
    (error: any) => error.code === 'CJ_REST_ONLY_CJ_REST_HTTP_401'
      && errorClass(error).code === 'CJ_REST_ONLY_CJ_REST_HTTP_401'
      && !String(error.message).includes('provider body'),
  );

  const mcp401 = new CJMcpReadOnlyClient(
    'https://developers.cjdropshipping.com/mcp/fake-token',
    (async () => new Response('mcp secret', { status: 401 })) as typeof fetch,
  );
  const hybrid = new CJMcpFirstSourcingProvider(mcp401, rest401);
  await assert.rejects(
    () => hybrid.searchProducts({ keyword: 'test' }),
    (error: any) => error.code === 'CJ_MCP_FALLBACK_CJ_MCP_HTTP_401_CJ_REST_HTTP_401'
      && errorClass(error).code === 'CJ_MCP_FALLBACK_CJ_MCP_HTTP_401_CJ_REST_HTTP_401'
      && !String(error.message).includes('secret'),
  );
});

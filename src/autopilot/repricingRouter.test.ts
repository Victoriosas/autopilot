import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createCatalogGovernanceRouter } from './catalogGovernanceRouter';
test('admin cost sheet reaches HTTP repricing while unknown costs and public access stay blocked', async () => {
  const previous = process.env.AUTOPILOT_ADMIN_TOKEN;
  process.env.AUTOPILOT_ADMIN_TOKEN = 'pilot-test';
  const app = express(); app.use(express.json()); app.use(createCatalogGovernanceRouter());
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as {port:number}).port}/repricing/propose`;
  const observation = { productId: 'pilot', title: 'Accesorio', source: 'cj_dropshipping',
    currentPrice: 30, currency: 'USD', observedSupplierCost: 10, observedStock: 5,
    provenance: { product: 'verified', supplierCost: 'observed' } };
  const costEvidence = { currency: 'USD', sourceReference: 'test-cost-sheet',
    supplierShipping: 5, customsRatePct: 10, paymentFeePct: 5, paymentFeeFixed: 1,
    returnReservePct: 3, acquisitionCost: 2, taxRatePct: 2 };
  const post = (body: unknown, authenticated = true) => fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json',
      ...(authenticated ? { authorization: 'Bearer pilot-test' } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(3000),
  });
  try {
    assert.equal((await post({observation}, false)).status, 401);
    const missing = await post({observation});
    assert.equal(missing.status, 200);
    const blocked = await missing.json();
    assert.equal(blocked.proposal.status, 'no_change');
    assert.equal(blocked.persisted, null);
    const good = await post({ observation, costEvidence });
    assert.equal(good.status, 200);
    const ready = await good.json();
    assert.equal(ready.proposal.quote.landedCost, 18.5);
    assert.equal(ready.proposal.quote.recommendedPrice, 35.9);
    assert.equal(ready.proposal.costEvidence.sourceReference, 'test-cost-sheet');
    assert.equal(ready.persisted, null);
    assert.equal(ready.proposal.policy.supplierPurchaseAllowed, false);
  } finally {
    if (previous === undefined) delete process.env.AUTOPILOT_ADMIN_TOKEN;
    else process.env.AUTOPILOT_ADMIN_TOKEN = previous;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

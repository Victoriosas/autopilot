import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewResearch, auditDirectory } from '../scripts/audit-research.mjs';

test('unknown data cannot authorize publication', () => {
  const result = reviewResearch({});
  assert.equal(result.eligible, false);
  assert.ok(result.missing.includes('UNKNOWN_PROVIDER'));
});

test('CJ factory inventory is not CJ warehouse stock', () => {
  const result = reviewResearch({provider:'CJdropshipping',publicationAllowed:true,
    cjObservation:{variantId:'a',unitCost:1.93,inventory:{factoryCN:11738,cjWarehouseCN:0},
      freightOptions:[{priceUSD:11.01}]},allInCost:15,netMargin:20,imageRightsVerified:true});
  assert.equal(result.eligible, false);
  assert.ok(result.missing.includes('CJ_WAREHOUSE_STOCK_NOT_AVAILABLE'));
});

test('local quote must be verified, not just emailed', () => {
  const result = reviewResearch({supplier:'Casa Hector',publicationAllowed:true,
    quoteRequest:{status:'SENT_AWAITING_REPLY'},confirmedStock:10,allInCost:245,
    netMargin:25,imageRightsVerified:true});
  assert.equal(result.eligible,false);
  assert.ok(result.missing.includes('SUPPLIER_QUOTE_PENDING'));
});

test('actual research records remain blocked', () => {
  const results = auditDirectory('docs/research');
  assert.ok(results.length >= 2);
  assert.equal(results.filter(x=>x.eligible).length,0);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { runRepricingCouncil } from './repricingCouncil';
import type { RepricingProposal } from './repricingProposal';
const legacy: RepricingProposal = {
  productId: 'legacy', status: 'review_required', currentPrice: 30, currency: 'USD',
  proposedPrice: 32, reason: 'Cambio de costo', provenance: { supplierCost: 'observed', stock: 'observed' },
  policy: { ownerApprovalRequired: false, automaticPriceMutationAllowed: false,
    councilApprovalRequired: true, supplierPurchaseAllowed: false },
};
test('legacy repricing without complete cost sheet is rejected before any AI request', async () => {
  const before = globalThis.fetch; let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('NO_EXTERNAL_REQUESTS_IN_TEST'); };
  try {
    const result = await runRepricingCouncil(legacy);
    assert.equal(result.decision, 'reject');
    assert.equal(result.debatePerformed, false);
    assert.match(result.summary, /costos/i);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = before; }
});
test('incomplete repricing does not escalate to owner as if economics were ready', async () => {
  const result = await runRepricingCouncil({
    ...legacy, policy: { ...legacy.policy, ownerApprovalRequired: true },
  });
  assert.equal(result.decision, 'reject');
  assert.equal(result.ownerEscalationRequired, false);
  assert.match(result.summary, /costos/i);
});

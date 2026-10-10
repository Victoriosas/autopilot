import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommerceMaintenance } from './commerceMaintenance';

test('maintenance releases safe expiry, holds unknown payment and creates a recoverable manual fulfillment task', async () => {
  const calls: any[] = []; let claimed = false;
  const command = async (action: string, args: any) => {
    calls.push({ action, args });
    if (action === 'expired') return { reservations: [
      { orderId: 'unstarted', providerStarted: false },
      { orderId: 'unknown', providerStarted: true, providerOrderId: null },
      { orderId: 'declined', providerStarted: true, providerOrderId: 'provider-declined' },
    ] };
    if (action === 'claim_fulfillment') {
      if (claimed) return { job: null }; claimed = true;
      return { job: { id: 'job', owner: 'worker', generation: 1, order_id: 'paid-order' } };
    }
    if (action === 'prepare_fulfillment') return { taskId: 'paid-order', requiresOwnerApproval: true };
    return { ok: true, paymentStatus: 'pending' };
  };
  const gateway = {
    async create() { throw new Error('maintenance must never initiate a payment'); },
    async lookup(id: string) { assert.equal(id, 'provider-declined'); return { external_reference: 'declined', total_amount: 100, total_paid_amount: 0, currency_id: 'UYU', status: 'failed' }; },
  };
  const result = await runCommerceMaintenance(command, gateway, 'worker');
  assert.ok(calls.some(call => call.action === 'expire' && call.args.orderId === 'unstarted'));
  assert.ok(!calls.some(call => call.action === 'expire' && call.args.orderId === 'unknown'));
  assert.ok(calls.some(call => call.action === 'reject' && call.args.orderId === 'declined'));
  assert.ok(calls.some(call => call.action === 'finish_fulfillment'));
  assert.equal(result.manualTasks, 1); assert.equal(result.uncertainReservations, 1);
});

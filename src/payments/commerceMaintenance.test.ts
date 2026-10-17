import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommerceMaintenanceRouter, recoverPaymentReference, runCommerceMaintenance } from './commerceMaintenance';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

test('maintenance and manual tasks reject anonymous access before database or provider calls', async () => {
  const app = express(); app.use('/maintenance', createCommerceMaintenanceRouter());
  const server = createServer(app).listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const { port } = server.address() as { port: number };
    for (const [path, method] of [['run', 'POST'], ['tasks', 'GET'], ['recover', 'POST']]) {
      const response = await fetch(`http://127.0.0.1:${port}/maintenance/${path}`, { method });
      assert.equal(response.status, 401); assert.equal((await response.json()).error, 'ADMIN_AUTH_REQUIRED');
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('admin recovery reads existing provider truth without creating payment and retains uncertain funds', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const calls: string[] = [];
  let truth: any = { id: 'remote-one', external_reference: orderId, total_amount: '100', total_paid_amount: '100', currency_id: 'UYU', status: 'processed' };
  const gateway = { async create() { throw new Error('must never create payment'); }, async lookup() { return truth; } };
  const command = async (action: string) => { calls.push(action); return { paymentStatus: 'paid' }; };
  assert.equal((await recoverPaymentReference(command, gateway, orderId, 'remote-one')).paymentStatus, 'paid');
  assert.deepEqual(calls, ['recover_provider', 'payment']);
  for (const change of [{ id: 'other' }, { external_reference: 'other' }, { total_amount: true }]) {
    calls.length = 0; const original = truth; truth = { ...truth, ...change };
    await assert.rejects(recoverPaymentReference(command, gateway, orderId, 'remote-one'));
    assert.equal(calls.length, 0); truth = original;
  }
  calls.length = 0; truth = { ...truth, status: 'failed', total_paid_amount: '50' };
  await assert.rejects(recoverPaymentReference(command, gateway, orderId, 'remote-one'), /RECOVERY_REQUIRED/);
  assert.ok(!calls.includes('reject')); assert.ok(!calls.includes('payment'));
});

test('malformed recovery identifiers never reach the provider', async () => {
  let lookups = 0;
  const gateway = { async create() { throw new Error('unused'); }, async lookup() { lookups++; throw new Error('unexpected'); } };
  for (const id of [undefined, null, ['remote'], 123]) await assert.rejects(recoverPaymentReference(async () => ({}), gateway, '11111111-1111-4111-8111-111111111111', id as any));
  assert.equal(lookups, 0);
});

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

test('maintenance discovers an uncertain payment without human ID or a new charge', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111'; const calls: string[] = [];
  const command = async (action: string) => {
    calls.push(action);
    if (action === 'expired') return { reservations: [{ orderId, providerStarted: true }] };
    if (action === 'recovery_context') return { createdAt: '2026-10-10T00:00:00Z' };
    if (action === 'claim_fulfillment') return { job: null };
    return { paymentStatus: 'paid' };
  };
  const gateway = {
    async create() { throw new Error('must not charge'); },
    async find(reference: string) { assert.equal(reference, orderId); return 'remote-one'; },
    async lookup() { return { id: 'remote-one', external_reference: orderId, total_amount: '100', total_paid_amount: '100', currency_id: 'UYU', status: 'processed' }; },
  };
  const result = await runCommerceMaintenance(command, gateway, 'worker');
  assert.ok(calls.includes('recover_provider')); assert.ok(calls.includes('payment'));
  assert.equal(result.uncertainReservations, 0); assert.equal(result.expiryChecks, 1);
});

test('Orders API canonical currency is accepted and conflicting or malformed currencies never mutate orders', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const calls: Array<{ action: string; args: any }> = [];
  let truth: any = { id: 'remote-one', external_reference: orderId, total_amount: '100', total_paid_amount: '100', currency: 'UYU', status: 'processed' };
  const command = async (action: string, args: any) => { calls.push({ action, args }); return { paymentStatus: 'paid' }; };
  const gateway = { async create() { throw new Error('must not charge'); }, async lookup() { return truth; } };
  for (const fields of [{ currency: 'UYU' }, { currency: 'UYU', currency_id: 'UYU' }, { currency_id: 'UYU' }]) {
    truth = { id: 'remote-one', external_reference: orderId, total_amount: '100', total_paid_amount: '100', status: 'processed', ...fields };
    assert.equal((await recoverPaymentReference(command, gateway, orderId, 'remote-one')).paymentStatus, 'paid');
    assert.ok(calls.every(call => call.args.currency === 'UYU'));
    calls.length = 0;
  }
  for (const fields of [{}, { currency: 'USD' }, { currency: 'uyu' }, { currency: null, currency_id: 'UYU' }, { currency: '', currency_id: 'UYU' }, { currency: 'UYU', currency_id: 'USD' }, { currency: 'USD', currency_id: 'UYU' }, { currency: 'UYU', currency_id: null }, { currency: ['UYU'] }]) {
    truth = { id: 'remote-one', external_reference: orderId, total_amount: '100', total_paid_amount: '100', status: 'processed', ...fields };
    await assert.rejects(recoverPaymentReference(command, gateway, orderId, 'remote-one'), /INVALID_PROVIDER_PAYMENT/);
    assert.deepEqual(calls, []);
  }
});

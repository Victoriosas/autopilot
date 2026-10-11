import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// This suite must never receive hosted project credentials or customer data.
assert.equal(process.env.COMMERCE_SYNTHETIC_SUPABASE, 'true', 'Explicit disposable fixture opt-in required');
assert.ok(process.env.SUPABASE_LOCAL_STATUS_FILE, 'Local CLI status file required; no silent skips');
const status = JSON.parse(readFileSync(process.env.SUPABASE_LOCAL_STATUS_FILE!, 'utf8'));
const url = new URL(status.API_URL);
assert.equal(url.protocol, 'http:');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '54321');
assert.equal(url.pathname, '/');
const anonKey = status.ANON_KEY || status.PUBLISHABLE_KEY;
const serviceKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
assert.ok(typeof anonKey === 'string' && anonKey.length > 0);
assert.ok(typeof serviceKey === 'string' && serviceKey.length > 0);
const client = (key: string) => createClient(url.origin, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const admin = client(serviceKey);
const publicClient = client(anonKey);
const customer = client(anonKey);
const productId = randomUUID();
const request = () => ({
  key: randomUUID(), provider: 'mercadopago', currency: 'UYU',
  customer: { email: 'buyer@example.test', name: 'Synthetic buyer' },
  items: [{ productId, quantity: 1 }], shipping: 0, total: 1,
});
async function command(action: string, args: object = {}) {
  const result = await admin.rpc('commerce_checkout_command', { command: action, args });
  assert.equal(result.error, null, result.error?.message);
  return result.data;
}
async function privateDataBlocked(actor: SupabaseClient, table: string) {
  const result = await actor.from(table).select('*');
  if (result.error) assert.ok(['42501', 'PGRST205'].includes(result.error.code), result.error.message);
  else assert.deepEqual(result.data, [], 'Private rows must not be exposed');
}
async function rpcBlocked(actor: SupabaseClient, name: string, args: object) {
  const result = await actor.rpc(name, args);
  assert.ok(result.error, 'Restricted RPC must reject the caller');
  assert.ok(['42501', 'PGRST202'].includes(result.error.code), result.error.message);
}

test('disposable Supabase Auth, PostgREST and atomic commerce', { timeout: 90000 }, async t => {
  let userId: string | undefined;
  try {
    await t.test('real Auth login creates an authenticated JWT only in the local fixture', async () => {
      const email = 'fixture-' + randomUUID() + '@example.test';
      const password = 'Fixture-' + randomUUID() + '-9a!';
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null, created.error?.message);
      userId = created.data.user!.id;
      const signedIn = await customer.auth.signInWithPassword({ email, password });
      assert.equal(signedIn.error, null, signedIn.error?.message);
      assert.equal(signedIn.data.user!.id, userId);
      assert.ok(signedIn.data.session?.access_token);
    });
    await t.test('migrations and updated_at trigger work through service-role PostgREST', async () => {
      const inserted = await admin.from('products').insert({
        id: productId, title: 'Synthetic accessory', price: 100, currency: 'UYU',
        status: 'published', inventory: 1, updated_at: '2000-01-01T00:00:00Z',
      });
      assert.equal(inserted.error, null, inserted.error?.message);
      const updated = await admin.from('products').update({ title: 'Fixture accessory' })
        .eq('id', productId).select('updated_at').single();
      assert.equal(updated.error, null, updated.error?.message);
      assert.ok(Date.parse(updated.data!.updated_at) > Date.parse('2000-01-01T00:00:00Z'));
      const capabilities = await command('capabilities', {
        provider: 'mercadopago', environment: 'sandbox', currency: 'UYU',
      });
      assert.equal(capabilities.atomicCheckout, true);
      assert.equal(capabilities.available, false, 'No provider capability attestation is fabricated');
    });
    await t.test('anonymous and authenticated callers cannot mutate stock or call commerce RPCs', async () => {
      for (const actor of [publicClient, customer]) {
        await rpcBlocked(actor, 'commerce_checkout_command', { command: 'reserve', args: request() });
        await rpcBlocked(actor, 'commerce_recover_provider_order', { args: { orderId: randomUUID() } });
        await rpcBlocked(actor, 'commerce_recovery_context', { args: { orderId: randomUUID() } });
        await rpcBlocked(actor, 'commerce_maintenance_expired', {});
        const inserted = await actor.from('products').insert({
          id: randomUUID(), title: 'Forbidden', price: 1, inventory: 999, status: 'published',
        });
        assert.ok(inserted.error);
        assert.equal(inserted.error.code, '42501');
      }
      const row = await admin.from('products').select('inventory').eq('id', productId).single();
      assert.equal(row.error, null);
      assert.equal(row.data!.inventory, 1);
    });
    let reserved: any;
    await t.test('concurrent HTTP reservations and retry use server price and exactly one unit', async () => {
      const inputs = [request(), request()];
      const results = await Promise.all(inputs.map(args =>
        admin.rpc('commerce_checkout_command', { command: 'reserve', args })));
      const winningIndex = results.findIndex(result => !result.error);
      assert.equal(results.filter(result => !result.error).length, 1);
      const rejected = results.find(result => result.error)!;
      assert.match(rejected.error!.message, /PRODUCT_OUT_OF_STOCK/);
      reserved = results[winningIndex].data;
      assert.equal(reserved.total, 100);
      assert.equal(reserved.currency, 'UYU');
      const retry = await command('reserve', inputs[winningIndex]);
      assert.equal(retry.orderId, reserved.orderId);
      const stock = await admin.from('products').select('inventory').eq('id', productId).single();
      assert.equal(stock.error, null); assert.equal(stock.data!.inventory, 0);
      const orders = await admin.from('orders').select('id');
      assert.equal(orders.error, null); assert.equal(orders.data!.length, 1);
    });
    await t.test('restricted tables and order details stay private after rows exist', async () => {
      for (const actor of [publicClient, customer]) {
        for (const table of ['orders', 'commerce_checkout_sessions', 'commerce_fulfillment_jobs',
          'commerce_manual_fulfillment_tasks', 'commerce_payment_capabilities']) {
          await privateDataBlocked(actor, table);
        }
      }
    });
    await t.test('durable recovery and payment replay enqueue one manual fulfillment task', async () => {
      await command('begin_provider', { orderId: reserved.orderId });
      const proof = { orderId: reserved.orderId, reference: reserved.orderId,
        providerOrderId: 'fixture-provider-' + randomUUID(), amount: 100, currency: 'UYU' };
      const context = await admin.rpc('commerce_recovery_context', { args: { orderId: reserved.orderId } });
      assert.equal(context.error, null); assert.ok(Number.isFinite(Date.parse(context.data.createdAt)));
      const bad = await admin.rpc('commerce_recover_provider_order', { args: { ...proof, amount: 99 } });
      assert.match(bad.error!.message, /PAYMENT_AMOUNT_MISMATCH/);
      const recovered = await admin.rpc('commerce_recover_provider_order', { args: proof });
      assert.equal(recovered.error, null, recovered.error?.message);
      for (let attempt = 0; attempt < 2; attempt++) await command('payment', { ...proof, status: 'processed' });
      const jobs = await admin.from('commerce_fulfillment_jobs').select('*');
      assert.equal(jobs.error, null); assert.equal(jobs.data!.length, 1);
      const claim = await command('claim_fulfillment', { owner: 'synthetic-worker' });
      const fence = { id: claim.job.id, owner: 'synthetic-worker', generation: claim.job.generation };
      const prepared = await command('prepare_fulfillment', fence);
      assert.equal(prepared.requiresOwnerApproval, true);
      await command('prepare_fulfillment', fence);
      const tasks = await command('manual_tasks');
      assert.equal(tasks.tasks.length, 1);
      assert.equal(tasks.tasks[0].state, 'awaiting_owner_approval');
      // A simulated provider observation above is not a real Mercado Pago payment.
    });
  } finally {
    if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId);
      assert.equal(deleted.error, null, deleted.error?.message);
    }
    await customer.auth.signOut();
  }
});

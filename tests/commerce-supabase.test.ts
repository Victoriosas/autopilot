import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
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
    await t.test('public catalog exposes published rows while drafts remain hidden', async () => {
      const draftId = randomUUID();
      const inserted = await admin.from('products').insert({
        id: draftId, title: 'Private draft', price: 50, currency: 'UYU',
        status: 'draft_ready', inventory: 2,
      });
      assert.equal(inserted.error, null);
      for (const actor of [publicClient, customer]) {
        const catalog = await actor.from('products').select('id,title,price');
        assert.equal(catalog.error, null, catalog.error?.message);
        assert.ok(catalog.data!.some(row => row.id === productId));
        assert.ok(!catalog.data!.some(row => row.id === draftId));
      }
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
    await t.test('authenticated owners read their order while another customer cannot', async () => {
      const assigned = await admin.from('orders').update({ user_id: userId }).eq('id', reserved.orderId);
      assert.equal(assigned.error, null);
      const mine = await customer.from('orders').select('id,total');
      assert.equal(mine.error, null);
      assert.deepEqual(mine.data, [{ id: reserved.orderId, total: 100 }]);
      await privateDataBlocked(publicClient, 'orders');
      const email = 'other-' + randomUUID() + '@example.test';
      const password = 'Other-' + randomUUID() + '-9a!';
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null);
      const other = client(anonKey);
      try {
        const session = await other.auth.signInWithPassword({ email, password });
        assert.equal(session.error, null);
        await privateDataBlocked(other, 'orders');
        const attack = await other.from('orders').update({ user_id: session.data.user!.id })
          .eq('id', reserved.orderId).select('id');
        assert.equal(attack.error, null);
        assert.deepEqual(attack.data, []);
        const unchanged = await admin.from('orders').select('user_id').eq('id', reserved.orderId).single();
        assert.equal(unchanged.error, null);
        assert.equal(unchanged.data!.user_id, userId);
      } finally {
        await other.auth.signOut();
        const deleted = await admin.auth.admin.deleteUser(created.data.user!.id);
        assert.equal(deleted.error, null);
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
    await t.test('application HTTP checkout and webhook use the real Supabase adapter', async () => {
      const { default: express } = await import('express');
      const { createMercadoPagoRouter } = await import('../src/payments/mercadoPago');
      const { commerceCommand } = await import('../src/payments/availability');
      const envNames = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STORE_SHIPPING_FLAT',
        'STORE_FREE_SHIPPING_FROM', 'PUBLIC_APP_URL'] as const;
      const previous = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
      Object.assign(process.env, { SUPABASE_URL: url.origin, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        STORE_SHIPPING_FLAT: '0', STORE_FREE_SHIPPING_FROM: '0', PUBLIC_APP_URL: 'https://example.test' });
      const httpProduct = randomUUID();
      const inserted = await admin.from('products').insert({
        id: httpProduct, title: 'HTTP fixture', price: 150, currency: 'UYU', status: 'published', inventory: 2,
      });
      assert.equal(inserted.error, null);
      const operations = new Map<string, { id: string; checkoutUrl: string; snapshot: any }>();
      let creates = 0; let available = true;
      const app = express(); app.use(express.json());
      app.use('/mp', createMercadoPagoRouter({
        command: commerceCommand,
        available: async () => ({ requested: true, available, reason: available ? null : 'SYNTHETIC_DISABLED' }),
        gateway: {
          async create(snapshot) {
            if (!operations.has(snapshot.orderId)) {
              creates++;
              operations.set(snapshot.orderId, { id: 'http-' + snapshot.orderId,
                checkoutUrl: 'https://example.test/fixture-payment', snapshot });
            }
            return operations.get(snapshot.orderId)!;
          },
          async lookup(id) {
            const operation = [...operations.values()].find(row => row.id === id);
            assert.ok(operation, 'Unknown synthetic provider order');
            return { external_reference: operation.snapshot.orderId, total_amount: operation.snapshot.total,
              total_paid_amount: operation.snapshot.total, currency_id: 'UYU', status: 'processed' };
          },
        },
      }));
      const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
      const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
      const key = randomUUID();
      const body = { customer: { name: 'Test', email: 'buyer@example.test', phone: '099123456',
        address: 'Fixture 1', city: 'Canelones', postalCode: '15000', country: 'UY' },
        items: [{ productId: httpProduct, quantity: 1 }], total: 1, shipping: 999 };
      const post = (path: string, value: object, requestKey = key) => fetch(origin + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
        body: JSON.stringify(value), signal: AbortSignal.timeout(10000),
      });
      try {
        const attempts = await Promise.all([post('/mp/order', body), post('/mp/order', body)]);
        const orders = await Promise.all(attempts.map(async response => {
          assert.equal(response.status, 201); return response.json();
        }));
        assert.equal(orders[0].orderId, orders[1].orderId);
        assert.equal(orders[0].total, 150);
        assert.equal(creates, 1);
        const stock = await admin.from('products').select('inventory').eq('id', httpProduct).single();
        assert.equal(stock.error, null); assert.equal(stock.data!.inventory, 1);
        available = false;
        assert.equal((await post('/mp/order', body, randomUUID())).status, 503);
        for (let replay = 0; replay < 2; replay++) {
          const response = await post('/mp/webhook', { data: { id: orders[0].providerOrderId } });
          assert.equal(response.status, 200);
          assert.equal((await response.json()).paymentStatus, 'paid');
        }
        const jobs = await admin.from('commerce_fulfillment_jobs').select('id').eq('order_id', orders[0].orderId);
        assert.equal(jobs.error, null); assert.equal(jobs.data!.length, 1);
        assert.equal(creates, 1);
      } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        for (const name of envNames) {
          if (previous[name] === undefined) delete process.env[name];
          else process.env[name] = previous[name];
        }
      }
    });
  } finally {
    if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId);
      assert.equal(deleted.error, null, deleted.error?.message);
    }
    await customer.auth.signOut();
  }
});

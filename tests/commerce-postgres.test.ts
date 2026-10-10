import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const database = process.env.COMMERCE_TEST_DATABASE_URL;
if (!database) throw new Error('Run scripts/test-commerce-postgres.mjs; no PostgreSQL tests may silently skip.');
const target = new URL(database);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/victoriosa_checkout_test');
function sql(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.PSQL_PATH || 'psql', [database!, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true },
      (error, output, stderr) => error ? reject(new Error(stderr)) : resolve(output.trim()));
    child.stdin!.end(query);
  });
}
const quote = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
const command = async (action: string, args: object = {}) => JSON.parse(await sql(`set role service_role; select public.commerce_checkout_command('${action}', ${quote(args)});`));
const productId = '11111111-1111-4111-8111-111111111111';
const request = (key = randomUUID(), quantity = 1) => ({ key, provider: 'mercadopago', currency: 'UYU', customer: { email: 'buyer@example.test', name: 'Test' }, items: [{ productId, quantity }], shipping: 0 });
const migration = 'supabase/migrations/20261010010000_atomic_checkout.sql';

test('isolated PostgreSQL atomic commerce', { timeout: 120000 }, async t => {
  await sql(readFileSync('tests/commerce-baseline.sql', 'utf8'));
  // During RED, absence of the proposed RPC is the intended missing implementation.
  if (existsSync(migration)) await sql(readFileSync(migration, 'utf8'));
  const reset = async (stock = 1) => {
    await sql(`truncate public.products,public.orders cascade;
      insert into public.products(id,title,price,currency,status,inventory) values('${productId}','Vincha',100,'UYU','published',${stock});`);
  };
  await t.test('two concurrent shoppers cannot reserve the last unit twice', async () => {
    await reset();
    const results = await Promise.allSettled([command('reserve', request()), command('reserve', request())]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.match(String((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason), /PRODUCT_OUT_OF_STOCK/);
    assert.equal(await sql('select inventory from public.products;'), '0');
    assert.equal(await sql('select count(*) from public.orders;'), '1');
  });
  await t.test('concurrent checkout retries preserve order and server price; changed intent is rejected', async () => {
    await reset(3);
    const input = request();
    const [a, b] = await Promise.all([command('reserve', { ...input, total: 1 }), command('reserve', { ...input, total: 1 })]);
    assert.equal(a.orderId, b.orderId); assert.equal(a.total, 100);
    assert.equal(await sql('select inventory from public.products;'), '2');
    assert.equal(await sql('select count(*) from public.orders;'), '1');
    await assert.rejects(command('reserve', { ...input, items: [{ productId, quantity: 2 }] }), /IDEMPOTENCY_CONFLICT/);
  });
  await t.test('failure and expiry release a reservation once; released orders cannot confirm', async () => {
    for (const action of ['reject', 'expire']) {
      await reset();
      const reserved = await command('reserve', request());
      await command('bind', { orderId: reserved.orderId, providerOrderId: 'provider-one', checkoutUrl: 'https://example.test/pay' });
      await command('payment', { orderId: reserved.orderId, providerOrderId: 'provider-one', amount: 100, currency: 'UYU', status: 'cancelled' });
      if (action === 'expire') await sql("update public.commerce_checkout_sessions set expires_at=now()-interval '1 second';");
      await command(action, { orderId: reserved.orderId });
      await command(action, { orderId: reserved.orderId });
      assert.equal(await sql('select inventory from public.products;'), '1');
      await assert.rejects(command('payment', { orderId: reserved.orderId, providerOrderId: 'provider-one', amount: 100, currency: 'UYU', status: 'processed' }), /RESERVATION_NOT_ACTIVE/);
    }
  });
  await t.test('duplicate paid webhooks enqueue fulfillment once and preserve stock', async () => {
    await reset();
    const reserved = await command('reserve', request());
    await command('bind', { orderId: reserved.orderId, providerOrderId: 'provider-two', checkoutUrl: 'https://example.test/pay' });
    const payment = { orderId: reserved.orderId, providerOrderId: 'provider-two', amount: 100, currency: 'UYU', status: 'processed' };
    for (const invalid of [{ amount: 99.99 }, { amount: 'Infinity' }, { currency: 'USD' }, { providerOrderId: 'other' }]) {
      await assert.rejects(command('payment', { ...payment, ...invalid }), /PAYMENT_.*MISMATCH|INVALID_PAYMENT_AMOUNT/);
    }
    assert.equal((await command('payment', { ...payment, status: 'pending' })).paymentStatus, 'pending');
    await Promise.all([command('payment', payment), command('payment', payment)]);
    await sql("update public.orders set status='shipped';");
    await command('payment', payment);
    assert.equal(await sql('select status from public.orders;'), 'shipped', 'duplicate webhook cannot undo fulfillment progress');
    assert.equal(await sql("select count(*) from public.orders where payment_status='paid';"), '1');
    assert.equal(await sql('select count(*) from public.commerce_fulfillment_jobs;'), '1');
    assert.equal(await sql('select inventory from public.products;'), '0');
    await command('reject', { orderId: reserved.orderId });
    assert.equal(await sql('select inventory from public.products;'), '0');
    const claims = await Promise.all([command('claim_fulfillment', { owner: 'worker-a' }), command('claim_fulfillment', { owner: 'worker-b' })]);
    const job = claims.find(result => result.job)?.job;
    assert.equal(claims.filter(result => result.job).length, 1);
    await assert.rejects(command('finish_fulfillment', { id: job.id, owner: job.owner }), /FULFILLMENT_FENCE_REJECTED/);
    const task = await command('prepare_fulfillment', { id: job.id, owner: job.owner, generation: job.generation });
    assert.equal((await command('manual_tasks', {})).tasks[0].order_id, task.taskId);
    await sql("update public.commerce_fulfillment_jobs set lease_until=now()-interval '1 second';");
    const recovered = (await command('claim_fulfillment', { owner: 'worker-c' })).job;
    assert.equal(recovered.id, job.id); assert.ok(recovered.generation > job.generation);
    assert.equal((await command('prepare_fulfillment', { id: recovered.id, owner: recovered.owner, generation: recovered.generation })).taskId, task.taskId);
    assert.equal(await sql('select count(*) from public.commerce_manual_fulfillment_tasks;'), '1');
    await assert.rejects(command('finish_fulfillment', { id: job.id, owner: job.owner, generation: job.generation }), /FULFILLMENT_FENCE_REJECTED/);
    await command('finish_fulfillment', { id: recovered.id, owner: recovered.owner, generation: recovered.generation });
    assert.equal((await command('claim_fulfillment', { owner: 'worker-d' })).job, null);
  });
  await t.test('expired retries cannot initiate payment; uncertain provider operations retain stock', async () => {
    await reset();
    const input = request();
    const reserved = await command('reserve', input);
    await command('begin_provider', { orderId: reserved.orderId });
    await sql("update public.commerce_checkout_sessions set expires_at=now()-interval '1 second';");
    assert.equal((await command('reserve', input)).expired, true);
    await assert.rejects(command('begin_provider', { orderId: reserved.orderId }), /RESERVATION_EXPIRED/);
    await assert.rejects(command('expire', { orderId: reserved.orderId }), /PROVIDER_OUTCOME_UNKNOWN/);
    assert.equal(await sql('select inventory from public.products;'), '0');
    // Provider creation may have finished before the timeout; recording its ID
    // is allowed for recovery, but must not advertise a payable expired URL.
    assert.equal((await command('bind', { orderId: reserved.orderId, providerOrderId: 'late', checkoutUrl: 'https://example.test/pay' })).expired, true);
    await command('payment', { orderId: reserved.orderId, providerOrderId: 'late', amount: 100, currency: 'UYU', status: 'processed' });
    assert.equal(await sql("select payment_status from public.orders;"), 'paid', 'late paid truth is valid while stock remains held');
    await reset();
    const unstarted = await command('reserve', request());
    await sql("update public.commerce_checkout_sessions set expires_at=now()-interval '1 second';");
    await command('expire', { orderId: unstarted.orderId });
    assert.equal(await sql('select inventory from public.products;'), '1');
    const more = await command('reserve', request());
    await sql("update public.commerce_checkout_sessions set expires_at=now()-interval '1 second' where state='held';");
    const expired = await command('expired', {});
    assert.equal(expired.reservations.length, 1); assert.equal(expired.reservations[0].orderId, more.orderId);
  });
  await t.test('anonymous roles cannot mutate reservations or attest readiness', async () => {
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(sql(`set role ${role}; select public.commerce_checkout_command('reserve',${quote(request())});`), /permission denied/);
      await assert.rejects(sql(`set role ${role}; select * from public.commerce_payment_capabilities;`), /permission denied/);
    }
    const capability = await command('capabilities', { provider: 'mercadopago', environment: 'live', currency: 'UYU' });
    assert.equal(capability.available, false);
  });
});

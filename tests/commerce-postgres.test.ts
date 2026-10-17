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
  const recoveryMigration = 'supabase/migrations/20261010020000_payment_reference_recovery.sql';
  if (existsSync(recoveryMigration)) await sql(readFileSync(recoveryMigration, 'utf8'));
  const oauthCompatibilityMigration = 'supabase/migrations/20261012010000_provider_oauth_token_ciphertext_compat.sql';
  await t.test('hosted OAuth token schema upgrades to encrypted columns without silent plaintext conversion', async () => {
    const hostedLegacySchema = `
      drop table if exists public.provider_oauth_tokens;
      create table public.provider_oauth_tokens (
        provider text primary key,
        access_token text not null,
        refresh_token text,
        token_type text,
        expires_at timestamptz,
        scope text,
        external_user_id text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`;
    await sql(hostedLegacySchema);
    if (existsSync(oauthCompatibilityMigration)) await sql(readFileSync(oauthCompatibilityMigration, 'utf8'));
    const columns = await sql(`select string_agg(column_name, ',' order by ordinal_position)
      from information_schema.columns where table_schema='public' and table_name='provider_oauth_tokens';`);
    assert.match(columns, /access_token_ciphertext/);
    assert.match(columns, /refresh_token_ciphertext/);
    assert.doesNotMatch(columns, /(^|,)access_token(,|$)/);
    assert.doesNotMatch(columns, /(^|,)refresh_token(,|$)/);
    await sql(`insert into public.provider_oauth_tokens(provider,access_token_ciphertext)
      values('mercadolibre','v1:synthetic-ciphertext');`);

    await sql(hostedLegacySchema);
    await sql(`insert into public.provider_oauth_tokens(provider,access_token,refresh_token)
      values('mercadolibre','synthetic-plaintext','synthetic-refresh');`);
    await assert.rejects(sql(readFileSync(oauthCompatibilityMigration, 'utf8')), /OAUTH_PLAINTEXT_ROTATION_REQUIRED/);
    assert.equal(await sql(`select access_token from public.provider_oauth_tokens where provider='mercadolibre';`), 'synthetic-plaintext');
    assert.equal(await sql(`select count(*) from information_schema.columns where table_schema='public'
      and table_name='provider_oauth_tokens' and column_name='access_token_ciphertext';`), '0');
    await sql('drop table public.provider_oauth_tokens;');
  });
  const reset = async (stock = 1) => {
    await sql(`truncate public.products,public.orders cascade;
      insert into public.products(id,title,price,currency,status,inventory) values('${productId}','Vincha',100,'UYU','published',${stock});`);
  };
  await t.test('verified provider reference recovery is durable, conflict-safe and never releases uncertain stock', async () => {
    await reset();
    const reserved = await command('reserve', request());
    const proof = { orderId: reserved.orderId, reference: reserved.orderId, providerOrderId: 'verified-remote', amount: 100, currency: 'UYU' };
    const recover = (args: any) => sql(`set role service_role; select public.commerce_recover_provider_order(${quote(args)});`).then(JSON.parse);
    await assert.rejects(recover(proof), /PROVIDER_OPERATION_NOT_STARTED/);
    await command('begin_provider', { orderId: reserved.orderId });
    const context = JSON.parse(await sql(`set role service_role; select public.commerce_recovery_context(${quote({ orderId: reserved.orderId })});`));
    assert.ok(Number.isFinite(Date.parse(context.createdAt)));
    await sql("update public.commerce_checkout_sessions set expires_at=now()-interval '1 second';");
    for (const change of [{ reference: randomUUID() }, { amount: 99 }, { currency: 'USD' }]) await assert.rejects(recover({ ...proof, ...change }));
    const recovered = await Promise.all([recover(proof), recover(proof)]);
    assert.ok(recovered.every(row => row.providerOrderId === proof.providerOrderId));
    assert.equal(await sql('select inventory from public.products;'), '0');
    await assert.rejects(recover({ ...proof, providerOrderId: 'different' }), /PAYMENT_PROVIDER_MISMATCH/);
    await assert.rejects(command('expire', { orderId: reserved.orderId }), /PROVIDER_OUTCOME_UNKNOWN/);
    await command('payment', { ...proof, status: 'processed' });
    await recover(proof);
    assert.equal(await sql('select count(*) from public.commerce_fulfillment_jobs;'), '1');
    await assert.rejects(sql(`set role authenticated; select public.commerce_recover_provider_order(${quote(proof)});`), /permission denied/);
    await reset(2);
    const [one, two] = await Promise.all([command('reserve', request()), command('reserve', request())]);
    await command('begin_provider', { orderId: one.orderId }); await command('begin_provider', { orderId: two.orderId });
    await sql("update public.commerce_checkout_sessions set expires_at=now()-interval '1 second';");
    const firstBatch = JSON.parse(await sql('set role service_role; select public.commerce_maintenance_expired();')).reservations;
    const nextBatch = JSON.parse(await sql('set role service_role; select public.commerce_maintenance_expired();')).reservations;
    assert.equal(firstBatch.length, 1); assert.equal(nextBatch.length, 1);
    assert.notEqual(firstBatch[0].orderId, nextBatch[0].orderId);
    const results = await Promise.allSettled([one, two].map(row => recover({ ...proof, orderId: row.orderId, reference: row.orderId })));
    assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
    const winner = results[0].status === 'fulfilled' ? one : two;
    await command('payment', { orderId: winner.orderId, providerOrderId: proof.providerOrderId, amount: 100, currency: 'UYU', status: 'failed' });
    await command('reject', { orderId: winner.orderId });
    await assert.rejects(recover({ ...proof, orderId: winner.orderId, reference: winner.orderId }), /RESERVATION_NOT_ACTIVE/);
    assert.equal(await sql('select inventory from public.products;'), '1');
  });
  await t.test('server-derived checkout owner is persisted while guests stay unassigned', async () => {
    await reset(2);
    const ownerId = randomUUID();
    const ownedIntent = { ...request(), userId: ownerId };
    const owned = await command('reserve', ownedIntent);
    assert.equal(await sql(`select user_id from public.orders where id='${owned.orderId}';`), ownerId);
    const guest = await command('reserve', request());
    assert.equal(await sql(`select user_id is null from public.orders where id='${guest.orderId}';`), 't');
    await assert.rejects(command('reserve', { ...ownedIntent, userId: randomUUID() }), /IDEMPOTENCY_CONFLICT/);
  });
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
  await t.test('multi-product reservation failure rolls back all preceding stock changes', async () => {
    await reset(2);
    const secondId = '22222222-2222-4222-8222-222222222222';
    await sql(`insert into public.products(id,title,price,currency,status,inventory) values('${secondId}','Sin stock',100,'UYU','published',0);`);
    await assert.rejects(command('reserve', { ...request(), items: [{ productId, quantity: 1 }, { productId: secondId, quantity: 1 }] }), /PRODUCT_OUT_OF_STOCK/);
    assert.equal(await sql(`select inventory from public.products where id='${productId}';`), '2');
    assert.equal(await sql('select count(*) from public.orders;'), '0');
    assert.equal(await sql('select count(*) from public.commerce_checkout_sessions;'), '0');
  });
  await t.test('invalid quantities and unsupported variants reject without reservation effects', async () => {
    await reset(20);
    for (const quantity of [0, -1, 21, 1.5, '1', null]) {
      await assert.rejects(command('reserve', { ...request(), items: [{ productId, quantity }] }), /INVALID_CHECKOUT_ITEM/);
    }
    await assert.rejects(command('reserve', { ...request(), items: [{ productId, quantity: 1, selectedVariant: 'Large' }] }), /INVALID_CHECKOUT_ITEM/);
    await assert.rejects(command('reserve', { ...request(), items: [{ productId, quantity: 1 }, { productId, quantity: 1 }] }), /INVALID_CHECKOUT_ITEMS/);
    assert.equal(await sql('select inventory from public.products;'), '20');
    assert.equal(await sql('select count(*) from public.orders;'), '0');
    assert.equal(await sql('select count(*) from public.commerce_checkout_sessions;'), '0');
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
  await t.test('uncertain expired payments cannot starve later reservations', async () => {
    await reset(); await sql('update public.products set inventory=21;');
    for (let i = 0; i < 21; i++) await command('reserve', { ...request(), key: `rotation-checkout-${i.toString().padStart(3, '0')}` });
    await sql("update public.commerce_checkout_sessions set expires_at=now()-interval '1 second',provider_started=true;");
    const first = (await command('expired', {})).reservations;
    const second = (await command('expired', {})).reservations;
    assert.equal(new Set([...first, ...second].map(row => row.orderId)).size, 21);
  });
});

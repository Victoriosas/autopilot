import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';

const database = process.env.HOSTED_REPLAY_TEST_DATABASE_URL;
if (!database) throw new Error('Run scripts/test-hosted-replay-postgres.mjs; hosted replay tests may not silently skip.');
const target = new URL(database);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/victoriosa_hosted_replay_test');

function sql(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.PSQL_PATH || 'psql', [database!, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true },
      (error, output, stderr) => error ? reject(new Error(stderr)) : resolve(output.trim()));
    child.stdin!.end(query);
  });
}
const apply = (path: string) => sql(readFileSync(path, 'utf8'));

const newMigrations = [
  '20261010010000_atomic_checkout.sql',
  '20261010020000_payment_reference_recovery.sql',
  '20261011005345_product_stock_after_publication.sql',
  '20261011050519_explicit_data_api_grants.sql',
  '20261011114131_revoke_catalog_archive_public_execute.sql',
  '20261012010000_provider_oauth_token_ciphertext_compat.sql',
];

test('canonical hosted history accepts forward migrations without losing legacy contracts', { timeout: 120000 }, async () => {
  await apply('tests/hosted-replay-bootstrap.sql');
  await apply('supabase/migration.sql');
  await apply('supabase/migration-sourcing.sql');
  await apply('tests/hosted-migrations-canonical.sql');

  const supplierId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  await sql(`insert into public.suppliers(id,name,code) values('${supplierId}','Synthetic Supplier','synthetic');
    insert into public.products(id,title,price,status,inventory,supplier_id,traceability)
    values('${productId}','Legacy Product',100,'published',2,'${supplierId}','{"source":"synthetic"}'::jsonb);`);

  for (const migration of newMigrations) await apply(`supabase/migrations/${migration}`);

  assert.equal(await sql(`select title from public.products where id='${productId}';`), 'Legacy Product');
  assert.equal(await sql(`select supplier_id from public.products where id='${productId}';`), supplierId);
  assert.equal(await sql(`select traceability->>'source' from public.products where id='${productId}';`), 'synthetic');
  assert.equal(await sql(`select inventory from public.products where id='${productId}';`), '2');
  assert.equal(await sql(`select count(*) from information_schema.columns where table_schema='public' and table_name='provider_oauth_tokens' and column_name in ('access_token_ciphertext','refresh_token_ciphertext');`), '2');
  assert.equal(await sql(`select count(*) from information_schema.columns where table_schema='public' and table_name='provider_oauth_tokens' and column_name in ('access_token','refresh_token');`), '0');
  assert.equal(await sql(`select relrowsecurity from pg_class where oid='public.provider_oauth_tokens'::regclass;`), 't');
  assert.equal(await sql(`select has_function_privilege('anon','public.commerce_checkout_command(text,jsonb)','execute');`), 'f');
  assert.equal(await sql(`select has_function_privilege('service_role','public.commerce_checkout_command(text,jsonb)','execute');`), 't');
  assert.equal(await sql(`select has_function_privilege('anon','public.archive_and_clear_products(text)','execute');`), 'f');
});

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


test('Beauty FK indexes are repeatable and preserve rows, RLS and foreign keys', { timeout: 120000 }, async () => {
  // Minimal synthetic fixture in the disposable database, never hosted data.
  await sql(`create table public.beauty_fk_test_parent(id uuid primary key);
    insert into public.beauty_fk_test_parent values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    create table public.beauty_evaluations(
      id integer primary key,
      practitioner_id uuid references public.beauty_fk_test_parent(id));
    create table public.beauty_requests(
      id integer primary key,
      catalog_service_id uuid references public.beauty_fk_test_parent(id));
    alter table public.beauty_evaluations enable row level security;
    alter table public.beauty_requests enable row level security;
    insert into public.beauty_evaluations values (1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    insert into public.beauty_requests values (1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');`);
  await apply('supabase/migrations/20261020020414_beauty_foreign_key_indexes.sql');
  await apply('supabase/migrations/20261020020414_beauty_foreign_key_indexes.sql');
  assert.equal(await sql(`select count(*) from pg_index where indexrelid in (
    'public.beauty_evaluations_practitioner_id_idx'::regclass,
    'public.beauty_requests_catalog_service_id_idx'::regclass)
    and indisvalid and indisready and indpred is null;`), '2');
  assert.equal(await sql(`select string_agg(a.attname,',' order by a.attname)
    from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
    where i.indexrelid in ('public.beauty_evaluations_practitioner_id_idx'::regclass,
    'public.beauty_requests_catalog_service_id_idx'::regclass);`), 'catalog_service_id,practitioner_id');
  assert.equal(await sql('select count(*) from public.beauty_evaluations'), '1');
  assert.equal(await sql('select count(*) from public.beauty_requests'), '1');
  assert.equal(await sql(`select count(*) from pg_class where oid in
    ('public.beauty_evaluations'::regclass,'public.beauty_requests'::regclass)
    and relrowsecurity;`), '2');
  await assert.rejects(sql(`insert into public.beauty_requests values
    (2,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');`), /foreign key/);
  await assert.rejects(sql(`insert into public.beauty_evaluations values
    (2,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');`), /foreign key/);
});

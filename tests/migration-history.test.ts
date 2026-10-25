import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const canonical = readFileSync('tests/hosted-migrations-canonical.sql', 'utf8');
const hosted = [...canonical.matchAll(/^-- BEGIN (\d{14})_([^\r\n]+)$/gm)]
  .map(([, version, name]) => ({ version, name }));
const local = readdirSync('supabase/migrations')
  .filter(file => /^\d{14}_.+\.sql$/.test(file))
  .map(file => ({ version: file.slice(0, 14), name: file.slice(15, -4) }))
  .sort((a, b) => a.version.localeCompare(b.version));

test('migration history must be reconciled before any hosted db push', () => {
  const hostedVersions = new Set(hosted.map(migration => migration.version));
  const localVersions = new Set(local.map(migration => migration.version));
  assert.equal(hosted.length, 21, 'The pinned hosted catalog changed; review it before planning a push');
  assert.equal(local.length, 35, 'The local migration directory changed; review the mapping');
  assert.equal(hostedVersions.size, hosted.length, 'Hosted versions must be unique');
  assert.equal(localVersions.size, local.length, 'Local versions must be unique');

  const hostedLatest = hosted.at(-1)!.version;
  const legacyLocal = local.filter(migration => migration.version <= hostedLatest);
  const forwardLocal = local.filter(migration => migration.version > hostedLatest);
  const unmatchedLegacy = legacyLocal.filter(migration => !hostedVersions.has(migration.version));
  const unmatchedHosted = hosted.filter(migration => !localVersions.has(migration.version));

  assert.equal(legacyLocal.length, 18);
  assert.equal(unmatchedLegacy.length, 18,
    'Legacy files with different versions cannot be passed directly to the hosted CLI');
  assert.equal(unmatchedHosted.length, 21);
  assert.deepEqual(forwardLocal.map(migration => migration.name), [
    'atomic_checkout',
    'payment_reference_recovery',
    'product_stock_after_publication',
    'explicit_data_api_grants',
    'revoke_catalog_archive_public_execute',
    'provider_oauth_token_ciphertext_compat',
    'beauty_requests',
    'beauty_retention',
    'beauty_catalog_evaluations',
    'beauty_foreign_key_indexes',
    'consultation_private_outbox',
    'consultation_reply_outbox',
    'consultation_case_states',
    'consultation_automatic_reply_audit',
    'consultation_read_states',
    'consultation_intelligence_shadow',
    'consultation_optional_ai_consent',
  ]);
  // This inventories a mismatch, not the exact behavior of Supabase CLI against a linked project.
  // It intentionally provides no operation that repairs history or applies migrations.
});


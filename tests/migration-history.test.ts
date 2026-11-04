import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync('tests/fixtures/remote-migrations-20261104.json','utf8'));
const files = readdirSync('supabase/migrations').filter(f => /^\d{14}_.+\.sql$/.test(f)).sort();
const normalize = (sql: string) => sql.replace(/\r\n/g,'\n');
test('active history exactly matches the read-only production snapshot, without pending legacy proposals',()=>{
  assert.equal(snapshot.projectRef,'jfjzpwlrhzqbcrvqxhzf');
  assert.equal(snapshot.migrations.length,41);
  assert.deepEqual(files,snapshot.migrations.map((m:any)=>`${m.version}_${m.name}.sql`));
  assert.equal(new Set(snapshot.migrations.map((m:any)=>m.version)).size,41);
  for(const m of snapshot.migrations){
    const actual=normalize(readFileSync(`supabase/migrations/${m.version}_${m.name}.sql`,'utf8'));
    assert.equal(createHash('sha256').update(actual).digest('hex'),m.sha256,m.name+' must preserve executed SQL');
  }
});
test('original local migrations remain intact as isolated regression fixtures, outside deployment discovery',()=>{
  const legacy=readdirSync('supabase/legacy-migrations').filter(f=>f.endsWith('.sql'));
  assert.equal(legacy.length,41);
  assert.ok(legacy.includes('20261010010000_atomic_checkout.sql'));
  assert.ok(!files.some(f=>f.includes('atomic_checkout')),'unapplied commercial proposals must never become pending production migrations');
});

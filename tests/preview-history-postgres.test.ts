import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const database=process.env.HOSTED_REPLAY_TEST_DATABASE_URL!;
const target=new URL(database);assert.equal(target.hostname,'127.0.0.1');assert.equal(target.pathname,'/victoriosa_hosted_replay_test');
target.searchParams.set('sslmode','disable');
const sql=(input:string)=>execFileSync(process.env.PSQL_PATH||'psql',[database,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',windowsHide:true}).trim();
const cli=process.env.SUPABASE_CLI_PATH||'supabase';
test('actual Supabase CLI reproduces missing versions, then finds zero pending SQL without history repair',()=>{
 const snapshot=JSON.parse(readFileSync('tests/fixtures/remote-migrations-20261104.json','utf8'));
 sql('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);');
 for(const m of snapshot.migrations)sql(`insert into supabase_migrations.schema_migrations(version,name) values('${m.version}','${m.name}');`);
 const before=sql('select json_agg(m order by version) from supabase_migrations.schema_migrations m');
 const work=(source:string)=>{
  const directory=mkdtempSync(join(tmpdir(),'victoriosas-history-cli-'));
  execFileSync(cli,['init','--workdir',directory],{stdio:'pipe',windowsHide:true});
  const dest=join(directory,'supabase','migrations');mkdirSync(dest,{recursive:true});
  for(const file of readdirSync(source).filter(f=>f.endsWith('.sql')))copyFileSync(join(source,file),join(dest,file));
  // Explicit loopback URL plus dry-run. No production credentials or link exist.
  const r=spawnSync(cli,['db','push','--dry-run','--db-url',target.href,'--workdir',directory],{encoding:'utf8',windowsHide:true,timeout:30000});
  return {status:r.status,output:(r.stdout||'')+(r.stderr||'')};
 };
 const legacy=work('supabase/legacy-migrations');
 assert.notEqual(legacy.status,0);assert.match(legacy.output,/Remote migration versions not found in local migrations directory/);
 const canonical=work('supabase/migrations');
 assert.equal(canonical.status,0,canonical.output);assert.match(canonical.output,/up.to.date|No.*migrations/i);
 assert.equal(sql('select json_agg(m order by version) from supabase_migrations.schema_migrations m'),before);
 assert.equal(sql("select count(*) from information_schema.tables where table_schema='public'"),'0','dry-run must not execute any recovered SQL');
 console.log('Supabase CLI: original error reproduced; canonical history has zero pending migrations; no history or schema changed.');
});

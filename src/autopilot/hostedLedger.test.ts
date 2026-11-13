import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedLedgerSql } from '../../scripts/hosted-ledger-sql.mjs';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { prepareHostedHost } from '../../scripts/hosted-ledger-host.mjs';
import { cloudBinding } from './cloudMissionStore';

test('hosted SQL assembly preserves source dollar quoting and has one transaction',async()=>{
 const sql=await hostedLedgerSql('a'.repeat(64),'juyowvmtluxfetgkckjd');
 const source=await readFile(new URL('../../supabase/staged/six_agent_local_operator_20261109.sql',import.meta.url),'utf8');
 assert.ok(sql.includes(source),'embedded SQL must remain byte-for-byte intact');
 assert.equal((sql.match(/^begin;\r?$/gm)||[]).length,1);
 assert.equal((sql.match(/^commit;\r?$/gm)||[]).length,1);
 await assert.rejects(hostedLedgerSql('a'.repeat(64),'jfjzpwlrhzqbcrvqxhzf'));
 await assert.rejects(hostedLedgerSql("';select 1;--",'juyowvmtluxfetgkckjd'));
});
test('offline hosted seed and binding are reproducible across fresh directories',async()=>{
 const a=await mkdtemp(path.join(tmpdir(),'p0c-seed-a-')),b=await mkdtemp(path.join(tmpdir(),'p0c-seed-b-'));
 try {
   const first=await prepareHostedHost(a),second=await prepareHostedHost(b);
   assert.equal(first.resources.baseSha,second.resources.baseSha);
   assert.equal(cloudBinding(first),cloudBinding(second));
 } finally {await rm(a,{recursive:true,force:true});await rm(b,{recursive:true,force:true});}
});

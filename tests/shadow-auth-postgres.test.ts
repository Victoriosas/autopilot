import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';

const database=process.env.AUTOPILOT_TEST_DATABASE_URL;
const psql=process.env.PSQL_PATH || 'psql';
function sql(query:string):Promise<string>{
 return new Promise((resolve,reject)=>{
  const child=execFile(psql,[database!,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],{windowsHide:true},(err,out,stderr)=>err?reject(new Error(stderr)):resolve(out.trim()));
  child.stdin!.end(query);
 });
}

test('one-time shadow authorization migration', {skip:!database,timeout:60000}, async()=>{
 const target=new URL(database!);
 assert.ok(['localhost','127.0.0.1'].includes(target.hostname),'Only loopback databases allowed');
 assert.equal(target.pathname,'/autopilot_orchestrator_test','Dedicated disposable database required');

 await sql("drop function if exists public.consume_autopilot_shadow_run_authorization(text); drop table if exists public.autopilot_shadow_run_authorizations cascade;");
 await sql(readFileSync('supabase/migrations/20260914234500_production_shadow_once.sql','utf8'));

 const tokenHash='a'.repeat(64);
 await sql(`insert into public.autopilot_shadow_run_authorizations(token_hash,limits,expires_at) values('${tokenHash}','{"maxCandidates":3,"maxAiCalls":2,"durationMs":15000}'::jsonb,now()+interval '5 minutes');`);
 const first=await sql(`set role service_role; select public.consume_autopilot_shadow_run_authorization('${tokenHash}')::text;`);
 assert.match(first,/"maxCandidates": 3/);
 const second=await sql(`set role service_role; select coalesce(public.consume_autopilot_shadow_run_authorization('${tokenHash}')::text,'NULL');`);
 assert.equal(second,'NULL');
 await assert.rejects(sql(`set role anon; select public.consume_autopilot_shadow_run_authorization('${tokenHash}');`),/permission denied/);
});

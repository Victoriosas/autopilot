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

test('one-time shadow authorization migrations', {skip:!database,timeout:60000}, async()=>{
 const target=new URL(database!);
 assert.ok(['localhost','127.0.0.1'].includes(target.hostname),'Only loopback databases allowed');
 assert.equal(target.pathname,'/autopilot_orchestrator_test','Dedicated disposable database required');

 await sql("drop function if exists public.consume_autopilot_shadow_run_authorization_id(uuid); drop function if exists public.consume_autopilot_shadow_run_authorization(text); drop table if exists public.autopilot_shadow_run_authorizations cascade;");
 await sql(readFileSync('supabase/migrations/20260914234500_production_shadow_once.sql','utf8'));
 await sql(readFileSync('supabase/migrations/20260914240000_shadow_authorization_by_id.sql','utf8'));

 const tokenHash='a'.repeat(64);
 await sql(`insert into public.autopilot_shadow_run_authorizations(token_hash,limits,expires_at) values('${tokenHash}','{"maxCandidates":3,"maxAiCalls":2,"durationMs":15000}'::jsonb,now()+interval '5 minutes');`);
 const first=await sql(`set role service_role; select public.consume_autopilot_shadow_run_authorization('${tokenHash}')::text;`);
 assert.match(first,/"maxCandidates": 3/);
 const second=await sql(`set role service_role; select coalesce(public.consume_autopilot_shadow_run_authorization('${tokenHash}')::text,'NULL');`);
 assert.equal(second,'NULL');

 const capabilityId='123e4567-e89b-42d3-a456-426614174000';
 const secondHash='b'.repeat(64);
 await sql(`reset role; insert into public.autopilot_shadow_run_authorizations(id,token_hash,limits,expires_at) values('${capabilityId}','${secondHash}','{"maxCandidates":2,"maxAiCalls":1,"durationMs":10000}'::jsonb,now()+interval '5 minutes');`);
 const byId=await sql(`set role service_role; select public.consume_autopilot_shadow_run_authorization_id('${capabilityId}'::uuid)::text;`);
 assert.match(byId,/"maxCandidates": 2/);
 const byIdReplay=await sql(`set role service_role; select coalesce(public.consume_autopilot_shadow_run_authorization_id('${capabilityId}'::uuid)::text,'NULL');`);
 assert.equal(byIdReplay,'NULL');

 await assert.rejects(sql(`set role anon; select public.consume_autopilot_shadow_run_authorization('${tokenHash}');`),/permission denied/);
 await assert.rejects(sql(`set role anon; select public.consume_autopilot_shadow_run_authorization_id('${capabilityId}'::uuid);`),/permission denied/);
});

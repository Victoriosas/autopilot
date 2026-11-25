import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sql,literal,runnerSql} from './fixtures/directorSupervisionLab';
import {runCloudOffice,type CloudClaim,type CloudRpc} from '../src/autopilot/cloudRuntimeV3';
const sha='a'.repeat(40),subject='cloud-v3-isolated-test';
const source=(name:string)=>readFile(new URL('../'+name,import.meta.url),'utf8');
const claims=(role='autopilot_cloud_runtime',sub=subject)=>`set request.jwt.claims=${literal({role,sub})};set role ${role};`;
const params:Record<string,string[]>= {cloud_v3_start:['p_sha'],cloud_v3_claim:['p_parent','p_token','p_agent','p_sha'],
 cloud_v3_measure:['p_id','p_token','p_sha'],cloud_v3_finish:['p_id','p_token','p_sha','p_result'],cloud_v3_status:[]};
const rpc:CloudRpc=async(name,args)=>{
 assert.ok(Object.hasOwn(params,name));
 const values=params[name].map(k=>args[k]===null?'null':literal(args[k])+(k==='p_result'?'::jsonb':'')).join(',');
 return JSON.parse(await sql(`${claims()}select coalesce(to_json(public.${name}(${values})),'null'::json);`));
};
test('cloud office SQL enforces scoped roles, single owner, fencing, persisted results and blocked-history preservation', {timeout:120000},async()=>{
 await sql(`create schema auth;create function auth.role() returns text language sql stable as 'select current_setting(''request.jwt.claim.role'',true)';
 create role service_role;create role anon;create role authenticated;
 create role autopilot_cloud_runner login password ${literal(process.env.DIRECTOR_LAB_RUNNER_PASSWORD)} nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
 grant connect on database victoriosa_director_supervision_lab to autopilot_cloud_runner;grant usage on schema public to autopilot_cloud_runner;
 create table public.agent_tasks(id text primary key,goal text not null,actor text not null,action text not null,status text not null,input jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.agent_audit_events(id bigint generated always as identity primary key,task_id text references public.agent_tasks(id),event_type text,details jsonb,created_at timestamptz default now());
 alter table public.agent_tasks enable row level security;alter table public.agent_audit_events enable row level security;
 set autopilot.isolated_project_ref='juyowvmtluxfetgkckjd';
 ${await source('supabase/staged/cloud_runtime_v3_isolated_fixture_REVIEW_ONLY.sql')}
 ${await source('supabase/staged/six_agent_queue_20261025.sql')}
 ${await source('supabase/staged/20261122045000_six_agent_fail_lease_fencing.sql')}
 ${await source('supabase/staged/cloud_runtime_v3_REVIEW_ONLY.sql')}
 grant autopilot_cloud_runtime,autopilot_cloud_reader to autopilot_cloud_runner;
 insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input)
 select 'legacy-blocked:'||a,'preserved','old','read','blocked',a,'{"private":"must-not-leak"}' from unnest(array['director','software','infrastructure','consultations','followup','reports']) a;
 insert into public.agent_audit_events(task_id,event_type,details) select id,'legacy_event','{"sentinel":"must-not-leak"}' from public.agent_tasks;
 insert into public.consultation_requests values('00000000-0000-4000-8000-000000000001',now()+interval '1 day','{"private":"must-not-leak"}'),('00000000-0000-4000-8000-000000000002',now()-interval '1 day','{}');`);
 const legacy=await sql(`select jsonb_agg(to_jsonb(t) order by id) from public.agent_tasks t where status='blocked';`);
 await assert.rejects(rpc('cloud_v3_start',{p_sha:sha}),/rejected/);
 await sql(`insert into public.agent_tasks(id,goal,actor,action,status,input) values('cloud-v3:control','authorized local fixture','cloud-v3-policy','read','awaiting_approval',${literal({enabled:true,environment:'isolated',scheduler:'supabase_cron',github_disabled:true,no_send:true,subject,reviewed_sha:sha,not_before:'2026-01-01',expires_at:'2099-01-01'})}::jsonb);`);
 const control=(patch:Record<string,unknown>)=>sql(`update public.agent_tasks set input=input||${literal(patch)}::jsonb where id='cloud-v3:control';`);
 await control({scheduler:'manual_once',slot:1});
 assert.equal(await sql(`${claims()}select public.cloud_v3_authorized('${sha}');`),'t');
 await control({environment:'production'});
 assert.equal(await sql(`${claims()}select public.cloud_v3_authorized('${sha}');`),'f');
 await control({environment:'isolated',scheduler:'supabase_cron'});
 for(const patch of [{enabled:false},{enabled:null},{scheduler:'github'},{github_disabled:false},{no_send:false},{subject:'wrong'},{reviewed_sha:'b'.repeat(40)},{expires_at:'2020-01-01'},{not_before:'2099-01-01'}]){
  await sql(`begin;update public.agent_tasks set input=input||${literal(patch)}::jsonb where id='cloud-v3:control';commit;`);
  await assert.rejects(rpc('cloud_v3_start',{p_sha:sha}));
  await control({enabled:true,environment:'isolated',scheduler:'supabase_cron',github_disabled:true,no_send:true,subject,reviewed_sha:sha,not_before:'2026-01-01',expires_at:'2099-01-01'});
 }
 for(const role of ['anon','authenticated','autopilot_cloud_reader'])await assert.rejects(sql(`${claims(role)}select public.cloud_v3_start('${sha}');`));
 await assert.rejects(sql(`${claims()}select * from public.agent_tasks;`));
 await assert.rejects(sql(`${claims('autopilot_cloud_reader')}select public.cloud_v3_finish('x',null,'${sha}','{}');`));
 await assert.rejects(sql(`${claims()}select * from public.six_agent_claim('software',60);`));
 // Separate authenticated SCRAM connection, certificate verify-full, actual scoped role.
 assert.equal(await runnerSql(`${claims('autopilot_cloud_reader')}select jsonb_array_length(public.cloud_v3_status()->'agents');`),'6');
 const started=await Promise.all([rpc('cloud_v3_start',{p_sha:sha}),rpc('cloud_v3_start',{p_sha:sha})]);
 assert.equal(started.filter(Boolean).length,1);
 const parent=started.find(Boolean) as CloudClaim;
 const child=await rpc('cloud_v3_claim',{p_parent:parent.task_id,p_token:parent.claim_token,p_agent:'software',p_sha:sha}) as CloudClaim;
 assert.ok(child);
 const finish=(t:CloudClaim,result:unknown)=>rpc('cloud_v3_finish',{p_id:t.task_id,p_token:t.claim_token,p_sha:sha,p_result:result});
 assert.equal(await finish(child,{}),false);
 assert.equal(await finish(child,{kind:'artifact_verified',sha:'b'.repeat(40)}),false);
 // Expired child cannot write a heartbeat/result or consume another attempt.
 await sql(`update public.agent_tasks set lease_until=now()-interval '1 second' where id=${literal(child.task_id)};`);
 assert.equal(await finish(child,{kind:'artifact_verified',sha}),false);
 // Parent recovery changes its fence too; stale child from earlier generation is denied.
 await sql(`update public.agent_tasks set lease_until=now()-interval '1 second' where id=${literal(parent.task_id)};`);
 const recovered=await rpc('cloud_v3_start',{p_sha:sha}) as CloudClaim;
 assert.notEqual(recovered.claim_token,parent.claim_token);
 await sql(`update public.agent_tasks set lease_until=now()+interval '30 seconds' where id=${literal(child.task_id)};`);
 assert.equal(await finish(child,{kind:'artifact_verified',sha}),false);
 await sql(`update public.agent_tasks set lease_until=now()-interval '1 second' where id=${literal(child.task_id)};`);
 await assert.rejects(rpc('cloud_v3_claim',{p_parent:parent.task_id,p_token:parent.claim_token,p_agent:'reports',p_sha:sha}));
 await assert.rejects(rpc('cloud_v3_claim',{p_parent:recovered.task_id,p_token:recovered.claim_token,p_agent:null,p_sha:sha}));
 // Complete real SQL/runtime executors; only external health is deterministic fixture here.
 let healthCalls=0;
 let first=true;
 const result=await runCloudOffice({enabled:true,reviewedSha:sha,artifactSha:sha,
  rpc:async(n,a)=>{if(n==='cloud_v3_start'&&first){first=false;return recovered;}return rpc(n,a);},
  health:async()=>{healthCalls++;return {code:'ok',status:200,healthy:true};}});
 assert.equal(result.tasksClaimed,6);assert.equal(healthCalls,1);
 assert.equal((await runCloudOffice({enabled:true,reviewedSha:sha,artifactSha:sha,rpc})).tasksClaimed,0);
 assert.equal(await sql(`select count(*) from public.agent_tasks where actor='cloud-v3-runtime' and status='completed';`),'6');
 assert.equal(await sql(`select count(*) from public.agent_audit_events where event_type='cloud_v3_heartbeat';`),'6');
 assert.equal(await sql(`select count(*) from public.agent_audit_events where event_type='cloud_v3_result';`),'6');
 const status=JSON.parse(await sql(`${claims('autopilot_cloud_reader')}select public.cloud_v3_status();`));
 assert.equal(status.environment,'isolated');assert.equal(status.agents.length,6);assert.ok(status.agents.every((a:any)=>a.completed===1&&a.results===1&&a.lastHeartbeat));
 assert.equal(JSON.stringify(status).includes('must-not-leak'),false);
 assert.equal(await sql(`select jsonb_agg(to_jsonb(t) order by id) from public.agent_tasks t where id like 'legacy-blocked:%';`),legacy);
 assert.equal(await sql(`select count(*) from public.agent_audit_events where event_type='legacy_event';`),'6');
 // Revocation is checked on every procedure, not only at wake/start.
 await control({enabled:false});await assert.rejects(finish(recovered,{}));
 console.log(JSON.stringify({environment:'disposable_postgres_scram_tls',realCloud:false,roles:6,completed:6,heartbeats:6,results:6,legacyBlockedPreserved:6,health:'fixture_only',noSend:true}));
});

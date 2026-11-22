import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { AGENT_IDS } from '../src/autopilot/sixAgentControlPlane';
import { runDirectorSyntheticMission, directorSlot, type DirectorCloudGrant } from '../src/autopilot/directorCloudMission';
import { directorCloudStore, labConnection, literal, runnerSql, sql } from './fixtures/directorSupervisionLab';

const source=(name:string)=>import('node:fs/promises').then(fs=>fs.readFile(path.isAbsolute(name)?name:new URL(`../${name}`,import.meta.url),'utf8'));
const reviewedSha='8892d2b10c204627b1b5efc661e8e052ef247cc7';

test('Director cloud adapter is synthetic-only, TLS/SCRAM-bound, slot-idempotent and recoverable',
  {timeout:120_000},async()=>{
  // Explicit, disposable, loopback-only PostgreSQL. Never connect to a Supabase URL.
  const configured=process.env.DIRECTOR_LAB_DATABASE_URL;
  for(const invalid of [
    'postgresql://lab_owner@db.example.invalid:5432/victoriosa_director_supervision_lab',
    'postgresql://lab_owner@127.0.0.1:5432/postgres',
    'postgresql://lab_owner@127.0.0.1:5432/victoriosa_director_supervision_lab?sslmode=disable',
  ]) {process.env.DIRECTOR_LAB_DATABASE_URL=invalid;assert.throws(labConnection,/disposable_loopback_lab_required/);}
  if(configured)process.env.DIRECTOR_LAB_DATABASE_URL=configured;
  const {store,binding}=directorCloudStore();
  const db=labConnection();
  const runnerPassword=process.env.DIRECTOR_LAB_RUNNER_PASSWORD;
  assert.ok(runnerPassword&&process.env.DIRECTOR_LAB_RUNNER_PASSFILE&&process.env.DIRECTOR_LAB_TLS_ROOT_CERT);
  await sql(`begin;
    create role autopilot_cloud_runner login password ${literal(runnerPassword)} nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant connect on database victoriosa_director_supervision_lab to autopilot_cloud_runner;
    grant usage on schema public to autopilot_cloud_runner;
    create schema auth;create function auth.role() returns text language sql stable as 'select current_setting(''request.jwt.claim.role'',true)';
    do $$ begin
      create role service_role;create role anon;create role authenticated;
    end $$;
    create table public.agent_tasks(id text primary key,goal text not null,actor text not null,action text not null,
      status text not null,input jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.agent_audit_events(id bigint generated always as identity primary key,
      task_id text,event_type text,details jsonb,created_at timestamptz default now());
    ${await source('supabase/staged/six_agent_queue_20261025.sql')}
    ${await source('supabase/staged/six_agent_mission_checkpoint_20261109.sql')}
    ${await source(process.env.DIRECTOR_LAB_LEASE_FIX_SQL??'')}
    ${await source('supabase/staged/six_agent_director_synthetic_20261122.sql')}
    create table public.director_lab_control(reject_version integer,revoke_version integer);
    insert into public.director_lab_control values(null,null);
    create function public.director_lab_fault() returns trigger language plpgsql as $trigger$
    declare v integer; fault record;
    begin
      if new.event_type<>'mission_checkpoint_saved' then return new;end if;
      v=(new.details->>'checkpoint_version')::integer;
      select * into fault from public.director_lab_control limit 1;
      if fault.reject_version=v then raise exception 'synthetic_checkpoint_rejected';end if;
      if fault.revoke_version=v then
        update public.agent_tasks set input=jsonb_set(jsonb_set(input,'{director_authorization,active}','false'::jsonb),
          '{director_authorization,revision}',to_jsonb((input->'director_authorization'->>'revision')::integer+1))
          where id=new.task_id;
        insert into public.agent_audit_events(task_id,event_type,details) values(new.task_id,'director_authorization_revoked',
          jsonb_build_object('reason','lab_mid_operation_revoke','revision',3));
      end if;
      return new;
    end $trigger$;
    create trigger director_lab_fault before insert on public.agent_audit_events for each row execute function public.director_lab_fault();
    commit;`);
  const plan=[{id:'observe-ledger',task:'observe synthetic ledger',depends_on:[]},
    {id:'verify-observation',task:'verify persisted observation',depends_on:['observe-ledger']}];
  const input={mission_schema_version:'1',goal_version:1,plan_version:1,plan,
    restrictions:['synthetic_only','no_send','no_dispatch'],no_send:true,no_dispatch:true,director_fixture_version:'1',
    completion_criteria:['six canonical roles observed','durable observation independently verified']};
  const rows=AGENT_IDS.map(agent=>{
    const id=`synthetic-director-metric-${agent}`;
    const status=agent==='software'?'completed':agent==='infrastructure'?'blocked':agent==='consultations'?'running':'queued';
    const evidence=agent==='software'?'private-sentinel-must-not-leak':null;
    const cols=agent==='consultations'?'id,goal,actor,action,status,agent_id,attempt_count,input,completed_evidence,lease_until'
      :'id,goal,actor,action,status,agent_id,attempt_count,input,completed_evidence';
    const values=[literal(id),literal('Synthetic metric row'),literal('synthetic-director-lab'),literal('read'),literal(status),literal(agent),
      '0',literal({director_fixture_version:'1',no_send:true,no_dispatch:true})+'::jsonb',literal(evidence)];
    if(agent==='consultations')values.push("clock_timestamp()-interval '1 minute'");
    return `insert into public.agent_tasks(${cols}) values(${values.join(',')});`;
  }).join('\n');
  await sql(`insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input)
    values('synthetic-director-supervision','Observe approved synthetic six-agent aggregates','synthetic-director-lab','observe','queued','director',
      ${literal(input)}::jsonb || jsonb_build_object('host_binding',${literal(binding)}));
    ${rows}`);
  const initialCheckpoint=JSON.parse(await sql(`select mission_checkpoint from public.agent_tasks
    where id='synthetic-director-supervision';`));
  const slot=directorSlot();
  const expires=new Date(Date.parse(slot)+30*60_000).toISOString().replace('.000Z','Z');
  // Regression: a valid synthetic fixture without the durable grant must not
  // let SQL NULL pass a PL/pgSQL IF guard or consume a protected attempt.
  const unapproved={missionId:'synthetic-director-supervision',binding,reviewedSha,slot,
    authorizationId:'director-auth-missing-0001',hostIdentity:'autopilot_cloud_runner',
    notBefore:slot,expiresAt:expires};
  const denied=await store.directorClient(unapproved).rpc('six_agent_claim_mission',
    {p_agent:'director',p_lease_seconds:25});
  assert.deepEqual(denied.data,[],'a fixture without director_authorization cannot be claimed');
  assert.equal(denied.error,null);
  const unmodified=JSON.parse(await sql(`select json_build_object('status',status,'attempts',attempt_count,
    'token',execution_token,'checkpoint_version',mission_checkpoint_version) from public.agent_tasks
    where id='synthetic-director-supervision';`));
  assert.deepEqual(unmodified,{status:'queued',attempts:0,token:null,checkpoint_version:0},
    'denied claim leaves mission state and attempt budget unchanged');
  assert.equal(await sql(`select count(*) from public.agent_audit_events where task_id='synthetic-director-supervision';`),'0',
    'denied claim creates no audit side effect');
  await assert.rejects(()=>store.callDirectorSql('director_observe_synthetic_agents',[
    unapproved.missionId,binding,reviewedSha,slot,unapproved.authorizationId]));
  await assert.rejects(()=>store.callDirectorSql('director_read_mission',[
    unapproved.missionId,binding,reviewedSha,slot,unapproved.authorizationId]));
  await assert.rejects(()=>runnerSql(`select * from public.six_agent_director_claim(
    null::text,${literal(binding)},${literal(reviewedSha)},${literal(slot)},${literal(unapproved.authorizationId)},25);`));
  assert.equal(await runnerSql(`select public.six_agent_director_checkpoint(
    null::text,null::text,null::uuid,null::integer,null::text,null::text,null::jsonb,
    null::text,null::text,null::text,null::text);`),'f','checkpoint rejects null security fields');
  assert.equal(await runnerSql(`select public.six_agent_director_complete(
    null::text,null::uuid,null::text,null::text,null::text,null::text,null::text);`),'f','complete rejects null security fields');
  assert.equal(await runnerSql(`select public.six_agent_director_fail(
    null::text,null::uuid,null::text,null::text,null::text,null::text,null::text);`),'f','fail rejects null security fields');
  await assert.rejects(()=>runnerSql(`select public.director_observe_synthetic_agents(
    ${literal(unapproved.missionId)},${literal(binding)},${literal(reviewedSha)},${literal(slot)},null::text);`));
  await assert.rejects(()=>runnerSql(`select public.director_read_mission(
    ${literal(unapproved.missionId)},${literal(binding)},${literal(reviewedSha)},${literal(slot)},null::text);`));
  await assert.rejects(()=>sql(`select public.director_authorize(null::text,${literal(binding)},${literal(reviewedSha)},
    ${literal(slot)},${literal('director-auth-null-0001')},${literal(expires)}::timestamptz,0);`));
  assert.equal(await sql(`select public.director_authorize(${literal('synthetic-director-supervision')},${literal(binding)},
    ${literal(reviewedSha)},${literal(slot)},${literal('director-auth-lab-0001')},${literal(expires)}::timestamptz,0);`),'t');
  const validAuthorization=JSON.parse(await sql(`select input->'director_authorization' from public.agent_tasks
    where id='synthetic-director-supervision';`));
  const authRow=JSON.parse(await sql(`select input->'director_authorization'->'grant' from public.agent_tasks
    where id='synthetic-director-supervision';`));
  let grant:DirectorCloudGrant={missionId:'synthetic-director-supervision',binding,reviewedSha,slot,
    authorizationId:authRow.id,hostIdentity:'autopilot_cloud_runner',notBefore:authRow.notBefore,expiresAt:authRow.expiresAt};
  assert.equal(store.hostIdentity,'autopilot_cloud_runner');
  const invalidAuthorizations:unknown[]=[null,{...validAuthorization,active:null},{...validAuthorization,grant:null},
    ...['id','missionId','agentRole','binding','reviewedSha','hostRole','slot','notBefore','expiresAt','no_send','no_dispatch']
      .map(field=>({...validAuthorization,grant:Object.fromEntries(Object.entries(validAuthorization.grant)
        .filter(([key])=>key!==field))}))];
  for(const invalidAuthorization of invalidAuthorizations) {
    await sql(`update public.agent_tasks set input=jsonb_set(input,'{director_authorization}',
      ${literal(invalidAuthorization)}::jsonb) where id='synthetic-director-supervision';`);
    const deniedClaim=await store.directorClient(grant).rpc('six_agent_claim_mission',{p_agent:'director',p_lease_seconds:25});
    assert.deepEqual(deniedClaim.data,[],'null or incomplete durable grants cannot claim');
    await assert.rejects(()=>store.callDirectorSql('director_observe_synthetic_agents',[
      grant.missionId,binding,reviewedSha,slot,grant.authorizationId]));
    await assert.rejects(()=>store.callDirectorSql('director_read_mission',[
      grant.missionId,binding,reviewedSha,slot,grant.authorizationId]));
  }
  await sql(`update public.agent_tasks set input=jsonb_set(input,'{director_authorization}',
    ${literal(validAuthorization)}::jsonb) where id='synthetic-director-supervision';`);
  assert.deepEqual(JSON.parse(await sql(`select json_build_object('status',status,'attempts',attempt_count,
    'token',execution_token,'version',mission_checkpoint_version) from public.agent_tasks
    where id='synthetic-director-supervision';`)),{status:'queued',attempts:0,token:null,version:0},
    'malformed grants deny claims without changing task state');
  assert.equal(await sql(`select count(*) from public.agent_audit_events where task_id='synthetic-director-supervision';`),'1',
    'malformed grant denials do not append audit events');
  const preflightClaim=await store.directorClient(grant).rpc('six_agent_claim_mission',{p_agent:'director',p_lease_seconds:25});
  assert.equal(preflightClaim.data?.length,1,'valid durable grant can claim in the isolated lab');
  const preflightToken=preflightClaim.data[0].claim_token;
  await sql(`update public.agent_tasks set input=input-'director_authorization' where id='synthetic-director-supervision';`);
  const guardedCheckpoint={mission_state:'in_progress',current_step_id:'observe-ledger',completed_steps:[],pending_steps:['observe-ledger'],
    results:[],artifacts:[],test_evidence:[],worktree:{branch:'negative-test',sha:reviewedSha}};
  for(const procedureValues of [
    ['six_agent_director_checkpoint',['synthetic-director-supervision','synthetic-director-supervision',preflightToken,1,'no-auth-cp','director-cloud-synthetic',guardedCheckpoint,binding,reviewedSha,slot,grant.authorizationId]],
    ['six_agent_director_fail',['synthetic-director-supervision',preflightToken,'no-auth-fail',binding,reviewedSha,slot,grant.authorizationId]],
    ['six_agent_director_complete',['synthetic-director-supervision',preflightToken,`director_verified:${reviewedSha}:${slot}`,binding,reviewedSha,slot,grant.authorizationId]],
  ] as const) {
    assert.equal(await store.callDirectorSql(procedureValues[0],[...procedureValues[1]]),'false',
      `${procedureValues[0]} rejects a running lease whose durable grant disappeared`);
  }
  assert.deepEqual(JSON.parse(await sql(`select json_build_object('status',status,'attempts',attempt_count,'token',execution_token,
    'version',mission_checkpoint_version,'checkpoint',mission_checkpoint) from public.agent_tasks
    where id='synthetic-director-supervision';`)),{
      status:'running',attempts:1,token:preflightToken,version:0,checkpoint:initialCheckpoint,
    },'missing authorization cannot checkpoint, fail or complete a live claim');
  assert.equal(await sql(`select count(*) from public.agent_audit_events where task_id='synthetic-director-supervision';`),'2',
    'failed guarded writes do not append audit events');
  // Return only the disposable fixture to its original state before the existing concurrency/recovery scenario.
  await sql(`delete from public.agent_audit_events where task_id='synthetic-director-supervision';
    update public.agent_tasks set input=input-'director_authorization',status='queued',attempt_count=0,
      lease_until=null,execution_token=null,mission_checkpoint_version=0,mission_checkpoint=${literal(initialCheckpoint)}::jsonb
      where id='synthetic-director-supervision';
    select public.director_authorize(${literal('synthetic-director-supervision')},${literal(binding)},
      ${literal(reviewedSha)},${literal(slot)},${literal('director-auth-lab-0001')},${literal(expires)}::timestamptz,0);`);
  const reauthorized=JSON.parse(await sql(`select input->'director_authorization'->'grant' from public.agent_tasks
    where id='synthetic-director-supervision';`));
  grant={...grant,authorizationId:reauthorized.id,notBefore:reauthorized.notBefore,expiresAt:reauthorized.expiresAt};
  assert.equal(await sql(`select count(*) from public.agent_audit_events where task_id='synthetic-director-supervision';`),'1');
  assert.equal(await sql(`update public.director_lab_control set reject_version=1; select 1;`),'1');

  // Two workers race the exact same mission/slot. One consumes the claim; checkpoint 1 is rejected and rolls back.
  const concurrent=await Promise.allSettled([
    runDirectorSyntheticMission(store,grant),runDirectorSyntheticMission(store,grant),
  ]);
  assert.equal(concurrent.filter(r=>r.status==='rejected').length,1);
  let state=JSON.parse(await sql(`select json_build_object('status',status,'version',mission_checkpoint_version,
    'attempts',attempt_count,'checkpoint',mission_checkpoint,'lease',lease_until>clock_timestamp(),
    'token',execution_token) from public.agent_tasks where id='synthetic-director-supervision';`));
  assert.equal(state.version,0);assert.equal(state.attempts,1);assert.equal(state.status,'running');
  assert.deepEqual(state.checkpoint.completed_steps,[]);
  assert.equal(await sql(`select count(*) from public.agent_audit_events where task_id='synthetic-director-supervision'
    and event_type='mission_checkpoint_saved';`),'0','checkpoint and audit roll back atomically');
  const firstToken=state.token;
  await runDirectorSyntheticMission(store,grant).catch(()=>{});
  assert.equal(JSON.parse(await sql(`select attempt_count from public.agent_tasks where id='synthetic-director-supervision';`)),1,
    'same slot retry while lease is live is idempotent');
  await delay(25_500);
  assert.equal(await sql(`update public.director_lab_control set reject_version=null,revoke_version=1;select 1;`),'1');

  // After lease expiry, recovery resumes through the same slot. The first checkpoint commits, then the DB revokes authorization.
  await runDirectorSyntheticMission(store,grant).catch(()=>{});
  state=JSON.parse(await sql(`select json_build_object('status',status,'version',mission_checkpoint_version,'attempts',attempt_count,
    'checkpoint',mission_checkpoint,'active',input->'director_authorization'->>'active','token',execution_token)
    from public.agent_tasks where id='synthetic-director-supervision';`));
  assert.equal(state.version,1);assert.equal(state.attempts,2);assert.equal(state.active,'false');
  assert.deepEqual(state.checkpoint.completed_steps,['observe-ledger']);
  const revokedToken=state.token;
  assert.equal(await store.callDirectorSql('six_agent_director_checkpoint',[
    'synthetic-director-supervision','synthetic-director-supervision',revokedToken,2,'revoke-denied','director-cloud-synthetic',
    state.checkpoint,binding,reviewedSha,slot,grant.authorizationId]),'false','revocation blocks subsequent checkpoint writes');
  await delay(25_500);
  const nextExpires=new Date(Date.parse(slot)+30*60_000).toISOString().replace('.000Z','Z');
  assert.equal(await sql(`select public.director_authorize(${literal('synthetic-director-supervision')},${literal(binding)},
    ${literal(reviewedSha)},${literal(slot)},${literal('director-auth-lab-0002')},${literal(nextExpires)}::timestamptz,2);`),'t');
  const staleGrantClaim=await store.directorClient(grant).rpc('six_agent_claim_mission',{p_agent:'director',p_lease_seconds:25});
  assert.deepEqual(staleGrantClaim.data,[],'old authorization id cannot claim after renewal');
  assert.equal(staleGrantClaim.error,null);
  state=JSON.parse(await sql(`select json_build_object('version',mission_checkpoint_version,'attempts',attempt_count)
    from public.agent_tasks where id='synthetic-director-supervision';`));
  assert.equal(state.version,1,'a revoked grant id cannot claim after a new authorization replaces it');
  assert.equal(state.attempts,2,'stale authorization does not acquire a new lease');
  const renewed=JSON.parse(await sql(`select input->'director_authorization'->'grant' from public.agent_tasks
    where id='synthetic-director-supervision';`));
  grant.authorizationId=renewed.id;grant.notBefore=renewed.notBefore;grant.expiresAt=renewed.expiresAt;
  await sql(`update public.director_lab_control set reject_version=null,revoke_version=null;`);
  await runDirectorSyntheticMission(store,grant);
  state=JSON.parse(await sql(`select json_build_object('status',status,'version',mission_checkpoint_version,'attempts',attempt_count,
    'checkpoint',mission_checkpoint,'lease',lease_until is not null) from public.agent_tasks where id='synthetic-director-supervision';`));
  assert.equal(state.status,'completed');assert.equal(state.version,3);assert.equal(state.attempts,3);assert.equal(state.lease,false);
  assert.deepEqual(state.checkpoint.completed_steps,['observe-ledger','verify-observation']);
  const observation=JSON.parse(state.checkpoint.results.find((r:{step_id:string})=>r.step_id==='observe-ledger').summary);
  assert.deepEqual(observation.agents.map((a:{id:string})=>a.id),AGENT_IDS);
  assert.equal(observation.no_send,true);assert.equal(observation.no_dispatch,true);
  assert.ok(!JSON.stringify(observation).includes('private-sentinel-must-not-leak'));
  const adapter=JSON.parse(await store.callDirectorSql('director_observe_synthetic_agents',[
    grant.missionId,binding,reviewedSha,slot,grant.authorizationId]));
  const independent=JSON.parse(await sql(`select coalesce(json_agg(r),'[]') from (
    select id,agent_id,status,attempt_count,updated_at,lease_until,
      case when nullif(btrim(completed_evidence),'') is null then null else 'declared' end completed_evidence
    from public.agent_tasks where actor='synthetic-director-lab' and id like 'synthetic-director-%'
      and id<>'synthetic-director-supervision' and input->>'director_fixture_version'='1' order by agent_id,id) r;`));
  assert.deepEqual(adapter,independent,'fresh SQL process independently reads the same synthetic-only ledger projection');
  assert.equal(await store.callDirectorSql('six_agent_director_complete',[
    'synthetic-director-supervision',firstToken,'director_verified:'+reviewedSha+':'+slot,binding,reviewedSha,slot,grant.authorizationId]),'false',
    'old token cannot complete a recovered mission');
  assert.equal(await store.callDirectorSql('six_agent_director_fail',[
    'synthetic-director-supervision',firstToken,'stale_test',binding,reviewedSha,slot,grant.authorizationId]),'false','old token cannot fail');
  assert.equal(await store.callDirectorSql('six_agent_director_checkpoint',[
    'synthetic-director-supervision','synthetic-director-supervision',firstToken,4,'stale-checkpoint','director-cloud-synthetic',
    state.checkpoint,binding,reviewedSha,slot,grant.authorizationId]),'false','old token cannot checkpoint');
  assert.equal(await sql(`select count(*) from public.agent_tasks where id='synthetic-director-supervision';`),'1',
    'same interval never creates a duplicate mission');
  assert.equal(await sql(`select count(*) from public.agent_tasks where agent_id<>'director' and attempt_count>0;`),'0',
    'no other agent was claimed by this run');
  assert.equal(await sql(`select count(*) from pg_extension where extname in ('pg_cron','pg_net');`),'0');
  console.log(JSON.stringify({scope:'disposable_postgres18_loopback_scram_tls',noSend:true,noDispatch:true,
    exactMission:grant.missionId,slot,checkpointRollbackBeforeVersion1:true,checkpointDurableAtVersion1:true,
    revokedMidRun:true,authorizationReauthorizedAfterLeaseExpiry:true,checkpointVersion:3,attempts:3,
    simultaneousSameMissionWorkers:2,duplicateMissionCount:1,staleTokenCheckpointFailCompleteRejected:true,
    independentSyntheticProjectionMatch:true,otherAgentClaims:0,schedulerCreated:false,hostedExecutionVerified:false}));
});

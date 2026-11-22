import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { AGENT_IDS } from '../src/autopilot/sixAgentControlPlane';
import { LAB_MISSION, labConnection, literal, sql, readAgents } from './fixtures/directorSupervisionLab';

const exec = promisify(execFile);
const source = (name:string) => readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('Director: real SQL checkpoint, rollback, process restart, fencing and no_send', {timeout:60000}, async () => {
  // Explicit command, never silently skipped or connected to a hosted database.
  const configured = process.env.DIRECTOR_LAB_DATABASE_URL;
  for (const invalid of [
    'postgresql://lab_owner@db.example.invalid:5432/victoriosa_director_supervision_lab',
    'postgresql://lab_owner@127.0.0.1:5432/postgres',
    'postgresql://lab_owner@127.0.0.1:5432/victoriosa_director_supervision_lab?sslmode=disable',
  ]) {
    process.env.DIRECTOR_LAB_DATABASE_URL=invalid;
    assert.throws(labConnection,/disposable_loopback_lab_required/);
  }
  if (configured===undefined) delete process.env.DIRECTOR_LAB_DATABASE_URL;
  else process.env.DIRECTOR_LAB_DATABASE_URL=configured;
  labConnection();
  const fixFile = process.env.DIRECTOR_LAB_LEASE_FIX_SQL;
  assert.ok(fixFile,'Provide the unmodified migration from PR #272; do not duplicate its SQL');
  const fix = await readFile(fixFile,'utf8');
  assert.equal(createHash('sha256').update(fix).digest('hex'),
    '9c36d6949b3f44c24605cf57b2bd634fc202d22708aa4b7a1c7b9bac88f7e9a1', 'Reviewed #272 migration bytes changed');
  await sql(`begin;
    do $$ begin
      if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%'
        and c.relkind in ('r','p','v','m','S','f')) then raise exception 'fresh_lab_required'; end if;
    end $$;
    create schema auth;
    create function auth.role() returns text language sql stable as 'select current_setting(''request.jwt.claim.role'',true)';
    do $$ begin
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $$;
    create table public.agent_tasks(id text primary key,goal text not null,actor text not null,action text not null,
      status text not null,input jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.agent_audit_events(id bigint generated always as identity primary key,
      task_id text references public.agent_tasks(id),event_type text,details jsonb,created_at timestamptz default now());
    ${await source('supabase/staged/six_agent_queue_20261025.sql')}
    ${await source('supabase/staged/six_agent_mission_checkpoint_20261109.sql')}
    ${fix}
    create table public.director_lab_guard(no_send boolean not null check(no_send));
    insert into public.director_lab_guard values(true);
    create function public.reject_director_audit() returns trigger language plpgsql as $trigger$
    begin
      if new.event_type='mission_checkpoint_saved' and current_setting('test.reject_director_audit',true)='on'
        then raise exception 'synthetic_audit_failure'; end if;
      return new;
    end $trigger$;
    create trigger reject_director_audit before insert on public.agent_audit_events
      for each row execute function public.reject_director_audit();
    commit;`);
  const plan = [{id:'observe-ledger',task:'observe synthetic ledger',depends_on:[]},
    {id:'verify-observation',task:'verify persisted observation',depends_on:['observe-ledger']}];
  const input = {mission_schema_version:'1',goal_version:1,plan_version:1,plan,
    restrictions:['synthetic_only','no_send','no_dispatch'],completion_criteria:['six canonical roles observed','durable observation recovered']};
  await sql(`insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input)
    values(${literal(LAB_MISSION)},'Synthetic Director observation','synthetic-supervision-lab','analyze','queued','director',${literal(input)}::jsonb);
    ${AGENT_IDS.filter(a=>a!=='director').map(a=>`insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input)
      values('synthetic-observation-${a}','Synthetic role record','synthetic-supervision-lab','read','queued','${a}','{}');`).join('\n')}`);
  const worker = (fault = false) => exec(process.execPath,['--import','tsx',
    fileURLToPath(new URL('./fixtures/directorSupervisionLab.ts',import.meta.url)),
    'director-lab-worker',...(fault?['inject-audit-failure']:[])],{
    env:{...process.env,NODE_TEST_CONTEXT:undefined},timeout:20000,maxBuffer:8192,
  });
  const state = async () => JSON.parse(await sql(`select json_build_object('status',status,'version',mission_checkpoint_version,
    'attempts',attempt_count,'checkpoint',mission_checkpoint,'lease',lease_until>clock_timestamp())
    from public.agent_tasks where id=${literal(LAB_MISSION)};`));
  const audit = async () => sql(`select count(*) from public.agent_audit_events
    where task_id=${literal(LAB_MISSION)} and event_type='mission_checkpoint_saved';`);
  await assert.rejects(worker(true), /Command failed/, 'injected audit failure interrupts without a follow-up failure write');
  const interrupted = await state();
  assert.equal(interrupted.version,1);
  assert.equal(interrupted.status,'running');
  assert.equal(interrupted.attempts,1);
  assert.deepEqual(interrupted.checkpoint.completed_steps,['observe-ledger']);
  assert.equal(await audit(),'1','checkpoint update and audit insert must roll back together');
  const saved = JSON.parse(interrupted.checkpoint.results[0].summary);
  assert.deepEqual(saved.agents.map((a:{id:string})=>a.id),AGENT_IDS);
  assert.equal(saved.noSend,true);
  assert.ok(saved.agents.every((a:{runtimeStatus:string})=>a.runtimeStatus==='unknown'));
  // An independent concurrent worker cannot take over a live lease or add an attempt.
  const busy = JSON.parse((await worker()).stdout);
  assert.deepEqual(busy.steps,[]);
  assert.equal((await state()).attempts,1);
  const oldToken = await sql(`select execution_token from public.agent_tasks where id=${literal(LAB_MISSION)};`);
  assert.equal(await sql(`select public.six_agent_checkpoint(${literal(LAB_MISSION)},${literal(LAB_MISSION)},${literal(oldToken)},1,
    'checkpoint:${LAB_MISSION}:1','director-supervision-lab',${literal(interrupted.checkpoint)}::jsonb);`),'t');
  assert.equal(await audit(),'1','exact checkpoint replay must be idempotent');
  // Real expiry, no SQL time manipulation or early lease release.
  await delay(5500);
  assert.equal((await state()).lease,false);
  assert.equal(await sql(`select public.six_agent_fail(${literal(LAB_MISSION)},${literal(oldToken)},'expired_test');`),'f');
  assert.equal(await sql(`select public.six_agent_checkpoint(${literal(LAB_MISSION)},${literal(LAB_MISSION)},${literal(oldToken)},2,
    'expired-checkpoint','expired-worker',${literal(interrupted.checkpoint)}::jsonb);`),'f');
  const recovered = JSON.parse((await worker()).stdout);
  assert.deepEqual(recovered.steps,['verify-observation'],'restart must not repeat the confirmed observation');
  const final = await state();
  assert.equal(final.status,'completed');
  assert.equal(final.version,3);
  assert.equal(final.attempts,2);
  assert.deepEqual(final.checkpoint.results[0],interrupted.checkpoint.results[0]);
  assert.equal(await audit(),'2');
  assert.equal(await sql(`select public.six_agent_complete(${literal(LAB_MISSION)},${literal(oldToken)},'stale evidence');`),'f');
  assert.equal(await sql(`select count(*) from public.agent_tasks where agent_id<>'director' and
    (status<>'queued' or attempt_count<>0 or execution_token is not null);`),'0');
  const before = await state();
  assert.deepEqual(JSON.parse((await worker()).stdout).steps,[]);
  assert.deepEqual(await state(),before,'completed cycle cannot execute again');
  assert.equal((await readAgents()).length,6);
  assert.equal(await sql(`select count(*) from pg_extension where extname in ('pg_cron','pg_net');`),'0');
  console.log(JSON.stringify({scope:'disposable_postgres_lab',noSend:true,hostedExecutionVerified:false,
    roles:[...AGENT_IDS],checkpointBeforeRestart:1,checkpointFinal:3,attempts:2,
    atomicRollbackVerified:true,duplicateReplayVerified:true,expiredTokenRejected:true,
    otherAgentsClaimed:0,schedulerCreated:false}));
});
